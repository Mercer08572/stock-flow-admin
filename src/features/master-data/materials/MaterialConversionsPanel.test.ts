import { mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { conversionsApi } from '@/api/conversions'
import MaterialConversionsPanel from '@/features/master-data/materials/MaterialConversionsPanel.vue'
import { naiveTestPlugin } from '@/test/naive'

import type { UnitDef } from '@/features/master-data/lib/unit-catalog'
import type { MaterialUnitConversion } from '@/types/api'

const MATERIAL_ID = 10
const METER = 5
const CENTIMETER = 6

const units: UnitDef[] = [
  { id: METER, code: 'M', name: '米', symbol: 'm', unitType: 'length' },
  { id: CENTIMETER, code: 'CM', name: '厘米', symbol: 'cm', unitType: 'length' },
]

const now = '2026-10-01T10:00:00Z'

/** 存量数据里互为反向的两条：界面必须逐行如实显示，而不是归一成同一条 */
const conversions: MaterialUnitConversion[] = [
  {
    id: 4,
    material_id: MATERIAL_ID,
    from_unit_id: METER,
    to_unit_id: CENTIMETER,
    factor: '100.0000000000',
    created_at: now,
    updated_at: now,
  },
  {
    id: 5,
    material_id: MATERIAL_ID,
    from_unit_id: CENTIMETER,
    to_unit_id: METER,
    factor: '0.0100000000',
    created_at: now,
    updated_at: now,
  },
]

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useMessage: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
    useDialog: () => ({ warning: vi.fn() }),
  }
})

vi.mock('@/api/conversions', () => ({
  conversionsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

function mountPanel() {
  return mount(NConfigProvider, {
    global: { plugins: [naiveTestPlugin] },
    slots: {
      default: () =>
        h(MaterialConversionsPanel, {
          materialId: MATERIAL_ID,
          baseUnitId: METER,
          units,
        }),
    },
  })
}

async function mountLoaded() {
  vi.mocked(conversionsApi.list).mockResolvedValue({
    items: conversions,
    limit: 100,
    offset: 0,
  })

  const wrapper = mountPanel()
  await vi.waitFor(() => expect(wrapper.findAll('tbody tr').length).toBe(2))
  return wrapper
}

describe('MaterialConversionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders every stored conversion with its own direction', async () => {
    const wrapper = await mountLoaded()

    const relationCells = wrapper.findAll('tbody td[data-col-key="relation"]')
    expect(relationCells.map((cell) => cell.text())).toEqual([
      '1 M - 米 = 100.0000000000 CM - 厘米',
      '1 CM - 厘米 = 0.0100000000 M - 米',
    ])

    // 方向列让人能看出这两行是同一对单位的两个方向
    const directionCells = wrapper.findAll('tbody td[data-col-key="direction"]')
    expect(directionCells.map((cell) => cell.text())).toEqual([
      '基础单位 → 目标',
      '目标 → 基础单位',
    ])
  })

  it('asks the backend for the material conversions of this material', async () => {
    await mountLoaded()

    expect(conversionsApi.list).toHaveBeenCalledWith(MATERIAL_ID, { limit: 100, offset: 0 })
  })
})
