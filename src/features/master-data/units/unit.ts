/**
 * 计量单位的列表列与表单字段。
 *
 * 与 `unitsApi` 的绑定只出现在这里，页面（`UnitListView.vue`）不直接认识 API。
 */

import { unitsApi } from '@/api/units'
import {
  statusColumn,
  timeColumn,
  type ResourceConfig,
} from '@/features/master-data/lib/list-config'
import { statusOptions, unitTypeOptions } from '@/features/master-data/lib/reference-labels'

import type { DataTableColumn } from '@/components/common/data-table'
import type { Unit } from '@/types/api'

const commonFields = [
  { key: 'code', label: '编码', type: 'text', required: true, placeholder: '请输入编码' },
  { key: 'name', label: '名称', type: 'text', required: true, placeholder: '请输入名称' },
  { key: 'status', label: '状态', type: 'select', required: true, options: statusOptions },
] as const

const columns: readonly DataTableColumn<Unit>[] = [
  { key: 'code', title: '编码', width: 140 },
  { key: 'name', title: '名称', width: 180 },
  { key: 'symbol', title: '符号', width: 100 },
  { key: 'unit_type', title: '类型', width: 120 },
  { key: 'precision', title: '精度', width: 90, align: 'right' },
  statusColumn,
  timeColumn,
]

export const unitConfig: ResourceConfig<Unit> = {
  title: '计量单位',
  load: () => unitsApi.list({ limit: 100, offset: 0 }),
  columns,
  fields: [
    ...commonFields,
    { key: 'symbol', label: '符号', type: 'text', required: true, placeholder: '请输入单位符号' },
    { key: 'unit_type', label: '类型', type: 'select', required: true, options: unitTypeOptions },
    { key: 'precision', label: '精度', type: 'number', required: true, min: 0, max: 6 },
  ],
  create: unitsApi.create,
  get: unitsApi.get,
  update: unitsApi.update,
  remove: unitsApi.remove,
}
