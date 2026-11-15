/**
 * 物料的列表列、表单字段与详情页需要的字段变体。
 *
 * 与 `materialsApi` 的绑定只出现在这里，页面（`MaterialListView.vue`、`MaterialDetailView.vue`）
 * 不直接认识 API，也不会各自写一份字段定义。
 */

import { materialsApi } from '@/api/materials'
import { referenceLabel } from '@/components/common/reference-display'
import {
  statusColumn,
  timeColumn,
  type ResourceConfig,
} from '@/features/master-data/lib/list-config'
import { statusOptions } from '@/features/master-data/lib/reference-labels'

import type { DataTableColumn } from '@/components/common/data-table'
import type { FieldConfig } from '@/features/master-data/lib/entity-form'
import type { Material } from '@/types/api'

const commonFields: readonly FieldConfig[] = [
  { key: 'code', label: '编码', type: 'text', required: true, placeholder: '请输入编码' },
  { key: 'name', label: '名称', type: 'text', required: true, placeholder: '请输入名称' },
  { key: 'status', label: '状态', type: 'select', required: true, options: [...statusOptions] },
]

export const materialFields: readonly FieldConfig[] = [
  ...commonFields,
  {
    key: 'category_id',
    label: '分类',
    type: 'select',
    required: true,
    optionsSource: 'categories',
    placeholder: '请选择分类',
  },
  {
    key: 'base_unit_id',
    label: '基础单位',
    type: 'select',
    required: true,
    optionsSource: 'units',
    placeholder: '请选择基础单位',
  },
  { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
]

/**
 * 详情页编辑物料用的字段：与新增一致，但基础单位锁定。
 *
 * 为什么要锁定而不是隐藏：`PUT /materials/:id` 是全量替换，`base_unit_id` 是非指针字段，
 * 漏发会被写成 0。锁定后它仍出现在载荷里，同时避免用户改动基础单位导致既有换算失效。
 */
export function materialEditFields(baseUnitId: number): FieldConfig[] {
  return materialFields.map((field) =>
    field.key === 'base_unit_id' ? { ...field, disabled: true, lockedValue: baseUnitId } : field,
  )
}

/** 列表列：分类与基础单位渲染「编码 - 名称」，名字来自后端内联的引用快照 */
export function materialColumns(): readonly DataTableColumn<Material>[] {
  return [
    { key: 'code', title: '编码', width: 140 },
    { key: 'name', title: '名称', width: 180 },
    {
      key: 'category_id',
      title: '分类',
      width: 190,
      render: (row) => referenceLabel(row.category, row.category_id),
    },
    {
      key: 'base_unit_id',
      title: '基础单位',
      width: 170,
      render: (row) => referenceLabel(row.base_unit, row.base_unit_id),
    },
    statusColumn,
    timeColumn,
  ]
}

export const materialConfig: ResourceConfig<Material> = {
  title: '物料',
  load: (offset) => materialsApi.list({ limit: 100, offset }),
  // 列不由配置提供：页面的引用列依赖后端内联快照，见 MaterialListView.vue
  fields: materialFields,
  create: materialsApi.create,
  get: materialsApi.get,
  update: materialsApi.update,
  remove: materialsApi.remove,
  /** 物料有详情页：列表据此渲染「详情」按钮并让整行可点击 */
  detailRoute: (row) => `/master-data/materials/${row.id}`,
}
