import { describe, expect, it, vi } from 'vitest'

import {
  API_TEST_OPERATIONS,
  DEFAULT_API_TEST_OPERATION,
  buildOperationBody,
  createIdempotencyKey,
  findOperation,
  operationLabel,
  operationUrl,
  validateApiTestForm,
  type ApiTestFormState,
  type ApiTestOperation,
} from './operations'

const QUANTITY_ERROR = '数量需为最多 14 位整数、6 位小数的数字'

function operation(value: ApiTestOperation) {
  const found = findOperation(value)
  if (!found) throw new Error(`缺少操作定义：${value}`)
  return found
}

function createForm(overrides: Partial<ApiTestFormState> = {}): ApiTestFormState {
  return {
    warehouseId: 3,
    skuId: 7,
    batchId: null,
    reservationId: null,
    qty: '10',
    idempotencyKey: 'dev-api-test-demo',
    sourceType: '',
    sourceId: '',
    sourceLineId: '',
    ...overrides,
  }
}

describe('API_TEST_OPERATIONS', () => {
  it('覆盖五个操作并映射到四个端点', () => {
    expect(API_TEST_OPERATIONS.map((item) => item.value)).toEqual([
      'increase',
      'reserve',
      'decrease_reserved',
      'decrease_available',
      'release',
    ])

    expect(operation('increase').endpoint).toBe('/inventory/increase')
    expect(operation('reserve').endpoint).toBe('/inventory/reserve')
    expect(operation('decrease_reserved').endpoint).toBe('/inventory/decrease')
    expect(operation('decrease_available').endpoint).toBe('/inventory/decrease')
    expect(operation('release').endpoint).toBe('/inventory/release')
  })

  it('预留扣减与预留释放必须引用预留单，且不允许指定批次', () => {
    for (const value of ['decrease_reserved', 'release'] as const) {
      const definition = operation(value)
      expect(definition.requiresReservation).toBe(true)
      expect(definition.allowsBatch).toBe(false)
    }
    expect(operation('release').qtyOptional).toBe(true)
    expect(operation('decrease_reserved').qtyOptional).toBe(false)
  })

  it('默认操作是库存增加，未知操作返回 undefined', () => {
    expect(DEFAULT_API_TEST_OPERATION.value).toBe('increase')
    expect(findOperation('unknown')).toBeUndefined()
  })

  it('把后端 operation_type 映射回中文操作名，未知值原样返回', () => {
    expect(operationLabel('decrease_reserved')).toBe('预留扣减（占用扣减）')
    expect(operationLabel('release_reserved')).toBe('预留释放（占用释放）')
    expect(operationLabel('future_operation')).toBe('future_operation')
  })
})

describe('validateApiTestForm', () => {
  it('完整参数没有错误', () => {
    expect(validateApiTestForm(createForm(), operation('increase'))).toEqual([])
  })

  it('仓库、SKU、数量与幂等键缺失时给出可读提示', () => {
    const errors = validateApiTestForm(
      createForm({ warehouseId: null, skuId: null, qty: '', idempotencyKey: '  ' }),
      operation('increase'),
    )
    expect(errors).toContain('请选择仓库')
    expect(errors).toContain('请选择 SKU')
    expect(errors).toContain('请填写数量')
    expect(errors).toContain('请填写幂等键')
  })

  it('数量必须匹配后端精度且大于 0', () => {
    const malformed = ['-1', '1.1234567', '123456789012345', 'abc', '1e3', '.5', '1.']
    for (const qty of malformed) {
      expect(validateApiTestForm(createForm({ qty }), operation('increase'))).toContain(
        QUANTITY_ERROR,
      )
    }
    for (const qty of ['0', '0.000000']) {
      expect(validateApiTestForm(createForm({ qty }), operation('increase'))).toContain(
        '数量必须大于 0',
      )
    }
    expect(validateApiTestForm(createForm({ qty: '0.000001' }), operation('increase'))).toEqual([])
    expect(
      validateApiTestForm(createForm({ qty: '12345678901234.123456' }), operation('increase')),
    ).toEqual([])
  })

  it('预留释放的数量可留空，但填了就必须合法', () => {
    expect(validateApiTestForm(createForm({ qty: '' }), operation('release'))).toContain(
      '请选择预留单',
    )
    expect(
      validateApiTestForm(createForm({ qty: '', reservationId: 12 }), operation('release')),
    ).toEqual([])
    expect(
      validateApiTestForm(createForm({ qty: 'x', reservationId: 12 }), operation('release')),
    ).toContain(QUANTITY_ERROR)
  })

  it('预留类操作缺少预留单时报错，非预留操作不要求', () => {
    for (const value of ['decrease_reserved', 'release'] as const) {
      expect(validateApiTestForm(createForm(), operation(value))).toContain('请选择预留单')
    }
    expect(validateApiTestForm(createForm(), operation('increase'))).not.toContain('请选择预留单')
  })

  it('不允许批次的操作用了批次会报错', () => {
    expect(
      validateApiTestForm(
        createForm({ batchId: 5, reservationId: 12 }),
        operation('decrease_reserved'),
      ),
    ).toContain('当前操作不允许指定批次')
  })

  it('幂等键与来源字段有长度上限', () => {
    expect(
      validateApiTestForm(createForm({ idempotencyKey: 'k'.repeat(129) }), operation('increase')),
    ).toContain('幂等键不能超过 128 个字符')
    expect(
      validateApiTestForm(createForm({ sourceType: 't'.repeat(65) }), operation('increase')),
    ).toContain('来源类型不能超过 64 个字符')
    expect(
      validateApiTestForm(createForm({ sourceId: 's'.repeat(129) }), operation('increase')),
    ).toContain('来源 ID 不能超过 128 个字符')
  })
})

