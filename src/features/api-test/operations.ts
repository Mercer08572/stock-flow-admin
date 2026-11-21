/**
 * 「API 测试」页的纯逻辑：操作目录、表单校验、请求体组装与幂等键生成。
 *
 * 契约约束（均已在后端核对）：
 * 1. 五个操作对应四个端点：`/inventory/decrease` 带 `reservation_id` 时是
 *    「预留扣减」（`decrease_reserved`），不带时是「直接扣减」（`decrease_available`）。
 * 2. 预留扣减禁止同时传 `batch_id`（后端直接返回 400），批次由预留分配决定。
 * 3. 预留释放必须引用预留单；`qty` 省略表示释放该预留单全部剩余。
 * 4. 数量是字符串：最多 14 位整数 + 6 位小数，且必须大于 0。
 * 5. 所有变更都必须带 `idempotency_key`（去空白后 1–128 字符）。
 * 6. `source_type` ≤ 64、`source_id` / `source_line_id` ≤ 128，空字符串视为未提供。
 */

import type { InventoryOperationInput, MovementOperationType } from '@/types/api'

/** 页面上可选的库存变更操作 */
export type ApiTestOperation =
  'increase' | 'reserve' | 'decrease_reserved' | 'decrease_available' | 'release'

export interface ApiTestOperationDefinition {
  value: ApiTestOperation
  label: string
  /** 后端实际返回的 operation_type，用于结果面板展示 */
  operationType: MovementOperationType
  /** 相对 API 前缀的路径，如 `/inventory/increase` */
  endpoint: string
  description: string
  /** 必须引用预留单（预留扣减 / 预留释放） */
  requiresReservation: boolean
  /** 是否允许指定批次 */
  allowsBatch: boolean
  /** 数量可留空（仅预留释放：留空 = 释放全部剩余） */
  qtyOptional: boolean
}

/**
 * 操作目录。顺序即页面上的按钮顺序：先入库与预留，再扣减确认，最后释放。
 *
 * `as const satisfies` 保留字面量类型，`[0]` 可安全作为默认操作。
 */
export const API_TEST_OPERATIONS = [
  {
    value: 'increase',
    label: '库存增加',
    operationType: 'increase',
    endpoint: '/inventory/increase',
    description: '增加实物库存（在库 +数量），已预留数量不变。未指定批次时计入非批次库存层。',
    requiresReservation: false,
    allowsBatch: true,
    qtyOptional: false,
  },
  {
    value: 'reserve',
    label: '库存预留（占用）',
    operationType: 'reserve',
    endpoint: '/inventory/reserve',
    description: '锁定可用库存（预留 +数量，在库不变）。未指定批次时按 FIFO 跨库存层分配。',
    requiresReservation: false,
    allowsBatch: true,
    qtyOptional: false,
  },
  {
    value: 'decrease_reserved',
    label: '预留扣减（占用扣减）',
    operationType: 'decrease_reserved',
    endpoint: '/inventory/decrease',
    description: '确认消耗已预留的库存（在库与预留同时减少），必须引用原始预留单。',
    requiresReservation: true,
    allowsBatch: false,
    qtyOptional: false,
  },
  {
    value: 'decrease_available',
    label: '直接扣减',
    operationType: 'decrease_available',
    endpoint: '/inventory/decrease',
    description: '直接消耗未预留的可用库存（仅在库减少，预留不变）。',
    requiresReservation: false,
    allowsBatch: true,
    qtyOptional: false,
  },
  {
    value: 'release',
    label: '预留释放（占用释放）',
    operationType: 'release_reserved',
    endpoint: '/inventory/release',
    description: '释放已预留的库存（预留减少，在库不变）。数量留空表示释放该预留单全部剩余。',
    requiresReservation: true,
    allowsBatch: false,
    qtyOptional: true,
  },
] as const satisfies readonly ApiTestOperationDefinition[]

/** 默认操作：库存增加 */
export const DEFAULT_API_TEST_OPERATION = API_TEST_OPERATIONS[0]

/** 后人新增枚举时返回 undefined，由调用方回退默认操作 */
export function findOperation(value: string): ApiTestOperationDefinition | undefined {
  return API_TEST_OPERATIONS.find((operation) => operation.value === value)
}

/** 结果面板：把后端 operation_type 映射回中文操作名 */
export function operationLabel(operationType: string): string {
  return (
    API_TEST_OPERATIONS.find((operation) => operation.operationType === operationType)?.label ??
    operationType
  )
}

/** 数量快捷选项 */
export const QTY_PRESETS = ['1', '10', '100', '1000'] as const

export interface ApiTestFormState {
  warehouseId: number | null
  skuId: number | null
  batchId: number | null
  reservationId: number | null
  /** 字符串而非 number：数量是 NUMERIC(20,6)，不应经过浮点转换 */
  qty: string
  idempotencyKey: string
  sourceType: string
  sourceId: string
  sourceLineId: string
}

