<script setup lang="ts">
import { RefreshCw, RotateCcw, Search } from '@lucide/vue'
import { NButton, NPagination } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'

import { getErrorDetail, type ErrorDetail } from '@/api/error'
import { inventoryApi } from '@/api/inventory'
import { skusApi } from '@/api/skus'
import { warehousesApi } from '@/api/warehouses'
import AsyncState from '@/components/common/AsyncState.vue'
import DataTable from '@/components/common/DataTable.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import PageHeader from '@/components/common/PageHeader.vue'
import {
  buildStockQuery,
  referenceCode,
  referenceName,
  toSelectOptions,
  STOCK_PAGE_SIZE,
  type StockFilters,
} from '@/features/inventory/stock-list'

import type { StockBalance, StockLayer } from '@/types/api'

interface SelectOption {
  label: string
  value: number
}

const filters = reactive<StockFilters>({ warehouseId: null, skuId: null })
const offset = ref(0)
const total = ref(0)
const rows = ref<StockBalance[]>([])
const loading = ref(false)
const errorDetail = ref<ErrorDetail | null>(null)

const warehouseOptions = ref<SelectOption[]>([])
const skuOptions = ref<SelectOption[]>([])
const optionsError = ref('')

const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref<ErrorDetail | null>(null)
const detail = ref<StockBalance | null>(null)
/** 保留当前明细对应的行，重试时不需要依赖已加载成功的 detail */
const detailTarget = ref<{ warehouseId: number; skuId: number } | null>(null)

const columns: DataTableColumn<StockBalance>[] = [
  {
    key: 'warehouse.code',
    title: '仓库编码',
    width: 130,
    // 主数据被软删除后引用可能整体缺失，回退展示 ID 而不是留空
    render: (row) => referenceCode(row.warehouse, row.warehouse_id),
  },
  {
    key: 'warehouse.name',
    title: '仓库名称',
    width: 160,
    render: (row) => referenceName(row.warehouse, row.warehouse_id),
  },
  {
    key: 'sku.code',
    title: 'SKU 编码',
    width: 140,
    render: (row) => referenceCode(row.sku, row.sku_id),
  },
  {
    key: 'sku.name',
    title: 'SKU 名称',
    width: 180,
    render: (row) => referenceName(row.sku, row.sku_id),
  },
  { key: 'on_hand_qty', title: '在库数量', width: 120, align: 'right' },
  { key: 'reserved_qty', title: '预留数量', width: 120, align: 'right' },
  { key: 'available_qty', title: '可用数量', width: 120, align: 'right' },
  {
    key: 'updated_at',
    title: '更新时间',
    width: 170,
    render: (row) => formatDateTime(row.updated_at),
  },
]

const layerColumns: DataTableColumn<StockLayer>[] = [
  {
    key: 'batch_id',
    title: '批次',
    width: 110,
    align: 'right',
    render: (row) => (row.batch_id === null ? '无批次' : String(row.batch_id)),
  },
  {
    key: 'received_at',
    title: '入库时间',
    width: 170,
    render: (row) => formatDateTime(row.received_at),
  },
  { key: 'on_hand_qty', title: '在库数量', width: 120, align: 'right' },
  { key: 'reserved_qty', title: '预留数量', width: 120, align: 'right' },
  { key: 'available_qty', title: '可用数量', width: 120, align: 'right' },
]

const page = computed(() => Math.floor(offset.value / STOCK_PAGE_SIZE) + 1)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / STOCK_PAGE_SIZE)))

async function load() {
  loading.value = true
  errorDetail.value = null
  try {
    const result = await inventoryApi.list(buildStockQuery(filters, offset.value, STOCK_PAGE_SIZE))
    total.value = result.total
    rows.value = result.items ?? []

    // 删除或数据变化后当前页可能已经越界：回退到最后一个有数据的页
    if (rows.value.length === 0 && offset.value > 0) {
      const lastOffset =
        result.total > 0
          ? Math.max(0, Math.ceil(result.total / STOCK_PAGE_SIZE) - 1) * STOCK_PAGE_SIZE
          : 0
      if (offset.value > lastOffset) {
        offset.value = lastOffset
        await load()
        return
      }
    }
  } catch (error) {
    total.value = 0
    rows.value = []
    errorDetail.value = getErrorDetail(error)
  } finally {
    loading.value = false
  }
}

/**
 * 加载筛选下拉的选项。
 *
 * 后端 `/warehouses` 与 `/skus` 都没有关键字搜索、`limit` 上限 100，
 * 所以这里只取前 100 条做本地可搜索下拉；失败不阻塞列表查询。
 */
async function loadOptions() {
  optionsError.value = ''
  try {
    const [warehouseResult, skuResult] = await Promise.all([
      warehousesApi.list({ limit: STOCK_PAGE_SIZE, offset: 0 }),
      skusApi.list({ limit: STOCK_PAGE_SIZE, offset: 0 }),
    ])
    warehouseOptions.value = toSelectOptions(warehouseResult.items ?? [])
    skuOptions.value = toSelectOptions(skuResult.items ?? [])
  } catch (error) {
    optionsError.value = `筛选项加载失败：${getErrorDetail(error).message}`
  }
}

/** 条件变化必须回到第一页，否则会拿着旧 offset 查新条件 */
async function search() {
  offset.value = 0
  await load()
}

function reset() {
  filters.warehouseId = null
  filters.skuId = null
  void search()
}

