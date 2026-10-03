/**
 * SKU 的列表列与表单字段。
 *
 * 与 `skusApi` 的绑定只出现在这里。独立的 SKU 列表页与物料详情页的 SKU 子表
 * 都以本文件为字段来源，避免同一实体的两张表单出现字段漂移。
 */

import { skusApi } from '@/api/skus'
import {
  statusColumn,
  timeColumn,
  type ResourceConfig,
} from '@/features/master-data/lib/list-config'
import { statusOptions } from '@/features/master-data/lib/reference-labels'

import type { DataTableColumn } from '@/components/common/data-table'
import type { FieldConfig, FieldOption, ReferenceKey } from '@/features/master-data/lib/entity-form'
import { commensurableUnitTypes, type UnitDef } from '@/features/master-data/lib/unit-catalog'
import type { SKU } from '@/types/api'

/** 与 `FieldConfig.optionsSource` 一一对应，供页面声明需要加载哪些引用选项 */
export const skuReferenceKeys: readonly ReferenceKey[] = ['materials', 'units']

const commonFields: readonly FieldConfig[] = [
  { key: 'code', label: '编码', type: 'text', required: true, placeholder: '请输入编码' },
  { key: 'name', label: '名称', type: 'text', required: true, placeholder: '请输入名称' },
  { key: 'status', label: '状态', type: 'select', required: true, options: [...statusOptions] },
]

export const skuFields: readonly FieldConfig[] = [
  ...commonFields,
  {
    key: 'material_id',
    label: '物料',
    type: 'select',
    required: true,
    optionsSource: 'materials',
    placeholder: '请选择物料',
  },
  {
    key: 'unit_id',
    label: '单位',
    type: 'select',
    required: true,
    optionsSource: 'units',
    placeholder: '请选择单位',
  },
  { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
]

/**
 * 物料详情页的字段变体。
 *
 * 两处与列表页不同：
 * - `material_id` 锁定为当前物料（不隐藏：隐藏会让载荷漏键，而 `PUT` 是全量替换，漏发等于清空）；
 * - `unit_id` 只列与物料基础单位可公度的单位（真正的把关在后端换算校验）。
 */
export function skuFieldsForMaterial(
  materialId: number,
  baseUnitId: number,
  units: readonly UnitDef[],
): FieldConfig[] {
  return skuFields.map((field) => {
    if (field.key === 'material_id') {
      return {
        key: field.key,
        label: field.label,
        type: field.type,
        disabled: true,
        lockedValue: materialId,
        ...(field.required === undefined ? {} : { required: field.required }),
      }
    }

    if (field.key === 'unit_id') {
      return {
        ...field,
        optionsSource: undefined,
        options: commensurableUnitOptions(baseUnitId, units),
      }
    }

    return field
  })
}

/**
 * 可作为 SKU 单位的单位：与基础单位可公度。
 *
 * 停用的单位会由单位目录过滤掉；已建立换算的单位由后端把关
 * （`SKU_UNIT_NOT_ALLOWED`），因此这里不重复请求换算列表。
 */
export function commensurableUnitOptions(
  baseUnitId: number,
  units: readonly UnitDef[],
  extraUnitId?: number,
): FieldOption[] {
  const baseUnit = units.find((unit) => unit.id === baseUnitId)

  const available = units.filter((unit) => {
    if (unit.id === baseUnitId) return true
    if (!baseUnit) return true

    return commensurableUnitTypes(baseUnit.unitType, unit.unitType)
  })

  // 编辑时当前值可能已被停用或不再可公度，仍需出现在选项里才能显示
  if (extraUnitId !== undefined && !available.some((unit) => unit.id === extraUnitId)) {
    const extra = units.find((unit) => unit.id === extraUnitId)
    if (extra) available.push(extra)
  }

  return available.map((unit) => ({ label: `${unit.code} - ${unit.name}`, value: unit.id }))
}

/**
 * 列表列需要把 `material_id` / `unit_id` 渲染成「编码 - 名称」，
 * 因此标签函数由页面注入（页面才知道引用选项加载到没有）。
 */
export function skuColumns(label: (key: ReferenceKey, id: unknown) => string) {
  const columns: readonly DataTableColumn<SKU>[] = [
    { key: 'code', title: '编码', width: 140 },
    { key: 'name', title: '名称', width: 180 },
    {
      key: 'material_id',
      title: '物料',
      width: 190,
      render: (row) => label('materials', row.material_id),
    },
    { key: 'unit_id', title: '单位', width: 170, render: (row) => label('units', row.unit_id) },
    statusColumn,
    timeColumn,
  ]
  return columns
}

/**
 * 物料详情页子表的列：不重复「物料」列（整张表都属于同一个物料），
 * 其余列与独立 SKU 列表保持一致。
 */
export function skuDetailColumns(label: (key: ReferenceKey, id: unknown) => string) {
  const columns: readonly DataTableColumn<SKU>[] = [
    { key: 'code', title: '编码', width: 140 },
    { key: 'name', title: '名称', width: 180 },
    { key: 'unit_id', title: '单位', width: 170, render: (row) => label('units', row.unit_id) },
    statusColumn,
    timeColumn,
  ]
  return columns
}

export const skuConfig: ResourceConfig<SKU> = {
  title: 'SKU',
  load: () => skusApi.list({ limit: 100, offset: 0 }),
  // 列由页面提供（引用列标签依赖页面加载到的选项），见 SkuListView.vue
  fields: skuFields,
  create: skusApi.create,
  get: skusApi.get,
  update: skusApi.update,
  remove: skusApi.remove,
}
