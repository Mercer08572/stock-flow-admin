<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
import { NButton, NRadioButton, NRadioGroup } from 'naive-ui'
import { computed } from 'vue'

import AsyncState from '@/components/common/AsyncState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ApiThroughputChart from '@/features/api-monitor/ApiThroughputChart.vue'
import { useApiThroughput } from '@/features/api-monitor/useApiThroughput'
import { STATS_RANGES } from '@/lib/stats'

const { range, data, error, loading, refreshing, lastUpdatedAt, refresh, reload } =
  useApiThroughput()

/** 所有时间桶的调用量合计：为 0 时展示空态，而不是一张贴着 0 轴的图 */
const totalCalls = computed(() => data.value?.total.reduce((sum, calls) => sum + calls, 0) ?? 0)

const updatedAtText = computed(() => {
  if (!lastUpdatedAt.value) return ''
  return new Date(lastUpdatedAt.value).toLocaleTimeString('zh-CN', { hour12: false })
})
</script>

<template>
  <main class="page api-monitor">
    <PageHeader title="API 监控" />

    <div class="monitor-toolbar">
      <NRadioGroup v-model:value="range" size="small" aria-label="统计时间范围">
        <NRadioButton v-for="item in STATS_RANGES" :key="item.key" :value="item.key">
          {{ item.label }}
        </NRadioButton>
      </NRadioGroup>
      <NButton size="small" :loading="refreshing" @click="refresh">
        <template #icon><RefreshCw :size="14" /></template>
        刷新
      </NButton>
    </div>

    <section class="monitor-charts" aria-label="API 监控图表">
      <article class="monitor-card">
        <header class="monitor-card__head">
          <h2 class="monitor-card__title">库存接口调用量与失败率趋势</h2>
          <span v-if="updatedAtText" class="monitor-card__meta">更新于 {{ updatedAtText }}</span>
        </header>
        <AsyncState
          :loading="loading"
          :error="error?.message ?? ''"
          :error-trace-id="error?.traceId ?? ''"
          :empty="!loading && !error && data !== null && totalCalls === 0"
          empty-text="该时段没有库存接口调用"
          @retry="reload"
        >
          <ApiThroughputChart
            v-if="data"
            :buckets="data.buckets"
            :total="data.total"
            :failure-rate="data.failure_rate"
            :granularity="data.granularity"
            :loading="loading"
          />
        </AsyncState>
      </article>
    </section>
  </main>
</template>

<style scoped>
.api-monitor {
  max-width: 1180px;
}

.monitor-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.monitor-charts {
  display: grid;
  gap: 12px;
}

.monitor-card {
  padding: 14px 16px 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fff;
}

.monitor-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.monitor-card__title {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
}

.monitor-card__meta {
  color: var(--color-text-muted);
  font-size: 12px;
}

@media (max-width: 480px) {
  .monitor-toolbar {
    justify-content: flex-start;
  }
}
</style>
