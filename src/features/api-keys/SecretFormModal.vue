<script setup lang="ts">
import {
  NAlert,
  NButton,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NModal,
  useMessage,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { apiKeysApi } from '@/api/api-keys'
import { getErrorMessage } from '@/api/error'
import { isoToTimestamp, timestampToIso } from '@/features/api-keys/api-key'

import type { APISecret, IssuedAPISecret } from '@/types/api'

export type SecretFormMode = 'issue' | 'edit' | 'reissue'

const props = defineProps<{
  show: boolean
  mode: SecretFormMode
  appId: number | null
  /** 编辑/重新签发时必填 */
  secret: APISecret | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  issued: [secret: IssuedAPISecret]
  saved: []
}>()

const message = useMessage()
const name = ref('')
const expiresAt = ref<number | null>(null)
const saving = ref(false)

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const title = computed(() => {
  if (props.mode === 'edit') return '编辑密钥'
  if (props.mode === 'reissue') return '重新签发密钥'
  return '签发密钥'
})

const submitText = computed(() => {
  if (props.mode === 'edit') return '保存'
  if (props.mode === 'reissue') return '确认重新签发'
  return '签发'
})

watch(
  () => [props.show, props.mode, props.secret?.secret_id] as const,
  () => {
    if (!props.show) return
    name.value = props.mode === 'issue' ? '' : (props.secret?.name ?? '')
    expiresAt.value = isoToTimestamp(props.secret?.expires_at ?? null)
  },
  { immediate: true },
)

function close() {
  if (saving.value) return
  visible.value = false
}

async function submit() {
  if (props.appId === null) return
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    message.warning('请填写密钥名称')
    return
  }
  if (expiresAt.value !== null && expiresAt.value <= Date.now()) {
    message.warning('过期时间必须晚于当前时间，留空表示永不过期')
    return
  }

  if (props.mode !== 'issue' && !props.secret) return

  const payload = {
    name: trimmedName,
    expires_at: timestampToIso(expiresAt.value),
  }

  saving.value = true
  try {
    if (props.mode === 'edit') {
      if (!props.secret) return
      await apiKeysApi.updateSecret(props.appId, props.secret.secret_id, payload)
      message.success('密钥已更新')
      emit('saved')
    } else if (props.mode === 'reissue') {
      if (!props.secret) return
      const issued = await apiKeysApi.reissueSecret(props.appId, props.secret.secret_id, payload)
      message.success('密钥已重新签发，旧密钥已禁用')
      emit('issued', issued)
    } else {
      const issued = await apiKeysApi.issueSecret(props.appId, payload)
      message.success('密钥已签发')
      emit('issued', issued)
    }
    visible.value = false
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <NModal
    v-model:show="visible"
    preset="card"
    :closable="!saving"
    :mask-closable="!saving"
    :style="{ width: 'min(520px, 92vw)' }"
    :title="title"
  >
    <NAlert v-if="mode === 'reissue'" type="warning" :show-icon="true" class="form-warning">
      保存后旧密钥立即禁用，调用方需要改用新密钥。新密钥明文只显示一次。
    </NAlert>
    <p v-else-if="mode === 'issue'" class="form-hint">
      签发后明文只显示一次，请提醒调用方立即保存。
    </p>
    <p v-else class="form-hint">只修改名称与过期时间，不影响密钥本身。</p>

    <NForm label-placement="top" :show-feedback="false">
      <NFormItem label="密钥名称">
        <NInput v-model:value="name" placeholder="例如：生产环境" maxlength="80" />
      </NFormItem>
      <NFormItem label="过期时间">
        <NDatePicker
          v-model:value="expiresAt"
          type="datetime"
          clearable
          class="form-control"
          placeholder="留空表示永不过期"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="modal-footer">
        <NButton :disabled="saving" @click="close">取消</NButton>
        <NButton type="primary" :loading="saving" @click="submit">{{ submitText }}</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.form-hint {
  margin: 0 0 16px;
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.form-warning {
  margin-bottom: 16px;
}

.form-control {
  width: 100%;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
