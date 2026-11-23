import { mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/error'
import { batchesApi } from '@/api/batches'
import BatchDetailView from '@/features/inventory/batches/BatchDetailView.vue'
import { naiveTestPlugin } from '@/test/naive'

const BATCH_ID = 3
const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: String(BATCH_ID) }, path: `/inventory/batches/${BATCH_ID}` }),
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useMessage: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
    useDialog: () => ({ warning: vi.fn() }),
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

const detail = {
  id: BATCH_ID,
  sku_id: 7,
  sku: { id: 7, code: 'SKU-1', name: '橄榄油', deleted: false },
  batch_no: 'B-20250510',
  first_received_at: '2025-05-10T09:00:00+08:00',
  production_date: '2025-05-01',
  expiration_date: '2027-04-30',
  status: 'active' as const,
  dispatch_priority: 10,
  remark: null,
  created_at: '2025-05-10T09:00:00+08:00',
  updated_at: '2025-05-10T09:00:00+08:00',
  stocks: [
    {
      warehouse_id: 1,
      warehouse: { id: 1, code: 'WH-SH', name: '上海仓', deleted: false },
      on_hand_qty: '500.000000',
      reserved_qty: '100.000000',
      available_qty: '400.000000',
      layer_count: 1,
    },
  ],
}

function mountView() {
  return mount(NConfigProvider, {
    global: { plugins: [naiveTestPlugin] },
    slots: { default: () => h(BatchDetailView) },
  })
}

describe('BatchDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the batch facts and the stock distribution', async () => {
    vi.mocked(batchesApi.get).mockResolvedValue(detail)

    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('B-20250510'))

    const text = wrapper.text()
    expect(text).toContain('SKU-1 - 橄榄油')
    expect(text).toContain('2025-05-01')
    expect(text).toContain('2027-04-30')
    expect(text).toContain('WH-SH - 上海仓')
    expect(text).toContain('400.000000')
    expect(text).toContain('库存分布（共 1 个仓库）')
  })

  it('shows an empty state when the batch has no stock', async () => {
    vi.mocked(batchesApi.get).mockResolvedValue({ ...detail, stocks: [] })

    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('B-20250510'))

    expect(wrapper.text()).toContain('该批次暂无库存')
  })

  it('renders the backend error message and retries on demand', async () => {
    vi.mocked(batchesApi.get).mockRejectedValue(
      new ApiError('inventory batch not found', {
        status: 404,
        code: 404,
        errorCode: 'INVENTORY_BATCH_NOT_FOUND',
        traceId: 'trace-7',
      }),
    )

    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('inventory batch not found'))

    expect(wrapper.text()).toContain('trace-7')

    vi.mocked(batchesApi.get).mockResolvedValue(detail)
    const retry = wrapper.findAll('button').find((button) => button.text() === '重试')
    await retry?.trigger('click')

    await vi.waitFor(() => expect(wrapper.text()).toContain('B-20250510'))
    expect(batchesApi.get).toHaveBeenCalledTimes(2)
  })

  it('navigates back to the list', async () => {
    vi.mocked(batchesApi.get).mockResolvedValue(detail)

    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('B-20250510'))

    const back = wrapper.findAll('button').find((button) => button.text() === '返回列表')
    await back?.trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/inventory/batches')
  })
})
