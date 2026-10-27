/**
 * 库存占用列表的纯逻辑：查询参数组装、状态/关闭原因标签、来源格式化。
 *
 * 契约约束（已在后端核对）：
 * 1. `GET /inventory/reservations` 接受 `warehouse_id` / `sku_id` / `status` / `limit` / `offset`；
 *    响应额外返回同条件下的 `total`，用于显示总数与页码跳转。
 * 2. 后端 `MaxListLimit = 100`，页大小不能超过它。
 * 3. `Reservation.warehouse` / `sku` 是 `*Reference + omitempty`，引用缺失时退化为 ID。
 */

import type { Reservation, ReservationCloseReason, ReservationStatus } from '@/types/api'

/** 后端 `MaxListLimit` */
export const RESERVATION_PAGE_SIZE = 100

export interface ReservationFilters {
  warehouseId: number | null
  skuId: number | null
  status: ReservationStatus | null
}

export interface ReservationQuery {
  warehouse_id?: number
  sku_id?: number
  status?: ReservationStatus
  limit: number
  offset: number
}

/** 空条件不发送该参数（`client.ts` 也会丢弃 undefined / null，这里显式表达意图） */
export function buildReservationQuery(
  filters: ReservationFilters,
  offset: number,
  limit: number = RESERVATION_PAGE_SIZE,
): ReservationQuery {
  return {
    ...(filters.warehouseId === null ? {} : { warehouse_id: filters.warehouseId }),
    ...(filters.skuId === null ? {} : { sku_id: filters.skuId }),
    ...(filters.status === null ? {} : { status: filters.status }),
    limit,
    offset: Math.max(0, offset),
  }
}

export function reservationStatusLabel(status: string): string {
  if (status === 'active') return '占用中'
  if (status === 'closed') return '已关闭'
  return status
}

const CLOSE_REASON_LABELS: Record<ReservationCloseReason, string> = {
  consumed: '已消耗',
  released: '已释放',
  mixed: '混合关闭',
  cancelled: '已取消',
  expired: '已过期',
}

export function closeReasonLabel(reason: ReservationCloseReason | null | undefined): string {
  if (!reason) return '-'
  return CLOSE_REASON_LABELS[reason] ?? reason
}

/** 来源由外部业务系统提供，三段都可能为空 */
export function formatReservationSource(
  row: Pick<Reservation, 'source_type' | 'source_id' | 'source_line_id'>,
): string {
  const parts = [row.source_type, row.source_id, row.source_line_id].filter(
    (part): part is string => Boolean(part),
  )
  return parts.length > 0 ? parts.join(' / ') : '-'
}
