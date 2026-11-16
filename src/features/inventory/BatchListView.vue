<script setup lang="ts">
/**
 * 库存批次列表页。
 *
 * 批次是 SKU 级主数据：这里维护批号、效期、出库优先级与状态；
 * 批次库存不在这张表上，详情页按仓库聚合展示。
 */

import { Plus, RefreshCw, RotateCcw, Search } from '@lucide/vue'
import { useBreakpoints } from '@vueuse/core'
import { NAlert, NButton, NForm, NFormItem, NInput, NPagination, NSelect } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { batchesApi } from '@/api/batches'
import DataTable from '@/components/common/DataTable.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ReferenceSelect from '@/components/common/ReferenceSelect.vue'
import type { ReferenceSelectOption } from '@/components/common/reference-select'
import EntityFormDrawer from '@/features/master-data/components/EntityFormDrawer.vue'
import { useEntityList } from '@/features/master-data/lib/entity-list'
import { actionColumn } from '@/features/master-data/lib/row-actions'
import {
  BATCH_PAGE_SIZE,
  batchColumns,
  batchCreateFields,
  batchEditFields,
  batchStatusOptions,
  buildBatchQuery,
  type BatchFilters,
} from '@/features/inventory/batch'
import { REFERENCE_OPTION_PREFETCH, searchSkuOptions } from '@/features/inventory/reference-options'

import type { CreateBatchInput, InventoryBatch, UpdateBatchInput } from '@/types/api'

const router = useRouter()

const filters = reactive<BatchFilters>({ skuId: null, status: null, keyword: '' })
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')
const skuOptions = ref<ReferenceSelectOption<number>[]>([])
const optionsError = ref('')

const {
  rows,
  loading,
  errorDetail,
  drawerOpen,
  drawerMode,
  editingId,
  total,
  page,
  pageCount,
  pageSize,
  reload,
  reloadFromStart,
  goToPage,
  openCreate,
  openEdit,
  onSaved,
  confirmDelete,
  confirmDisable,
} = useEntityList<InventoryBatch>({
  title: '批次',
  pageSize: BATCH_PAGE_SIZE,
  load: (offset) => batchesApi.list(buildBatchQuery(filters, offset)),
  remove: (id) => batchesApi.remove(id),
  disable: (id) => batchesApi.disable(id),
  // 批次没有 code/name：确认框必须显示批号，否则只剩一个裸 ID
  labelOf: (row) => row.batch_no,
  disableHint: '停用后不再入库、不再参与自动分配；已存在的库存仍可显式指定批次扣减。',
})

const columns = computed(() => [
  ...batchColumns,
  {
    ...actionColumn<InventoryBatch>({
      onEdit: openEdit,
      onDelete: confirmDelete,
      onDisable: confirmDisable,
      onDetail: openDetail,
    }),
    // 列多时会横向滚动：桌面端把操作列固定在右侧，避免「看不到按钮」。
    // 320 px 下固定 208 px 会挤掉数据区，移动端保持随表滚动。
    ...(isMobile.value ? {} : { fixed: 'right' as const }),
  },
])

/** 新增与编辑的字段差异：编辑多一个状态、SKU 与批号锁定 */
const formFields = computed(() =>
  drawerMode.value === 'edit' ? batchEditFields : batchCreateFields,
)

function openDetail(row: InventoryBatch) {
  void router.push(`/inventory/batches/${row.id}`)
}

async function loadOptions() {
  optionsError.value = ''
  try {
    const result = await searchSkuOptions({
      keyword: '',
      offset: 0,
      limit: REFERENCE_OPTION_PREFETCH,
    })
    skuOptions.value = result.options
  } catch {
    skuOptions.value = []
    optionsError.value = 'SKU 选项加载失败，可直接输入关键字重试'
  }
}

function applyFilters() {
  void reloadFromStart()
}

function resetFilters() {
  filters.skuId = null
  filters.status = null
  filters.keyword = ''
  void reloadFromStart()
}

// EntityFormDrawer 的契约是 Record<string, unknown>；具体入参类型在 api 层收口
function loadBatch(id: number) {
  return batchesApi.get(id) as unknown as Promise<Record<string, unknown>>
}

function createBatch(body: Record<string, unknown>) {
  return batchesApi.create(body as unknown as CreateBatchInput)
}

function updateBatch(id: number, body: Record<string, unknown>) {
  return batchesApi.update(id, body as unknown as UpdateBatchInput)
}

onMounted(async () => {
  await Promise.all([reload(), loadOptions()])
})
</script>

<template>
  <main class="page">
    <PageHeader title="库存批次" :description="`共 ${total} 条 · 第 ${page} / ${pageCount} 页`">
      <template #actions>
        <NButton type="primary" @click="openCreate">
          <template #icon><Plus :size="16" /></template>
          新增
        </NButton>
        <NButton :loading="loading" @click="reload">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="batch-panel panel">
      <NForm inline :show-feedback="false" class="filters" @submit.prevent="applyFilters">
        <NFormItem label="SKU">
          <ReferenceSelect
            v-model:value="filters.skuId"
            class="filters__select"
            :options="skuOptions"
            :remote="searchSkuOptions"
            filterable
            clearable
            placeholder="全部 SKU"
          />
        </NFormItem>
        <NFormItem label="状态">
          <NSelect
            v-model:value="filters.status"
            class="filters__select"
            :options="batchStatusOptions"
            clearable
            placeholder="全部状态"
          />
        </NFormItem>
        <NFormItem label="批号">
          <NInput
            v-model:value="filters.keyword"
            class="filters__input"
            clearable
            placeholder="按批号模糊搜索"
            @keyup.enter="applyFilters"
          />
        </NFormItem>
        <div class="filters__actions">
          <NButton attr-type="submit" type="primary" :loading="loading">
            <template #icon><Search :size="16" /></template>
            查询
          </NButton>
          <NButton @click="resetFilters">
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
        empty-text="暂无批次数据"
        export-file-name="库存批次"
        row-clickable
        @retry="reload"
        @row-click="openDetail"
      />

      <footer class="pager">
        <span class="pager__hint">共 {{ total }} 条，每页 {{ pageSize }} 条</span>
        <NPagination
          v-if="total > 0"
          :page="page"
          :item-count="total"
          :page-size="pageSize"
          :disabled="loading"
          show-quick-jumper
          @update:page="goToPage"
        >
          <template #goto>跳至</template>
        </NPagination>
      </footer>
    </section>

    <EntityFormDrawer
      v-model:show="drawerOpen"
      :fields="formFields"
      title="批次"
      :mode="drawerMode"
      :entity-id="editingId"
      :load="loadBatch"
      :create="createBatch"
      :update="updateBatch"
      @saved="onSaved"
    />
  </main>
</template>

<style scoped>
.batch-panel {
  min-width: 0;
}

.filters {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.filters__select,
.filters__input {
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

@media (max-width: 680px) {
  .filters {
    align-items: stretch;
    flex-direction: column;
  }

  .filters :deep(.n-form-item),
  .filters__select,
  .filters__input {
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