describe('buildOperationBody', () => {
  it('库存增加携带批次并可省略批次', () => {
    expect(buildOperationBody(createForm({ batchId: 9 }), operation('increase'))).toEqual({
      warehouse_id: 3,
      sku_id: 7,
      batch_id: 9,
      qty: '10',
      idempotency_key: 'dev-api-test-demo',
    })
    expect(buildOperationBody(createForm(), operation('increase'))).not.toHaveProperty('batch_id')
  })

  it('直接扣减可带批次，预留扣减即使表单残留批次也不发送', () => {
    expect(
      buildOperationBody(createForm({ batchId: 9 }), operation('decrease_available')),
    ).toHaveProperty('batch_id', 9)

    const body = buildOperationBody(
      createForm({ batchId: 9, reservationId: 21 }),
      operation('decrease_reserved'),
    )
    expect(body.reservation_id).toBe(21)
    expect(body).not.toHaveProperty('batch_id')
  })

  it('预留释放留空数量时不发送 qty，填写时原样传递', () => {
    const emptyQty = buildOperationBody(
      createForm({ reservationId: 21, qty: '  ' }),
      operation('release'),
    )
    expect(emptyQty).not.toHaveProperty('qty')

    const partial = buildOperationBody(
      createForm({ reservationId: 21, qty: '2.5' }),
      operation('release'),
    )
    expect(partial.qty).toBe('2.5')
  })

  it('非预留操作忽略表单里残留的预留单', () => {
    expect(
      buildOperationBody(createForm({ reservationId: 21 }), operation('increase')),
    ).not.toHaveProperty('reservation_id')
  })

  it('来源字段去空白，空值整体省略', () => {
    const body = buildOperationBody(
      createForm({
        sourceType: ' dev_test ',
        sourceId: 'DEMO-1',
        sourceLineId: '  ',
      }),
      operation('increase'),
    )
    expect(body.source_type).toBe('dev_test')
    expect(body.source_id).toBe('DEMO-1')
    expect(body).not.toHaveProperty('source_line_id')
  })

  it('缺少仓库或 SKU 时拒绝组装', () => {
    expect(() =>
      buildOperationBody(createForm({ warehouseId: null }), operation('increase')),
    ).toThrow('warehouse_id 与 sku_id 为必填项')
  })
})

describe('createIdempotencyKey', () => {
  it('前缀固定、长度远小于后端上限，且可注入时间与随机源', () => {
    const key = createIdempotencyKey(1_700_000_000_000, 0.5)
    expect(key.startsWith('dev-api-test-')).toBe(true)
    expect(key.length).toBeLessThanOrEqual(128)
    expect(createIdempotencyKey(1_700_000_000_000, 0.5)).toBe(key)
    expect(createIdempotencyKey(1_700_000_000_000, 0.6)).not.toBe(key)
  })
})

describe('operationUrl', () => {
  it('拼接 API 前缀并去掉结尾斜杠', () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api/v1/')
    expect(operationUrl('/inventory/increase')).toBe('/api/v1/inventory/increase')
    vi.unstubAllEnvs()
  })
})
