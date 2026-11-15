/**
 * 实体表单的纯逻辑：空表单、预填、必填校验、请求体构造、引用型选项的解析。
 *
 * 各资源目录（materials / skus / categories / units / warehouses）的表单字段不同，
 * 但下面两条规则必须只有一处实现：
 * 1. `PUT /xxx/:id` 是**全量替换**（后端请求体字段全为非指针且无 `binding:"required"`，
 *    漏发即落 Go 零值，例如 `precision` 被写成 0）；
 * 2. 引用型下拉（分类 / 单位 / 物料）的选项来自另一个列表接口，需要按字段声明去重加载。
 *
 * 因此纯逻辑集中在这里，由 `components/EntityFormDrawer.vue` 与各资源的 `*.ts` 共用。
 */

import { referenceLabel, referenceName } from '@/components/common/reference-display'

import type { Reference } from '@/types/api'

export type FieldType = 'text' | 'number' | 'textarea' | 'select'

export interface FieldOption {
  label: string
  /** 枚举用字符串；引用型下拉（分类 / 单位 / 物料）用数字 ID */
  value: string | number
  /** 引用型下拉的编码与名称，供两行展示；静态枚举没有这两个字段 */
  code?: string
  name?: string
}

/** 引用型下拉的取数来源，与 `lib/reference-cache.ts` 的加载函数一一对应 */
export type ReferenceKey = 'categories' | 'units' | 'materials'

export interface FieldConfig {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  min?: number
  max?: number
  /** 静态选项（枚举） */
  options?: FieldOption[]
  /** 动态选项来源；与 `options` 二选一 */
  optionsSource?: ReferenceKey
  /**
   * 详情响应里对应的内联引用快照字段名（如 `category`、`base_unit`）。
   *
   * 编辑时用它兜底回显：候选选项只含启用记录、且只有一页，引用的主数据可能在
   * 超出候选的一页、已停用或已软删除，`NSelect` 找不到 label 就会把值显示成数字 ID。
   */
  referenceField?: string
  /** 锁定字段：值仍随表单提交，但用户不可编辑（如详情页里的「物料」） */
  disabled?: boolean
  /**
   * 锁定字段的固定值（新增模式下使用）。
   * 例如「在物料 12 的详情页新增 SKU」时 material_id 恒为 12。
   */
  lockedValue?: string | number
  /** 值变化时的回调；用于「选了物料后要重新取该物料的单位换算」这类联动 */
  onChange?: (value: unknown) => void
}

export type FormValues = Record<string, string | number | null>

/** 新增模式的空表单；数值字段用 `null`（NInputNumber 不接受空字符串） */
export function createEmptyForm(fields: FieldConfig[]): FormValues {
  const form: FormValues = {}
  for (const field of fields) {
    if (field.lockedValue !== undefined) {
      form[field.key] = field.lockedValue
      continue
    }
    form[field.key] = field.key === 'status' ? 'active' : field.type === 'number' ? null : ''
  }
  return form
}

/** 用实体字段灌满表单；缺失字段按「空」处理，避免残留上一次编辑的值 */
export function fillForm(fields: FieldConfig[], entity: Record<string, unknown>): FormValues {
  const form: FormValues = {}
  for (const field of fields) {
    const value = entity[field.key]
    if (value === null || value === undefined || value === '') {
      form[field.key] = field.lockedValue ?? (field.type === 'number' ? null : '')
    } else {
      form[field.key] = value as string | number
    }
  }
  return form
}

export function findMissingRequired(
  fields: FieldConfig[],
  form: FormValues,
): FieldConfig | undefined {
  return fields.find((field) => {
    if (!field.required) return false
    const value = form[field.key]
    return value === null || value === undefined || value === ''
  })
}

/**
 * 构造请求体。
 *
 * `PUT` 是全量替换，因此**每个**字段都要出现在载荷里：可选项留空时必须显式发 `null`。
 * 后端可选项均为 `*T`，所以 `null` 与省略在语义上一致（都表示清空），
 * 但省略非指针字段会被解析成零值。必填项留空由 `findMissingRequired` 提前拦下。
 */
export function buildPayload(fields: FieldConfig[], form: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const field of fields) {
    const value = form[field.key]
    const isEmpty = value === null || value === undefined || value === ''
    if (isEmpty) {
      if (!field.required) payload[field.key] = null
      continue
    }
    payload[field.key] = value
  }
  return payload
}

/** 一组字段需要的引用型数据源（去重，按首次出现顺序） */
export function referenceSources(fields: readonly FieldConfig[]): ReferenceKey[] {
  const keys = fields
    .map((field) => field.optionsSource)
    .filter((key): key is ReferenceKey => key !== undefined)

  return [...new Set(keys)]
}

/**
 * 把详情接口内联的引用快照补进候选选项。
 *
 * 候选选项只含启用记录、且只有一页；编辑时引用的主数据可能在超出候选的一页、
 * 已停用或已软删除，`NSelect` 找不到 label 就会把值显示成数字 ID。
 * 详情响应本来就带 `category` / `base_unit` 等快照，用它补一条即可，不需要额外请求。
 *
 * 返回新对象、新数组：`optionsBySource` 里可能是 `reference-cache` 的缓存数组，
 * 原地 push 会污染缓存，影响下一次打开表单。
 */
export function mergeReferenceOptions(
  fields: readonly FieldConfig[],
  optionsBySource: Record<string, FieldOption[]>,
  entity: Record<string, unknown> | null,
): Record<string, FieldOption[]> {
  if (!entity) return optionsBySource

  const merged: Record<string, FieldOption[]> = {}

  for (const field of fields) {
    const source = field.optionsSource
    const snapshotKey = field.referenceField
    if (!source || !snapshotKey) continue

    const snapshot = entity[snapshotKey]
    if (!isReferenceSnapshot(snapshot)) continue

    const current = merged[source] ?? optionsBySource[source] ?? []
    if (current.some((option) => option.value === snapshot.id)) {
      merged[source] = current
      continue
    }

    merged[source] = [referenceOption(snapshot), ...current]
  }

  if (Object.keys(merged).length === 0) return optionsBySource
  return { ...optionsBySource, ...merged }
}

/** 快照 → 选项：标签与列表列共用「编码 - 名称（已停用/已删除）」的约定 */
function referenceOption(reference: Reference): FieldOption {
  return {
    label: referenceLabel(reference, reference.id),
    value: reference.id,
    code: reference.code,
    name: referenceName(reference, reference.id),
  }
}

function isReferenceSnapshot(value: unknown): value is Reference {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Partial<Reference>
  return (
    typeof candidate.id === 'number' &&
    typeof candidate.code === 'string' &&
    typeof candidate.name === 'string'
  )
}

/**
 * 把加载到的选项合并进字段。
 *
 * 必须**先加载选项、再预填表单**：`NSelect` 只显示存在于选项表里的值，
 * 顺序反了会看到「表单有值但下拉是空的」。
 */
export function resolveFieldOptions(
  fields: readonly FieldConfig[],
  optionsBySource: Record<string, FieldOption[]>,
): FieldConfig[] {
  return fields.map((field) => {
    if (!field.optionsSource) return field
    return { ...field, options: optionsBySource[field.optionsSource] ?? [] }
  })
}
