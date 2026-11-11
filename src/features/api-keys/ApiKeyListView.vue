<script setup lang="ts">
import { Plus, RefreshCw } from '@lucide/vue'
import { NAlert, NButton, NPagination, useDialog, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { apiKeysApi } from '@/api/api-keys'
import { getErrorDetail, getErrorMessage, type ErrorDetail } from '@/api/error'
import DataTable from '@/components/common/DataTable.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { apiAppColumns } from '@/features/api-keys/api-key'
import ApiAppFormDrawer, {
  type CreatedAPIAppResult,
} from '@/features/api-keys/ApiAppFormDrawer.vue'
import ApiKeySecretsDrawer from '@/features/api-keys/ApiKeySecretsDrawer.vue'
import SecretRevealModal from '@/features/api-keys/SecretRevealModal.vue'

import type { APIApp, IssuedAPISecret } from '@/types/api'

const message = useMessage()
const dialog = useDialog()

const rows = ref<APIApp[]>([])
const loading = ref(false)
const errorDetail = ref<ErrorDetail | null>(null)
const total = ref(0)
const offset = ref(0)
const pageSize = 100
const busyId = ref<number | null>(null)

const appDrawerOpen = ref(false)
const appDrawerMode = ref<'create' | 'edit'>('create')
const appDrawerApp = ref<APIApp | null>(null)

const secretsOpen = ref(false)
const secretsApp = ref<APIApp | null>(null)

const revealOpen = ref(false)
const revealApp = ref<APIApp | null>(null)
const revealed = ref<IssuedAPISecret | null>(null)

watch(revealOpen, (open) => {
  if (open) return
  revealed.value = null
  revealApp.value = null
})

const page = computed(() => Math.floor(offset.value / pageSize) + 1)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

const columns = computed(() =>
  apiAppColumns({
    onManageKeys: manageKeys,
    onEdit: openEdit,
    onToggleStatus: toggleStatus,
    onDelete: confirmDelete,
  }),
)

async function load() {
  loading.value = true
  errorDetail.value = null
  try {
    const result = await apiKeysApi.listApps({ limit: pageSize, offset: offset.value })
    rows.value = result.items ?? []
    total.value = result.total

    // 删除当前页最后一条后可能越界：回退到最后一个有数据的页
    if (rows.value.length === 0 && offset.value > 0 && result.total > 0) {
      offset.value = Math.max(0, Math.ceil(result.total / pageSize) - 1) * pageSize
      await load()
    }
  } catch (error) {
    rows.value = []
    total.value = 0
    errorDetail.value = getErrorDetail(error)
  } finally {
    loading.value = false
  }
}

async function reload() {
  await load()
}

async function goToPage(target: number) {
  if (loading.value) return
  const nextOffset = Math.max(0, (target - 1) * pageSize)
  if (nextOffset === offset.value) return
  offset.value = nextOffset
  await load()
}

function openCreate() {
  appDrawerMode.value = 'create'
  appDrawerApp.value = null
  appDrawerOpen.value = true
}

function openEdit(row: APIApp) {
  appDrawerMode.value = 'edit'
  appDrawerApp.value = row
  appDrawerOpen.value = true
}

function manageKeys(row: APIApp) {
  secretsApp.value = row
  secretsOpen.value = true
}

function onSaved() {
  void reload()
}

function onCreated(result: CreatedAPIAppResult) {
  appDrawerOpen.value = false
  void reload()

  if (result.issued) {
    revealApp.value = result.app
    revealed.value = result.issued
    revealOpen.value = true
    return
  }
  if (result.issueError) {
    message.warning(`应用已创建，但首把密钥签发失败：${result.issueError}`)
    manageKeys(result.app)
  }
}

function toggleStatus(row: APIApp) {
  if (busyId.value !== null) return
  if (row.status === 'active') {
    dialog.warning({
      title: '停用 API 应用',
      content: `确认停用「${row.name}」吗？停用后该应用下的所有密钥立即无法调用受保护接口。`,
      positiveText: '确认停用',
      negativeText: '取消',
      onPositiveClick: () => updateStatus(row, 'inactive'),
    })
    return
  }
  void updateStatus(row, 'active')
}

async function updateStatus(row: APIApp, status: APIApp['status']) {
  if (busyId.value !== null) return
  busyId.value = row.id
  try {
    await apiKeysApi.updateApp(row.id, {
      name: row.name,
      description: row.description,
      status,
      metadata: row.metadata ?? {},
    })
    message.success(status === 'active' ? '应用已启用' : '应用已停用')
    await reload()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    busyId.value = null
  }
}

function confirmDelete(row: APIApp) {
  dialog.warning({
    title: '删除 API 应用',
    content: `确认删除「${row.name}」（${row.app_id}）吗？删除后其下所有密钥立即失效，且不可恢复。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: () => deleteApp(row),
  })
}

async function deleteApp(row: APIApp) {
  if (busyId.value !== null) return
  busyId.value = row.id
  try {
    await apiKeysApi.deleteApp(row.id)
    message.success('API 应用已删除')
    await reload()
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    busyId.value = null
  }
}

void load()
</script>

<template>
  <main class="page">
    <PageHeader title="API 密钥" :description="`共 ${total} 个应用 · 第 ${page} / ${pageCount} 页`">
      <template #actions>
        <NButton type="primary" @click="openCreate">
          <template #icon><Plus :size="16" /></template>
          新建应用
        </NButton>
        <NButton :loading="loading" @click="reload">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <NAlert type="info" :show-icon="true" class="usage">
      外部系统调用受保护接口时，同时发送请求头
      <code>X-Stock-Flow-App-ID</code> 与 <code>X-Stock-Flow-Secret</code>。
      持有有效密钥即可调用全部受保护接口；密钥明文只在签发或重新签发时显示一次。
    </NAlert>

    <section class="panel">
      <DataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :error="errorDetail?.message ?? ''"
        :error-trace-id="errorDetail?.traceId ?? ''"
        empty-text="还没有 API 应用，点击右上角「新建应用」开始"
        export-file-name="API 应用"
        :row-key="(row: APIApp) => row.id"
        row-clickable
        @row-click="manageKeys"
        @retry="reload"
      />

      <footer v-if="total > 0" class="pager">
        <span class="pager__hint">共 {{ total }} 条，每页 {{ pageSize }} 条</span>
        <NPagination
          :page="page"
          :item-count="total"
          :page-size="pageSize"
          :disabled="loading"
          show-quick-jumper
          @update:page="goToPage"
        >
          <template #goto>跳至</template>
        </NPagination>
      </footer>
    </section>

    <ApiAppFormDrawer
      v-model:show="appDrawerOpen"
      :mode="appDrawerMode"
      :app="appDrawerApp"
      @saved="onSaved"
      @created="onCreated"
    />

    <ApiKeySecretsDrawer v-model:show="secretsOpen" :app="secretsApp" />

    <SecretRevealModal v-model:show="revealOpen" :app="revealApp" :issued="revealed" />
  </main>
</template>

<style scoped>
.usage {
  margin-bottom: 16px;
}

.usage code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
}

.pager__hint {
  color: var(--color-text-muted);
  font-size: 12px;
}

.pager :deep(.n-pagination) {
  flex-wrap: wrap;
  justify-content: flex-end;
}

@media (max-width: 680px) {
  .pager {
    align-items: stretch;
    flex-direction: column;
  }

  .pager :deep(.n-pagination) {
    justify-content: flex-start;
  }
}
</style>