async function goToPage(targetPage: number) {
  if (loading.value) return
  const nextOffset = Math.max(0, (targetPage - 1) * STOCK_PAGE_SIZE)
  if (nextOffset === offset.value) return
  offset.value = nextOffset
  await load()
}

async function openDetail(row: StockBalance) {
  detailOpen.value = true
  detailError.value = null
  detail.value = null
  detailTarget.value = { warehouseId: row.warehouse_id, skuId: row.sku_id }
  await fetchDetail(row.warehouse_id, row.sku_id)
}

async function fetchDetail(warehouseId: number, skuId: number) {
  detailLoading.value = true
  detailError.value = null
  try {
    detail.value = await inventoryApi.get(warehouseId, skuId, { include_layers: true })
  } catch (error) {
    detailError.value = getErrorDetail(error)
  } finally {
    detailLoading.value = false
  }
}

function retryDetail() {
  const target = detailTarget.value
  if (target) void fetchDetail(target.warehouseId, target.skuId)
}

onMounted(async () => {
  await Promise.all([load(), loadOptions()])
})
</script>

<template>
  <main class="page">
    <PageHeader title="库存余额" :description="`共 ${total} 条 · 第 ${page} / ${pageCount} 页`">
      <template #actions>
        <NButton :loading="loading" @click="load">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="stock-panel panel">
      <NForm inline :show-feedback="false" class="filters" @submit.prevent="search">
        <NFormItem label="仓库">
          <NSelect
            v-model:value="filters.warehouseId"
            class="filters__select"
            :options="warehouseOptions"
            filterable
            clearable
            placeholder="全部仓库"
          />
        </NFormItem>
        <NFormItem label="SKU">
          <NSelect
            v-model:value="filters.skuId"
            class="filters__select"
            :options="skuOptions"
            filterable
            clearable
            placeholder="全部 SKU"
          />
        </NFormItem>
        <div class="filters__actions">
          <NButton attr-type="submit" type="primary" :loading="loading">
            <template #icon><Search :size="16" /></template>
            查询
          </NButton>
          <NButton @click="reset">
            <template #icon><RotateCcw :size="16" /></template>
            重置
          </NButton>
        </div>
      </NForm>

      <NAlert v-if="optionsError" type="warning" :show-icon="true" class="filters__warning">
        {{ optionsError }}
      </NAlert>

      <DataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :error="errorDetail?.message ?? ''"
        :error-trace-id="errorDetail?.traceId ?? ''"
        empty-text="暂无库存数据"
        export-file-name="库存余额"
        row-clickable
        @retry="load"
        @row-click="openDetail"
      />

      <footer class="pager">
        <span class="pager__hint">共 {{ total }} 条，每页 {{ STOCK_PAGE_SIZE }} 条</span>
        <NPagination
          v-if="total > 0"
          :page="page"
          :item-count="total"
          :page-size="STOCK_PAGE_SIZE"
          :disabled="loading"
          show-quick-jumper
          @update:page="goToPage"
        >
          <template #goto>跳至</template>
        </NPagination>
      </footer>
    </section>

    <NDrawer v-model:show="detailOpen" :width="640" placement="right">
      <NDrawerContent closable>
        <template #header>
          <div class="drawer-header">
            <span>库存层明细</span>
            <NButton size="small" :loading="detailLoading" @click="retryDetail">
              <template #icon><RefreshCw :size="14" /></template>
              刷新
            </NButton>
          </div>
        </template>
        <AsyncState
          :loading="detailLoading"
          :error="detailError?.message ?? ''"
          :error-trace-id="detailError?.traceId ?? ''"
          :empty="!detailLoading && !detailError && (detail?.layers?.length ?? 0) === 0"
          empty-text="该库存暂无层明细"
          @retry="retryDetail"
        >
          <div v-if="detail" class="detail-summary">
            <span>仓库：{{ referenceCode(detail.warehouse, detail.warehouse_id) }}</span>
            <span>SKU：{{ referenceCode(detail.sku, detail.sku_id) }}</span>
            <span>在库：{{ detail.on_hand_qty }}</span>
            <span>预留：{{ detail.reserved_qty }}</span>
            <span>可用：{{ detail.available_qty }}</span>
          </div>
          <DataTable
            :columns="layerColumns"
            :rows="detail?.layers ?? []"
            empty-text="该库存暂无层明细"
            export-file-name="库存层明细"
          />
        </AsyncState>
      </NDrawerContent>
    </NDrawer>
  </main>
</template>

<style scoped>
.stock-panel {
  min-width: 0;
}

.filters {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.filters__select {
  width: 220px;
}

.filters__actions {
  display: flex;
  gap: 8px;
}

.filters__warning {
  margin: 12px 16px 0;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
}

.pager__hint {
  color: var(--color-text-muted);
  font-size: 12px;
}

.pager :deep(.n-pagination) {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-right: 6px;
}

.detail-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 12px;
  color: var(--color-text-muted);
  font-size: 13px;
}

@media (max-width: 680px) {
  .filters {
    align-items: stretch;
    flex-direction: column;
  }

  .filters :deep(.n-form-item),
  .filters__select {
    width: 100%;
  }

  .filters__actions > * {
    flex: 1;
  }

  .pager {
    align-items: stretch;
    flex-direction: column;
  }

  .pager :deep(.n-pagination) {
    justify-content: flex-start;
  }
}
</style>
