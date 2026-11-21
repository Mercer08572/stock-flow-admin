<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
import { useBreakpoints } from '@vueuse/core'
import { NAlert, NButton, NDrawer, NDrawerContent, NTag } from 'naive-ui'
import { computed, h, ref, watch } from 'vue'

import { getErrorDetail, type ErrorDetail } from '@/api/error'
import { inventoryApi } from '@/api/inventory'
import AsyncState from '@/components/common/AsyncState.vue'
import { referenceCode, referenceName } from '@/components/common/reference-display'
import DataTable from '@/components/common/DataTable.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import {
  formatMovementActor,
  formatMovementSource,
  hasMoreMovements,
  mergeMovementRows,
  MOVEMENT_PAGE_SIZE,
  operationTypeLabel,
  operationTypeTagType,
} from '@/features/inventory/movement-list'
import { reservationQuantitySegments } from '@/features/inventory/reservation-quantity'
import {
  closeReasonLabel,
  formatReservationSource,
  reservationStatusLabel,
} from '@/features/inventory/reservation-list'

import type { InventoryMovement, Reservation, ReservationItem } from '@/types/api'

const props = defineProps<{
  show: boolean
  /** 为 null 时不发请求（抽屉只会在行点击后打开，正常不会出现） */
  reservationId: number | null
}>()

const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const detailLoading = ref(false)
const detailError = ref<ErrorDetail | null>(null)
const detail = ref<Reservation | null>(null)

/**
 * 数量分布：进度条分段与图例百分比来自同一份计算，
 * 避免出现「数字 20%、条宽 21%」这种用户没法自己核对的画面。
 */
const quantitySegments = computed(() =>
  detail.value ? reservationQuantitySegments(detail.value) : [],
)

const movementLog = ref<InventoryMovement[]>([])
const movementLogTotal = ref(0)
const movementLogLastBatchSize = ref(0)
const movementLogLoading = ref(false)
const movementLogLoadingMore = ref(false)
const movementLogError = ref<ErrorDetail | null>(null)
const movementLogMoreError = ref('')

const movementLogHasMore = computed(() =>
  hasMoreMovements(
    movementLog.value.length,
    movementLogTotal.value,
    movementLogLastBatchSize.value,
  ),
)

const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')

const itemColumns: DataTableColumn<ReservationItem>[] = [
  { key: 'stock_layer_id', title: '库存层 ID', width: 100, align: 'right' },
  {
    key: 'batch_id',
    title: '批次',
    width: 90,
    align: 'right',
    render: (row) => (row.batch_id === null ? '无批次' : String(row.batch_id)),
  },
  {
    key: 'received_at',
    title: '入库时间',
    width: 150,
    render: (row) => formatDateTime(row.received_at),
  },
  { key: 'reserved_qty', title: '分配数量', width: 100, align: 'right' },
  { key: 'released_qty', title: '已释放', width: 90, align: 'right' },
  { key: 'consumed_qty', title: '已消耗', width: 90, align: 'right' },
  { key: 'remaining_qty', title: '剩余', width: 90, align: 'right' },
]

/** 操作日志直接复用库存流水的展示语义（操作类型配色、来源/操作人回退规则） */
const movementColumns: DataTableColumn<InventoryMovement>[] = [
  { key: 'id', title: '流水号', width: 90, align: 'right' },
  {
    key: 'created_at',
    title: '发生时间',
    width: 170,
    render: (row) => formatDateTime(row.created_at),
    exportValue: (row) => formatDateTime(row.created_at, ''),
  },
  {
    key: 'operation_type',
    title: '操作类型',
    width: 110,
    render: (row) =>
      h(
        NTag,
        {
          type: operationTypeTagType(row.operation_type),
          size: 'small',
          bordered: false,
        },
        { default: () => operationTypeLabel(row.operation_type) },
      ),
    exportValue: (row) => operationTypeLabel(row.operation_type),
  },
  { key: 'qty', title: '数量', width: 90, align: 'right' },
  {
    key: 'stock_layer_id',
    title: '库存层',
    width: 90,
    align: 'right',
    render: (row) => (row.stock_layer_id === null ? '-' : String(row.stock_layer_id)),
  },
  {
    key: 'source_type',
    title: '来源',
    width: 180,
    render: (row) => formatMovementSource(row),
    exportValue: (row) => formatMovementSource(row),
  },
  {
    key: 'actor_label',
    title: '操作人',
    width: 110,
    render: (row) => formatMovementActor(row),
    exportValue: (row) => formatMovementActor(row),
  },
]

