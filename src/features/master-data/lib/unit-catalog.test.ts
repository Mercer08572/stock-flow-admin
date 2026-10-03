import { describe, expect, it } from 'vitest'

import { commensurableUnitTypes, toUnitDefs } from '@/features/master-data/lib/unit-catalog'

import type { Unit } from '@/types/api'

describe('toUnitDefs', () => {
  it('keeps the unit type needed for commensurability checks', () => {
    const unit: Unit = {
      id: 3,
      code: 'KG',
      name: '千克',
      symbol: 'kg',
      unit_type: 'weight',
      precision: 3,
      status: 'active',
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T10:00:00Z',
    }

    expect(toUnitDefs([unit])).toEqual([
      { id: 3, code: 'KG', name: '千克', symbol: 'kg', unitType: 'weight' },
    ])
  })
})

describe('commensurableUnitTypes', () => {
  it('accepts the same type', () => {
    expect(commensurableUnitTypes('weight', 'weight')).toBe(true)
  })

  it('accepts the package and count pair in both directions', () => {
    expect(commensurableUnitTypes('package', 'count')).toBe(true)
    expect(commensurableUnitTypes('count', 'package')).toBe(true)
  })

  it('rejects the pairs that would produce meaningless sums', () => {
    // 「1 张 = 多少 kg」取决于规格，不是单位换算能表达的关系，必须挡住
    expect(commensurableUnitTypes('weight', 'count')).toBe(false)
    expect(commensurableUnitTypes('weight', 'package')).toBe(false)
    expect(commensurableUnitTypes('length', 'area')).toBe(false)
  })
})
