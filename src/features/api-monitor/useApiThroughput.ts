import { auditStatsApi } from '@/api/audit'
import { usePollingStats } from '@/lib/use-polling-stats'

import type { ApiThroughputStats } from '@/types/api'

/**
 * API 监控页的库存接口吞吐数据。
 *
 * 口径来自审计日志 route 维度，因此包含失败请求（4xx/5xx），
 * 与工作台「成功操作次数」的口径互补。
 */
export function useApiThroughput() {
  return usePollingStats<ApiThroughputStats>((query, signal) =>
    auditStatsApi.get(query, { signal }),
  )
}
