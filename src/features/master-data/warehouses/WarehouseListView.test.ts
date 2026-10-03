import { mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/error'
import { warehousesApi } from '@/api/warehouses'
import WarehouseListView from '@/features/master-data/warehouses/WarehouseListView.vue'
import { naiveTestPlugin } from '@/test/naive'

const messageError = vi.fn()
const messageSuccess = vi.fn()
const dialogWarning = vi.fn()

// 共享列表模板用 useRouter 打开行详情；仓库没有详情页，这里只为满足注入
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useMessage: () => ({ error: messageError, success: messageSuccess, warning: vi.fn() }),
    useDialog: () => ({ warning: dialogWarning }),
  }
})

vi.mock('@/api/warehouses', () => ({
  warehousesApi: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    disable: vi.fn(),
  },
}))

const activeWarehouse = {
  id: 3,
  code: 'WH-01',
  name: '主仓',
  type: 'normal',
  status: 'active',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
}

const inactiveWarehouse = {
  ...activeWarehouse,
  id: 4,
  code: 'WH-02',
  name: '备用仓',
  status: 'inactive',
}

function mockList() {
  vi.mocked(warehousesApi.list).mockResolvedValue({
    items: [activeWarehouse, inactiveWarehouse],
    limit: 100,
    offset: 0,
  })
}

async function mountView() {
  mockList()
  // Naive UI 的表单/表格组件要求上层存在 NConfigProvider
  const wrapper = mount(NConfigProvider, {
    global: { plugins: [naiveTestPlugin] },
    slots: { default: () => h(WarehouseListView) },
  })
  // 列表为异步加载，等待一行渲染出来
  await vi.waitFor(() => expect(wrapper.findAll('tbody tr').length).toBeGreaterThan(0))
  return wrapper
}

function buttonNamed(wrapper: Awaited<ReturnType<typeof mountView>>, name: string, index = 0) {
  const matches = wrapper.findAll('button').filter((button) => button.text() === name)
  const target = matches[index]
  if (!target) throw new Error(`未找到按钮：${name}`)
  return target
}

/** 取出 dialog.warning 的选项；测试里用它替代真实弹窗 */
function lastDialogOptions() {
  const call = dialogWarning.mock.calls.at(-1)
  if (!call) throw new Error('dialog.warning 未被调用')
  return call[0] as { content: string; onPositiveClick: () => Promise<void> | void }
}

describe('WarehouseListView 行操作', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders edit, disable and delete actions for every row', async () => {
    const wrapper = await mountView()

    expect(wrapper.findAll('button').filter((b) => b.text() === '编辑')).toHaveLength(2)
    expect(wrapper.findAll('button').filter((b) => b.text() === '删除')).toHaveLength(2)
    expect(wrapper.findAll('button').filter((b) => b.text() === '停用')).toHaveLength(2)
  })

  it('disables the disable action for an already inactive warehouse', async () => {
    const wrapper = await mountView()

    const disableButtons = wrapper.findAll('button').filter((b) => b.text() === '停用')

    expect(disableButtons[0]?.attributes('disabled')).toBeUndefined()
    expect(disableButtons[1]?.attributes('disabled')).toBeDefined()
  })

  it('asks for confirmation with the code and name before deleting', async () => {
    const wrapper = await mountView()

    await buttonNamed(wrapper, '删除').trigger('click')

    expect(dialogWarning).toHaveBeenCalledTimes(1)
    expect(lastDialogOptions().content).toContain('WH-01')
    expect(lastDialogOptions().content).toContain('主仓')
    // 仅打开确认框不应发出请求
    expect(warehousesApi.remove).not.toHaveBeenCalled()
  })

  it('deletes and reloads the list only after confirmation', async () => {
    const wrapper = await mountView()
    vi.mocked(warehousesApi.remove).mockResolvedValue(undefined)

    await buttonNamed(wrapper, '删除').trigger('click')
    await lastDialogOptions().onPositiveClick()

    expect(warehousesApi.remove).toHaveBeenCalledWith(3)
    expect(messageSuccess).toHaveBeenCalledWith('仓库已删除')
    // 初次加载 + 删除后刷新
    expect(warehousesApi.list).toHaveBeenCalledTimes(2)
  })

  it('shows a readable Chinese message when the warehouse is still referenced', async () => {
    const wrapper = await mountView()
    vi.mocked(warehousesApi.remove).mockRejectedValue(
      new ApiError('warehouse is referenced by inventory and cannot be deleted', {
        status: 409,
        code: 1009,
        errorCode: 'WAREHOUSE_REFERENCED_BY_INVENTORY',
        traceId: 'trace-9',
      }),
    )

    await buttonNamed(wrapper, '删除').trigger('click')
    await lastDialogOptions().onPositiveClick()

    expect(messageError).toHaveBeenCalledWith('已被库存引用，无法删除')
  })

  it('disables a warehouse after confirmation', async () => {
    const wrapper = await mountView()
    vi.mocked(warehousesApi.disable).mockResolvedValue({
      ...activeWarehouse,
      status: 'inactive',
    })

    await buttonNamed(wrapper, '停用').trigger('click')

    expect(lastDialogOptions().content).toContain('WH-01')
    await lastDialogOptions().onPositiveClick()

    expect(warehousesApi.disable).toHaveBeenCalledWith(3)
    expect(messageSuccess).toHaveBeenCalledWith('仓库已停用')
  })
})
