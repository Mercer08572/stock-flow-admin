import { api } from './client'

import type { CreateMaterialInput, ListResult, Material, UpdateMaterialInput } from '@/types/api'

export const materialsApi = {
  list: (query: {
    status?: string
    category_id?: number
    /** 按编码或名称模糊搜索 */
    q?: string
    limit?: number
    offset?: number
  }) => api.get<ListResult<Material>>('/materials', query),
  get: (id: number) => api.get<Material>(`/materials/${id}`),
  create: (body: CreateMaterialInput) => api.post<Material>('/materials', body),
  update: (id: number, body: UpdateMaterialInput) => api.put<Material>(`/materials/${id}`, body),
  remove: (id: number) => api.delete<void>(`/materials/${id}`),
}
