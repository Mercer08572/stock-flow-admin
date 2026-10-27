<script setup lang="ts">
import { ChevronLeft, ChevronRight, RefreshCw, RotateCcw, Search } from '@lucide/vue'
import { useBreakpoints } from '@vueuse/core'
import { NAlert, NButton, NDrawer, NDrawerContent, NForm, NFormItem, NSelect, NTag } from 'naive-ui'
import { computed, h, onMounted, reactive, ref } from 'vue'

import { getErrorDetail, type ErrorDetail } from '@/api/error'
import { inventoryApi } from '@/api/inventory'
import { skusApi } from '@/api/skus'
import { warehousesApi } from '@/api/warehouses'
import AsyncState from '@/components/common/AsyncState.vue'
import DataTable from '@/components/common/DataTable.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import PageHeader from '@/components/common/PageHeader.vue'
import {
  buildReservationQuery,
  closeReasonLabel,
  formatReservationSource,
  reservationStatusLabel,
  RESERVATION_PAGE_SIZE,
  type ReservationFilters,
} from '@/features/inventory/reservation-list'
import {
  hasNextPage,
  referenceCode,
  referenceName,
  toSelectOptions,
} from '@/features/inventory/stock-list'

import type { Reference, Reservation, ReservationItem, ReservationStatus } from '@/types/api'

interface SelectOption {
  label: string
  value: number
}

const filters = reactive<ReservationFilters>({ warehouseId: null, skuId: null, status: null })
const offset = ref(0)
const rows = ref<Reservation[]>([])
const loading = ref(false)
const errorDetail = ref<ErrorDetail | null>(null)

const warehouseOptions = ref<SelectOption[]>([])
const skuOptions = ref<SelectOption[]>([])
const optionsError = ref('')

const statusOptions: Array<{ label: string; value: ReservationStatus }> = [
  { label: '占用中', value: 'active' },
  { label: '已关闭', value: 'closed' },
]

const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref<ErrorDetail | null>(null)
const detail = ref<Reservation | null>(null)
/** 保留当前明细对应的占用单 ID，重试时不需要依赖已加载成功的 detail */
const detailTargetId = ref<number | null>(null)

const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')

/**
 * 仓库 / SKU 合并成一列展示。
 *
 * 占用列表列数比库存余额多，拆成「编码 + 名称」两列会把状态与数量挤到横向滚动区；
 * 这里保留「编码 / 名称」的可读性，同时把关键字段留在首屏。
 */
function referenceLabel(reference: Reference | undefined, fallbackId: number): string {
  const code = referenceCode(reference, fallbackId)
  const name = referenceName(reference, fallbackId)
  return name === code ? code : `${code} / ${name}`
}

const columns: DataTableColumn<Reservation>[] = [
  { key: 'id', title: '单号', width: 90, align: 'right' },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (row) =>
      h(
        NTag,
        {
          type: row.status === 'active' ? 'warning' : 'default',
          size: 'small',
          bordered: false,
        },
        { default: () => reservationStatusLabel(row.status) },
      ),
    exportValue: (row) => reservationStatusLabel(row.status),
  },
  {
    key: 'warehouse.code',
    title: '仓库',
    width: 210,
    // 主数据被软删除后引用可能整体缺失，回退展示 ID 而不是留空
    render: (row) => referenceLabel(row.warehouse, row.warehouse_id),
    exportValue: (row) => referenceLabel(row.warehouse, row.warehouse_id),
  },
  {
    key: 'sku.code',
    title: 'SKU',
    width: 230,
    render: (row) => referenceLabel(row.sku, row.sku_id),
    exportValue: (row) => referenceLabel(row.sku, row.sku_id),
  },
  { key: 'total_qty', title: '占用数量', width: 110, align: 'right' },
  { key: 'released_qty', title: '已释放', width: 100, align: 'right' },
  { key: 'consumed_qty', title: '已消耗', width: 100, align: 'right' },
  { key: 'remaining_qty', title: '剩余', width: 100, align: 'right' },
  {
    key: 'close_reason',
    title: '关闭原因',
    width: 120,
    render: (row) => closeReasonLabel(row.close_reason),
    exportValue: (row) => closeReasonLabel(row.close_reason),
  },
  {
    key: 'source_type',
    title: '来源',
    width: 180,
    render: (row) => formatReservationSource(row),
    exportValue: (row) => formatReservationSource(row),
  },
  {
    key: 'actor_label',
    title: '操作人',
    width: 120,
    render: (row) => row.actor_label || '-',
    exportValue: (row) => row.actor_label || '-',
  },
  {
    key: 'created_at',
    title: '创建时间',
    width: 170,
    render: (row) => formatDateTime(row.created_at),
    exportValue: (row) => formatDateTime(row.created_at, ''),
  },
]

