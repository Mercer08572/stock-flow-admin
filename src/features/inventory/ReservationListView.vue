<script setup lang="ts">
import { RefreshCw, RotateCcw, Search } from '@lucide/vue'
import { NAlert, NButton, NForm, NFormItem, NPagination, NSelect, NTag } from 'naive-ui'
import { computed, h, onMounted, reactive, ref } from 'vue'

import { getErrorDetail, type ErrorDetail } from '@/api/error'
import { inventoryApi } from '@/api/inventory'
import { skusApi } from '@/api/skus'
import { warehousesApi } from '@/api/warehouses'
import DataTable from '@/components/common/DataTable.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import PageHeader from '@/components/common/PageHeader.vue'
import ReservationDetailDrawer from '@/features/inventory/ReservationDetailDrawer.vue'
import {
  buildReservationQuery,
  closeReasonLabel,
  formatReservationSource,
  reservationStatusLabel,
  RESERVATION_PAGE_SIZE,
  type ReservationFilters,
} from '@/features/inventory/reservation-list'
import { referenceCode, referenceName, toSelectOptions } from '@/features/inventory/stock-list'

import type { Reference, Reservation, ReservationStatus } from '@/types/api'

interface SelectOption {
  label: string
  value: number
}

const filters = reactive<ReservationFilters>({ warehouseId: null, skuId: null, status: null })
const offset = ref(0)
const total = ref(0)
const rows = ref<Reservation[]>([])
const loading = ref(false)
const errorDetail = ref<ErrorDetail | null>(null)

const warehouseOptions = ref<SelectOption[]>([])
const skuOptions = ref<SelectOption[]>([])
const optionsError = ref('')

const statusOptions: Array<{ label: string; value: ReservationStatus }> = [
  { label: '预留中', value: 'active' },
  { label: '已关闭', value: 'closed' },
]

const detailOpen = ref(false)
/** 当前抽屉对应的预留单 ID，详情加载与重试由抽屉组件负责 */
const detailTargetId = ref<number | null>(null)

/**
 * 仓库 / SKU 合并成一列展示。
 *
 * 预留列表列数比库存余额多，拆成「编码 + 名称」两列会把状态与数量挤到横向滚动区；
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
  { key: 'total_qty', title: '预留数量', width: 110, align: 'right' },
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

const page = computed(() => Math.floor(offset.value / RESERVATION_PAGE_SIZE) + 1)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / RESERVATION_PAGE_SIZE)))

async function load() {
  loading.value = true
  errorDetail.value = null
  try {
    const result = await inventoryApi.listReservations(
      buildReservationQuery(filters, offset.value, RESERVATION_PAGE_SIZE),
    )
    total.value = result.total
    rows.value = result.items ?? []

    // 删除或数据变化后当前页可能已经越界：回退到最后一个有数据的页
    if (rows.value.length === 0 && offset.value > 0) {
      const lastOffset =
        result.total > 0
          ? Math.max(0, Math.ceil(result.total / RESERVATION_PAGE_SIZE) - 1) * RESERVATION_PAGE_SIZE
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

async function goToPage(targetPage: number) {
  if (loading.value) return
  const nextOffset = Math.max(0, (targetPage - 1) * RESERVATION_PAGE_SIZE)
  if (nextOffset === offset.value) return
  offset.value = nextOffset
  await load()
}

function openDetail(row: Reservation) {
  detailTargetId.value = row.id
  detailOpen.value = true
}

onMounted(async () => {
  await Promise.all([load(), loadOptions()])
})
</script>

<template>
  <main class="page">
    <PageHeader title="库存预留" :description="`共 ${total} 条 · 第 ${page} / ${pageCount} 页`">
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
        empty-text="暂无库存预留"
        export-file-name="库存预留"
        row-clickable
        @retry="load"
        @row-click="openDetail"
      />

      <footer class="pager">
        <span class="pager__hint">共 {{ total }} 条，每页 {{ RESERVATION_PAGE_SIZE }} 条</span>
        <NPagination
          v-if="total > 0"
          :page="page"
          :item-count="total"
          :page-size="RESERVATION_PAGE_SIZE"
          :disabled="loading"
          show-quick-jumper
          @update:page="goToPage"
        >
          <template #goto>跳至</template>
        </NPagination>
      </footer>
    </section>

    <ReservationDetailDrawer v-model:show="detailOpen" :reservation-id="detailTargetId" />
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

.pager :deep(.n-pagination) {
  flex-wrap: wrap;
  justify-content: flex-end;
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

  .pager :deep(.n-pagination) {
    justify-content: flex-start;
  }
}
</style>
