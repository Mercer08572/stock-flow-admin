<script setup lang="ts">
import { RefreshCw, RotateCcw, Search } from '@lucide/vue'
import { onMounted, reactive, ref } from 'vue'

import { getErrorMessage } from '@/api/error'
import { resourceApi } from '@/api/resources'
import DataTable from '@/components/common/DataTable.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import PageHeader from '@/components/common/PageHeader.vue'

import type { StockBalance } from '@/types/api'

const filters = reactive<{ warehouseId: number | null; skuId: number | null }>({
  warehouseId: null,
  skuId: null,
})
const rows = ref<StockBalance[]>([])
const loading = ref(false)
const errorMessage = ref('')

const columns: DataTableColumn<StockBalance>[] = [
  { key: 'warehouse.code', title: '仓库编码', width: 130 },
  { key: 'warehouse.name', title: '仓库名称', width: 160 },
  { key: 'sku.code', title: 'SKU 编码', width: 140 },
  { key: 'sku.name', title: 'SKU 名称', width: 180 },
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

      <DataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :error="errorMessage"
        empty-text="暂无库存数据"
        export-file-name="库存余额"
        @retry="load"
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