/**
 * 快速连续点击不同预留单时只接受最后一次请求的响应；
 * 关闭抽屉也会让在途请求失效，避免关闭后到达的响应把详情写回来。
 */
let fetchSequence = 0

async function fetchDetail(id: number) {
  const sequence = ++fetchSequence
  detailLoading.value = true
  detailError.value = null
  detail.value = null
  try {
    const result = await inventoryApi.getReservation(id)
    if (sequence !== fetchSequence) return
    detail.value = result
  } catch (error) {
    if (sequence !== fetchSequence) return
    detailError.value = getErrorDetail(error)
  } finally {
    if (sequence === fetchSequence) detailLoading.value = false
  }
}

function retryDetail() {
  if (props.reservationId !== null) void fetchDetail(props.reservationId)
}

/** 与详情各自独立编号：日志请求失败或关闭抽屉都不能影响详情响应 */
let movementLogSequence = 0

async function fetchMovementLog(id: number) {
  const sequence = ++movementLogSequence
  movementLogLoading.value = true
  movementLogLoadingMore.value = false
  movementLogError.value = null
  movementLogMoreError.value = ''
  movementLog.value = []
  movementLogTotal.value = 0
  movementLogLastBatchSize.value = 0
  try {
    const result = await inventoryApi.listMovements({
      reservation_id: id,
      limit: MOVEMENT_PAGE_SIZE,
      offset: 0,
    })
    if (sequence !== movementLogSequence) return
    const items = result.items ?? []
    movementLog.value = items
    movementLogTotal.value = result.total
    movementLogLastBatchSize.value = items.length
  } catch (error) {
    if (sequence !== movementLogSequence) return
    movementLogError.value = getErrorDetail(error)
  } finally {
    if (sequence === movementLogSequence) movementLogLoading.value = false
  }
}

async function loadMoreMovementLog() {
  if (
    props.reservationId === null ||
    movementLogLoading.value ||
    movementLogLoadingMore.value ||
    !movementLogHasMore.value
  ) {
    return
  }
  const sequence = movementLogSequence
  movementLogLoadingMore.value = true
  movementLogMoreError.value = ''
  try {
    const result = await inventoryApi.listMovements({
      reservation_id: props.reservationId,
      limit: MOVEMENT_PAGE_SIZE,
      offset: movementLog.value.length,
    })
    if (sequence !== movementLogSequence) return
    const items = result.items ?? []
    movementLog.value = mergeMovementRows(movementLog.value, items)
    movementLogTotal.value = result.total
    movementLogLastBatchSize.value = items.length
  } catch (error) {
    if (sequence !== movementLogSequence) return
    movementLogMoreError.value = `加载更多失败：${getErrorDetail(error).message}`
  } finally {
    if (sequence === movementLogSequence) movementLogLoadingMore.value = false
  }
}

function retryMovementLog() {
  if (props.reservationId !== null) void fetchMovementLog(props.reservationId)
}

/** 顶部刷新：详情、分配明细、操作日志一起重拉 */
function refreshAll() {
  if (props.reservationId === null) return
  void fetchDetail(props.reservationId)
  void fetchMovementLog(props.reservationId)
}

watch(
  () => [props.show, props.reservationId] as const,
  ([show, id]) => {
    if (!show) {
      fetchSequence += 1
      movementLogSequence += 1
      detailLoading.value = false
      movementLogLoading.value = false
      movementLogLoadingMore.value = false
      return
    }
    if (id !== null) {
      void fetchDetail(id)
      void fetchMovementLog(id)
    }
  },
)
</script>

