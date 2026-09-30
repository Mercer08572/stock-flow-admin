import { api } from './client'

import type { CreateWarehouseInput, ListResult, UpdateWarehouseInput, Warehouse } from '@/types/api'

export const warehousesApi = {
  list: (query: { status?: string; type?: string; limit?: number; offset?: number }) =>
    api.get<ListResult<Warehouse>>('/warehouses', query),
  get: (id: number) => api.get<Warehouse>(`/warehouses/${id}`),
  create: (body: CreateWarehouseInput) => api.post<Warehouse>('/warehouses', body),
  update: (id: number, body: UpdateWarehouseInput) => api.put<Warehouse>(`/warehouses/${id}`, body),
  remove: (id: number) => api.delete<void>(`/warehouses/${id}`),
  /** 停用：状态置为 inactive，不做库存引用检查（与 DELETE 不同，没有 409） */
  disable: (id: number) => api.put<Warehouse>(`/warehouses/${id}/disable`),
}
