import type { StatsGranularity } from '@/types/api'

/**
 * 趋势类页面共用的时间范围与时间桶工具。
 *
 * 工作台（库存操作趋势）与 API 监控（接口吞吐）必须用同一套窗口规则，
 * 否则同一时间范围下两张图的首尾桶会对不上。这里只放无状态纯函数。
 */

/** 可选的时间范围 */
export type StatsRangeKey = '24h' | '7d' | '30d'

export interface StatsRangeOption {
  key: StatsRangeKey
  label: string
  granularity: StatsGranularity
  /** 仅 day 粒度使用：覆盖的自然日数量 */
  days: number
}

export const STATS_RANGES: StatsRangeOption[] = [
  { key: '24h', label: '近 24 小时', granularity: 'hour', days: 1 },
  { key: '7d', label: '近 7 天', granularity: 'day', days: 7 },
  { key: '30d', label: '近 30 天', granularity: 'day', days: 30 },
]

/** 请求后端统计接口的窗口参数 */
export interface StatsWindow {
  from: string
  to: string
  granularity: StatsGranularity
}

/** 统计桶按浏览器时区切分；必须与 `computeStatsWindow` 的本地边界计算保持一致 */
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
}

/**
 * 计算查询窗口。
 *
 * - 24h：截止到下一个整点，覆盖当前这一小时，起点 = 终点 - 24h
 * - 7d / 30d：起点 = 今天零点往前 N-1 天，终点 = 明天零点
 *
 * 边界刻意取整，避免首尾桶只统计了半截数据却在图上表现为"下降"。
 */
export function computeStatsWindow(range: StatsRangeKey, now = new Date()): StatsWindow {
  const option = STATS_RANGES.find((item) => item.key === range) ?? STATS_RANGES[0]

  if (option.granularity === 'hour') {
    const to = new Date(now)
    to.setMinutes(0, 0, 0)
    to.setHours(to.getHours() + 1)
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000)
    return { from: from.toISOString(), to: to.toISOString(), granularity: 'hour' }
  }

  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const to = new Date(startOfToday)
  to.setDate(to.getDate() + 1)

  const from = new Date(startOfToday)
  from.setDate(from.getDate() - (option.days - 1))

  return { from: from.toISOString(), to: to.toISOString(), granularity: 'day' }
}

/**
 * 把后端返回的 RFC3339 桶起点格式化成坐标轴标签。
 *
 * 直接切片而不经过 `new Date()`：后端按请求时区切好桶并带上了偏移，
 * 再经浏览器时区换算会让标签在非本地时区下整体偏移。
 */
export function formatBucketLabel(value: string, granularity: StatsGranularity): string {
  if (granularity === 'hour') {
    return value.length >= 16 ? value.slice(11, 16) : value
  }
  return value.length >= 10 ? value.slice(5, 10) : value
}
