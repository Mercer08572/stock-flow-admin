<script setup lang="ts">
import { RotateCcw, Search } from '@lucide/vue'
import { NButton, NDatePicker, NInput, NInputNumber, NSelect, NTag, useMessage } from 'naive-ui'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { auditApi, type AuditLogQuery } from '@/api/audit'
import { getErrorDetail, getErrorMessage, type ErrorDetail } from '@/api/error'
import DataTable from '@/components/common/DataTable.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import {
  actorText,
  auditAuthMethodOptions,
  authMethodLabel,
  authMethodTagType,
  formatLatency,
  pathText,
  statusTagType,
} from '@/features/audit/audit-log'

import type { AuditAuthMethod, AuditLog } from '@/types/api'

const message = useMessage()
const route = useRoute()
const router = useRouter()

const pageSize = 50

const initialTraceID = typeof route.query.trace_id === 'string' ? route.query.trace_id : ''
const range = ref<number | [number, number] | null>(initialTraceID ? null : defaultRange())
const authMethod = ref<AuditAuthMethod | null>(null)
const actorLabel = ref('')
const clientIP = ref('')
const statusCode = ref<number | null>(null)
const path = ref('')
const traceID = ref(initialTraceID)

const rows = ref<AuditLog[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const errorDetail = ref<ErrorDetail | null>(null)
const nextCursor = ref('')

const description = computed(
  () => `按时间、认证方式、调用方、IP、状态码过滤 · 已加载 ${rows.value.length} 条`,
)

const columns: DataTableColumn<AuditLog>[] = [
  {
    key: 'occurred_at',
    title: '时间',
    width: 175,
    render: (row) => formatDateTime(row.occurred_at),
    exportValue: (row) => formatDateTime(row.occurred_at, ''),
  },
  {
    key: 'auth_method',
    title: '认证方式',
    width: 110,
    filterOptions: auditAuthMethodOptions.map((option) => ({
      label: option.label,
      value: option.value,
    })),
    render: (row) =>
      h(
        NTag,
        { type: authMethodTagType(row.auth_method), size: 'small', bordered: false },
        { default: () => authMethodLabel(row.auth_method) },
      ),
    exportValue: (row) => authMethodLabel(row.auth_method),
  },
  {
    key: 'actor_label',
    title: '调用方',
    width: 190,
    render: (row) => actorText(row),
    exportValue: (row) => actorText(row),
  },
  { key: 'method', title: '方法', width: 75 },
  {
    key: 'path',
    title: '路径',
    width: 260,
    render: (row) =>
      h(
        'code',
        {
          title: row.route ? `路由模板：${row.route}` : row.path,
          style: 'font-size: 12px; word-break: break-all;',
        },
        pathText(row),
      ),
    exportValue: (row) => row.path,
  },
  {
    key: 'status_code',
    title: '状态',
    width: 80,
    render: (row) =>
      h(
        NTag,
        { type: statusTagType(row.status_code), size: 'small', bordered: false },
        { default: () => String(row.status_code) },
      ),
    exportValue: (row) => String(row.status_code),
  },
  {
    key: 'latency_ms',
    title: '耗时',
    width: 90,
    align: 'right',
    render: (row) => formatLatency(row.latency_ms),
    exportValue: (row) => formatLatency(row.latency_ms),
  },
  {
    key: 'client_ip',
    title: 'IP',
    width: 135,
    render: (row) => row.client_ip || '-',
  },
  {
    key: 'error_code',
    title: '错误码',
    width: 190,
    render: (row) => row.error_code || '-',
  },
  {
    key: 'trace_id',
    title: '追踪 ID',
    width: 180,
    render: (row) => h('code', { style: 'font-size: 12px;' }, row.trace_id),
  },
]

function defaultRange(): [number, number] {
  const to = Date.now()
  return [to - 24 * 60 * 60 * 1000, to]
}

function buildQuery(cursor?: string): AuditLogQuery {
  const query: AuditLogQuery = { limit: pageSize }
  if (Array.isArray(range.value)) {
    query.from = new Date(range.value[0]).toISOString()
    query.to = new Date(range.value[1]).toISOString()
  }
  if (authMethod.value) query.auth_method = authMethod.value
  if (actorLabel.value.trim()) query.actor_label = actorLabel.value.trim()
  if (clientIP.value.trim()) query.client_ip = clientIP.value.trim()
  if (statusCode.value !== null) query.status_code = statusCode.value
  if (path.value.trim()) query.path = path.value.trim()
  if (traceID.value.trim()) query.trace_id = traceID.value.trim()
  if (cursor) query.cursor = cursor
  return query
}

async function load(append: boolean) {
  if (append && !nextCursor.value) return
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
    errorDetail.value = null
  }

  try {
    const result = await auditApi.list(buildQuery(append ? nextCursor.value : undefined))
    const items = result.items ?? []
    rows.value = append ? [...rows.value, ...items] : items
    nextCursor.value = result.next_cursor ?? ''
  } catch (error) {
    if (append) {
      message.error(`加载更多失败：${getErrorMessage(error)}`)
    } else {
      rows.value = []
      nextCursor.value = ''
      errorDetail.value = getErrorDetail(error)
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function search() {
  rows.value = []
  nextCursor.value = ''
  await load(false)
}

function reset() {
  range.value = defaultRange()
  authMethod.value = null
  actorLabel.value = ''
  clientIP.value = ''
  statusCode.value = null
  path.value = ''
  traceID.value = ''
  // 清掉路由里的 trace_id，否则从流水页再次点同一个 trace 链接会是一次无变化的导航，
  // 页面不会重新应用过滤条件。
  if (route.query.trace_id !== undefined) {
    const query = { ...route.query }
    delete query.trace_id
    void router.replace({ query })
  }
  void search()
}

watch(
  () => route.query.trace_id,
  (value) => {
    const next = typeof value === 'string' ? value : ''
    if (next === traceID.value) return
    traceID.value = next
    if (next) {
      // 从流水跳转过来时 trace 可能不在最近 24 小时内；交给后端按保留期查询。
      range.value = null
    }
    void search()
  },
)

onMounted(() => {
  void search()
})
</script>

<template>
  <main class="page">
    <PageHeader title="审计日志" :description="description">
      <template #actions>
        <NButton type="primary" :loading="loading" @click="search">
          <template #icon><Search :size="16" /></template>
          查询
        </NButton>
        <NButton :disabled="loading" @click="reset">
          <template #icon><RotateCcw :size="16" /></template>
          重置
        </NButton>
      </template>
    </PageHeader>

    <section class="filters">
      <div class="filter-item filter-range">
        <span class="filter-label">时间范围</span>
        <NDatePicker
          v-model:value="range"
          type="datetimerange"
          clearable
          class="filter-control"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
        />
      </div>

      <div class="filter-item filter-auth">
        <span class="filter-label">认证方式</span>
        <NSelect
          v-model:value="authMethod"
          :options="auditAuthMethodOptions"
          clearable
          placeholder="全部"
        />
      </div>

      <div class="filter-item filter-actor">
        <span class="filter-label">调用方</span>
        <NInput
          v-model:value="actorLabel"
          clearable
          placeholder="管理员用户名或 App ID"
          @keyup.enter="search"
        />
      </div>

      <div class="filter-item filter-ip">
        <span class="filter-label">IP 地址</span>
        <NInput
          v-model:value="clientIP"
          clearable
          placeholder="例如 203.0.113.10"
          @keyup.enter="search"
        />
      </div>

      <div class="filter-item filter-status">
        <span class="filter-label">状态码</span>
        <NInputNumber
          v-model:value="statusCode"
          :min="100"
          :max="599"
          clearable
          placeholder="例如 401"
          class="filter-control"
          @keyup.enter="search"
        />
      </div>

      <div class="filter-item filter-path">
        <span class="filter-label">请求路径</span>
        <NInput
          v-model:value="path"
          clearable
          placeholder="例如 /api/v1/inventory/stocks"
          @keyup.enter="search"
        />
      </div>

      <div class="filter-item filter-trace">
        <span class="filter-label">追踪 ID</span>
        <NInput
          v-model:value="traceID"
          clearable
          placeholder="例如 req_abcd1234"
          @keyup.enter="search"
        />
      </div>
    </section>

    <section class="panel">
      <DataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :error="errorDetail?.message ?? ''"
        :error-trace-id="errorDetail?.traceId ?? ''"
        empty-text="当前条件下没有审计日志"
        export-file-name="审计日志"
        :row-key="(row: AuditLog) => row.id"
        @retry="search"
      />

      <footer v-if="rows.length > 0" class="pager">
        <span class="pager__hint">已加载 {{ rows.length }} 条</span>
        <NButton v-if="nextCursor" :loading="loadingMore" @click="load(true)"> 加载更多 </NButton>
        <span v-else class="pager__hint">没有更多了</span>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px 16px;
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.filter-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.filter-range {
  grid-column: span 2;
}

.filter-label {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.filter-control {
  width: 100%;
}

.filters :deep(.n-date-picker) {
  width: 100%;
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

@media (max-width: 680px) {
  .filters {
    grid-template-columns: 1fr;
    padding: 12px;
  }

  .filter-range {
    grid-column: span 1;
  }

  .pager {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
