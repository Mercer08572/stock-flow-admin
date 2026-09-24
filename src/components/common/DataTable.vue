<script setup lang="ts" generic="T">
/* global Blob, URL, document */
import { Download, RotateCcw, SlidersHorizontal } from '@lucide/vue'
import { useBreakpoints } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NDataTable,
  NEmpty,
  NPopover,
  type DataTableBaseColumn,
  type DataTableColumns,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { formatCellText, readPath, type DataTableColumn } from './data-table'

const props = withDefaults(
  defineProps<{
    /** 项目自有的列描述，见 ./data-table.ts */
    columns: DataTableColumn<T>[]
    rows: T[]
    loading?: boolean
    /** 有值时用错误提示替代表格，并提供重试入口 */
    error?: string
    emptyText?: string
    exportFileName?: string
  }>(),
  {
    loading: false,
    error: '',
    emptyText: '暂无数据',
    exportFileName: 'export',
  },
)

const emit = defineEmits<{ retry: [] }>()

const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')
const maxHeight = computed(() =>
  isMobile.value
    ? 'max(320px, min(520px, calc(100vh - 240px)))'
    : 'max(380px, min(620px, calc(100vh - 280px)))',
)

const visibleKeys = ref<string[]>([])
watch(
  () => props.columns,
  (columns) => {
    visibleKeys.value = columns.map((column) => column.key)
  },
  { immediate: true },
)

const visibleColumns = computed(() =>
  props.columns.filter((column) => visibleKeys.value.includes(column.key)),
)

// 列宽之和作为横向滚动宽度：容器更窄时横向滚动，更宽时仍铺满容器
const scrollX = computed(() => {
  const total = visibleColumns.value.reduce((sum, column) => sum + (column.width ?? 0), 0)
  return total > 0 ? total : undefined
})

function updateVisibleKeys(keys: Array<string | number>) {
  // 至少保留一列，避免把表格整体隐藏掉
  if (keys.length === 0) return
  visibleKeys.value = keys.map(String)
}

function compareValues(left: unknown, right: unknown): number {
  const leftEmpty = left === null || left === undefined || left === ''
  const rightEmpty = right === null || right === undefined || right === ''
  if (leftEmpty || rightEmpty) return leftEmpty && rightEmpty ? 0 : leftEmpty ? -1 : 1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), 'zh-CN')
}

const tableColumns = computed<DataTableColumns<T>>(() =>
  visibleColumns.value.map((column) => {
    const render = column.render
    const naiveColumn: DataTableBaseColumn<T> = {
      key: column.key,
      title: column.title,
      resizable: true,
      ellipsis: { tooltip: true },
      render: (row) => (render ? render(row) : formatCellText(readPath(row, column.key))),
    }
    if (column.width !== undefined) {
      naiveColumn.width = column.width
      // 未显式声明 minWidth 时，用布局宽度作为可拖拽缩小的下限
      naiveColumn.minWidth = column.minWidth ?? column.width
    } else if (column.minWidth !== undefined) {
      naiveColumn.minWidth = column.minWidth
    }
    if (column.align !== undefined) naiveColumn.align = column.align
    if (column.fixed !== undefined) naiveColumn.fixed = column.fixed
    if (column.sortable !== false) {
      naiveColumn.sorter = (rowA, rowB) =>
        compareValues(readPath(rowA, column.key), readPath(rowB, column.key))
    }
    if (column.filterOptions !== undefined && column.filterOptions.length > 0) {
      naiveColumn.filterOptions = column.filterOptions
      naiveColumn.filter = (optionValue, row) =>
        String(readPath(row, column.key)) === String(optionValue)
    }
    return naiveColumn
  }),
)

const tableThemeOverrides = {
  thColor: '#f7f9f8',
  thTextColor: '#17201d',
  thFontWeight: '600',
  tdColorHover: '#f2f8f6',
  fontSizeSmall: '13px',
  common: {
    borderColor: '#dfe5e2',
  },
}

function quoteCsv(text: string): string {
  return `"${text.replace(/"/g, '""')}"`
}

function exportCsv() {
  const exportColumns = visibleColumns.value.filter((column) => column.exportable !== false)
  if (props.rows.length === 0 || exportColumns.length === 0) return

  const lines = [
    exportColumns.map((column) => quoteCsv(column.title)).join(','),
    ...props.rows.map((row) =>
      exportColumns
        .map((column) =>
          quoteCsv(
            column.exportValue
              ? column.exportValue(row)
              : formatCellText(readPath(row, column.key), ''),
          ),
        )
        .join(','),
    ),
  ]

  // 前置 BOM，保证 Excel 以 UTF-8 打开中文表头
  const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = props.exportFileName.endsWith('.csv')
    ? props.exportFileName
    : `${props.exportFileName}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="data-table">
    <NAlert v-if="error" type="error" :show-icon="true" class="data-table__error">
      <div class="data-table__error-body">
        <span>{{ error }}</span>
        <NButton size="tiny" @click="emit('retry')">
          <template #icon><RotateCcw :size="14" /></template>
          重试
        </NButton>
      </div>
    </NAlert>

    <template v-else>
      <div class="data-table__toolbar">
        <NPopover
          v-if="columns.length > 1"
          trigger="click"
          placement="bottom-end"
          :show-arrow="false"
        >
          <template #trigger>
            <NButton size="small" quaternary>
              <template #icon><SlidersHorizontal :size="15" /></template>
              列设置
            </NButton>
          </template>
          <NCheckboxGroup
            class="data-table__column-picker"
            :value="visibleKeys"
            @update:value="updateVisibleKeys"
          >
            <NCheckbox
              v-for="column in columns"
              :key="column.key"
              :value="column.key"
              :label="column.title"
            />
          </NCheckboxGroup>
        </NPopover>

        <NButton size="small" quaternary :disabled="rows.length === 0" @click="exportCsv">
          <template #icon><Download :size="15" /></template>
          导出 CSV
        </NButton>
      </div>

      <NDataTable
        size="small"
        :bordered="false"
        :columns="tableColumns"
        :data="rows"
        :loading="loading"
        :max-height="maxHeight"
        :scroll-x="scrollX"
        :theme-overrides="tableThemeOverrides"
      >
        <template #empty>
          <NEmpty size="small" :description="emptyText" />
        </template>
      </NDataTable>
    </template>
  </div>
</template>

<style scoped>
.data-table__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.data-table__column-picker {
  display: flex;
  max-height: 300px;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.data-table__error {
  margin: 16px;
}

.data-table__error-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
