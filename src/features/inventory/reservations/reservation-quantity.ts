/**
 * 预留单数量分布：把「总量 / 已释放 / 已消耗 / 剩余」换算成分段进度条所需的比例。
 *
 * 契约约束（已在后端核对）：
 * 1. `internal/inventory/reservation.go` 的 `applyReservationQuantities` 由
 *    `remaining = total - released - consumed` 推导剩余量，因此接口返回值里
 *    `released_qty + consumed_qty + remaining_qty` 恒等于 `total_qty`（已去尾零的字符串）。
 * 2. 数量是 decimal 字符串（如 `'3.5'`），前端只读取，不做二次格式化；
 *    展示原值可以避免把 `3.500000` 这类后端未归一的值悄悄改成别的数字。
 *
 * 这里把「比例计算」抽成纯函数，组件只负责渲染：百分比与进度条宽度必须来自同一份
 * 计算，否则用户会看到「数字 20%、条宽 21%」这类自相矛盾的画面。
 */

import type { Reservation } from '@/types/api'

export type ReservationQuantityKey = 'consumed' | 'released' | 'remaining'

export interface ReservationQuantitySegment {
  key: ReservationQuantityKey
  /** 图例文案 */
  label: string
  /** 后端原始数量字符串，原样展示（0 也保留） */
  qty: string
  /** 0..1，供进度条 `flex-grow` 使用；三段之和不会超过 1 */
  share: number
  /** 形如 `60%` / `14.3%` / `0%`，最多 1 位小数 */
  percentLabel: string
}

/**
 * 段序 = 图例序：先展示已发生的部分（消耗、释放），剩余量收在进度条右端。
 * 颜色与顺序在组件里一一对应，调整这里即可同时改变条与图例。
 */
const SEGMENT_ORDER: ReservationQuantityKey[] = ['consumed', 'released', 'remaining']

const SEGMENT_LABELS: Record<ReservationQuantityKey, string> = {
  consumed: '已消耗',
  released: '已释放',
  remaining: '剩余',
}

/** 数量字段到 key 的映射，避免运行时再拼字段名 */
const SEGMENT_FIELDS: Record<
  ReservationQuantityKey,
  'consumed_qty' | 'released_qty' | 'remaining_qty'
> = {
  consumed: 'consumed_qty',
  released: 'released_qty',
  remaining: 'remaining_qty',
}

/** 非法值、负数、空串一律按 0 处理：宁可显示 0 也不能出现 NaN 或 Infinity */
function toQuantity(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function formatPercent(ratio: number): string {
  const percent = ratio * 100
  // 去掉无意义的 `.0`（60% 而不是 60.0%），保留一位小数表达 1/7 这类除不尽的比例
  return `${percent.toFixed(1).replace(/\.0$/, '')}%`
}

export function reservationQuantitySegments(
  reservation: Pick<Reservation, 'total_qty' | 'released_qty' | 'consumed_qty' | 'remaining_qty'>,
): ReservationQuantitySegment[] {
  const values = {
    consumed: toQuantity(reservation.consumed_qty),
    released: toQuantity(reservation.released_qty),
    remaining: toQuantity(reservation.remaining_qty),
  }
  const total = toQuantity(reservation.total_qty)
  const sum = values.consumed + values.released + values.remaining

  /**
   * 百分比优先用总量作分母（用户眼里「总量」就是 100%）；
   * 总量为 0 或非法（异常数据）时退回三段之和，至少让比例仍然自洽。
   */
  const percentBase = total > 0 ? total : sum
  /**
   * 条宽按 `max(总量, 三段之和)` 归一：正常数据下两种分母等价，
   * 数据异常（三段之和超过总量）时宁可每段都按比例收窄，也不让条溢出容器。
   */
  const shareBase = Math.max(total, sum)

  return SEGMENT_ORDER.map((key) => {
    const value = values[key]
    const share = shareBase > 0 ? value / shareBase : 0
    const ratio = percentBase > 0 ? value / percentBase : 0
    return {
      key,
      label: SEGMENT_LABELS[key],
      qty: reservation[SEGMENT_FIELDS[key]],
      share,
      // 数据异常时上限 100%：条已经按最大值归一，数字也不该出现 200%
      percentLabel: formatPercent(Math.min(ratio, 1)),
    }
  })
}
