import { describe, expect, it } from 'vitest'

import { reservationQuantitySegments } from './reservation-quantity'

/** 只关心四个数量字段，其余字段与本函数无关 */
function quantities(total: string, released: string, consumed: string, remaining: string) {
  return {
    total_qty: total,
    released_qty: released,
    consumed_qty: consumed,
    remaining_qty: remaining,
  }
}

describe('reservationQuantitySegments', () => {
  it('按消耗 / 释放 / 剩余的顺序拆出比例与百分比', () => {
    const segments = reservationQuantitySegments(quantities('5', '1', '1', '3'))

    expect(segments.map((segment) => segment.key)).toEqual(['consumed', 'released', 'remaining'])
    expect(segments.map((segment) => segment.label)).toEqual(['已消耗', '已释放', '剩余'])
    expect(segments.map((segment) => segment.qty)).toEqual(['1', '1', '3'])
    expect(segments.map((segment) => segment.share)).toEqual([0.2, 0.2, 0.6])
    expect(segments.map((segment) => segment.percentLabel)).toEqual(['20%', '20%', '60%'])
  })

  it('释放量为 0 时仍然返回该段，数值与百分比不会被进度条宽度吞掉', () => {
    const segments = reservationQuantitySegments(quantities('5', '0', '0', '5'))
    const released = segments.find((segment) => segment.key === 'released')

    expect(released).toBeDefined()
    expect(released?.qty).toBe('0')
    expect(released?.share).toBe(0)
    expect(released?.percentLabel).toBe('0%')
  })

  it('小数数量保留一位小数百分比，不丢段', () => {
    const segments = reservationQuantitySegments(quantities('3.5', '1', '0', '2.5'))

    expect(segments.map((segment) => segment.qty)).toEqual(['0', '1', '2.5'])
    expect(segments.map((segment) => segment.percentLabel)).toEqual(['0%', '28.6%', '71.4%'])
    expect(segments.reduce((sum, segment) => sum + segment.share, 0)).toBeCloseTo(1, 10)
  })

  it('总量为 0 时不产生 NaN，全部退化为 0%', () => {
    const segments = reservationQuantitySegments(quantities('0', '0', '0', '0'))

    for (const segment of segments) {
      expect(segment.share).toBe(0)
      expect(segment.percentLabel).toBe('0%')
    }
  })

  it('总量非法时用三段之和兜底，比例仍然自洽', () => {
    const segments = reservationQuantitySegments(quantities('', '1', '1', '3'))

    expect(segments.map((segment) => segment.percentLabel)).toEqual(['20%', '20%', '60%'])
    expect(segments.reduce((sum, segment) => sum + segment.share, 0)).toBeCloseTo(1, 10)
  })

  it('三段之和超过总量时按最大值归一，进度条不溢出且百分比不超 100%', () => {
    const segments = reservationQuantitySegments(quantities('1', '2', '1', '1'))
    const totalShare = segments.reduce((sum, segment) => sum + segment.share, 0)

    expect(totalShare).toBeCloseTo(1, 10)
    for (const segment of segments) {
      expect(segment.share).toBeLessThanOrEqual(1)
      expect(Number.parseFloat(segment.percentLabel)).toBeLessThanOrEqual(100)
    }
  })
})
