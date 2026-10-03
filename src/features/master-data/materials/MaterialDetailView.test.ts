import { mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/error'
import { categoriesApi } from '@/api/categories'
import { conversionsApi } from '@/api/conversions'
import { materialsApi } from '@/api/materials'
import { skusApi } from '@/api/skus'
import { unitsApi } from '@/api/units'
import MaterialDetailView from '@/features/master-data/materials/MaterialDetailView.vue'
import { naiveTestPlugin } from '@/test/naive'

const MATERIAL_ID = 101

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: String(MATERIAL_ID) } }),
  useRouter: () => ({ push: vi.fn() }),
}))

const dialogWarning = vi.fn()

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useMessage: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
    useDialog: () => ({ warning: dialogWarning }),
  }
})

vi.mock('@/api/materials', () => ({ materialsApi: { get: vi.fn(), list: vi.fn() } }))
vi.mock('@/api/conversions', () => ({
  conversionsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}))
vi.mock('@/api/skus', () => ({
  skusApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), get: vi.fn() },
}))
vi.mock('@/api/units', () => ({ unitsApi: { list: vi.fn() } }))
vi.mock('@/api/categories', () => ({ categoriesApi: { list: vi.fn() } }))

const now = '2026-10-01T10:00:00Z'
const category = {
  id: 11,
  code: 'CAT-01',
  name: '金属件',
  parent_id: null,
  status: 'active' as const,
  remark: null,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
}

const kgUnit = {
  id: 1,
  code: 'KG',
  name: '千克',
  symbol: 'kg',
  unit_type: 'weight' as const,
  precision: 3,
  status: 'active' as const,
  created_at: now,
  updated_at: now,
}
const material = {
  id: MATERIAL_ID,
  code: 'M-001',
  name: '钢板',
  category_id: 11,
  base_unit_id: 1,
  status: 'active' as const,
  remark: null,
  created_at: now,
  updated_at: now,
}
const sku = {
  id: 1001,
  code: 'SKU-001',
  name: '钢板 1mm',
  material_id: MATERIAL_ID,
  unit_id: 1,
  status: 'active' as const,
  remark: null,
  created_at: now,
  updated_at: now,
}

/** 读取基础信息里某个字段的取值（标签与取值是分开的两个元素） */
function factValue(wrapper: ReturnType<typeof mountView>, label: string): string {
  const fact = wrapper.findAll('.material-fact').find((item) => item.find('dt').text() === label)
  if (!fact) throw new Error(`未找到基础信息字段：${label}`)

  return fact.find('dd').text()
}

function mountView() {
  return mount(NConfigProvider, {
    global: { plugins: [naiveTestPlugin] },
    slots: { default: () => h(MaterialDetailView) },
  })
}

async function mountLoaded() {
  vi.mocked(materialsApi.get).mockResolvedValue(material)
  vi.mocked(skusApi.list).mockResolvedValue({ items: [sku], limit: 100, offset: 0 })

  const wrapper = mountView()
  await vi.waitFor(() => expect(wrapper.findAll('tbody tr').length).toBeGreaterThan(0))
  return wrapper
}

describe('MaterialDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 抽屉预填与「单位换算」区块都要先加载单位目录与换算列表；
    // 不提供会让加载先失败，看不到后续请求
    vi.mocked(unitsApi.list).mockResolvedValue({ items: [kgUnit], limit: 100, offset: 0 })
    vi.mocked(categoriesApi.list).mockResolvedValue({ items: [category], limit: 100, offset: 0 })
    vi.mocked(materialsApi.list).mockResolvedValue({ items: [], limit: 100, offset: 0 })
    vi.mocked(conversionsApi.list).mockResolvedValue({ items: [], limit: 100, offset: 0 })
  })

  it('loads the material and only that material\u2019s SKUs', async () => {
    const wrapper = await mountLoaded()

    expect(materialsApi.get).toHaveBeenCalledWith(MATERIAL_ID)
    // 子表按 material_id 过滤，不做跨物料查询
    expect(skusApi.list).toHaveBeenCalledWith({ material_id: MATERIAL_ID, limit: 100, offset: 0 })
    expect(wrapper.text()).toContain('SKU-001')
    expect(wrapper.text()).toContain('M-001')
    // 基础信息按「标签 / 取值」成对渲染，且分类与基础单位都显示名称而不是数字 ID
    expect(factValue(wrapper, '编码')).toBe('M-001')
    expect(factValue(wrapper, '分类')).toBe('CAT-01 - 金属件')
    expect(factValue(wrapper, '基础单位')).toBe('KG - 千克')
    expect(factValue(wrapper, '状态')).toBe('正常')
    // 子表不重复「物料」列：整张表都属于同一个物料
    expect(wrapper.findAll('th').map((th) => th.text())).not.toContain('物料')
  })

  it('wires row actions from the subtable and asks before deleting', async () => {
    const wrapper = await mountLoaded()
    vi.mocked(skusApi.remove).mockResolvedValue(undefined)

    const edit = wrapper.findAll('button').find((button) => button.text() === '编辑')
    if (!edit) throw new Error('未找到编辑按钮')
    await edit.trigger('click')

    await wrapper.vm.$nextTick()
    // 编辑预填走 GET /skus/:id
    await vi.waitFor(() => expect(skusApi.get).toHaveBeenCalledWith(sku.id))

    const remove = wrapper.findAll('button').find((button) => button.text() === '删除')
    if (!remove) throw new Error('未找到删除按钮')
    await remove.trigger('click')

    // 删除必须先二次确认，只打开确认框不发请求
    expect(skusApi.remove).not.toHaveBeenCalled()
    expect(dialogWarning).toHaveBeenCalledTimes(1)

    const options = dialogWarning.mock.calls.at(-1)?.[0] as { onPositiveClick: () => unknown }
    await options.onPositiveClick()

    expect(skusApi.remove).toHaveBeenCalledWith(sku.id)
  })

  it('shows the material load error with a retry entry', async () => {
    // 物料详情加载失败时不能只留空白；错误来自 response 封装（ApiError）
    vi.mocked(materialsApi.get).mockRejectedValue(
      new ApiError('material not found', { status: 404, code: 1004, traceId: 'trace-404' }),
    )
    vi.mocked(skusApi.list).mockResolvedValue({ items: [], limit: 100, offset: 0 })

    const wrapper = mountView()

    await vi.waitFor(() => expect(wrapper.text()).toContain('material not found'))
    expect(wrapper.text()).toContain('trace-404')
    expect(wrapper.text()).toContain('重试')
  })
})
