<script setup lang="ts">
/* global Event, HTMLElement */
import { ChevronDown, RefreshCw, RotateCcw, Search } from '@lucide/vue'
import {
  NAlert,
  NButton,
  NConfigProvider,
  NForm,
  NFormItem,
  NSelect,
  NSpin,
  NTag,
  dateZhCN,
  zhCN,
} from 'naive-ui'
import { computed, h, onMounted, reactive, ref } from 'vue'

import { getErrorDetail, type ErrorDetail } from '@/api/error'
import { inventoryApi } from '@/api/inventory'
import { skusApi } from '@/api/skus'
import { warehousesApi } from '@/api/warehouses'
import DataTable from '@/components/common/DataTable.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import PageHeader from '@/components/common/PageHeader.vue'
import {
  buildMovementQuery,
  formatMovementActor,
  formatMovementSource,
  hasMoreMovements,
  mergeMovementRows,
  MOVEMENT_PAGE_SIZE,
  operationTypeLabel,
  operationTypeTagType,
  OPERATION_TYPE_OPTIONS,
  referenceLabel,
  type MovementFilters,
} from '@/features/inventory/movement-list'
import { toSelectOptions } from '@/features/inventory/stock-list'

import type { InventoryMovement } from '@/types/api'

interface SelectOption {
  label: string
  value: number
}

/**
 * 已生效的筛选条件快照。
 *
 * 表单编辑与查询解耦：用户改了条件但没点「查询」时，「加载更多」仍必须按**上一次查询**
 * 的条件取下一页，否则两页数据来自不同条件，拼在一起会前后矛盾。
 */
const filters = reactive<MovementFilters>({
  warehouseId: null,
  skuId: null,
  operationType: null,
  dateRange: null,
})
const applied = ref<MovementFilters>({
  warehouseId: null,
  skuId: null,
  operationType: null,
  dateRange: null,
})

const rows = ref<InventoryMovement[]>([])
const total = ref(0)
/** 下一次请求的 offset：按已取回的条数递增，不能用 `rows.length`（去重会让两者不等） */
const nextOffset = ref(0)
const lastBatchSize = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const errorDetail = ref<ErrorDetail | null>(null)
const moreError = ref('')
/** 首屏加载后自增，用重建表格的方式把虚拟列表的滚动位置归零 */
const listVersion = ref(0)

const warehouseOptions = ref<SelectOption[]>([])
const skuOptions = ref<SelectOption[]>([])
const optionsError = ref('')

/**
 * 流水是审计数据，表格只承载展示。
 *
 * 关闭列排序：后端固定按 `created_at DESC, id DESC` 返回，而前端是**增量追加**，
 * 对已加载子集做本地排序会让「第 1 页第 1 行」不再是最新流水，容易误读。
 */
const columns: DataTableColumn<InventoryMovement>[] = [
  { key: 'id', title: '流水号', width: 100, align: 'right', sortable: false },
  {
    key: 'created_at',
    title: '发生时间',
    width: 170,
    sortable: false,
    render: (row) => formatDateTime(row.created_at),
    exportValue: (row) => formatDateTime(row.created_at, ''),
  },
  {
    key: 'operation_type',
    title: '操作类型',
    width: 120,
    sortable: false,
    render: (row) =>
      h(
        NTag,
        {
          type: operationTypeTagType(row.operation_type),
          size: 'small',
          bordered: false,
        },
        { default: () => operationTypeLabel(row.operation_type) },
      ),
    exportValue: (row) => operationTypeLabel(row.operation_type),
  },
  {
    key: 'warehouse_id',
    title: '仓库',
    width: 190,
    sortable: false,
    // 流水只带 ID，名称来自筛选下拉的选项表；取不到时回退 #id，不留空白
    render: (row) => referenceLabel(warehouseOptions.value, row.warehouse_id),
    exportValue: (row) => referenceLabel(warehouseOptions.value, row.warehouse_id),
  },
  {
    key: 'sku_id',
    title: 'SKU',
    width: 220,
    sortable: false,
    render: (row) => referenceLabel(skuOptions.value, row.sku_id),
    exportValue: (row) => referenceLabel(skuOptions.value, row.sku_id),
  },
  { key: 'qty', title: '数量', width: 120, align: 'right', sortable: false },
  {
    key: 'batch_id',
    title: '批次',
    width: 100,
    align: 'right',
    sortable: false,
    render: (row) => (row.batch_id === null ? '无批次' : String(row.batch_id)),
    exportValue: (row) => (row.batch_id === null ? '无批次' : String(row.batch_id)),
  },
  {
    key: 'stock_layer_id',
    title: '库存层',
    width: 100,
    align: 'right',
    sortable: false,
    render: (row) => (row.stock_layer_id === null ? '-' : String(row.stock_layer_id)),
  },
  {
    key: 'reservation_id',
    title: '占用单',
    width: 100,
    align: 'right',
    sortable: false,
    render: (row) => (row.reservation_id === null ? '-' : String(row.reservation_id)),
  },
  {
    key: 'source_type',
    title: '来源',
    width: 200,
    sortable: false,
    render: (row) => formatMovementSource(row),
    exportValue: (row) => formatMovementSource(row),
  },
  {
    key: 'actor_label',
    title: '操作人',
    width: 120,
    sortable: false,
    render: (row) => formatMovementActor(row),
    exportValue: (row) => formatMovementActor(row),
  },
  {
    key: 'idempotency_key',
    title: '幂等键',
    width: 240,
    sortable: false,
  },
]

