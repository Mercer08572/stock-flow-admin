<script setup lang="ts">
import { Plus, RefreshCw } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'

import { getErrorMessage } from '@/api/error'
import { resourceApi } from '@/api/resources'
import DataTable from '@/components/common/DataTable.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import PageHeader from '@/components/common/PageHeader.vue'

import type { BaseEntity } from '@/types/api'

type ResourceKey = 'units' | 'categories' | 'materials' | 'skus' | 'warehouses'
type ResourceRow = BaseEntity & Record<string, unknown>

interface ResourceConfig {
  title: string
  load: () => Promise<{ items: unknown[]; limit: number; offset: number }>
  columns: DataTableColumn<ResourceRow>[]
  fields: FieldConfig[]
  create: (payload: Record<string, unknown>) => Promise<unknown>
}

type FieldType = 'text' | 'number' | 'textarea' | 'select'

interface FieldOption {
  label: string
  value: string
}

interface FieldConfig {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  min?: number
  max?: number
  options?: FieldOption[]
}

const route = useRoute()
const rows = ref<ResourceRow[]>([])
const loading = ref(false)
const errorMessage = ref('')
const drawerOpen = ref(false)
const saving = ref(false)
const form = reactive<Record<string, string | number | null>>({})
const message = useMessage()

const statusOptions: FieldOption[] = [
  { label: '正常', value: 'active' },
  { label: '停用', value: 'inactive' },
]
const unitTypeOptions: FieldOption[] = [
  { label: '计数', value: 'count' },
  { label: '重量', value: 'weight' },
  { label: '长度', value: 'length' },
  { label: '面积', value: 'area' },
  { label: '体积', value: 'volume' },
  { label: '包装', value: 'package' },
  { label: '时间', value: 'time' },
  { label: '其他', value: 'other' },
]
const warehouseTypeOptions: FieldOption[] = [
  { label: '普通仓', value: 'normal' },
  { label: '虚拟仓', value: 'virtual' },
]

const commonFields: FieldConfig[] = [
  { key: 'code', label: '编码', type: 'text', required: true, placeholder: '请输入编码' },
  { key: 'name', label: '名称', type: 'text', required: true, placeholder: '请输入名称' },
  { key: 'status', label: '状态', type: 'select', required: true, options: statusOptions },
]

function createPayload(create: (body: never) => Promise<unknown>) {
  return (payload: Record<string, unknown>) => create(payload as never)
}

const commonColumns: DataTableColumn<ResourceRow>[] = [
  { key: 'code', title: '编码', width: 140 },
  { key: 'name', title: '名称', width: 180 },
]

const statusColumn: DataTableColumn<ResourceRow> = {
  key: 'status',
  title: '状态',
  width: 100,
  filterOptions: statusOptions,
  render: (row) => (row.status === 'active' ? '正常' : row.status === 'inactive' ? '停用' : '-'),
}

const timeColumn: DataTableColumn<ResourceRow> = {
  key: 'updated_at',
  title: '更新时间',
  width: 170,
  render: (row) => formatDateTime(row.updated_at),
}

