<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import VChart from 'vue-echarts'

import { formatBucketLabel } from '@/lib/stats'

import '@/lib/echarts-setup'
import { OPERATION_META, OPERATION_ORDER } from './stats-format'

import type { MovementStatsSeries, StatsGranularity } from '@/types/api'

/**
 * 库存操作趋势折线图。
 *
 * 数据由后端按时间桶补零后给出，因此这里不再做"缺项补 0"，
 * 直接把 `calls` 数组按顺序喂给 ECharts 即可。
 */
const props = withDefaults(
  defineProps<{
    buckets: string[]
    series: MovementStatsSeries[]
    granularity: StatsGranularity
    loading?: boolean
  }>(),
  { loading: false },
)

const orderedSeries = computed(() => {
  const byType = new Map(props.series.map((item) => [item.operation_type, item]))
  return OPERATION_ORDER.map((operationType) => {
    const meta = OPERATION_META[operationType]
    return {
      name: meta.label,
      type: 'line' as const,
      smooth: 0.15,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: props.buckets.length <= 48,
      lineStyle: { width: 2 },
      itemStyle: { color: meta.color },
      emphasis: { focus: 'series' as const },
      data: byType.get(operationType)?.calls ?? [],
    }
  })
})

const option = computed<EChartsOption>(() => ({
  color: OPERATION_ORDER.map((operationType) => OPERATION_META[operationType].color),
  animationDuration: 240,
  grid: { top: 44, left: 8, right: 16, bottom: 4, containLabel: true },
  tooltip: {
    trigger: 'axis',
    confine: true,
    axisPointer: { type: 'line' },
  },
  legend: {
    top: 0,
    left: 0,
    type: 'scroll',
    itemWidth: 12,
    itemHeight: 8,
    textStyle: { fontSize: 12, color: '#5f6b66' },
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: props.buckets.map((bucket) => formatBucketLabel(bucket, props.granularity)),
    axisLine: { lineStyle: { color: '#d9e0dc' } },
    axisTick: { show: false },
    axisLabel: {
      color: '#7a8794',
      fontSize: 11,
      hideOverlap: true,
    },
  },
  yAxis: {
    type: 'value',
    minInterval: 1,
    axisLabel: { color: '#7a8794', fontSize: 11 },
    splitLine: { lineStyle: { color: '#eef2f0' } },
  },
  series: orderedSeries.value,
}))
</script>

<template>
  <div class="trend-chart">
    <VChart
      class="trend-chart__canvas"
      :option="option"
      :loading="loading"
      :update-options="{ notMerge: true }"
      autoresize
    />
  </div>
</template>

<style scoped>
.trend-chart {
  position: relative;
  width: 100%;
  height: 320px;
}

.trend-chart__canvas {
  width: 100%;
  height: 100%;
}

@media (max-width: 640px) {
  .trend-chart {
    height: 260px;
  }
}
</style>
