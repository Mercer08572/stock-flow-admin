<script setup lang="ts">
/**
 * 物料详情页的「单位换算」区块。
 *
 * 表格**逐行按接口返回的方向与系数展示**（例如 `1 M = 100 CM`、`1 CM = 0.01 M`），
 * 不做换向或求倒数——存量数据里可能存在互为反向的两条，如实呈现比悄悄归一更可信。
 *
 * 新增时方向固定为「基础单位 → 目标单位」；编辑时方向锁定，只允许改系数
 * （需要改成另一个方向时，用户可删除后重加）。
 */

import { Plus, RefreshCw } from '@lucide/vue'
import { computed, h, onMounted, ref, watch } from 'vue'
import {
  NButton,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  useDialog,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'

import { conversionsApi } from '@/api/conversions'
import { getErrorDetail, getErrorMessage, type ErrorDetail } from '@/api/error'
import AsyncState from '@/components/common/AsyncState.vue'
import {
  availableTargetUnits,
  CONVERSION_PAGE_SIZE,
  toConversionRow,
  unitLabel,
  type ConversionRow,
} from '@/features/master-data/materials/material-conversion'

import type { UnitDef } from '@/features/master-data/lib/unit-catalog'
import type { MaterialUnitConversion } from '@/types/api'

const props = defineProps<{
  materialId: number
  /** 物料基础单位：换算的固定一端 */
  baseUnitId: number
  /** 单位目录，由父组件加载（同一个目录也用于 SKU 单位下拉） */
  units: readonly UnitDef[]
}>()

const emit = defineEmits<{ changed: [] }>()

const message = useMessage()
const dialog = useDialog()

const conversions = ref<MaterialUnitConversion[]>([])
const loading = ref(false)
const errorDetail = ref<ErrorDetail | null>(null)

const drawerOpen = ref(false)
const drawerMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const saving = ref(false)
const form = ref<{ to_unit_id: number | null; factor: string }>({ to_unit_id: null, factor: '' })
/** 编辑时的原始方向；新增时为空，表示「基础单位 → 目标单位」 */
const editingDirection = ref<{ fromUnitId: number; toUnitId: number } | null>(null)

const baseUnitText = computed(() => unitLabel(props.units, props.baseUnitId))

/** 编辑时展示的原始方向文案：`1 <from> = <factor> <to>` */
const editingRelationText = computed(() => {
  const direction = editingDirection.value
  if (!direction) return ''

  return `1 ${unitLabel(props.units, direction.fromUnitId)} = ${form.value.factor} ${unitLabel(props.units, direction.toUnitId)}`
})

/** 系数输入框的说明：新增时是「基础单位 → 选中单位」，编辑时是「该行原本的方向」 */
const factorLabel = computed(() => {
  const direction = editingDirection.value
  if (!direction) {
    return `1 ${baseUnitText.value} 等于多少目标单位`
  }

  return `1 ${unitLabel(props.units, direction.fromUnitId)} 等于多少 ${unitLabel(props.units, direction.toUnitId)}`
})
const mayBeTruncated = computed(() => conversions.value.length >= CONVERSION_PAGE_SIZE)

const rows = computed<ConversionRow[]>(() => conversions.value.map(toConversionRow))

const targetUnitOptions = computed(() =>
  availableTargetUnits(
    props.units,
    props.baseUnitId,
    conversions.value,
    editingId.value ?? undefined,
  ).map((unit) => ({ label: `${unit.code} - ${unit.name}`, value: unit.id })),
)

const columns = computed<DataTableColumns<ConversionRow>>(() => [
  {
    key: 'relation',
    title: '换算关系',
    render: (row) =>
      `1 ${unitLabel(props.units, row.fromUnitId)} = ${row.factor} ${unitLabel(props.units, row.toUnitId)}`,
  },
  {
    key: 'direction',
    title: '方向',
    width: 140,
    render: (row) => (row.fromUnitId === props.baseUnitId ? '基础单位 → 目标' : '目标 → 基础单位'),
  },
  {
    key: 'actions',
    title: '操作',
    width: 140,
    align: 'right',
    render: (row) => [
      h(
        NButton,
        { size: 'tiny', quaternary: true, type: 'primary', onClick: () => openEdit(row) },
        { default: () => '编辑' },
      ),
      h(
        NButton,
        { size: 'tiny', quaternary: true, type: 'error', onClick: () => confirmDelete(row) },
        { default: () => '删除' },
      ),
    ],
  },
])

async function load() {
  loading.value = true
  errorDetail.value = null
  try {
    const result = await conversionsApi.list(props.materialId, {
      limit: CONVERSION_PAGE_SIZE,
      offset: 0,
    })
    conversions.value = result.items
  } catch (error) {
    conversions.value = []
    errorDetail.value = getErrorDetail(error)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  drawerMode.value = 'create'
  editingId.value = null
  editingDirection.value = null
  form.value = { to_unit_id: null, factor: '' }
  drawerOpen.value = true
}

function openEdit(row: ConversionRow) {
  drawerMode.value = 'edit'
  editingId.value = row.id
  // 编辑沿用该行原本的 from/to（新增时才是「基础单位 → 目标单位」）
  form.value = { to_unit_id: row.toUnitId, factor: row.factor }
  editingDirection.value = { fromUnitId: row.fromUnitId, toUnitId: row.toUnitId }
  drawerOpen.value = true
}

function closeDrawer() {
  if (!saving.value) drawerOpen.value = false
}

async function submit() {
  const factor = form.value.factor.trim()
  if (form.value.to_unit_id === null) {
    message.warning('请选择目标单位')
    return
  }
  if (factor === '' || !(Number(factor) > 0)) {
    message.warning('请填写大于 0 的换算系数')
    return
  }

  // 新增：基础单位 → 目标单位；编辑：沿用该行原本的方向
  const payload = editingDirection.value
    ? {
        from_unit_id: editingDirection.value.fromUnitId,
        to_unit_id: editingDirection.value.toUnitId,
        factor,
      }
    : {
        from_unit_id: props.baseUnitId,
        to_unit_id: form.value.to_unit_id,
        factor,
      }

  saving.value = true
  try {
    if (drawerMode.value === 'edit' && editingId.value !== null) {
      await conversionsApi.update(props.materialId, editingId.value, payload)
      message.success('单位换算已更新')
    } else {
      await conversionsApi.create(props.materialId, payload)
      message.success('单位换算已新增')
    }
    drawerOpen.value = false
    await load()
    emit('changed')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

function confirmDelete(row: ConversionRow) {
  dialog.warning({
    title: '删除单位换算',
    content: `确认删除「1 ${unitLabel(props.units, row.fromUnitId)} = ${row.factor} ${unitLabel(props.units, row.toUnitId)}」吗？删除后该单位不再能用于此物料的 SKU。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: () => remove(row),
  })
}

async function remove(row: ConversionRow) {
  try {
    await conversionsApi.remove(props.materialId, row.id)
    message.success('单位换算已删除')
    await load()
    emit('changed')
  } catch (error) {
    message.error(getErrorMessage(error))
  }
}

onMounted(load)

// 基础单位或单位目录到位后，展示文案才会正确，因此需要重新取一次
watch(() => [props.materialId, props.baseUnitId] as const, load)
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <div class="panel-head__copy">
        <h2>单位换算</h2>
        <p>
          以基础单位 <strong>{{ baseUnitText }}</strong> 为一端；只有建立换算的单位才能用于该物料的
          SKU。
        </p>
      </div>
      <div class="panel-head__actions">
        <NButton type="primary" size="small" @click="openCreate">
          <template #icon><Plus :size="15" /></template>
          新增换算
        </NButton>
        <NButton size="small" :loading="loading" @click="load">
          <template #icon><RefreshCw :size="15" /></template>
          刷新
        </NButton>
      </div>
    </div>

    <AsyncState
      :loading="loading"
      :error="errorDetail?.message ?? ''"
      :error-trace-id="errorDetail?.traceId ?? ''"
      @retry="load"
    >
      <p v-if="mayBeTruncated" class="panel-hint">
        最多显示 {{ CONVERSION_PAGE_SIZE }} 条换算，更多请通过接口查询。
      </p>
      <NDataTable size="small" :bordered="false" :columns="columns" :data="rows" :loading="loading">
        <template #empty>
          <NEmpty size="small" description="该物料暂无单位换算" />
        </template>
      </NDataTable>
    </AsyncState>

    <NDrawer v-model:show="drawerOpen" :width="420" placement="right">
      <NDrawerContent :title="drawerMode === 'edit' ? '编辑单位换算' : '新增单位换算'" closable>
        <NForm :show-label="true" label-placement="top" :show-feedback="false">
          <NFormItem v-if="editingDirection" label="换算方向">
            <NInput :value="editingRelationText" disabled />
          </NFormItem>
          <NFormItem v-else label="目标单位">
            <NSelect
              v-model:value="form.to_unit_id"
              :options="targetUnitOptions"
              filterable
              placeholder="请选择与基础单位可公度的单位"
            />
          </NFormItem>
          <NFormItem :label="factorLabel">
            <NInput v-model:value="form.factor" placeholder="例如 1000" />
          </NFormItem>
        </NForm>
        <p class="drawer-hint">
          换算系数是十进制字符串，例如 1 KG = 1000 G 填
          1000。编辑方向不可改：需要另一个方向时请删除后重新添加。
        </p>
        <template #footer>
          <div class="drawer-footer">
            <NButton :disabled="saving" @click="closeDrawer">取消</NButton>
            <NButton type="primary" :loading="saving" @click="submit">保存</NButton>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>
  </section>
</template>

<style scoped>
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
}

.panel-head__copy h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 650;
}

.panel-head__copy p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}

.panel-head__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.panel-hint {
  margin: 0;
  padding: 0 16px 10px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.drawer-hint {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

@media (max-width: 640px) {
  .panel-head {
    flex-direction: column;
  }
}
</style>
