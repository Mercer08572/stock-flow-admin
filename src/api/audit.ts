import { api } from './client'

import type { AuditLogListResult } from '@/types/api'

export interface AuditLogQuery {
  from?: string
  to?: string
  auth_method?: string
  actor_type?: string
  actor_id?: number
  actor_label?: string
  client_ip?: string
  status_code?: number
  path?: string
  limit?: number
  cursor?: string
}

export const auditApi = {
  list: (query: AuditLogQuery) => api.get<AuditLogListResult>('/audit/logs', query),
}