const itemColumns: DataTableColumn<ReservationItem>[] = [
  { key: 'stock_layer_id', title: '库存层 ID', width: 100, align: 'right' },
  {
    key: 'batch_id',
    title: '批次',
    width: 90,
    align: 'right',
    render: (row) => (row.batch_id === null ? '无批次' : String(row.batch_id)),
  },
  {
    key: 'received_at',
    title: '入库时间',
    width: 150,
    render: (row) => formatDateTime(row.received_at),
  },
  { key: 'reserved_qty', title: '分配数量', width: 100, align: 'right' },
  { key: 'released_qty', title: '已释放', width: 90, align: 'right' },
  { key: 'consumed_qty', title: '已消耗', width: 90, align: 'right' },
  { key: 'remaining_qty', title: '剩余', width: 90, align: 'right' },
]

const canGoPrev = computed(() => offset.value > 0)
const canGoNext = computed(() => hasNextPage(rows.value.length, RESERVATION_PAGE_SIZE))
const pageLabel = computed(() => `第 ${Math.floor(offset.value / RESERVATION_PAGE_SIZE) + 1} 页`)

async function load() {
  loading.value = true
  errorDetail.value = null
  try {
    const result = await inventoryApi.listReservations(
      buildReservationQuery(filters, offset.value, RESERVATION_PAGE_SIZE),
    )
    rows.value = result.items ?? []
  } catch (error) {
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
      warehousesApi.list({ limit: RESERVATION_PAGE_SIZE, offset: 0 }),
      skusApi.list({ limit: RESERVATION_PAGE_SIZE, offset: 0 }),
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
  filters.status = null
  void search()
}

async function goPrev() {
  if (!canGoPrev.value) return
  offset.value = Math.max(0, offset.value - RESERVATION_PAGE_SIZE)
  await load()
}

async function goNext() {
  if (!canGoNext.value) return
  offset.value += RESERVATION_PAGE_SIZE
  await load()
}

async function openDetail(row: Reservation) {
  detailOpen.value = true
  detailError.value = null
  detail.value = null
  detailTargetId.value = row.id
  await fetchDetail(row.id)
}

async function fetchDetail(id: number) {
  detailLoading.value = true
  detailError.value = null
  try {
    detail.value = await inventoryApi.getReservation(id)
  } catch (error) {
    detailError.value = getErrorDetail(error)
  } finally {
    detailLoading.value = false
  }
}

function retryDetail() {
  if (detailTargetId.value !== null) void fetchDetail(detailTargetId.value)
}

onMounted(async () => {
  await Promise.all([load(), loadOptions()])
})
</script>

<template>
  <main class="page">
    <PageHeader title="库存占用" :description="`${pageLabel} · 当前结果 ${rows.length} 条`">
      <template #actions>
        <NButton :loading="loading" @click="load">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="reservation-panel panel">
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
        <NFormItem label="状态">
          <NSelect
            v-model:value="filters.status"
            class="filters__select filters__select--status"
            :options="statusOptions"
            clearable
            placeholder="全部状态"
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
        empty-text="暂无库存占用"
        export-file-name="库存占用"
        row-clickable
        @retry="load"
        @row-click="openDetail"
      />

      <footer class="pager">
        <span class="pager__hint">契约无总数，仅支持前后翻页</span>
        <div class="pager__actions">
          <NButton size="small" :disabled="!canGoPrev || loading" @click="goPrev">
            <template #icon><ChevronLeft :size="15" /></template>
            上一页
          </NButton>
          <NButton size="small" :disabled="!canGoNext || loading" @click="goNext">
            下一页
            <template #icon><ChevronRight :size="15" /></template>
          </NButton>
        </div>
      </footer>
    </section>

    <NDrawer v-model:show="detailOpen" :width="isMobile ? '100%' : 760" placement="right">
      <NDrawerContent :title="detail ? `占用单 #${detail.id}` : '库存占用详情'" closable>
        <dl v-if="detail" class="summary">
          <div>
            <dt>仓库</dt>
            <dd>
              {{ referenceCode(detail.warehouse, detail.warehouse_id) }} /
              {{ referenceName(detail.warehouse, detail.warehouse_id) }}
            </dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd>
              {{ referenceCode(detail.sku, detail.sku_id) }} /
              {{ referenceName(detail.sku, detail.sku_id) }}
            </dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>
              <NTag
                :type="detail.status === 'active' ? 'warning' : 'default'"
                size="small"
                :bordered="false"
              >
                {{ reservationStatusLabel(detail.status) }}
              </NTag>
            </dd>
          </div>
          <div>
            <dt>占用数量</dt>
            <dd>{{ detail.total_qty }}</dd>
          </div>
          <div>
            <dt>已释放</dt>
            <dd>{{ detail.released_qty }}</dd>
          </div>
          <div>
            <dt>已消耗</dt>
            <dd>{{ detail.consumed_qty }}</dd>
          </div>
          <div>
            <dt>剩余</dt>
            <dd>{{ detail.remaining_qty }}</dd>
          </div>
          <div>
            <dt>关闭原因</dt>
            <dd>{{ closeReasonLabel(detail.close_reason) }}</dd>
          </div>
          <div>
            <dt>来源</dt>
            <dd>{{ formatReservationSource(detail) }}</dd>
          </div>
          <div>
            <dt>操作人</dt>
            <dd>{{ detail.actor_label || '-' }}</dd>
          </div>
          <div class="summary__wide">
            <dt>幂等键</dt>
            <dd class="summary__key">{{ detail.idempotency_key || '-' }}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{{ formatDateTime(detail.created_at) }}</dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>{{ formatDateTime(detail.updated_at) }}</dd>
          </div>
        </dl>

        <h3 class="detail-heading">分配明细</h3>
        <AsyncState
          :loading="detailLoading"
          :error="detailError?.message ?? ''"
          :error-trace-id="detailError?.traceId ?? ''"
          :empty="!detailLoading && !detailError && (detail?.items?.length ?? 0) === 0"
          empty-text="该占用单暂无分配明细"
          @retry="retryDetail"
        >
          <DataTable
            :columns="itemColumns"
            :rows="detail?.items ?? []"
            empty-text="该占用单暂无分配明细"
            export-file-name="库存占用明细"
          />
        </AsyncState>
      </NDrawerContent>
    </NDrawer>
  </main>
</template>

<style scoped>
.reservation-panel {
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
  width: 200px;
}

.filters__select--status {
  width: 150px;
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

.pager__actions {
  display: flex;
  gap: 8px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
  margin: 0 0 20px;
}

.summary > div {
  min-width: 0;
}

.summary dt {
  color: var(--color-text-muted);
  font-size: 12px;
}

.summary dd {
  margin: 3px 0 0;
  color: var(--color-text);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.summary__wide {
  grid-column: 1 / -1;
}

.summary__key {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.detail-heading {
  margin: 0 0 10px;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 650;
}

@media (max-width: 680px) {
  .filters {
    align-items: stretch;
    flex-direction: column;
  }

  .filters :deep(.n-form-item),
  .filters__select,
  .filters__select--status {
    width: 100%;
  }

  .filters__actions > * {
    flex: 1;
  }

  .pager {
    align-items: stretch;
    flex-direction: column;
  }

  .pager__actions > * {
    flex: 1;
  }

  .summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
