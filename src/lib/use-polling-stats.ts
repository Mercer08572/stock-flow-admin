import { onMounted, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'

import { getErrorDetail, type ErrorDetail } from '@/api/error'

import { browserTimezone, computeStatsWindow, type StatsRangeKey, type StatsWindow } from './stats'

/** 轮询间隔：30 秒；标签页不可见时暂停，避免后台空跑 */
const REFRESH_INTERVAL_MS = 30_000

/** 传给 fetcher 的完整查询条件 */
export interface StatsQuery extends StatsWindow {
  timezone: string
}

export interface PollingStatsState<T> {
  range: Ref<StatsRangeKey>
  timezone: string
  data: Ref<T | null>
  error: Ref<ErrorDetail | null>
  /** 首次加载（尚无数据）时用于骨架屏 */
  loading: Ref<boolean>
  /** 已有数据时的后台刷新，用于按钮 loading 与"不闪空态" */
  refreshing: Ref<boolean>
  lastUpdatedAt: Ref<number | null>
  /** 手动刷新：会与下一次轮询共用同一套竞态保护 */
  refresh: () => Promise<void>
  /** 失败重试：语义与 refresh 相同，单独暴露是为了模板可读性 */
  reload: () => Promise<void>
}

/**
 * 统计类页面的通用轮询容器。
 *
 * 工作台与 API 监控的图表数据都走这里，保证两处的行为一致：
 * 30 秒轮询、切换范围立即刷新、标签页隐藏时暂停、在途请求被新请求取消，
 * 以及刷新失败时保留旧图（避免图表闪成空白）。
 */
export function usePollingStats<T>(
  fetcher: (query: StatsQuery, signal: AbortSignal) => Promise<T>,
): PollingStatsState<T> {
  const range = ref<StatsRangeKey>('24h')
  const timezone = browserTimezone()

  const data = shallowRef<T | null>(null)
  const error = ref<ErrorDetail | null>(null)
  const loading = ref(false)
  const refreshing = ref(false)
  const lastUpdatedAt = ref<number | null>(null)

  let refreshTimer: number | undefined
  let inFlight: AbortController | null = null
  let disposed = false

  async function refresh(): Promise<void> {
    inFlight?.abort()
    const controller = new AbortController()
    inFlight = controller

    const hasData = data.value !== null
    if (hasData) {
      refreshing.value = true
    } else {
      loading.value = true
    }

    try {
      const window = computeStatsWindow(range.value)
      const payload = await fetcher({ ...window, timezone }, controller.signal)
      if (disposed || controller.signal.aborted) return
      data.value = payload
      error.value = null
      lastUpdatedAt.value = Date.now()
    } catch (thrown) {
      if (isAbortError(thrown) || disposed) return
      error.value = getErrorDetail(thrown)
      // 刷新失败保留旧图；首次加载失败才清空，否则会看到"有数据 → 空白"的跳变。
      if (!hasData) data.value = null
    } finally {
      if (!controller.signal.aborted && !disposed) {
        loading.value = false
        refreshing.value = false
      }
    }
  }

  function stopPolling() {
    if (refreshTimer !== undefined) {
      window.clearInterval(refreshTimer)
      refreshTimer = undefined
    }
  }

  function startPolling() {
    stopPolling()
    refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, REFRESH_INTERVAL_MS)
  }

  function handleVisibilityChange() {
    // 从后台切回时立即拉一次，用户不用等下一个轮询周期。
    if (document.visibilityState === 'visible') void refresh()
  }

  watch(range, () => {
    void refresh()
  })

  onMounted(() => {
    void refresh()
    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    disposed = true
    stopPolling()
    inFlight?.abort()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    range,
    timezone,
    data,
    error,
    loading,
    refreshing,
    lastUpdatedAt,
    refresh,
    reload: refresh,
  }
}

function isAbortError(error: unknown): boolean {
  // DOMException 继承自 Error；部分环境（如旧版 WebView）抛出的是普通 Error，
  // 因此按 name 判断而不是只认 DOMException。
  return error instanceof Error && error.name === 'AbortError'
}
