<script setup lang="ts">
import type { ColDef } from 'ag-grid-community'
import { AgGridVue } from 'ag-grid-vue3'
import { RefreshCw, RotateCcw, Search } from '@lucide/vue'
import { onMounted, reactive, ref } from 'vue'

import { getErrorMessage } from '@/api/error'
import { resourceApi } from '@/api/resources'
import PageHeader from '@/components/common/PageHeader.vue'
import '@/app/ag-grid'

import type { StockBalance } from '@/types/api'

const filters = reactive<{ warehouseId: number | null; skuId: number | null }>({
  warehouseId: null,
  skuId: null,
})
const rows = ref<StockBalance[]>([])
const loading = ref(false)
const errorMessage = ref('')

const columnDefs: ColDef<StockBalance>[] = [
  { headerName: '仓库编码', field: 'warehouse.code', minWidth: 130 },
  { headerName: '仓库名称', field: 'warehouse.name', minWidth: 160, flex: 1 },
  { headerName: 'SKU 编码', field: 'sku.code', minWidth: 140 },
  { headerName: 'SKU 名称', field: 'sku.name', minWidth: 180, flex: 1 },
  { headerName: '在库数量', field: 'on_hand_qty', minWidth: 120, type: 'rightAligned' },
  { headerName: '预留数量', field: 'reserved_qty', minWidth: 120, type: 'rightAligned' },
  { headerName: '可用数量', field: 'available_qty', minWidth: 120, type: 'rightAligned' },
  {
    headerName: '更新时间',
    field: 'updated_at',
    minWidth: 170,
    valueFormatter: ({ value }) =>
      value ? new Date(value as string).toLocaleString('zh-CN') : '-',
  },
]

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await resourceApi.stocks({
      ...(filters.warehouseId === null ? {} : { warehouse_id: filters.warehouseId }),
      ...(filters.skuId === null ? {} : { sku_id: filters.skuId }),
      limit: 100,
      offset: 0,
    })
    rows.value = result.items ?? []
  } catch (error) {
    rows.value = []
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function reset() {
  filters.warehouseId = null
  filters.skuId = null
  void load()
}

onMounted(load)
</script>

<template>
  <main class="page">
    <PageHeader title="库存余额" :description="`当前结果 ${rows.length} 条`">
      <template #actions>
        <NButton :loading="loading" @click="load">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="stock-panel panel">
      <NForm inline :show-feedback="false" class="filters" @submit.prevent="load">
        <NFormItem label="仓库 ID">
          <NInputNumber
            v-model:value="filters.warehouseId"
            clearable
            :min="1"
            placeholder="全部仓库"
          />
        </NFormItem>
        <NFormItem label="SKU ID">
          <NInputNumber v-model:value="filters.skuId" clearable :min="1" placeholder="全部 SKU" />
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

      <NAlert v-if="errorMessage" type="error" :show-icon="true" class="table-error">
        {{ errorMessage }}
      </NAlert>
      <AgGridVue
        v-else
        class="ag-theme-quartz"
        theme="legacy"
        :column-defs="columnDefs"
        :row-data="rows"
        :loading="loading"
        :animate-rows="true"
        :default-col-def="{ sortable: true, resizable: true }"
        :overlay-no-rows-template="'<span class=&quot;ag-overlay-no-rows-center&quot;>暂无库存数据</span>'"
      />
    </section>
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

.filters__actions {
  display: flex;
  gap: 8px;
}

.table-error {
  margin: 16px;
}

@media (max-width: 680px) {
  .filters {
    align-items: stretch;
    flex-direction: column;
  }

  .filters :deep(.n-form-item),
  .filters :deep(.n-input-number) {
    width: 100%;
  }

  .filters__actions > * {
    flex: 1;
  }
}
</style>