/** 与后端 `quantityPattern` 一致 */
const QUANTITY_PATTERN = /^[0-9]{1,14}(\.[0-9]{1,6})?$/
const MAX_IDEMPOTENCY_KEY_LENGTH = 128
const MAX_SOURCE_TYPE_LENGTH = 64
const MAX_SOURCE_ID_LENGTH = 128

function validateQty(qty: string): string | null {
  const trimmed = qty.trim()
  if (!QUANTITY_PATTERN.test(trimmed)) return '数量需为最多 14 位整数、6 位小数的数字'
  if (Number(trimmed) <= 0) return '数量必须大于 0'
  return null
}

/**
 * 表单校验，返回全部可读问题；空数组表示可以发送。
 *
 * 一次列出全部问题而不是遇到第一个就返回，页面可以整体提示、减少来回试错。
 */
export function validateApiTestForm(
  form: ApiTestFormState,
  operation: ApiTestOperationDefinition,
): string[] {
  const errors: string[] = []

  if (form.warehouseId === null || form.warehouseId <= 0) errors.push('请选择仓库')
  if (form.skuId === null || form.skuId <= 0) errors.push('请选择 SKU')

  if (operation.requiresReservation && (form.reservationId === null || form.reservationId <= 0)) {
    errors.push('请选择预留单')
  }
  if (!operation.allowsBatch && form.batchId !== null) {
    errors.push('当前操作不允许指定批次')
  }
  if (form.batchId !== null && form.batchId <= 0) errors.push('批次 ID 必须是大于 0 的整数')

  const qty = form.qty.trim()
  if (operation.qtyOptional) {
    if (qty !== '') {
      const message = validateQty(qty)
      if (message !== null) errors.push(message)
    }
  } else if (qty === '') {
    errors.push('请填写数量')
  } else {
    const message = validateQty(qty)
    if (message !== null) errors.push(message)
  }

  if (form.idempotencyKey.trim() === '') {
    errors.push('请填写幂等键')
  } else if (form.idempotencyKey.trim().length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    errors.push(`幂等键不能超过 ${MAX_IDEMPOTENCY_KEY_LENGTH} 个字符`)
  }

  if (form.sourceType.trim().length > MAX_SOURCE_TYPE_LENGTH) {
    errors.push(`来源类型不能超过 ${MAX_SOURCE_TYPE_LENGTH} 个字符`)
  }
  if (form.sourceId.trim().length > MAX_SOURCE_ID_LENGTH) {
    errors.push(`来源 ID 不能超过 ${MAX_SOURCE_ID_LENGTH} 个字符`)
  }
  if (form.sourceLineId.trim().length > MAX_SOURCE_ID_LENGTH) {
    errors.push(`来源行 ID 不能超过 ${MAX_SOURCE_ID_LENGTH} 个字符`)
  }

  return errors
}

/**
 * 组装请求体。
 *
 * 只发送当前操作真正使用的字段：预留扣减不会带 `batch_id`，预留释放留空时不带 `qty`，
 * 空白的来源字段整体省略。调用前应先通过 `validateApiTestForm`。
 */
export function buildOperationBody(
  form: ApiTestFormState,
  operation: ApiTestOperationDefinition,
): InventoryOperationInput {
  const { warehouseId, skuId } = form
  if (warehouseId === null || skuId === null) {
    throw new Error('warehouse_id 与 sku_id 为必填项')
  }

  const qty = form.qty.trim()
  const body: InventoryOperationInput = {
    warehouse_id: warehouseId,
    sku_id: skuId,
    ...(operation.allowsBatch && form.batchId !== null ? { batch_id: form.batchId } : {}),
    ...(operation.requiresReservation && form.reservationId !== null
      ? { reservation_id: form.reservationId }
      : {}),
    ...(qty === '' ? {} : { qty }),
    idempotency_key: form.idempotencyKey.trim(),
  }

  const sourceType = form.sourceType.trim()
  const sourceId = form.sourceId.trim()
  const sourceLineId = form.sourceLineId.trim()
  if (sourceType !== '') body.source_type = sourceType
  if (sourceId !== '') body.source_id = sourceId
  if (sourceLineId !== '') body.source_line_id = sourceLineId

  return body
}

/**
 * 生成幂等键。
 *
 * 带时间戳与随机后缀，避免复制粘贴时不同请求撞键；长度远小于后端 128 字符上限。
 * `now` / `random` 可注入，便于测试稳定断言。
 */
export function createIdempotencyKey(
  now: number = Date.now(),
  random: number = Math.random(),
): string {
  const suffix = Math.floor(random * 36 ** 6)
    .toString(36)
    .padStart(6, '0')
  return `dev-api-test-${now.toString(36)}-${suffix}`
}

/** 请求预览用的完整路径（API 前缀来自 env，与 client.ts 保持一致） */
export function operationUrl(endpoint: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
  return `${base}${endpoint}`
}
