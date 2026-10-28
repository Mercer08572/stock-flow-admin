import { describe, expect, it } from 'vitest'

import {
  buildMovementQuery,
  formatMovementActor,
  formatMovementSource,
  hasMoreMovements,
  mergeMovementRows,
  MOVEMENT_PAGE_SIZE,
  OPERATION_TYPE_OPTIONS,
  operationTypeLabel,
  operationTypeTagType,
  referenceLabel,
  toCreatedRange,
} from './movement-list'

import type { InventoryMovement } from '@/types/api'

function movement(id: number, overrides: Partial<InventoryMovement> = {}): InventoryMovement {
  return {
    id,
    operation_type: 'increase',
    warehouse_id: 3,
    sku_id: 7,
    batch_id: null,
    stock_layer_id: null,
    reservation_id: null,
    reservation_item_id: null,
    qty: '1.000000',
    idempotency_key: `key-${id}`,
    source_type: null,
    source_id: null,
    source_line_id: null,
    actor_type: null,
    actor_id: null,
    actor_label: null,
    created_at: '2026-10-01T10:00:00Z',
    ...overrides,
  }
}

const EMPTY_FILTERS = {
  warehouseId: null,
  skuId: null,
  operationType: null,
  dateRange: null,
} as const

describe('buildMovementQuery', () => {
  it('sends no filters when everything is empty', () => {
    expect(buildMovementQuery({ ...EMPTY_FILTERS }, 0)).toEqual({
      limit: MOVEMENT_PAGE_SIZE,
      offset: 0,
    })
  })

  it('sends only the selected filters', () => {
    expect(
      buildMovementQuery(
        { warehouseId: 3, skuId: 7, operationType: 'release_reserved', dateRange: null },
        100,
      ),
    ).toEqual({
      warehouse_id: 3,
      sku_id: 7,
      operation_type: 'release_reserved',
      limit: MOVEMENT_PAGE_SIZE,
      offset: 100,
    })
  })

  it('never sends a negative offset', () => {
    expect(buildMovementQuery({ ...EMPTY_FILTERS }, -100).offset).toBe(0)
  })

  it('uses the backend MaxListLimit as the page size', () => {
    // 后端 MaxListLimit = 100，超过会被静默截断
    expect(MOVEMENT_PAGE_SIZE).toBe(100)
    expect(buildMovementQuery({ ...EMPTY_FILTERS }, 0).limit).toBe(100)
  })
})

describe('toCreatedRange', () => {
  it('returns nothing without a range', () => {
    expect(toCreatedRange(null)).toEqual({})
    expect(toCreatedRange(undefined)).toEqual({})
  })

  it('covers the whole end day with an exclusive upper bound', () => {
    const range = toCreatedRange(['2026-10-01', '2026-10-02'])

    // 后端是 `created_at < created_to`，因此上界必须是结束日的次日零点
    expect(new Date(range.created_from!).getTime()).toBeLessThan(
      new Date(range.created_to!).getTime(),
    )
    const from = new Date(range.created_from!)
    expect([from.getFullYear(), from.getMonth() + 1, from.getDate()]).toEqual([2026, 10, 1])
    expect([from.getHours(), from.getMinutes()]).toEqual([0, 0])

    const to = new Date(range.created_to!)
    expect([to.getFullYear(), to.getMonth() + 1, to.getDate()]).toEqual([2026, 10, 3])
    expect([to.getHours(), to.getMinutes()]).toEqual([0, 0])
  })

  it('normalises a reversed range instead of producing an invalid query', () => {
    expect(toCreatedRange(['2026-10-05', '2026-10-01'])).toEqual(
      toCreatedRange(['2026-10-01', '2026-10-05']),
    )
  })

  it('ignores malformed or impossible dates', () => {
    expect(toCreatedRange(['2026-10-01', 'not-a-date'])).toEqual({})
    expect(toCreatedRange(['2026-02-31', '2026-03-02'])).toEqual({})
  })
})

