<script setup lang="ts">
/* global navigator */
import { Copy, KeyRound, Plus, RefreshCw } from '@lucide/vue'
import { useBreakpoints } from '@vueuse/core'
import { NAlert, NButton, NDrawer, NDrawerContent, NTag, useDialog, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { apiKeysApi } from '@/api/api-keys'
import { getErrorDetail, getErrorMessage, type ErrorDetail } from '@/api/error'
import AsyncState from '@/components/common/AsyncState.vue'
import DataTable from '@/components/common/DataTable.vue'
import {
  apiAppStatusLabel,
  apiAppStatusTagType,
  apiSecretColumns,
} from '@/features/api-keys/api-key'
import SecretFormModal, { type SecretFormMode } from '@/features/api-keys/SecretFormModal.vue'
import SecretRevealModal from '@/features/api-keys/SecretRevealModal.vue'

import type { APIApp, APISecret, IssuedAPISecret } from '@/types/api'

const props = defineProps<{
  show: boolean
  app: APIApp | null
}>()

const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const message = useMessage()
const dialog = useDialog()
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const secrets = ref<APISecret[]>([])
const loading = ref(false)
const errorDetail = ref<ErrorDetail | null>(null)
const busySecretId = ref<string | null>(null)

const formOpen = ref(false)
const formMode = ref<SecretFormMode>('issue')
const editingSecret = ref<APISecret | null>(null)
const revealOpen = ref(false)
const issued = ref<IssuedAPISecret | null>(null)

watch(
  () => [props.show, props.app?.id] as const,
  ([show]) => {
    if (!show) {
      secrets.value = []
      errorDetail.value = null
      loading.value = false
      formOpen.value = false
      revealOpen.value = false
      issued.value = null
      busySecretId.value = null
      return
    }
    // 切换应用时先清空上一条应用的密钥，避免加载期间短暂显示旧数据
    secrets.value = []
    errorDetail.value = null
    void loadSecrets()
  },
)

watch(revealOpen, (open) => {
  if (!open) issued.value = null
})

async function loadSecrets() {
  const app = props.app
  if (!app) return
  loading.value = true
  errorDetail.value = null
  try {
    const result = await apiKeysApi.listSecrets(app.id)
    secrets.value = result.items ?? []
  } catch (error) {
    secrets.value = []
    errorDetail.value = getErrorDetail(error)
  } finally {
    loading.value = false
  }
}

const columns = computed(() =>
  apiSecretColumns({
    onReissue: openReissue,
    onToggleStatus: toggleStatus,
    onEdit: openEdit,
    onDelete: confirmDelete,
  }),
)

function openIssue() {
  formMode.value = 'issue'
  editingSecret.value = null
  formOpen.value = true
}

function openEdit(secret: APISecret) {
  formMode.value = 'edit'
  editingSecret.value = secret
  formOpen.value = true
}

function openReissue(secret: APISecret) {
  formMode.value = 'reissue'
  editingSecret.value = secret
  formOpen.value = true
}

function onIssued(result: IssuedAPISecret) {
  issued.value = result
  revealOpen.value = true
  void loadSecrets()
}

function onSaved() {
  void loadSecrets()
}

function toggleStatus(secret: APISecret) {
  if (busySecretId.value !== null) return
  if (secret.status === 'active') {
    dialog.warning({
      title: '禁用密钥',
      content: `确认禁用「${secret.name}」吗？禁用后调用方立即无法使用该密钥。`,
      positiveText: '确认禁用',
      negativeText: '取消',
      onPositiveClick: () => blockSecret(secret),
    })
    return
  }
  void unblockSecret(secret)
}

async function blockSecret(secret: APISecret) {
  const app = props.app
  if (!app || busySecretId.value !== null) return
  busySecretId.value = secret.secret_id
  try {
    await apiKeysApi.blockSecret(app.id, secret.secret_id)
    message.success('密钥已禁用')
    await loadSecrets()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    busySecretId.value = null
  }
}

async function unblockSecret(secret: APISecret) {
  const app = props.app
  if (!app || busySecretId.value !== null) return
  busySecretId.value = secret.secret_id
  try {
    await apiKeysApi.unblockSecret(app.id, secret.secret_id)
    message.success('密钥已启用')
    await loadSecrets()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    busySecretId.value = null
  }
}

function confirmDelete(secret: APISecret) {
  dialog.warning({
    title: '删除密钥',
    content: `确认删除「${secret.name}」（${secret.secret_id}）吗？删除后不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: () => deleteSecret(secret),
  })
}

async function deleteSecret(secret: APISecret) {
  const app = props.app
  if (!app || busySecretId.value !== null) return
  busySecretId.value = secret.secret_id
  try {
    await apiKeysApi.deleteSecret(app.id, secret.secret_id)
    message.success('密钥已删除')
    await loadSecrets()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    busySecretId.value = null
  }
}

async function copyAppID() {
  if (!props.app) return
  try {
    await navigator.clipboard.writeText(props.app.app_id)
    message.success('App ID 已复制')
  } catch {
    message.error('复制失败，请手动选择文本复制')
  }
}
</script>

<template>
  <NDrawer v-model:show="visible" :width="isMobile ? '100%' : 760" placement="right">
    <NDrawerContent closable>
      <template #header>
        <div class="drawer-header">
          <span class="drawer-title">
            <KeyRound :size="16" />
            {{ app ? `${app.name} · 密钥` : 'API 密钥' }}
          </span>
          <NButton size="small" :loading="loading" @click="loadSecrets">
            <template #icon><RefreshCw :size="14" /></template>
            刷新
          </NButton>
        </div>
      </template>

      <template v-if="app">
        <section class="app-summary">
          <div class="app-summary__item">
            <span class="app-summary__label">App ID</span>
            <code class="app-summary__code">{{ app.app_id }}</code>
            <NButton size="tiny" quaternary aria-label="复制 App ID" @click="copyAppID">
              <template #icon><Copy :size="14" /></template>
            </NButton>
          </div>
          <div class="app-summary__item">
            <span class="app-summary__label">应用状态</span>
            <NTag :type="apiAppStatusTagType(app.status)" size="small" :bordered="false">
              {{ apiAppStatusLabel(app.status) }}
            </NTag>
          </div>
          <div class="app-summary__item">
            <span class="app-summary__label">密钥数量</span>
            <span>{{ secrets.length }}</span>
          </div>
        </section>

        <NAlert v-if="app.status === 'inactive'" type="warning" :show-icon="true" class="hint">
          应用已停用，其下所有密钥当前都无法调用受保护接口。
        </NAlert>

        <NAlert type="info" :show-icon="true" class="hint">
          调用受保护接口时同时发送请求头
          <code>X-Stock-Flow-App-ID</code> 与 <code>X-Stock-Flow-Secret</code>；
          密钥明文只在签发或重新签发时显示一次。
        </NAlert>

        <div class="toolbar">
          <NButton type="primary" @click="openIssue">
            <template #icon><Plus :size="15" /></template>
            签发密钥
          </NButton>
        </div>

        <DataTable
          :columns="columns"
          :rows="secrets"
          :loading="loading"
          :error="errorDetail?.message ?? ''"
          :error-trace-id="errorDetail?.traceId ?? ''"
          empty-text="该应用还没有密钥"
          export-file-name="API 密钥"
          @retry="loadSecrets"
        />
      </template>

      <AsyncState v-else empty empty-text="请先选择一个 API 应用" />
    </NDrawerContent>
  </NDrawer>

  <SecretFormModal
    v-model:show="formOpen"
    :mode="formMode"
    :app-id="app?.id ?? null"
    :secret="editingSecret"
    @issued="onIssued"
    @saved="onSaved"
  />
  <SecretRevealModal v-model:show="revealOpen" :app="app" :issued="issued" />
</template>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.drawer-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 28px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.app-summary__item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.app-summary__label {
  color: var(--color-text-muted);
}

.app-summary__code {
  max-width: 320px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  margin-bottom: 12px;
}

.hint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 4px 0 10px;
}

@media (max-width: 680px) {
  .app-summary {
    flex-direction: column;
    gap: 8px;
  }

  .app-summary__code {
    max-width: 100%;
  }
}
</style>
