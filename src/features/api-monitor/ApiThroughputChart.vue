<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import VChart from 'vue-echarts'

import { formatBucketLabel } from '@/lib/stats'

import '@/lib/echarts-setup'

import type { StatsGranularity } from '@/types/api'

/**
 * 库存接口吞吐与失败率补充图。
 *
 * 口径来自审计日志（含 4xx/5xx），与主图的「成功操作次数」互补：
 * 主图看业务发生量，这张图看接口是否健康。
 */
const props = withDefaults(
  defineProps<{
    buckets: string[]
    total: number[]
    failureRate: number[]
    granularity: StatsGranularity
    loading?: boolean
  }>(),
  { loading: false },
)

/** 失败率转成 0-100 的百分数，让坐标轴可以用静态模板 `{value}%`，避免函数式 formatter 的类型擦边 */
const failurePercent = computed(() => props.failureRate.map((rate) => Math.round(rate * 1000) / 10))

const option = computed<EChartsOption>(() => ({
  animationDuration: 240,
  grid: { top: 44, left: 8, right: 8, bottom: 4, containLabel: true },
  tooltip: {
    trigger: 'axis',
    confine: true,
    axisPointer: { type: 'shadow' },
  },
  legend: {
    top: 0,
    left: 0,
    itemWidth: 12,
    itemHeight: 8,
    textStyle: { fontSize: 12, color: '#5f6b66' },
  },
  xAxis: {
    type: 'category',
    data: props.buckets.map((bucket) => formatBucketLabel(bucket, props.granularity)),
    axisLine: { lineStyle: { color: '#d9e0dc' } },
    axisTick: { show: false },
    axisLabel: { color: '#7a8794', fontSize: 11, hideOverlap: true },
  },
  yAxis: [
    {
      type: 'value',
      minInterval: 1,
      name: '调用次数',
      nameTextStyle: { color: '#7a8794', fontSize: 11 },
      axisLabel: { color: '#7a8794', fontSize: 11 },
      splitLine: { lineStyle: { color: '#eef2f0' } },
    },
    {
      type: 'value',
      min: 0,
      max: 100,
      name: '失败率',
      nameTextStyle: { color: '#7a8794', fontSize: 11 },
      axisLabel: { color: '#7a8794', fontSize: 11, formatter: '{value}%' },
      splitLine: { show: false },
    },
  ],
  series: [
    {
      name: '调用次数',
      type: 'bar',
      barMaxWidth: 18,
      itemStyle: { color: '#2080f0', borderRadius: [3, 3, 0, 0] },
      data: props.total,
    },
    {
      name: '失败率',
      type: 'line',
      yAxisIndex: 1,
      smooth: 0.15,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: props.buckets.length <= 48,
      lineStyle: { width: 2 },
      itemStyle: { color: '#d03050' },
      data: failurePercent.value,
    },
  ],
}))
</script>

<template>
  <div class="throughput-chart">
    <VChart
      class="throughput-chart__canvas"
      :option="option"
      :loading="loading"
      :update-options="{ notMerge: true }"
      autoresize
    />
  </div>
</template>

<style scoped>
.throughput-chart {
  position: relative;
  width: 100%;
  height: 240px;
}

.throughput-chart__canvas {
  width: 100%;
  height: 100%;
}

@media (max-width: 640px) {
  .throughput-chart {
    height: 220px;
  }
}
</style>
