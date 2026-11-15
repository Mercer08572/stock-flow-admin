import { inventoryApi } from '@/api/inventory'
import { usePollingStats } from '@/lib/use-polling-stats'

/**
 * 工作台的库存操作趋势数据。
 *
 * 只请求 `/inventory/movements/stats`：接口吞吐图已挪到「API 监控」页面，
 * 工作台不应为一个不显示的图持续轮询。
 */
export function useMovementStats() {
  return usePollingStats((query, signal) => inventoryApi.getMovementStats(query, { signal }))
}
