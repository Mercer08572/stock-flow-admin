<script setup lang="ts">
import { useBreakpoints } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NCheckbox,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  useMessage,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { apiKeysApi } from '@/api/api-keys'
import { getErrorDetail, getErrorMessage, type ErrorDetail } from '@/api/error'
import AsyncState from '@/components/common/AsyncState.vue'

import type { APIApp, APIAppStatus, IssuedAPISecret } from '@/types/api'

export interface CreatedAPIAppResult {
  app: APIApp
  issued: IssuedAPISecret | null
  /** 应用创建成功但首把密钥签发失败时的原因 */
  issueError: string
}

const props = defineProps<{
  show: boolean
  mode: 'create' | 'edit'
  /** 编辑模式必填 */
  app: APIApp | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
  created: [result: CreatedAPIAppResult]
}>()

const message = useMessage()
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')

const name = ref('')
const description = ref('')
const status = ref<APIAppStatus>('active')
const metadata = ref<Record<string, unknown>>({})
const issueFirst = ref(true)
const secretName = ref('默认密钥')

const loadingDetail = ref(false)
const detailError = ref<ErrorDetail | null>(null)
const saving = ref(false)

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const drawerTitle = computed(() => (props.mode === 'edit' ? '编辑 API 应用' : '新建 API 应用'))

watch(
  () => [props.show, props.mode, props.app?.id] as const,
  () => {
    if (!props.show) return
    detailError.value = null
    issueFirst.value = true
    secretName.value = '默认密钥'
    metadata.value = {}

    if (props.mode === 'edit' && props.app) {
      name.value = props.app.name
      description.value = props.app.description ?? ''
      status.value = props.app.status
      metadata.value = props.app.metadata ?? {}
      void loadDetail(props.app.id)
      return
    }

    name.value = ''
    description.value = ''
    status.value = 'active'
  },
  { immediate: true },
)

async function loadDetail(id: number) {
  loadingDetail.value = true
  detailError.value = null
  try {
    // 列表行已包含 metadata，但编辑前再取一次详情，避免列表数据过期导致全量更新覆盖新值
    const app = await apiKeysApi.getApp(id)
    name.value = app.name
    description.value = app.description ?? ''
    status.value = app.status
    metadata.value = app.metadata ?? {}
  } catch (error) {
    detailError.value = getErrorDetail(error)
  } finally {
    loadingDetail.value = false
  }
}

function retryDetail() {
  if (props.mode === 'edit' && props.app) void loadDetail(props.app.id)
}

function close() {
  if (!saving.value) visible.value = false
}

async function submit() {
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    message.warning('请填写应用名称')
    return
  }
  if (props.mode === 'create' && issueFirst.value && !secretName.value.trim()) {
    message.warning('请填写首把密钥的名称')
    return
  }

  saving.value = true
  try {
    if (props.mode === 'edit') {
      if (!props.app) return
      await apiKeysApi.updateApp(props.app.id, {
        name: trimmedName,
        description: description.value.trim() || null,
        status: status.value,
        metadata: metadata.value,
      })
      message.success('API 应用已更新')
      emit('saved')
      visible.value = false
      return
    }

    const app = await apiKeysApi.createApp({
      name: trimmedName,
      description: description.value.trim() || null,
      status: status.value,
      metadata: {},
    })

    let issued: IssuedAPISecret | null = null
    let issueError = ''
    if (issueFirst.value) {
      try {
        issued = await apiKeysApi.issueSecret(app.id, { name: secretName.value.trim() })
      } catch (error) {
        issueError = getErrorMessage(error)
      }
    }

    emit('created', { app, issued, issueError })
    visible.value = false
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="isMobile ? '100%' : 460" placement="right">
    <NDrawerContent :title="drawerTitle" closable :native-scrollbar="false">
      <AsyncState
        :loading="loadingDetail"
        :error="detailError?.message ?? ''"
        :error-trace-id="detailError?.traceId ?? ''"
        @retry="retryDetail"
      >
        <NForm label-placement="top" :show-feedback="false">
          <NFormItem label="应用名称">
            <NInput v-model:value="name" placeholder="例如：WMS 仓储系统" maxlength="80" />
          </NFormItem>
          <NFormItem label="描述">
            <NInput
              v-model:value="description"
              type="textarea"
              placeholder="可选，说明该应用的用途"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
          <NFormItem label="状态">
            <NSelect
              v-model:value="status"
              :options="[
                { label: '启用', value: 'active' },
                { label: '停用', value: 'inactive' },
              ]"
            />
          </NFormItem>

          <template v-if="mode === 'create'">
            <NFormItem>
              <NCheckbox v-model:checked="issueFirst" label="创建后立即签发首把密钥" />
            </NFormItem>
            <NFormItem v-if="issueFirst" label="首把密钥名称">
              <NInput v-model:value="secretName" placeholder="例如：默认密钥" maxlength="80" />
            </NFormItem>
          </template>

          <NAlert v-else-if="status === 'inactive'" type="warning" :show-icon="true">
            停用后，该应用下的所有密钥立即无法调用受保护接口。
          </NAlert>
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
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
