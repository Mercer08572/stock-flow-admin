/**
 * 库存流水列表的纯逻辑：查询参数组装、操作类型中文映射、来源/操作人格式化、分页数据合并。
 *
 * 契约约束（已在后端核对）：
 * 1. `GET /inventory/movements` 接受 `warehouse_id` / `sku_id` / `operation_type` /
 *    `created_from` / `created_to` / `limit` / `offset`，响应带同条件 `total`。
 * 2. 后端 `MaxListLimit = 100`（默认 20），页大小不能超过它。
 * 3. `created_to` 是**开区间**（SQL 为 `created_at < created_to`），因此「截止到某天」要传次日零点。
 * 4. `Movement` 不内联 `warehouse` / `sku` 引用，只有 ID；名称要由筛选下拉的选项表反查。
 * 5. `operation_type` 受 CHECK 约束与后端校验双重限制，只有下面 5 个取值。
 */

import type { InventoryMovement, MovementOperationType } from '@/types/api'

/** 后端 `MaxListLimit` */
export const MOVEMENT_PAGE_SIZE = 100

export interface MovementFilters {
  warehouseId: number | null
  skuId: number | null
  operationType: MovementOperationType | null
  /** 日期范围（`yyyy-MM-dd` 字符串，来自 NDatePicker 的 value-format）；null 表示不限 */
  dateRange: [string, string] | null
}

export interface MovementQuery {
  warehouse_id?: number
  sku_id?: number
  operation_type?: MovementOperationType
  created_from?: string
  created_to?: string
  limit: number
  offset: number
}

/** 后端枚举 → 中文，顺序即下拉顺序（与 SQL CHECK 的书写顺序一致） */
export const OPERATION_TYPE_LABELS: Record<MovementOperationType, string> = {
  increase: '增加',
  reserve: '预留',
  release_reserved: '释放预留',
  decrease_available: '扣减可用',
  decrease_reserved: '扣减预留',
}

export const OPERATION_TYPE_OPTIONS: Array<{
  label: string
  value: MovementOperationType
}> = (
  ['increase', 'reserve', 'release_reserved', 'decrease_available', 'decrease_reserved'] as const
).map((value) => ({ label: OPERATION_TYPE_LABELS[value], value }))

/**
 * 操作类型的中文标签。
 *
 * 后端新增枚举而前端未跟上时原样显示，避免整列变成空白或占位符。
 */
export function operationTypeLabel(operationType: string): string {
  return OPERATION_TYPE_LABELS[operationType as MovementOperationType] ?? (operationType || '-')
}

/** 标签配色：入库成功、预留提示、释放信息、扣减为错误色 */
export function operationTypeTagType(
  operationType: string,
): 'success' | 'warning' | 'info' | 'error' | 'default' {
  switch (operationType) {
    case 'increase':
      return 'success'
    case 'reserve':
      return 'warning'
    case 'release_reserved':
      return 'info'
    case 'decrease_available':
    case 'decrease_reserved':
      return 'error'
    default:
      return 'default'
  }
}

/**
 * 把 `yyyy-MM-dd` 解析成当天本地零点的 Date。
 *
 * 不用 `new Date('2026-10-01')`：那会按 UTC 解析，东八区会得到 08:00，
 * 进而让「当天」的流水被漏掉。这里按本地时间构造。
 */
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  // 2026-02-31 这类非法日期会被 Date 顺延到 3 月，必须回读校验
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/**
 * 日期范围 → RFC3339 时间戳区间（左闭右开）。
 *
 * `created_to` 传**次日**本地零点：后端的比较是 `created_at < created_to`，
 * 传结束日当天零点会把这一天的流水全部排除在外。
 */
export function toCreatedRange(dateRange: [string, string] | null | undefined): {
  created_from?: string
  created_to?: string
} {
  if (!dateRange) return {}
  const [fromText, toText] = dateRange
  const from = parseLocalDate(fromText)
  const to = parseLocalDate(toText)
  if (!from || !to) return {}

  // 区间颠倒时以用户给出的两端为准做归一化，避免后端 400
  const [start, end] = from.getTime() <= to.getTime() ? [from, to] : [to, from]
  const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)

  return { created_from: start.toISOString(), created_to: endExclusive.toISOString() }
}

/** 空条件不发送该参数（`client.ts` 也会丢弃 undefined / null，这里显式表达意图） */
export function buildMovementQuery(
  filters: MovementFilters,
  offset: number,
  limit: number = MOVEMENT_PAGE_SIZE,
): MovementQuery {
  return {
    ...(filters.warehouseId === null ? {} : { warehouse_id: filters.warehouseId }),
    ...(filters.skuId === null ? {} : { sku_id: filters.skuId }),
    ...(filters.operationType === null ? {} : { operation_type: filters.operationType }),
    ...toCreatedRange(filters.dateRange),
    limit,
    offset: Math.max(0, offset),
  }
}

/** 来源由外部业务系统提供，三段都可能为空 */
export function formatMovementSource(
  row: Pick<InventoryMovement, 'source_type' | 'source_id' | 'source_line_id'>,
): string {
  const parts = [row.source_type, row.source_id, row.source_line_id].filter(
    (part): part is string => Boolean(part),
  )
  return parts.length > 0 ? parts.join(' / ') : '-'
}

/** 操作人：`actor_label` 为空时回退 `actor_type#id`，再回退占位符 */
export function formatMovementActor(
  row: Pick<InventoryMovement, 'actor_label' | 'actor_type' | 'actor_id'>,
): string {
  if (row.actor_label) return row.actor_label
  if (row.actor_type && row.actor_id !== null) return `${row.actor_type}#${row.actor_id}`
  if (row.actor_type) return row.actor_type
  return '-'
}

/**
 * 引用 ID → 可读标签。
 *
 * 后端流水只给 ID，名称来自筛选下拉的选项表；选项未加载或已软删除时回退 `#id`，
 * 不能留空（否则用户只能看到一片空白，无法判断是哪条流水）。
 */
export function referenceLabel(
  options: ReadonlyArray<{ label: string; value: number }>,
  id: number,
): string {
  return options.find((option) => option.value === id)?.label ?? `#${id}`
}

/**
 * 追加分页数据：按 `id` 去重并保持既有顺序。
 *
 * 流水按 `created_at DESC` 排序，翻页期间若有新流水写入，下一页的边界行会与上一页重叠；
 * 不做去重会让虚拟列表出现重复行键（Vue 会告警、渲染会错位）。
 */
export function mergeMovementRows(
  existing: InventoryMovement[],
  incoming: InventoryMovement[],
): InventoryMovement[] {
  const seen = new Set(existing.map((row) => row.id))
  const merged = [...existing]
  for (const row of incoming) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  return merged
}

/** 是否还有下一页：已加载条数少于总数，且上一批是满页（否则末页已到底） */
export function hasMoreMovements(
  loadedCount: number,
  total: number,
  lastBatchSize: number,
  pageSize: number = MOVEMENT_PAGE_SIZE,
): boolean {
  if (loadedCount >= total) return false
  return lastBatchSize >= pageSize
}
