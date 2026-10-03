/**
 * 物料分类的列表列与表单字段。
 *
 * 与 `categoriesApi` 的绑定只出现在这里，页面（`CategoryListView.vue`）不直接认识 API。
 */

import { categoriesApi } from '@/api/categories'
import {
  statusColumn,
  timeColumn,
  type ResourceConfig,
} from '@/features/master-data/lib/list-config'
import { statusOptions } from '@/features/master-data/lib/reference-labels'

import type { DataTableColumn } from '@/components/common/data-table'
import type { MaterialCategory } from '@/types/api'

const commonFields = [
  { key: 'code', label: '编码', type: 'text', required: true, placeholder: '请输入编码' },
  { key: 'name', label: '名称', type: 'text', required: true, placeholder: '请输入名称' },
  { key: 'status', label: '状态', type: 'select', required: true, options: statusOptions },
] as const

const columns: readonly DataTableColumn<MaterialCategory>[] = [
  { key: 'code', title: '编码', width: 140 },
  { key: 'name', title: '名称', width: 180 },
  { key: 'parent_id', title: '上级 ID', width: 110 },
  { key: 'remark', title: '备注', width: 180 },
  statusColumn,
  timeColumn,
]

export const categoryConfig: ResourceConfig<MaterialCategory> = {
  title: '物料分类',
  load: () => categoriesApi.list({ limit: 100, offset: 0 }),
  columns,
  fields: [
    ...commonFields,
    { key: 'parent_id', label: '上级 ID', type: 'number', min: 1, placeholder: '可选' },
    { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
  ],
  create: categoriesApi.create,
  get: categoriesApi.get,
  update: categoriesApi.update,
  remove: categoriesApi.remove,
}
