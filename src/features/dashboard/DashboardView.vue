<script setup lang="ts">
import { Boxes, PackageSearch, RefreshCw, Ruler, Tags, Warehouse } from '@lucide/vue'
import { NButton, NRadioButton, NRadioGroup } from 'naive-ui'
import { computed, onMounted, ref, type Component } from 'vue'

import { getErrorDetail, type ErrorDetail } from '@/api/error'
import { healthApi } from '@/api/health'
import AsyncState from '@/components/common/AsyncState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import MovementTrendChart from '@/features/dashboard/MovementTrendChart.vue'
import { useMovementStats } from '@/features/dashboard/useMovementStats'
import { STATS_RANGES } from '@/lib/stats'

import type { HealthStatus } from '@/types/api'

interface QuickLink {
  label: string
  to: string
  icon: Component
  tone: 'green' | 'blue' | 'amber'
}

const quickLinks: QuickLink[] = [
  { label: '库存余额', to: '/inventory/stocks', icon: PackageSearch, tone: 'green' },
  { label: '物料', to: '/master-data/materials', icon: Boxes, tone: 'blue' },
  { label: 'SKU', to: '/master-data/skus', icon: Tags, tone: 'amber' },
  { label: '仓库', to: '/master-data/warehouses', icon: Warehouse, tone: 'green' },
  { label: '物料分类', to: '/master-data/categories', icon: Boxes, tone: 'blue' },
  { label: '计量单位', to: '/master-data/units', icon: Ruler, tone: 'amber' },
]

const health = ref<HealthStatus | null>(null)
const errorDetail = ref<ErrorDetail | null>(null)
const checkingHealth = ref(false)

async function checkHealth() {
  checkingHealth.value = true
  errorDetail.value = null
  try {
    health.value = await healthApi.get()
  } catch (error) {
    health.value = null
    errorDetail.value = getErrorDetail(error)
  } finally {
    checkingHealth.value = false
  }
}

onMounted(checkHealth)

const {
  range,
  data: movementStats,
  error: movementError,
  loading: movementsLoading,
  refreshing: movementsRefreshing,
  lastUpdatedAt,
  refresh: refreshStats,
  reload: reloadMovements,
} = useMovementStats()

/** 所有序列合计为 0 时展示空态，而不是一张贴着 0 轴的折线 */
const movementTotalCalls = computed(
  () =>
    movementStats.value?.series.reduce(
      (sum, series) => sum + series.calls.reduce((seriesSum, calls) => seriesSum + calls, 0),
      0,
    ) ?? 0,
)

const updatedAtText = computed(() => {
  if (!lastUpdatedAt.value) return ''
  return new Date(lastUpdatedAt.value).toLocaleTimeString('zh-CN', { hour12: false })
})
</script>

<template>
  <main class="page dashboard">
    <PageHeader title="工作台" description="Stock Flow 管理入口">
      <template #actions>
        <NButton :loading="checkingHealth" @click="checkHealth">
          <template #icon><RefreshCw :size="16" /></template>
          检查服务
        </NButton>
      </template>
    </PageHeader>

    <AsyncState
      :loading="checkingHealth"
      :error="errorDetail?.message ?? ''"
      :error-trace-id="errorDetail?.traceId ?? ''"
      @retry="checkHealth"
    >
      <section class="service-strip">
        <span class="service-strip__dot" />
        <div>
          <strong>API 服务正常</strong>
          <p>{{ health?.service || 'stock-flow' }}</p>
        </div>
        <span v-if="health" class="service-strip__status">{{ health.status }}</span>
      </section>
    </AsyncState>

    <section class="stats-section" aria-labelledby="stats-heading">
      <div class="stats-header">
        <div class="stats-header__title">
          <h2 id="stats-heading" class="section-title">库存操作趋势</h2>
          <p class="stats-header__hint">成功操作次数，按幂等键去重；每 30 秒自动刷新</p>
        </div>
        <div class="stats-header__controls">
          <NRadioGroup v-model:value="range" size="small" aria-label="统计时间范围">
            <NRadioButton v-for="item in STATS_RANGES" :key="item.key" :value="item.key">
              {{ item.label }}
            </NRadioButton>
          </NRadioGroup>
          <NButton size="small" :loading="movementsRefreshing" @click="refreshStats">
            <template #icon><RefreshCw :size="14" /></template>
            刷新
          </NButton>
        </div>
      </div>

      <article class="stats-card">
        <header class="stats-card__head">
          <h3 class="stats-card__title">增 / 减 / 占用 / 占用扣减 / 占用释放</h3>
          <span v-if="updatedAtText" class="stats-card__meta">更新于 {{ updatedAtText }}</span>
        </header>
        <AsyncState
          :loading="movementsLoading"
          :error="movementError?.message ?? ''"
          :error-trace-id="movementError?.traceId ?? ''"
          :empty="
            !movementsLoading &&
            !movementError &&
            movementStats !== null &&
            movementTotalCalls === 0
          "
          empty-text="该时段没有库存操作"
          @retry="reloadMovements"
        >
          <MovementTrendChart
            v-if="movementStats"
            :buckets="movementStats.buckets"
            :series="movementStats.series"
            :granularity="movementStats.granularity"
            :loading="movementsLoading"
          />
        </AsyncState>
      </article>
    </section>

    <section aria-labelledby="quick-entry-heading">
      <h2 id="quick-entry-heading" class="section-title">快捷入口</h2>
      <div class="quick-grid">
        <RouterLink v-for="item in quickLinks" :key="item.to" :to="item.to" class="quick-link">
          <span class="quick-link__icon" :class="`quick-link__icon--${item.tone}`">
            <component :is="item.icon" :size="20" />
          </span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.dashboard {
  max-width: 1180px;
}

.service-strip {
  display: flex;
  min-height: 76px;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid #cfe5de;
  border-radius: 8px;
  background: #f0f8f5;
}

.service-strip__dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #25a57f;
  box-shadow: 0 0 0 5px rgba(37, 165, 127, 0.13);
}

.service-strip div {
  min-width: 0;
  flex: 1;
}

.service-strip strong {
  display: block;
  font-size: 14px;
}

.service-strip p {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-strip__status {
  color: #1d775f;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.section-title {
  margin: 6px 0 12px;
  font-size: 14px;
  font-weight: 650;
}

.stats-section {
  margin-top: 8px;
}

.stats-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.stats-header__title .section-title {
  margin-bottom: 4px;
}

.stats-header__hint {
  margin: 0 0 12px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.stats-header__controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.stats-card {
  padding: 14px 16px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fff;
}

.stats-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.stats-card__title {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
}

.stats-card__meta {
  color: var(--color-text-muted);
  font-size: 12px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.quick-link {
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 13px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: #fff;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.quick-link:hover {
  border-color: #aabbb5;
  box-shadow: 0 3px 10px rgba(30, 48, 42, 0.06);
}

.quick-link__icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
}

.quick-link__icon--green {
  color: #147d64;
  background: #e6f3ef;
}

.quick-link__icon--blue {
  color: #286f9d;
  background: #e7f1f7;
}

.quick-link__icon--amber {
  color: #9a6b10;
  background: #f8f0dd;
}

@media (max-width: 800px) {
  .quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .quick-grid {
    grid-template-columns: 1fr;
  }

  .stats-header__controls {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
