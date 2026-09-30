import { api } from './client'

import type {
  CreateCategoryInput,
  ListResult,
  MaterialCategory,
  UpdateCategoryInput,
} from '@/types/api'

export const categoriesApi = {
  list: (query: { status?: string; parent_id?: number; limit?: number; offset?: number }) =>
    api.get<ListResult<MaterialCategory>>('/material-categories', query),
  get: (id: number) => api.get<MaterialCategory>(`/material-categories/${id}`),
  create: (body: CreateCategoryInput) => api.post<MaterialCategory>('/material-categories', body),
  update: (id: number, body: UpdateCategoryInput) =>
    api.put<MaterialCategory>(`/material-categories/${id}`, body),
  remove: (id: number) => api.delete<void>(`/material-categories/${id}`),
}