const loadedHint = computed(() => {
  if (loading.value) return '加载中…'
  if (total.value === 0) return '暂无流水'
  if (!hasMore.value) return `已加载全部 ${rows.value.length} 条`
  return `已加载 ${rows.value.length} / 共 ${total.value} 条`
})

/** 行键必须是稳定的唯一键：虚拟列表靠它定位行，流水号天然唯一 */
function movementRowKey(row: InventoryMovement) {
  return row.id
}

async function loadFirstPage() {
  loading.value = true
  errorDetail.value = null
  moreError.value = ''
  try {
    const result = await inventoryApi.listMovements(buildMovementQuery(applied.value, 0))
    const items = result.items ?? []
    total.value = result.total
    rows.value = items
    nextOffset.value = items.length
    lastBatchSize.value = items.length
    hasMore.value = hasMoreMovements(nextOffset.value, total.value, lastBatchSize.value)
    // 新条件必须从第一行开始看：重建表格把虚拟列表的滚动位置归零
    listVersion.value += 1
  } catch (error) {
    rows.value = []
    total.value = 0
    nextOffset.value = 0
    lastBatchSize.value = 0
    hasMore.value = false
    errorDetail.value = getErrorDetail(error)
  } finally {
    loading.value = false
  }
}

/**
 * 追加下一页。
 *
 * 失败时**保留已加载的数据**：审计页面上「已看到的流水」不该因为下一页的网络抖动消失，
 * 只在底部给出提示与重试入口。
 */
async function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  moreError.value = ''
  try {
    const result = await inventoryApi.listMovements(
      buildMovementQuery(applied.value, nextOffset.value),
    )
    const items = result.items ?? []
    rows.value = mergeMovementRows(rows.value, items)
    total.value = result.total
    nextOffset.value += items.length
    lastBatchSize.value = items.length
    hasMore.value = hasMoreMovements(nextOffset.value, total.value, lastBatchSize.value)
  } catch (error) {
    moreError.value = `加载更多失败：${getErrorDetail(error).message}`
  } finally {
    loadingMore.value = false
  }
}

/**
 * 表格滚动到接近底部时自动追加。
 *
 * 虚拟滚动下滚动事件来自虚拟列表容器，`scrollHeight` 是全部已加载行的高度，
 * 因此这个判定对「渲染行数远小于数据量」的情形同样成立。留 120px 提前量，
 * 避免用户滚到底后还要再动一次滚轮。
 */
const NEAR_BOTTOM_PX = 120

function onTableScroll(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (target.scrollTop + target.clientHeight < target.scrollHeight - NEAR_BOTTOM_PX) return
  void loadMore()
}

/**
 * 加载筛选下拉的选项。
 *
 * 后端 `/warehouses` 与 `/skus` 都没有关键字搜索、`limit` 上限 100，
 * 所以这里只取前 100 条做本地可搜索下拉；失败不阻塞列表查询，
 * 仓库 / SKU 列退回展示 `#id`。
 */
async function loadOptions() {
  optionsError.value = ''
  try {
    const [warehouseResult, skuResult] = await Promise.all([
      warehousesApi.list({ limit: MOVEMENT_PAGE_SIZE, offset: 0 }),
      skusApi.list({ limit: MOVEMENT_PAGE_SIZE, offset: 0 }),
    ])
    warehouseOptions.value = toSelectOptions(warehouseResult.items ?? [])
    skuOptions.value = toSelectOptions(skuResult.items ?? [])
  } catch (error) {
    optionsError.value = `筛选项加载失败：${getErrorDetail(error).message}`
  }
}