<template>
  <NDrawer v-model:show="visible" :width="isMobile ? '100%' : 760" placement="right">
    <NDrawerContent closable>
      <template #header>
        <div class="drawer-header">
          <span>{{ detail ? `预留单 #${detail.id}` : '库存预留详情' }}</span>
          <NButton size="small" :loading="detailLoading || movementLogLoading" @click="refreshAll">
            <template #icon><RefreshCw :size="14" /></template>
            刷新
          </NButton>
        </div>
      </template>
      <!--
        数量分布：总量单独放大，下钻的分段条与图例同序同色。
        进度条本身只承载比例（aria-hidden），数值全部由图例文本提供，
        因此释放量为 0 时该段宽度为 0，但「已释放 0 · 0%」仍会照常显示。
      -->
      <section v-if="detail" class="qty-overview" aria-label="预留数量分布">
        <p class="qty-overview__caption">预留总量</p>
        <p class="qty-overview__total" data-testid="qty-total">{{ detail.total_qty }}</p>
        <div class="qty-overview__bar" aria-hidden="true">
          <span
            v-for="segment in quantitySegments"
            :key="segment.key"
            class="qty-overview__segment"
            :class="`qty-overview__segment--${segment.key}`"
            :style="{ flexGrow: segment.share }"
          />
        </div>
        <ul class="qty-overview__legend">
          <li
            v-for="segment in quantitySegments"
            :key="segment.key"
            class="qty-overview__item"
            :data-testid="`qty-segment-${segment.key}`"
          >
            <span class="qty-overview__dot" :class="`qty-overview__dot--${segment.key}`" />
            <!--
              标签、数值、百分比放在同一段文本里：视觉间距由文本空格表达，
              读屏软件读到的也是「已消耗 1 · 20%」，而不是被元素边界粘成「已消耗120%」。
              数值单独放大加粗，仍与进度条同色同序。
            -->
            <span class="qty-overview__item-text">
              {{ segment.label }}
              <span class="qty-overview__item-value">{{ segment.qty }}</span>
              · {{ segment.percentLabel }}
            </span>
          </li>
        </ul>
      </section>

      <dl v-if="detail" class="summary">
        <div>
          <dt>仓库</dt>
          <dd>
            {{ referenceCode(detail.warehouse, detail.warehouse_id) }} /
            {{ referenceName(detail.warehouse, detail.warehouse_id) }}
          </dd>
        </div>
        <div>
          <dt>SKU</dt>
          <dd>
            {{ referenceCode(detail.sku, detail.sku_id) }} /
            {{ referenceName(detail.sku, detail.sku_id) }}
          </dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>
            <NTag
              :type="detail.status === 'active' ? 'warning' : 'default'"
              size="small"
              :bordered="false"
            >
              {{ reservationStatusLabel(detail.status) }}
            </NTag>
          </dd>
        </div>
        <div>
          <dt>关闭原因</dt>
          <dd>{{ closeReasonLabel(detail.close_reason) }}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{{ formatReservationSource(detail) }}</dd>
        </div>
        <div>
          <dt>操作人</dt>
          <dd>{{ detail.actor_label || '-' }}</dd>
        </div>
        <div class="summary__wide">
          <dt>幂等键</dt>
          <dd class="summary__key">{{ detail.idempotency_key || '-' }}</dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{{ formatDateTime(detail.created_at) }}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd>{{ formatDateTime(detail.updated_at) }}</dd>
        </div>
      </dl>

      <h3 class="detail-heading">分配明细</h3>
      <AsyncState
        :loading="detailLoading"
        :error="detailError?.message ?? ''"
        :error-trace-id="detailError?.traceId ?? ''"
        :empty="!detailLoading && !detailError && (detail?.items?.length ?? 0) === 0"
        empty-text="该预留单暂无分配明细"
        @retry="retryDetail"
      >
        <DataTable
          :columns="itemColumns"
          :rows="detail?.items ?? []"
          empty-text="该预留单暂无分配明细"
          export-file-name="库存预留明细"
        />
      </AsyncState>

      <h3 class="detail-heading detail-heading--log">操作日志</h3>
      <AsyncState
        :loading="movementLogLoading"
        :error="movementLogError?.message ?? ''"
        :error-trace-id="movementLogError?.traceId ?? ''"
        :empty="!movementLogLoading && !movementLogError && movementLog.length === 0"
        empty-text="该预留单暂无操作记录"
        @retry="retryMovementLog"
      >
        <DataTable
          :columns="movementColumns"
          :rows="movementLog"
          empty-text="该预留单暂无操作记录"
          export-file-name="库存预留操作日志"
        />
        <div v-if="movementLogHasMore || movementLogMoreError" class="log-more">
          <span class="log-more__hint">
            已加载 {{ movementLog.length }} / 共 {{ movementLogTotal }} 条
          </span>
          <NAlert
            v-if="movementLogMoreError"
            type="error"
            :show-icon="true"
            :bordered="false"
            class="log-more__error"
          >
            {{ movementLogMoreError }}
          </NAlert>
          <NButton size="small" :loading="movementLogLoadingMore" @click="loadMoreMovementLog">
            {{ movementLogMoreError ? '重试加载' : '加载更多' }}
          </NButton>
        </div>
      </AsyncState>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-right: 6px;
}