describe('operation type labels', () => {
  it('maps all five backend enum values to Chinese', () => {
    expect(operationTypeLabel('increase')).toBe('增加')
    expect(operationTypeLabel('reserve')).toBe('预留')
    expect(operationTypeLabel('release_reserved')).toBe('释放预留')
    expect(operationTypeLabel('decrease_available')).toBe('扣减可用')
    expect(operationTypeLabel('decrease_reserved')).toBe('扣减预留')
  })

  it('lists the options in the same order with Chinese labels', () => {
    expect(OPERATION_TYPE_OPTIONS.map((option) => option.label)).toEqual([
      '增加',
      '预留',
      '释放预留',
      '扣减可用',
      '扣减预留',
    ])
    expect(OPERATION_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      'increase',
      'reserve',
      'release_reserved',
      'decrease_available',
      'decrease_reserved',
    ])
  })

  it('falls back to the raw value for an unknown/blank type', () => {
    expect(operationTypeLabel('transfer')).toBe('transfer')
    expect(operationTypeLabel('')).toBe('-')
  })

  it('gives each type a distinct tag tone', () => {
    expect(operationTypeTagType('increase')).toBe('success')
    expect(operationTypeTagType('reserve')).toBe('warning')
    expect(operationTypeTagType('release_reserved')).toBe('info')
    expect(operationTypeTagType('decrease_available')).toBe('error')
    expect(operationTypeTagType('decrease_reserved')).toBe('error')
    expect(operationTypeTagType('unknown')).toBe('default')
  })
})

describe('formatMovementSource', () => {
  it('joins the available source identifiers', () => {
    expect(
      formatMovementSource({
        source_type: 'sales_order',
        source_id: 'SO-1',
        source_line_id: '5',
      }),
    ).toBe('sales_order / SO-1 / 5')
  })

  it('skips missing segments and falls back to a placeholder', () => {
    expect(
      formatMovementSource({ source_type: 'manual', source_id: null, source_line_id: null }),
    ).toBe('manual')
    expect(formatMovementSource({ source_type: null, source_id: null, source_line_id: null })).toBe(
      '-',
    )
  })
})

describe('formatMovementActor', () => {
  it('prefers the actor label', () => {
    expect(formatMovementActor({ actor_label: 'admin', actor_type: 'admin', actor_id: 1 })).toBe(
      'admin',
    )
  })

  it('falls back to type#id and then the placeholder', () => {
    expect(formatMovementActor({ actor_label: null, actor_type: 'api_app', actor_id: 9 })).toBe(
      'api_app#9',
    )
    expect(formatMovementActor({ actor_label: null, actor_type: 'admin', actor_id: null })).toBe(
      'admin',
    )
    expect(formatMovementActor({ actor_label: null, actor_type: null, actor_id: null })).toBe('-')
  })
})

describe('referenceLabel', () => {
  const options = [{ label: 'WH-01 - 主仓', value: 3 }]

  it('resolves the label from the option list', () => {
    expect(referenceLabel(options, 3)).toBe('WH-01 - 主仓')
  })

  it('falls back to the id when the reference is not loaded', () => {
    // 后端流水只给 ID，选项未加载或主数据被软删除时不能留空
    expect(referenceLabel(options, 99)).toBe('#99')
    expect(referenceLabel([], 3)).toBe('#3')
  })
})

describe('mergeMovementRows', () => {
  it('appends new rows in order', () => {
    expect(
      mergeMovementRows([movement(1)], [movement(2), movement(3)]).map((row) => row.id),
    ).toEqual([1, 2, 3])
  })

  it('drops rows already loaded on an earlier page', () => {
    // 翻页期间有新流水写入时，边界行会在两页里重复出现
    expect(
      mergeMovementRows([movement(1), movement(2)], [movement(2), movement(3)]).map(
        (row) => row.id,
      ),
    ).toEqual([1, 2, 3])
  })

  it('keeps the existing rows when the incoming batch is empty', () => {
    expect(mergeMovementRows([movement(1)], []).map((row) => row.id)).toEqual([1])
  })
})

describe('hasMoreMovements', () => {
  it('stops at the total', () => {
    expect(hasMoreMovements(300, 300, 100)).toBe(false)
    expect(hasMoreMovements(250, 300, 50)).toBe(false)
  })

  it('continues while the last batch was full', () => {
    expect(hasMoreMovements(100, 300, 100)).toBe(true)
  })

  it('stops on a short batch even before reaching the total', () => {
    // 短页说明后端已经没有更多数据（总数为并发写入前的旧值）
    expect(hasMoreMovements(120, 300, 20)).toBe(false)
  })
})
