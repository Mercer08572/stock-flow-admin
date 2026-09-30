<script setup lang="ts">
import { Plus, RefreshCw } from '@lucide/vue'
import { computed, h, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NButton, useDialog, useMessage } from 'naive-ui'

import { getErrorDetail, getErrorMessage, type ErrorDetail } from '@/api/error'
import { resourceApi } from '@/api/resources'
import AsyncState from '@/components/common/AsyncState.vue'
import DataTable from '@/components/common/DataTable.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusTag from '@/components/common/StatusTag.vue'
import {
  buildPayload,
  createEmptyForm,
  fillForm,
  findMissingRequired,
  type FieldConfig,
  type FieldOption,
  type FormValues,
} from '@/features/master-data/master-data-form'

import type { BaseEntity } from '@/types/api'

type ResourceKey = 'units' | 'categories' | 'materials' | 'skus' | 'warehouses'
type ResourceRow = BaseEntity & Record<string, unknown>
type DrawerMode = 'create' | 'edit'

interface ResourceConfig {
  title: string
  load: () => Promise<{ items: unknown[]; limit: number; offset: number }>
  columns: DataTableColumn<ResourceRow>[]
  fields: FieldConfig[]
  create: (payload: Record<string, unknown>) => Promise<unknown>
  get: (id: number) => Promise<ResourceRow>
  update: (id: number, payload: Record<string, unknown>) => Promise<unknown>
  remove: (id: number) => Promise<unknown>
  /** 仅仓库提供：停用（软删除之外的独立动作） */
  disable?: (id: number) => Promise<unknown>
}

const route = useRoute()
const rows = ref<ResourceRow[]>([])
const loading = ref(false)
const errorDetail = ref<ErrorDetail | null>(null)
const drawerOpen = ref(false)
const drawerMode = ref<DrawerMode>('create')
const editingId = ref<number | null>(null)
const loadingDetail = ref(false)
const detailError = ref<ErrorDetail | null>(null)
const saving = ref(false)
const form = ref<FormValues>({})
const message = useMessage()
const dialog = useDialog()
const busyId = ref<number | null>(null)

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

/** 实体在列表页被当作通用行处理，字段读取统一走 DataTable 的取值路径 */
function asRow<T extends BaseEntity>(promise: Promise<T>): Promise<ResourceRow> {
  return promise as unknown as Promise<ResourceRow>
}

function updatePayload(update: (id: number, body: never) => Promise<unknown>) {
  return (id: number, payload: Record<string, unknown>) => update(id, payload as never)
}

const actionColumn: DataTableColumn<ResourceRow> = {
  key: 'actions',
  title: '操作',
  width: 176,
  align: 'right',
  sortable: false,
  exportable: false,
  render: (row) => {
    const buttons = [
      h(
        NButton,
        {
          size: 'tiny',
          quaternary: true,
          type: 'primary',
          onClick: () => void openEdit(row),
        },
        { default: () => '编辑' },
      ),
    ]

    // 停用只对仓库开放：状态已是 inactive 时禁用，避免无意义的重复请求
    if (config.value.disable) {
      buttons.push(
        h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            disabled: row.status !== 'active',
            onClick: () => confirmDisable(row),
          },
          { default: () => '停用' },
        ),
      )
    }

    buttons.push(
      h(
        NButton,
        {
          size: 'tiny',
          quaternary: true,
          type: 'error',
          onClick: () => confirmDelete(row),
        },
        { default: () => '删除' },
      ),
    )

    return h('div', { class: 'row-actions' }, buttons)
  },
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
  render: (row) => h(StatusTag, { status: String(row.status ?? '') }),
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
    get: (id) => asRow(resourceApi.getUnit(id)),
    update: updatePayload(resourceApi.updateUnit),
    remove: (id) => resourceApi.deleteUnit(id),
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
    get: (id) => asRow(resourceApi.getCategory(id)),
    update: updatePayload(resourceApi.updateCategory),
    remove: (id) => resourceApi.deleteCategory(id),
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
    get: (id) => asRow(resourceApi.getMaterial(id)),
    update: updatePayload(resourceApi.updateMaterial),
    remove: (id) => resourceApi.deleteMaterial(id),
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
    get: (id) => asRow(resourceApi.getSku(id)),
    update: updatePayload(resourceApi.updateSku),
    remove: (id) => resourceApi.deleteSku(id),
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
    get: (id) => asRow(resourceApi.getWarehouse(id)),
    update: updatePayload(resourceApi.updateWarehouse),
    remove: (id) => resourceApi.deleteWarehouse(id),
    disable: (id) => resourceApi.disableWarehouse(id),
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
const columns = computed(() => [...config.value.columns, actionColumn])
const drawerTitle = computed(() =>
  drawerMode.value === 'edit' ? `编辑${config.value.title}` : `新增${config.value.title}`,
)

