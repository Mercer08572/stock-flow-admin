import { api } from './client'

import type { CreateSkuInput, ListResult, SKU, UpdateSkuInput } from '@/types/api'

export const skusApi = {
  list: (query: { status?: string; material_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<SKU>>('/skus', query),
  get: (id: number) => api.get<SKU>(`/skus/${id}`),
  create: (body: CreateSkuInput) => api.post<SKU>('/skus', body),
  update: (id: number, body: UpdateSkuInput) => api.put<SKU>(`/skus/${id}`, body),
  remove: (id: number) => api.delete<void>(`/skus/${id}`),
}
