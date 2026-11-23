import { mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/error'
import { batchesApi } from '@/api/batches'
import { skusApi } from '@/api/skus'
import BatchListView from '@/features/inventory/batches/BatchListView.vue'
import { naiveTestPlugin } from '@/test/naive'

const messageError = vi.fn()
const messageSuccess = vi.fn()
const dialogWarning = vi.fn()
const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useMessage: () => ({ error: messageError, success: messageSuccess, warning: vi.fn() }),
    useDialog: () => ({ warning: dialogWarning }),
  }
})

vi.mock('@/api/batches', () => ({
  batchesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    disable: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('@/api/skus', () => ({
  skusApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

const activeBatch = {
  id: 3,
  sku_id: 7,
  sku: { id: 7, code: 'SKU-1', name: '橄榄油', deleted: false },
  batch_no: 'B-20250510',
  first_received_at: null,
  production_date: '2025-05-01',
  expiration_date: '2027-04-30',
  status: 'active' as const,
  dispatch_priority: 10,
  remark: null,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
}

const inactiveBatch = {
  ...activeBatch,
  id: 4,
  batch_no: 'B-OLD-RECALL',
  status: 'inactive' as const,
}

function mockList() {
  vi.mocked(batchesApi.list).mockResolvedValue({
    items: [activeBatch, inactiveBatch],
    total: 2,
    limit: 100,
    offset: 0,
  })
}

async function mountView() {
  mockList()
  vi.mocked(skusApi.list).mockResolvedValue({
    items: [
      {
        id: 7,
        material_id: 1,
        code: 'SKU-1',
        name: '橄榄油',
        unit_id: 1,
        status: 'active' as const,
        created_at: '2026-09-01T10:00:00Z',
        updated_at: '2026-09-01T10:00:00Z',
      },
    ],
    total: 1,
    limit: 100,
    offset: 0,
  })

  const wrapper = mount(NConfigProvider, {
    global: { plugins: [naiveTestPlugin] },
    slots: { default: () => h(BatchListView) },
  })
  await vi.waitFor(() => expect(wrapper.findAll('tbody tr').length).toBeGreaterThan(0))
  return wrapper
}

function buttonNamed(wrapper: Awaited<ReturnType<typeof mountView>>, name: string, index = 0) {
  const matches = wrapper.findAll('button').filter((button) => button.text() === name)
  const target = matches[index]
  if (!target) throw new Error(`未找到按钮：${name}`)
  return target
}

function lastDialogOptions() {
  const call = dialogWarning.mock.calls.at(-1)
  if (!call) throw new Error('dialog.warning 未被调用')
  return call[0] as { content: string; onPositiveClick: () => Promise<void> | void }
}

describe('BatchListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders batch numbers, SKU labels and status', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()

    expect(text).toContain('B-20250510')
    expect(text).toContain('SKU-1 - 橄榄油')
    expect(text).toContain('2025-05-01')
    expect(wrapper.findAll('button').filter((b) => b.text() === '详情')).toHaveLength(2)
    expect(wrapper.findAll('button').filter((b) => b.text() === '编辑')).toHaveLength(2)
    expect(wrapper.findAll('button').filter((b) => b.text() === '删除')).toHaveLength(2)
  })

  it('disables the disable action for an already inactive batch', async () => {
    const wrapper = await mountView()

    const disableButtons = wrapper.findAll('button').filter((b) => b.text() === '停用')

    expect(disableButtons[0]?.attributes('disabled')).toBeUndefined()
    expect(disableButtons[1]?.attributes('disabled')).toBeDefined()
  })

  it('opens the detail route when the row action is used', async () => {
    const wrapper = await mountView()

    await buttonNamed(wrapper, '详情').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/inventory/batches/3')
  })

  it('asks for confirmation with the batch number before deleting', async () => {
    const wrapper = await mountView()

    await buttonNamed(wrapper, '删除').trigger('click')

    expect(dialogWarning).toHaveBeenCalledTimes(1)
    expect(lastDialogOptions().content).toContain('B-20250510')
    expect(batchesApi.remove).not.toHaveBeenCalled()
  })

  it('deletes and reloads only after confirmation', async () => {
    const wrapper = await mountView()
    vi.mocked(batchesApi.remove).mockResolvedValue(undefined)

    await buttonNamed(wrapper, '删除').trigger('click')
    await lastDialogOptions().onPositiveClick()

    expect(batchesApi.remove).toHaveBeenCalledWith(3)
    expect(messageSuccess).toHaveBeenCalledWith('批次已删除')
    expect(batchesApi.list).toHaveBeenCalledTimes(2)
  })

  it('shows a readable message when the batch is still referenced', async () => {
    const wrapper = await mountView()
    vi.mocked(batchesApi.remove).mockRejectedValue(
      new ApiError('inventory batch is referenced by inventory records', {
        status: 409,
        code: 409,
        errorCode: 'INVENTORY_BATCH_REFERENCED',
        traceId: 'trace-9',
      }),
    )

    await buttonNamed(wrapper, '删除').trigger('click')
    await lastDialogOptions().onPositiveClick()

    expect(messageError).toHaveBeenCalledWith('批次已有库存或流水引用，请改用停用')
  })

  it('disables a batch after confirmation', async () => {
    const wrapper = await mountView()
    vi.mocked(batchesApi.disable).mockResolvedValue({ ...activeBatch, status: 'inactive' })

    await buttonNamed(wrapper, '停用').trigger('click')

    expect(lastDialogOptions().content).toContain('B-20250510')
    await lastDialogOptions().onPositiveClick()

    expect(batchesApi.disable).toHaveBeenCalledWith(3)
    expect(messageSuccess).toHaveBeenCalledWith('批次已停用')
  })
})
