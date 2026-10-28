import { api } from './client'

import type {
  InventoryMovement,
  ListResult,
  MovementOperationType,
  Reservation,
  ReservationStatus,
  StockBalance,
} from '@/types/api'

/** 库存为只读资源：变更操作由外部业务系统经后端库存接口完成 */
export const inventoryApi = {
  list: (query: { warehouse_id?: number; sku_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<StockBalance>>('/inventory/stocks', query),
  get: (warehouseId: number, skuId: number, query: { include_layers?: boolean } = {}) =>
    api.get<StockBalance>(`/inventory/stocks/${warehouseId}/${skuId}`, query),
  listReservations: (query: {
    warehouse_id?: number
    sku_id?: number
    status?: ReservationStatus
    limit?: number
    offset?: number
  }) => api.get<ListResult<Reservation>>('/inventory/reservations', query),
  getReservation: (id: number) => api.get<Reservation>(`/inventory/reservations/${id}`),
  /**
   * 库存流水：只读审计数据。
   *
   * `created_from` / `created_to` 是 RFC3339 时间戳，其中 `created_to` 为**开区间**
   * （后端 SQL 是 `created_at < created_to`），因此「查某一天」要传次日的零点。
   */
  listMovements: (query: {
    warehouse_id?: number
    sku_id?: number
    operation_type?: MovementOperationType
    created_from?: string
    created_to?: string
    limit?: number
    offset?: number
  }) => api.get<ListResult<InventoryMovement>>('/inventory/movements', query),
}
