import { api } from './client'

import type { CreateUnitInput, ListResult, Unit, UpdateUnitInput } from '@/types/api'

export const unitsApi = {
  list: (query: { status?: string; unit_type?: string; limit?: number; offset?: number }) =>
    api.get<ListResult<Unit>>('/units', query),
  get: (id: number) => api.get<Unit>(`/units/${id}`),
  create: (body: CreateUnitInput) => api.post<Unit>('/units', body),
  update: (id: number, body: UpdateUnitInput) => api.put<Unit>(`/units/${id}`, body),
  remove: (id: number) => api.delete<void>(`/units/${id}`),
}
