<script setup lang="ts">
import type { ColDef } from 'ag-grid-community'
import { AgGridVue } from 'ag-grid-vue3'
import { RefreshCw } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getErrorMessage } from '@/api/error'
import { resourceApi } from '@/api/resources'
import PageHeader from '@/components/common/PageHeader.vue'
import '@/app/ag-grid'

import type { BaseEntity } from '@/types/api'

type ResourceKey = 'units' | 'categories' | 'materials' | 'skus' | 'warehouses'
type ResourceRow = BaseEntity & Record<string, unknown>

interface ResourceConfig {
  title: string
  load: () => Promise<{ items: unknown[]; limit: number; offset: number }>
  columns: ColDef<ResourceRow>[]
}

const route = useRoute()
const rows = ref<ResourceRow[]>([])
const loading = ref(false)
const errorMessage = ref('')

const commonColumns: ColDef<ResourceRow>[] = [
  { headerName: '编码', field: 'code', minWidth: 140 },
  { headerName: '名称', field: 'name', minWidth: 180, flex: 1 },
]

const statusColumn: ColDef<ResourceRow> = {
  headerName: '状态',
  field: 'status',
  minWidth: 100,
  valueFormatter: ({ value }) =>
    value === 'active' ? '正常' : value === 'inactive' ? '停用' : '-',
}

const timeColumn: ColDef<ResourceRow> = {
  headerName: '更新时间',
  field: 'updated_at',
  minWidth: 170,
  valueFormatter: ({ value }) => (value ? new Date(value as string).toLocaleString('zh-CN') : '-'),
}

const configs: Record<ResourceKey, ResourceConfig> = {
  units: {
    title: '计量单位',
    load: () => resourceApi.units({ limit: 100, offset: 0 }),
    columns: [
      ...commonColumns,
      { headerName: '符号', field: 'symbol', minWidth: 100 },
      { headerName: '类型', field: 'unit_type', minWidth: 120 },
      { headerName: '精度', field: 'precision', minWidth: 90, type: 'rightAligned' },
      statusColumn,
      timeColumn,
    ],
  },
  categories: {
    title: '物料分类',
    load: () => resourceApi.categories({ limit: 100, offset: 0 }),
    columns: [
      ...commonColumns,
      { headerName: '上级 ID', field: 'parent_id', minWidth: 110 },
      { headerName: '备注', field: 'remark', minWidth: 180, flex: 1 },
      statusColumn,
      timeColumn,
    ],
  },
  materials: {
    title: '物料',
    load: () => resourceApi.materials({ limit: 100, offset: 0 }),
    columns: [
      ...commonColumns,
      { headerName: '分类 ID', field: 'category_id', minWidth: 110 },
      { headerName: '基础单位 ID', field: 'base_unit_id', minWidth: 130 },
      statusColumn,
      timeColumn,
    ],
  },
  skus: {
    title: 'SKU',
    load: () => resourceApi.skus({ limit: 100, offset: 0 }),
    columns: [
      ...commonColumns,
      { headerName: '物料 ID', field: 'material_id', minWidth: 110 },
      { headerName: '单位 ID', field: 'unit_id', minWidth: 110 },
      statusColumn,
      timeColumn,
    ],
  },
  warehouses: {
    title: '仓库',
    load: () => resourceApi.warehouses({ limit: 100, offset: 0 }),
    columns: [
      ...commonColumns,
      {
        headerName: '类型',
        field: 'type',
        minWidth: 110,
        valueFormatter: ({ value }) =>
          value === 'normal' ? '普通仓' : value === 'virtual' ? '虚拟仓' : '-',
      },
      { headerName: '位置', field: 'location', minWidth: 160, flex: 1 },
      statusColumn,
      timeColumn,
    ],
  },
}

const resource = computed(() => route.params.resource as ResourceKey)
const config = computed(() => configs[resource.value])

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await config.value.load()
    rows.value = result.items as ResourceRow[]
  } catch (error) {
    rows.value = []
    errorMessage.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

watch(resource, load, { immediate: true })
</script>

<template>
  <main class="page">
    <PageHeader :title="config.title" :description="`当前结果 ${rows.length} 条`">
      <template #actions>
        <NButton :loading="loading" @click="load">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="panel">
      <NAlert v-if="errorMessage" type="error" :show-icon="true" class="table-error">
        {{ errorMessage }}
      </NAlert>
      <AgGridVue
        v-else
        class="ag-theme-quartz"
        theme="legacy"
        :column-defs="config.columns"
        :row-data="rows"
        :loading="loading"
        :animate-rows="true"
        :default-col-def="{ sortable: true, resizable: true, filter: true }"
        :overlay-no-rows-template="'<span class=&quot;ag-overlay-no-rows-center&quot;>暂无数据</span>'"
      />
    </section>
  </main>
</template>

<style scoped>
.table-error {
  margin: 16px;
}
</style>