/** 条件变化必须从第一页重新拉取，否则会拿着旧 offset 查新条件 */
async function search() {
  applied.value = {
    warehouseId: filters.warehouseId,
    skuId: filters.skuId,
    operationType: filters.operationType,
    dateRange: filters.dateRange ? [...filters.dateRange] : null,
  }
  await loadFirstPage()
}

function reset() {
  filters.warehouseId = null
  filters.skuId = null
  filters.operationType = null
  filters.dateRange = null
  void search()
}

function refresh() {
  void loadFirstPage()
}

function retryLoadMore() {
  void loadMore()
}

onMounted(async () => {
  await Promise.all([search(), loadOptions()])
})
</script>

<template>
  <!--
    日期选择器的面板文案来自 naive 的 locale，而项目其它地方没有配中文 locale。
    这里只在本页局部提供，避免全局改动影响既有页面文案；
    `abstract` 让 provider 不渲染自己的 DOM（否则会多一层容器、破坏 `.page` 的 flex 布局）。
  -->
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" abstract>
    <main class="page">
      <PageHeader
        title="库存流水"
        :description="`${loadedHint} · 每次加载 ${MOVEMENT_PAGE_SIZE} 条`"
      >
        <template #actions>
          <NButton :loading="loading" @click="refresh">
            <template #icon><RefreshCw :size="16" /></template>
            刷新
          </NButton>
        </template>
      </PageHeader>

      <section class="movement-panel panel">
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
          <NFormItem label="操作类型">
            <NSelect
              v-model:value="filters.operationType"
              class="filters__select filters__select--type"
              :options="OPERATION_TYPE_OPTIONS"
              clearable
              placeholder="全部类型"
            />
          </NFormItem>
          <NFormItem label="发生时间">
            <NDatePicker
              v-model:formatted-value="filters.dateRange"
              class="filters__date"
              type="daterange"
              value-format="yyyy-MM-dd"
              clearable
              start-placeholder="开始日期"
              end-placeholder="结束日期"
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
          :key="listVersion"
          :columns="columns"
          :rows="rows"
          :loading="loading"
          :error="errorDetail?.message ?? ''"
          :error-trace-id="errorDetail?.traceId ?? ''"
          :row-key="movementRowKey"
          virtual-scroll
          empty-text="暂无库存流水"
          export-file-name="库存流水"
          @retry="refresh"
          @scroll="onTableScroll"
        />

        <footer class="pager">
          <div class="pager__status">
            <span class="pager__hint">{{ loadedHint }}</span>
            <NAlert
              v-if="moreError"
              type="error"
              :show-icon="true"
              class="pager__error"
              :bordered="false"
            >
              {{ moreError }}
            </NAlert>
          </div>
          <!--
            底部加载入口：
            1) 正在追加 → 转圈（与表格的加载遮罩同源，避免重复点击）；
            2) 追加失败 → 重试（保留已加载数据，只重试下一页）；
            3) 还有下一页 → 按钮兜底（自动滚动加载在矮视口或键盘操作下不一定触发）；
            4) 到底 → 文案。
          -->
          <NSpin v-if="loadingMore" size="small" />
          <NButton v-else-if="moreError" @click="retryLoadMore">重试加载</NButton>
          <NButton v-else-if="hasMore" :disabled="loading" @click="loadMore">
            <template #icon><ChevronDown :size="16" /></template>
            加载更多
          </NButton>
          <span v-else class="pager__done">没有更多了</span>
        </footer>
      </section>
    </main>
  </NConfigProvider>
</template>

<style scoped>
.movement-panel {
  min-width: 0;
}

.filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.filters__select {
  width: 200px;
}

.filters__select--type {
  width: 160px;
}

.filters__date {
  width: 260px;
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

.pager__status {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.pager__hint {
  color: var(--color-text-muted);
  font-size: 12px;
}

.pager__error {
  padding: 0;
}

.pager__done {
  color: var(--color-text-muted);
  font-size: 12px;
}

@media (max-width: 767px) {
  .filters {
    align-items: stretch;
    flex-direction: column;
  }

  .filters :deep(.n-form-item),
  .filters__select,
  .filters__select--type,
  .filters__date {
    width: 100%;
  }

  .filters__actions > * {
    flex: 1;
  }

  .pager {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
