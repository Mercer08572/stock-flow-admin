<script setup lang="ts">
/**
 * 库存批次详情页：批次主数据 + 该批次在各仓库的库存分布。
 *
 * 批次没有数量字段：库存分布由后端在库存层上按 batch_id 聚合得到，
 * 这里只负责展示与跳转，不做任何跨接口拼接。
 */

import { ChevronLeft, Pencil, RefreshCw } from '@lucide/vue'
import { NButton, NTag } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { batchesApi } from '@/api/batches'
import { getErrorDetail, type ErrorDetail } from '@/api/error'
import AsyncState from '@/components/common/AsyncState.vue'
import DataTable from '@/components/common/DataTable.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { formatDateTime } from '@/components/common/data-table'
import { referenceLabel } from '@/components/common/reference-display'
import { useShellTabTitle } from '@/components/layout/shell-tab-title'
import EntityFormDrawer from '@/features/master-data/components/EntityFormDrawer.vue'
import {
  batchEditFields,
  batchStatusLabel,
  batchStockColumns,
  formatDateOnly,
} from '@/features/inventory/batches/batch'

import type { InventoryBatchDetail, UpdateBatchInput } from '@/types/api'

const route = useRoute()
const router = useRouter()
const batchId = Number(route.params.id)

const batch = ref<InventoryBatchDetail | null>(null)
const loading = ref(false)
const errorDetail = ref<ErrorDetail | null>(null)
const drawerOpen = ref(false)

const title = computed(() => (batch.value ? `批次 ${batch.value.batch_no}` : '批次详情'))

// 数据到达后把标签文案换成具体批号：详情路由的 meta 标题是固定的「批次详情」
useShellTabTitle(() => (batch.value ? title.value : null))

/** 编辑抽屉的契约是 Record<string, unknown>；具体入参类型在 api 层收口 */
function loadBatch(id: number) {
  return batchesApi.get(id) as unknown as Promise<Record<string, unknown>>
}

function updateBatch(id: number, body: Record<string, unknown>) {
  return batchesApi.update(id, body as unknown as UpdateBatchInput)
}

async function load() {
  loading.value = true
  errorDetail.value = null
  try {
    batch.value = await batchesApi.get(batchId)
  } catch (error) {
    batch.value = null
    errorDetail.value = getErrorDetail(error)
  } finally {
    loading.value = false
  }
}

async function onSaved() {
  drawerOpen.value = false
  await load()
}

function backToList() {
  void router.push('/inventory/batches')
}

onMounted(() => {
  void load()
})
</script>

<template>
  <main class="page">
    <PageHeader :title="title" description="批次主数据与按仓库聚合的批次库存">
      <template #actions>
        <NButton @click="backToList">
          <template #icon><ChevronLeft :size="16" /></template>
          返回列表
        </NButton>
        <NButton :disabled="!batch" @click="drawerOpen = true">
          <template #icon><Pencil :size="16" /></template>
          编辑批次
        </NButton>
        <NButton :loading="loading" @click="load">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="panel">
      <AsyncState
        :loading="loading"
        :error="errorDetail?.message ?? ''"
        :error-trace-id="errorDetail?.traceId ?? ''"
        @retry="load"
      >
        <dl v-if="batch" class="batch-facts">
          <div class="batch-fact">
            <dt>批号</dt>
            <dd>{{ batch.batch_no }}</dd>
          </div>
          <div class="batch-fact">
            <dt>SKU</dt>
            <dd>{{ referenceLabel(batch.sku, batch.sku_id) }}</dd>
          </div>
          <div class="batch-fact">
            <dt>状态</dt>
            <dd>
              <NTag
                :type="batch.status === 'active' ? 'success' : 'default'"
                size="small"
                :bordered="false"
              >
                {{ batchStatusLabel(batch.status) }}
              </NTag>
            </dd>
          </div>
          <div class="batch-fact">
            <dt>出库优先级</dt>
            <dd>{{ batch.dispatch_priority }}（数值越小越先出，10 为默认）</dd>
          </div>
          <div class="batch-fact">
            <dt>生产日期</dt>
            <dd>{{ formatDateOnly(batch.production_date) }}</dd>
          </div>
          <div class="batch-fact">
            <dt>有效期至</dt>
            <dd>{{ formatDateOnly(batch.expiration_date) }}</dd>
          </div>
          <div class="batch-fact">
            <dt>首次收货</dt>
            <dd>
              {{ batch.first_received_at ? formatDateTime(batch.first_received_at) : '未收货' }}
            </dd>
          </div>
          <div class="batch-fact">
            <dt>更新时间</dt>
            <dd>{{ formatDateTime(batch.updated_at) }}</dd>
          </div>
          <div class="batch-fact batch-fact--wide">
            <dt>备注</dt>
            <dd>{{ batch.remark || '-' }}</dd>
          </div>
        </dl>
      </AsyncState>
    </section>

    <section v-if="batch" class="panel">
      <div class="panel-head">
        <h2>库存分布（共 {{ batch.stocks.length }} 个仓库）</h2>
        <p>
          批次库存在库存层上按 batch_id
          聚合；停用批次不再参与自动分配，但已存在库存仍可显式指定扣减。
        </p>
      </div>
      <DataTable
        :columns="batchStockColumns"
        :rows="batch.stocks"
        empty-text="该批次暂无库存"
        export-file-name="批次库存分布"
      />
    </section>

    <EntityFormDrawer
      v-model:show="drawerOpen"
      :fields="batchEditFields"
      title="批次"
      mode="edit"
      :entity-id="batchId"
      :load="loadBatch"
      :update="updateBatch"
      @saved="onSaved"
    />
  </main>
</template>

<style scoped>
.batch-facts {
  display: grid;
  gap: 14px 24px;
  margin: 0;
  padding: 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
}

.batch-fact {
  min-width: 0;
}

.batch-fact--wide {
  grid-column: 1 / -1;
}

.batch-fact dt {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.batch-fact dd {
  margin: 2px 0 0;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.panel-head {
  padding: 14px 16px 10px;
}

.panel-head h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 650;
}

.panel-head p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}

@media (max-width: 640px) {
  .batch-facts {
    gap: 12px;
    padding: 14px 16px;
  }
}
</style>
