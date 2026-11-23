/**
 * 库存批次的列表列、表单字段、库存分布列与查询参数。
 *
 * 与 `batchesApi` 的绑定只出现在这里；页面只认识这份配置。
 * 批次是 SKU 级主数据：没有数量字段，批次库存在详情里按仓库聚合展示。
 */

import { h } from 'vue'
import { NTag } from 'naive-ui'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import { referenceLabel } from '@/components/common/reference-display'

import type { FieldConfig, FieldOption } from '@/features/master-data/lib/entity-form'
import type { BatchStatus, BatchWarehouseStock, InventoryBatch } from '@/types/api'

/** 后端 `MaxListLimit`：页大小不能超过它 */
export const BATCH_PAGE_SIZE = 100

export interface BatchFilters {
  skuId: number | null
  status: BatchStatus | null
  keyword: string
}

export interface BatchQuery {
  sku_id?: number
  status?: BatchStatus
  q?: string
  limit: number
  offset: number
}

/** 空条件不发送该参数；`q` 只按批号模糊匹配 */
export function buildBatchQuery(
  filters: BatchFilters,
  offset: number,
  limit: number = BATCH_PAGE_SIZE,
): BatchQuery {
  const keyword = filters.keyword.trim()
  return {
    ...(filters.skuId === null ? {} : { sku_id: filters.skuId }),
    ...(filters.status === null ? {} : { status: filters.status }),
    ...(keyword === '' ? {} : { q: keyword }),
    limit,
    offset: Math.max(0, offset),
  }
}

/** 批次状态的文案与主数据不同：这里是启用/停用，不是正常/停用 */
export const batchStatusOptions: readonly FieldOption[] = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
]

/** 列表列头筛选与表单使用同一组枚举值（启用/停用，而不是主数据的正常/停用） */
export const batchStatusFilterOptions = batchStatusOptions

export const batchColumns: readonly DataTableColumn<InventoryBatch>[] = [
  { key: 'batch_no', title: '批号', width: 150 },
  {
    key: 'sku.code',
    title: 'SKU',
    width: 200,
    render: (row) => referenceLabel(row.sku, row.sku_id),
  },
  {
    key: 'production_date',
    title: '生产日期',
    width: 110,
    render: (row) => formatDateOnly(row.production_date),
  },
  {
    key: 'expiration_date',
    title: '有效期至',
    width: 110,
    render: (row) => formatDateOnly(row.expiration_date),
  },
  {
    key: 'dispatch_priority',
    title: '出库优先级',
    width: 110,
    align: 'right',
    render: (row) => String(row.dispatch_priority),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    filterOptions: batchStatusFilterOptions,
    render: (row) =>
      h(
        NTag,
        {
          type: row.status === 'active' ? 'success' : 'default',
          size: 'small',
          bordered: false,
        },
        { default: () => batchStatusLabel(row.status) },
      ),
  },
  {
    key: 'first_received_at',
    title: '首次收货',
    width: 160,
    render: (row) => (row.first_received_at ? formatDateTime(row.first_received_at) : '未收货'),
  },
  // 更新时间只在详情页展示：列表已够宽，再放一列会让桌面端也出现横向滚动
]

/** 新增批次：SKU 必填；状态默认 active，因此不在新增表单里出现 */
export const batchCreateFields: readonly FieldConfig[] = [
  {
    key: 'sku_id',
    label: 'SKU',
    type: 'select',
    required: true,
    optionsSource: 'skus',
    referenceField: 'sku',
    placeholder: '请选择 SKU',
  },
  { key: 'batch_no', label: '批号', type: 'text', required: true, placeholder: '请输入批号' },
  { key: 'production_date', label: '生产日期', type: 'date', placeholder: '可选，YYYY-MM-DD' },
  { key: 'expiration_date', label: '有效期至', type: 'date', placeholder: '可选，YYYY-MM-DD' },
  {
    key: 'dispatch_priority',
    label: '出库优先级',
    type: 'number',
    min: 0,
    placeholder: '留空为 10（越小越先出）',
  },
  { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
]

/**
 * 编辑批次：SKU 与批号是业务标识，锁定后仍随表单提交（后端忽略这两个字段），
 * 这样 `PUT` 的全量替换语义不会因为漏字段而被写成零值。
 */
export const batchEditFields: readonly FieldConfig[] = [
  ...batchCreateFields.map((field) => {
    if (field.key === 'sku_id' || field.key === 'batch_no') {
      return { ...field, disabled: true }
    }
    return field
  }),
  {
    key: 'status',
    label: '状态',
    type: 'select',
    required: true,
    options: [...batchStatusOptions],
  },
]

/** 详情页的库存分布列：数量一律字符串，不做浮点运算 */
export const batchStockColumns: readonly DataTableColumn<BatchWarehouseStock>[] = [
  {
    key: 'warehouse.code',
    title: '仓库',
    width: 220,
    render: (row) => referenceLabel(row.warehouse, row.warehouse_id),
  },
  { key: 'on_hand_qty', title: '在库数量', width: 120, align: 'right' },
  { key: 'reserved_qty', title: '预留数量', width: 120, align: 'right' },
  { key: 'available_qty', title: '可用数量', width: 120, align: 'right' },
  { key: 'layer_count', title: '库存层数', width: 100, align: 'right' },
]

/**
 * 日历日只取 `YYYY-MM-DD` 部分。
 *
 * 不能用 `formatDateTime`：`new Date('2026-05-01')` 按 UTC 解析，
 * 在东八区会显示成 05-01 08:00，看起来像差了一天。
 */
export function formatDateOnly(value: string | null | undefined, fallback = '-'): string {
  if (typeof value !== 'string' || value === '') return fallback
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value
}

/** 状态文案（详情页标题区用） */
export function batchStatusLabel(status: BatchStatus): string {
  return status === 'active' ? '启用' : '停用'
}