async function load() {
  loading.value = true
  errorDetail.value = null
  try {
    const result = await config.value.load()
    rows.value = result.items as ResourceRow[]
  } catch (error) {
    rows.value = []
    errorDetail.value = getErrorDetail(error)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  drawerMode.value = 'create'
  editingId.value = null
  detailError.value = null
  form.value = createEmptyForm(config.value.fields)
  drawerOpen.value = true
}

async function fetchDetail(id: number) {
  detailError.value = null
  loadingDetail.value = true
  try {
    form.value = fillForm(config.value.fields, await config.value.get(id))
  } catch (error) {
    detailError.value = getErrorDetail(error)
  } finally {
    loadingDetail.value = false
  }
}

async function openEdit(row: ResourceRow) {
  drawerMode.value = 'edit'
  editingId.value = row.id
  detailError.value = null
  // 先清空再拉取：`GET /:id` 期间表单不能显示上一次编辑的残留值
  form.value = createEmptyForm(config.value.fields)
  drawerOpen.value = true
  await fetchDetail(row.id)
}

function retryDetail() {
  if (editingId.value !== null) void fetchDetail(editingId.value)
}

function closeDrawer() {
  if (!saving.value) drawerOpen.value = false
}

function rowLabel(row: ResourceRow) {
  return `${String(row.code ?? '')} ${String(row.name ?? '')}`.trim()
}

/** 二次确认：只显示 ID 不足以避免误删，必须给出编码与名称 */
function confirmDelete(row: ResourceRow) {
  dialog.warning({
    title: `删除${config.value.title}`,
    content: `确认删除「${rowLabel(row)}」吗？删除后不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: () => deleteRow(row),
  })
}

async function deleteRow(row: ResourceRow) {
  // 同一时刻只允许一个删除请求，避免重复提交
  if (busyId.value !== null) return

  busyId.value = row.id
  try {
    await config.value.remove(row.id)
    message.success(`${config.value.title}已删除`)
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    busyId.value = null
  }
}

function confirmDisable(row: ResourceRow) {
  dialog.warning({
    title: `停用${config.value.title}`,
    content: `确认停用「${rowLabel(row)}」吗？停用后该仓库不再用于新的库存操作。`,
    positiveText: '确认停用',
    negativeText: '取消',
    onPositiveClick: () => disableRow(row),
  })
}

async function disableRow(row: ResourceRow) {
  if (busyId.value !== null) return

  busyId.value = row.id
  try {
    await config.value.disable?.(row.id)
    message.success(`${config.value.title}已停用`)
    await load()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    busyId.value = null
  }
}

async function submit() {
  const missing = findMissingRequired(config.value.fields, form.value)
  if (missing) {
    message.warning(`请填写${missing.label}`)
    return
  }

  const payload = buildPayload(config.value.fields, form.value)
  const targetId = editingId.value
  const editing = drawerMode.value === 'edit' && targetId !== null

  saving.value = true
  try {
    if (editing) {
      await config.value.update(targetId, payload)
      message.success(`${config.value.title}已更新`)
    } else {
      await config.value.create(payload)
      message.success(`${config.value.title}已新增`)
    }
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
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :error="errorDetail?.message ?? ''"
        :error-trace-id="errorDetail?.traceId ?? ''"
        :export-file-name="config.title"
        @retry="load"
      />
    </section>

    <NDrawer v-model:show="drawerOpen" :width="460" placement="right">
      <NDrawerContent :title="drawerTitle" closable>
        <AsyncState
          :loading="loadingDetail"
          :error="detailError?.message ?? ''"
          :error-trace-id="detailError?.traceId ?? ''"
          @retry="retryDetail"
        >
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
        </AsyncState>
        <template #footer>
          <div class="drawer-footer">
            <NButton :disabled="saving" @click="closeDrawer">取消</NButton>
            <NButton
              type="primary"
              :loading="saving"
              :disabled="loadingDetail || Boolean(detailError)"
              @click="submit"
            >
              保存
            </NButton>
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

.row-actions {
  display: inline-flex;
  justify-content: flex-end;
  gap: 2px;
}
</style>
