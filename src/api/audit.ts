import { api } from './client'

import type { ApiThroughputStats, AuditLogListResult, StatsGranularity } from '@/types/api'

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
  trace_id?: string
  limit?: number
  cursor?: string
}

export const auditApi = {
  list: (query: AuditLogQuery) => api.get<AuditLogListResult>('/audit/logs', query),
}

/**
 * 库存接口吞吐与失败率统计（工作台补充图）。
 *
 * 口径是 audit_logs 的 route 维度，因此包含失败请求（4xx/5xx），
 * 与 `GET /inventory/movements/stats` 的成功操作口径互补。
 *
 * 注意 `POST /inventory/decrease` 同时承载「库存减」与「占用扣减」两种操作，
 * 审计日志无法按 route 再细分，所以这里是 4 条路由而非 5 种操作。
 */
export const auditStatsApi = {
  get: (
    query: {
      from: string
      to: string
      granularity?: StatsGranularity
      timezone?: string
      routes?: string
    },
    options?: { signal?: AbortSignal },
  ) => api.get<ApiThroughputStats>('/audit/stats', query, options),
}
