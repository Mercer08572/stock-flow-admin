import { mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import EntityListPage from '@/features/master-data/components/EntityListPage.vue'
import { naiveTestPlugin } from '@/test/naive'

import type { ResourceConfig } from '@/features/master-data/lib/list-config'
import type { Material } from '@/types/api'

const push = vi.fn()

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useMessage: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
    useDialog: () => ({ warning: vi.fn() }),
  }
})

const material: Material = {
  id: 101,
  code: 'M-001',
  name: '钢板',
  category_id: 11,
  base_unit_id: 1,
  status: 'active',
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
}

const config: ResourceConfig<Material> = {
  title: '物料',
  load: () => Promise.resolve({ items: [material], limit: 100, offset: 0 }),
  fields: [
    { key: 'code', label: '编码', type: 'text', required: true },
    { key: 'name', label: '名称', type: 'text', required: true },
    { key: 'status', label: '状态', type: 'select', required: true, options: [] },
  ],
  create: (body) => Promise.resolve({ ...material, ...body } as Material),
  get: () => Promise.resolve(material),
  update: (id, body) => Promise.resolve({ ...material, ...body } as Material),
  remove: () => Promise.resolve(),
  detailRoute: (row) => `/master-data/materials/${row.id}`,
}

async function mountPage() {
  const wrapper = mount(NConfigProvider, {
    global: { plugins: [naiveTestPlugin] },
    slots: { default: () => h(EntityListPage, { config }) },
  })
  await vi.waitFor(() => expect(wrapper.findAll('tbody tr').length).toBe(1))
  return wrapper
}

function buttonNamed(wrapper: Awaited<ReturnType<typeof mountPage>>, name: string) {
  const target = wrapper.findAll('button').find((button) => button.text() === name)
  if (!target) throw new Error(`未找到按钮：${name}`)
  return target
}

describe('EntityListPage 详情入口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('navigates to the detail page when the row itself is clicked', async () => {
    const wrapper = await mountPage()

    await wrapper.find('tbody tr td').trigger('click')

    expect(push).toHaveBeenCalledWith(`/master-data/materials/${material.id}`)
  })

  it('does not navigate when a row action button is clicked', async () => {
    const wrapper = await mountPage()

    // 点「编辑」必须打开抽屉，而不是被行点击带去详情页
    await buttonNamed(wrapper, '编辑').trigger('click')

    expect(push).not.toHaveBeenCalled()
  })
})
