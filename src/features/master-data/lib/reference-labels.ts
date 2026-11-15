/**
 * 主数据枚举的共享选项。
 *
 * 列表与详情的引用列直接渲染后端内联的引用快照（见 `components/common/reference-display`），
 * 这里只保留与后端枚举一一对应的静态选项；下拉候选的加载在 `reference-cache.ts`。
 */

import type { FieldOption } from '@/features/master-data/lib/entity-form'

/** 启用 / 停用，5 个资源的 `status` 字段共用 */
export const statusOptions: readonly FieldOption[] = [
  { label: '正常', value: 'active' },
  { label: '停用', value: 'inactive' },
]

/** 状态列的筛选选项（`FieldOption` 与 `DataTableFilterOption` 同形，都是 label + value） */
export const statusFilterOptions: readonly FieldOption[] = statusOptions

/** 计量单位类型 */
export const unitTypeOptions: readonly FieldOption[] = [
  { label: '计数', value: 'count' },
  { label: '重量', value: 'weight' },
  { label: '长度', value: 'length' },
  { label: '面积', value: 'area' },
  { label: '体积', value: 'volume' },
  { label: '包装', value: 'package' },
  { label: '时间', value: 'time' },
  { label: '其他', value: 'other' },
]

/** 仓库类型 */
export const warehouseTypeOptions: readonly FieldOption[] = [
  { label: '普通仓', value: 'normal' },
  { label: '虚拟仓', value: 'virtual' },
]
