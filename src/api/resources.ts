import { api } from './client'

import type {
  HealthStatus,
  ListResult,
  Material,
  MaterialCategory,
  SKU,
  StockBalance,
  Unit,
  Warehouse,
} from '@/types/api'

export const resourceApi = {
  health: () => api.get<HealthStatus>('/health'),
  stocks: (query: { warehouse_id?: number; sku_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<StockBalance>>('/inventory/stocks', query),
  units: (query: { status?: string; unit_type?: string; limit?: number; offset?: number }) =>
    api.get<ListResult<Unit>>('/units', query),
  categories: (query: { status?: string; parent_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<MaterialCategory>>('/material-categories', query),
  materials: (query: { status?: string; category_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<Material>>('/materials', query),
  skus: (query: { status?: string; material_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<SKU>>('/skus', query),
  warehouses: (query: { status?: string; type?: string; limit?: number; offset?: number }) =>
    api.get<ListResult<Warehouse>>('/warehouses', query),
}