const configs: Record<ResourceKey, ResourceConfig> = {
  units: {
    title: '计量单位',
    load: () => resourceApi.units({ limit: 100, offset: 0 }),
    fields: [
      ...commonFields,
      { key: 'symbol', label: '符号', type: 'text', required: true, placeholder: '请输入单位符号' },
      { key: 'unit_type', label: '类型', type: 'select', required: true, options: unitTypeOptions },
      { key: 'precision', label: '精度', type: 'number', required: true, min: 0, max: 6 },
    ],
    create: createPayload(resourceApi.createUnit),
    columns: [
      ...commonColumns,
      { key: 'symbol', title: '符号', width: 100 },
      { key: 'unit_type', title: '类型', width: 120 },
      { key: 'precision', title: '精度', width: 90, align: 'right' },
      statusColumn,
      timeColumn,
    ],
  },
  categories: {
    title: '物料分类',
    load: () => resourceApi.categories({ limit: 100, offset: 0 }),
    fields: [
      ...commonFields,
      { key: 'parent_id', label: '上级 ID', type: 'number', min: 1, placeholder: '可选' },
      { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
    ],
    create: createPayload(resourceApi.createCategory),
    columns: [
      ...commonColumns,
      { key: 'parent_id', title: '上级 ID', width: 110 },
      { key: 'remark', title: '备注', width: 180 },
      statusColumn,
      timeColumn,
    ],
  },
  materials: {
    title: '物料',
    load: () => resourceApi.materials({ limit: 100, offset: 0 }),
    fields: [
      ...commonFields,
      { key: 'category_id', label: '分类 ID', type: 'number', required: true, min: 1 },
      { key: 'base_unit_id', label: '基础单位 ID', type: 'number', required: true, min: 1 },
      { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
    ],
    create: createPayload(resourceApi.createMaterial),
    columns: [
      ...commonColumns,
      { key: 'category_id', title: '分类 ID', width: 110 },
      { key: 'base_unit_id', title: '基础单位 ID', width: 130 },
      statusColumn,
      timeColumn,
    ],
  },
  skus: {
    title: 'SKU',
    load: () => resourceApi.skus({ limit: 100, offset: 0 }),
    fields: [
      ...commonFields,
      { key: 'material_id', label: '物料 ID', type: 'number', required: true, min: 1 },
      { key: 'unit_id', label: '单位 ID', type: 'number', required: true, min: 1 },
      { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
    ],
    create: createPayload(resourceApi.createSku),
    columns: [
      ...commonColumns,
      { key: 'material_id', title: '物料 ID', width: 110 },
      { key: 'unit_id', title: '单位 ID', width: 110 },
      statusColumn,
      timeColumn,
    ],
  },
  warehouses: {
    title: '仓库',
    load: () => resourceApi.warehouses({ limit: 100, offset: 0 }),
    fields: [
      ...commonFields,
      { key: 'type', label: '类型', type: 'select', required: true, options: warehouseTypeOptions },
      { key: 'location', label: '位置', type: 'text', placeholder: '可选' },
      { key: 'contact_name', label: '联系人', type: 'text', placeholder: '可选' },
      { key: 'contact_phone', label: '联系电话', type: 'text', placeholder: '可选' },
      { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
    ],
    create: createPayload(resourceApi.createWarehouse),
    columns: [
      ...commonColumns,
      {
        key: 'type',
        title: '类型',
        width: 110,
        filterOptions: warehouseTypeOptions,
        render: (row) =>
          row.type === 'normal' ? '普通仓' : row.type === 'virtual' ? '虚拟仓' : '-',
      },
      { key: 'location', title: '位置', width: 160 },
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

function openCreate() {
  for (const key of Object.keys(form)) delete form[key]
  for (const field of config.value.fields) {
    form[field.key] = field.key === 'status' ? 'active' : field.type === 'number' ? null : ''
  }
  drawerOpen.value = true
}

function closeCreate() {
  if (!saving.value) drawerOpen.value = false
}

function isMissingRequired(field: FieldConfig) {
  if (!field.required) return false
  const value = form[field.key]
  return value === null || value === undefined || value === ''
}

async function submitCreate() {
  const missing = config.value.fields.find(isMissingRequired)
  if (missing) {
    message.warning(`请填写${missing.label}`)
    return
  }

  const payload: Record<string, unknown> = {}
  for (const field of config.value.fields) {
    const value = form[field.key]
    if (value !== null && value !== undefined && value !== '') payload[field.key] = value
  }

  saving.value = true
  try {
    await config.value.create(payload)
    message.success(`${config.value.title}已新增`)
    drawerOpen.value = false
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

watch(resource, load, { immediate: true })
</script>

<template>
  <main class="page">
    <PageHeader :title="config.title" :description="`当前结果 ${rows.length} 条`">
      <template #actions>
        <NButton type="primary" @click="openCreate">
          <template #icon><Plus :size="16" /></template>
          新增
        </NButton>
        <NButton :loading="loading" @click="load">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="panel">
      <DataTable
        :columns="config.columns"
        :rows="rows"
        :loading="loading"
        :error="errorMessage"
        :export-file-name="config.title"
        @retry="load"
      />
    </section>

    <NDrawer v-model:show="drawerOpen" :width="460" placement="right">
      <NDrawerContent :title="`新增${config.title}`" closable>
        <NForm :show-label="true" label-placement="top" :show-feedback="false">
          <NFormItem v-for="field in config.fields" :key="field.key" :label="field.label">
            <NInput
              v-if="field.type === 'text'"
              v-model:value="form[field.key]"
              :placeholder="field.placeholder"
            />
            <NInputNumber
              v-else-if="field.type === 'number'"
              v-model:value="form[field.key]"
              class="form-control"
              :min="field.min"
              :max="field.max"
              :placeholder="field.placeholder"
            />
            <NSelect
              v-else-if="field.type === 'select'"
              v-model:value="form[field.key]"
              :options="field.options"
              :placeholder="`请选择${field.label}`"
            />
            <NInput
              v-else
              v-model:value="form[field.key]"
              type="textarea"
              :placeholder="field.placeholder"
              :autosize="{ minRows: 3, maxRows: 6 }"
            />
          </NFormItem>
        </NForm>
        <template #footer>
          <div class="drawer-footer">
            <NButton :disabled="saving" @click="closeCreate">取消</NButton>
            <NButton type="primary" :loading="saving" @click="submitCreate">保存</NButton>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>
  </main>
</template>

<style scoped>
.form-control {
  width: 100%;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
