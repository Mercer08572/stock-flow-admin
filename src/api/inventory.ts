import { api } from './client'

import type { ListResult, StockBalance } from '@/types/api'

/** 库存为只读资源：变更操作由外部业务系统经后端库存接口完成 */
export const inventoryApi = {
  list: (query: { warehouse_id?: number; sku_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<StockBalance>>('/inventory/stocks', query),
  get: (warehouseId: number, skuId: number, query: { include_layers?: boolean } = {}) =>
    api.get<StockBalance>(`/inventory/stocks/${warehouseId}/${skuId}`, query),
}
