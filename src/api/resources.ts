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
  createUnit: (body: {
    code: string
    name: string
    symbol: string
    unit_type: Unit['unit_type']
    precision: number
    status: Unit['status']
  }) => api.post<Unit>('/units', body),
  categories: (query: { status?: string; parent_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<MaterialCategory>>('/material-categories', query),
  createCategory: (body: {
    code: string
    name: string
    parent_id?: number
    status: MaterialCategory['status']
    remark?: string
  }) => api.post<MaterialCategory>('/material-categories', body),
  materials: (query: { status?: string; category_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<Material>>('/materials', query),
  createMaterial: (body: {
    code: string
    name: string
    category_id: number
    base_unit_id: number
    status: Material['status']
    remark?: string
  }) => api.post<Material>('/materials', body),
  skus: (query: { status?: string; material_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<SKU>>('/skus', query),
  createSku: (body: {
    material_id: number
    code: string
    name: string
    unit_id: number
    status: SKU['status']
    remark?: string
  }) => api.post<SKU>('/skus', body),
  warehouses: (query: { status?: string; type?: string; limit?: number; offset?: number }) =>
    api.get<ListResult<Warehouse>>('/warehouses', query),
  createWarehouse: (body: {
    code: string
    name: string
    type: Warehouse['type']
    status: Warehouse['status']
    location?: string
    contact_name?: string
    contact_phone?: string
    remark?: string
  }) => api.post<Warehouse>('/warehouses', body),
}
