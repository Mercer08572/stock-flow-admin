import { describe, expect, it } from 'vitest'

import {
  availableTargetUnits,
  skuUnitOptions,
  toConversionRow,
  unitLabel,
} from '@/features/master-data/materials/material-conversion'

import type { UnitDef } from '@/features/master-data/lib/unit-catalog'
import type { MaterialUnitConversion } from '@/types/api'

const KG: UnitDef = { id: 3, code: 'KG', name: '千克', symbol: 'kg', unitType: 'weight' }
const G: UnitDef = { id: 4, code: 'G', name: '克', symbol: 'g', unitType: 'weight' }
const LB: UnitDef = { id: 11, code: 'LB', name: '磅', symbol: 'lb', unitType: 'weight' }
const PCS: UnitDef = { id: 1, code: 'PCS', name: '个', symbol: 'pcs', unitType: 'count' }
const BOX: UnitDef = { id: 2, code: 'BOX', name: '箱', symbol: 'box', unitType: 'package' }
const M: UnitDef = { id: 5, code: 'M', name: '米', symbol: 'm', unitType: 'length' }

const units = [PCS, BOX, KG, G, LB, M]

function conversion(overrides: Partial<MaterialUnitConversion>): MaterialUnitConversion {
  return {
    id: 1,
    material_id: 10,
    from_unit_id: KG.id,
    to_unit_id: G.id,
    factor: '1000',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    ...overrides,
  }
}

describe('toConversionRow', () => {
  it('keeps the stored direction and factor untouched', () => {
    const row = toConversionRow(conversion({}))

    expect(row.fromUnitId).toBe(KG.id)
    expect(row.toUnitId).toBe(G.id)
    expect(row.factor).toBe('1000')
  })

  it('does not rewrite the opposite direction of an existing pair', () => {
    // 存量数据可能是互为反向的两条（M→CM 与 CM→M）。前端若把反向行取倒数归一，
    // 两行会显示成同一条「1 M = 100 CM」，用户看到的与接口不一致——因此必须原样呈现。
    const forward = toConversionRow(
      conversion({ id: 4, from_unit_id: M.id, to_unit_id: 6, factor: '100.0000000000' }),
    )
    const backward = toConversionRow(
      conversion({ id: 5, from_unit_id: 6, to_unit_id: M.id, factor: '0.0100000000' }),
    )

    expect(forward).toMatchObject({ fromUnitId: M.id, toUnitId: 6, factor: '100.0000000000' })
    expect(backward).toMatchObject({ fromUnitId: 6, toUnitId: M.id, factor: '0.0100000000' })
  })
})

describe('unitLabel', () => {
  it('falls back to the id when the unit is missing', () => {
    expect(unitLabel(units, 99)).toBe('#99')
  })
})

describe('availableTargetUnits', () => {
  it('only offers commensurable units that have no rule yet', () => {
    const options = availableTargetUnits(units, KG.id, [conversion({ to_unit_id: G.id })])

    expect(options.map((unit) => unit.id)).toEqual([LB.id])
  })

  it('includes the package and count pair but not length', () => {
    const options = availableTargetUnits(units, PCS.id, [])

    expect(options.map((unit) => unit.code).sort()).toEqual(['BOX'])
  })

  it('keeps the edited row unit in the candidates', () => {
    const existing = conversion({ id: 7, to_unit_id: G.id })
    const options = availableTargetUnits(units, KG.id, [existing], existing.id)

    expect(options.map((unit) => unit.code)).toEqual(['G', 'LB'])
  })
})

describe('skuUnitOptions', () => {
  it('returns nothing until a material is chosen', () => {
    expect(skuUnitOptions(units, null, [])).toEqual([])
  })

  it('offers the base unit plus units that already have a conversion', () => {
    const options = skuUnitOptions(units, KG.id, [conversion({ to_unit_id: G.id })])

    expect(options.map((option) => option.value)).toEqual([KG.id, G.id])
  })

  it('accepts a conversion stored in the opposite direction', () => {
    const options = skuUnitOptions(units, KG.id, [
      conversion({ from_unit_id: G.id, to_unit_id: KG.id, factor: '0.001' }),
    ])

    expect(options.map((option) => option.value).sort()).toEqual([G.id, KG.id].sort())
  })
})