/*
 * 数量分布用色：灰 = 已消耗（已完结），蓝 = 已释放（Info 语义），
 * 橙 = 剩余（与「预留中」的 Warning 标签同色）。
 * 目前只有这一处使用，先作为组件内局部令牌；等第二处复用同一条分布条时再上提到
 * `styles/main.css` 的全局令牌里，避免为单一消费方提前扩大全局调色板。
 */
.qty-overview {
  --qty-consumed: #9aa3a0;
  --qty-released: #2080f0;
  --qty-remaining: #f0a020;
  padding: 14px 16px 16px;
  margin: 0 0 20px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.qty-overview__caption {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.qty-overview__total {
  overflow-wrap: anywhere;
  margin: 2px 0 10px;
  color: var(--color-text);
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.qty-overview__bar {
  display: flex;
  overflow: hidden;
  height: 12px;
  border-radius: 999px;
  background: #eef1f0;
}

/* 宽度完全由 `flexGrow` 的比例决定：段间不留缝，比例才和数字一致 */
.qty-overview__segment {
  flex: 0 0 0;
  height: 100%;
}

.qty-overview__segment--consumed {
  background: var(--qty-consumed);
}

.qty-overview__segment--released {
  background: var(--qty-released);
}

.qty-overview__segment--remaining {
  background: var(--qty-remaining);
}

.qty-overview__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

/* 窄屏按 140px 最小宽自动折行，320px 时每行一项，不需要横向滚动 */
.qty-overview__item {
  display: flex;
  flex: 1 1 140px;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.qty-overview__dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.qty-overview__dot--consumed {
  background: var(--qty-consumed);
}

.qty-overview__dot--released {
  background: var(--qty-released);
}

.qty-overview__dot--remaining {
  background: var(--qty-remaining);
}

.qty-overview__item-text {
  min-width: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.qty-overview__item-value {
  color: var(--color-text);
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
  margin: 0 0 20px;
}

.summary > div {
  min-width: 0;
}

.summary dt {
  color: var(--color-text-muted);
  font-size: 12px;
}

.summary dd {
  margin: 3px 0 0;
  color: var(--color-text);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.summary__wide {
  grid-column: 1 / -1;
}

.summary__key {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.detail-heading {
  margin: 0 0 10px;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 650;
}

.detail-heading--log {
  margin-top: 24px;
}

.log-more {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}

.log-more__hint {
  color: var(--color-text-muted);
  font-size: 12px;
}

.log-more__error {
  padding: 0;
}

@media (max-width: 680px) {
  .qty-overview {
    padding: 12px 14px 14px;
  }

  .summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .log-more {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
