<script setup lang="ts">
/**
 * 实体表单抽屉：主数据列表页与（后续的）详情页共用的表单容器。
 *
 * 它只负责**「表单怎么渲染、怎么提交」**，不持有列表状态：
 * 收起抽屉由父组件在 `saved` 里决定（父组件还要刷新列表）。
 *
 * 之所以必须共用：`PUT /xxx/:id` 是**全量替换**，漏发字段会被后端写成 Go 零值，
 * 这条规则由 `lib/entity-form.ts` 单份实现，任何页面都不该再写第二遍。
 */

import { computed, ref, watch } from 'vue'
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  useMessage,
} from 'naive-ui'

import { getErrorDetail, getErrorMessage, type ErrorDetail } from '@/api/error'
import AsyncState from '@/components/common/AsyncState.vue'
import {
  buildPayload,
  createEmptyForm,
  fillForm,
  findMissingRequired,
  referenceSources,
  resolveFieldOptions,
  type FieldConfig,
  type FieldOption,
  type FormValues,
} from '@/features/master-data/lib/entity-form'
import { loadReferenceOptions } from '@/features/master-data/lib/reference-cache'

const props = withDefaults(
  defineProps<{
    /** 抽屉是否打开 */
    show: boolean
    fields: readonly FieldConfig[]
    /** 资源名，用于「新增物料 / 编辑物料」标题与提示文案 */
    title: string
    /** 新增：直接调 create；编辑：先按 `load` 预填，再调 update */
    mode: 'create' | 'edit'
    /** 编辑模式下的实体 ID */
    entityId?: number | null
    /** 编辑模式下拉取实体用于预填 */
    load: (id: number) => Promise<Record<string, unknown>>
    /** 缺省为空实现：只读使用（未来详情页展示）无需绑定写接口 */
    create?: ((body: Record<string, unknown>) => Promise<unknown>) | undefined
    update?: ((id: number, body: Record<string, unknown>) => Promise<unknown>) | undefined
  }>(),
  {
    entityId: null,
    create: () => Promise.resolve(),
    update: () => Promise.resolve(),
  },
)

const emit = defineEmits<{
  'update:show': [show: boolean]
  /** 保存成功；父组件据此收起抽屉并刷新列表 */
  saved: []
}>()

const message = useMessage()
const form = ref<FormValues>({})
/** 引用型下拉的数据；静态字段原样保留 */
const optionsBySource = ref<Record<string, FieldOption[]>>({})
const loadingDetail = ref(false)
const detailError = ref<ErrorDetail | null>(null)
const saving = ref(false)

const drawerTitle = ref('')

/** 实际渲染的字段：静态 options 原样，引用型字段在数据到位后补上 options */
const resolvedFields = computed(() => resolveFieldOptions(props.fields, optionsBySource.value))

/**
 * 每次打开都重置：`GET /:id` 期间不能显示上一次编辑的残留值。
 *
 * 把「先加载选项、再预填表单」放在这里而不是只放在编辑分支里：
 * 新增模式同样需要选项表才能渲染下拉（否则打开时是空的 No Data）。
 */
watch(
  () => [props.show, props.mode, props.entityId, props.fields] as const,
  () => {
    if (!props.show) return

    detailError.value = null
    optionsBySource.value = {}
    form.value = createEmptyForm([...props.fields])
    drawerTitle.value = `${props.mode === 'edit' ? '编辑' : '新增'}${props.title}`
    void loadForm()
  },
  { immediate: true, deep: false },
)

async function loadForm() {
  detailError.value = null
  loadingDetail.value = true
  try {
    // 顺序不能反：NSelect 只显示存在于选项表里的值
    optionsBySource.value = await loadReferenceData(props.fields)

    // 新增模式不能再 fillForm 一次：那会把 createEmptyForm 的默认值（status=active）清空
    const targetId = props.entityId
    if (props.mode === 'edit' && targetId !== null) {
      form.value = fillForm([...props.fields], await props.load(targetId))
    }
  } catch (error) {
    detailError.value = getErrorDetail(error)
  } finally {
    loadingDetail.value = false
  }
}

/** 并发加载本表单用到的引用选项，按来源去重 */
async function loadReferenceData(
  fields: readonly FieldConfig[],
): Promise<Record<string, FieldOption[]>> {
  const entries = await Promise.all(
    referenceSources(fields).map(async (key) => [key, await loadReferenceOptions(key)] as const),
  )
  return Object.fromEntries(entries)
}

function retryDetail() {
  void loadForm()
}

function close() {
  if (!saving.value) emit('update:show', false)
}

async function submit() {
  const fields = [...props.fields]
  const missing = findMissingRequired(fields, form.value)
  if (missing) {
    message.warning(`请填写${missing.label}`)
    return
  }

  const payload = buildPayload(fields, form.value)
  const targetId = props.entityId

  saving.value = true
  try {
    if (props.mode === 'edit' && targetId !== null) {
      await props.update?.(targetId, payload)
      message.success(`${props.title}已更新`)
    } else {
      await props.create?.(payload)
      message.success(`${props.title}已新增`)
    }
    emit('saved')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <NDrawer :show="show" :width="460" placement="right" @update:show="emit('update:show', $event)">
    <NDrawerContent :title="drawerTitle" closable>
      <AsyncState
        :loading="loadingDetail"
        :error="detailError?.message ?? ''"
        :error-trace-id="detailError?.traceId ?? ''"
        @retry="retryDetail"
      >
        <NForm :show-label="true" label-placement="top" :show-feedback="false">
          <NFormItem v-for="field in resolvedFields" :key="field.key" :label="field.label">
            <NInput
              v-if="field.type === 'text'"
              v-model:value="form[field.key]"
              :disabled="field.disabled === true"
              :placeholder="field.placeholder"
            />
            <NInputNumber
              v-else-if="field.type === 'number'"
              v-model:value="form[field.key]"
              class="form-control"
              :min="field.min"
              :max="field.max"
              :disabled="field.disabled === true"
              :placeholder="field.placeholder"
            />
            <NSelect
              v-else-if="field.type === 'select'"
              v-model:value="form[field.key]"
              :options="field.options"
              :disabled="field.disabled === true"
              filterable
              :placeholder="`请选择${field.label}`"
              @update:value="field.onChange?.($event)"
            />
            <NInput
              v-else
              v-model:value="form[field.key]"
              type="textarea"
              :disabled="field.disabled === true"
              :placeholder="field.placeholder"
              :autosize="{ minRows: 3, maxRows: 6 }"
            />
          </NFormItem>
        </NForm>
      </AsyncState>
      <template #footer>
        <div class="drawer-footer">
          <NButton :disabled="saving" @click="close">取消</NButton>
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
