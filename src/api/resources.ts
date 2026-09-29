import { api } from './client'

import type {
  HealthStatus,
  ListResult,
  Material,
  MaterialCategory,
  SKU,
  StockBalance,
  Unit,
  UpdateCategoryInput,
  UpdateMaterialInput,
  UpdateSkuInput,
  UpdateUnitInput,
  UpdateWarehouseInput,
  Warehouse,
} from '@/types/api'

export const resourceApi = {
  health: () => api.get<HealthStatus>('/health'),
  stocks: (query: { warehouse_id?: number; sku_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<StockBalance>>('/inventory/stocks', query),
  stock: (warehouseId: number, skuId: number, query: { include_layers?: boolean } = {}) =>
    api.get<StockBalance>(`/inventory/stocks/${warehouseId}/${skuId}`, query),
  units: (query: { status?: string; unit_type?: string; limit?: number; offset?: number }) =>
    api.get<ListResult<Unit>>('/units', query),
  getUnit: (id: number) => api.get<Unit>(`/units/${id}`),
  createUnit: (body: {
    code: string
    name: string
    symbol: string
    unit_type: Unit['unit_type']
    precision: number
    status: Unit['status']
  }) => api.post<Unit>('/units', body),
  updateUnit: (id: number, body: UpdateUnitInput) => api.put<Unit>(`/units/${id}`, body),
  deleteUnit: (id: number) => api.delete<void>(`/units/${id}`),
  categories: (query: { status?: string; parent_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<MaterialCategory>>('/material-categories', query),
  getCategory: (id: number) => api.get<MaterialCategory>(`/material-categories/${id}`),
  createCategory: (body: {
    code: string
    name: string
    parent_id?: number
    status: MaterialCategory['status']
    remark?: string
  }) => api.post<MaterialCategory>('/material-categories', body),
  updateCategory: (id: number, body: UpdateCategoryInput) =>
    api.put<MaterialCategory>(`/material-categories/${id}`, body),
  deleteCategory: (id: number) => api.delete<void>(`/material-categories/${id}`),
  materials: (query: { status?: string; category_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<Material>>('/materials', query),
  getMaterial: (id: number) => api.get<Material>(`/materials/${id}`),
  createMaterial: (body: {
    code: string
    name: string
    category_id: number
    base_unit_id: number
    status: Material['status']
    remark?: string
  }) => api.post<Material>('/materials', body),
  updateMaterial: (id: number, body: UpdateMaterialInput) =>
    api.put<Material>(`/materials/${id}`, body),
  deleteMaterial: (id: number) => api.delete<void>(`/materials/${id}`),
  skus: (query: { status?: string; material_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<SKU>>('/skus', query),
  getSku: (id: number) => api.get<SKU>(`/skus/${id}`),
  createSku: (body: {
    material_id: number
    code: string
    name: string
    unit_id: number
    status: SKU['status']
    remark?: string
  }) => api.post<SKU>('/skus', body),
  updateSku: (id: number, body: UpdateSkuInput) => api.put<SKU>(`/skus/${id}`, body),
  deleteSku: (id: number) => api.delete<void>(`/skus/${id}`),
  warehouses: (query: { status?: string; type?: string; limit?: number; offset?: number }) =>
    api.get<ListResult<Warehouse>>('/warehouses', query),
  getWarehouse: (id: number) => api.get<Warehouse>(`/warehouses/${id}`),
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
  updateWarehouse: (id: number, body: UpdateWarehouseInput) =>
    api.put<Warehouse>(`/warehouses/${id}`, body),
  deleteWarehouse: (id: number) => api.delete<void>(`/warehouses/${id}`),
  /** 停用：状态置为 inactive，不做库存引用检查（与 DELETE 不同，没有 409） */
  disableWarehouse: (id: number) => api.put<Warehouse>(`/warehouses/${id}/disable`),
}
