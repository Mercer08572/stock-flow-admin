/**
 * 主数据表单的纯逻辑：空表单、预填、必填校验、请求体构造。
 *
 * 抽出来的原因是 `PUT /xxx/:id` 是**全量替换**（后端请求体字段全为非指针且无
 * `binding:"required"`，漏发即落 Go 零值，例如 `precision` 被写成 0），
 * 这条规则值得被单独测试，而不是埋在视图组件里。
 */

export type FieldType = 'text' | 'number' | 'textarea' | 'select'

export interface FieldOption {
  label: string
  value: string
}

export interface FieldConfig {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  min?: number
  max?: number
  options?: FieldOption[]
}

export type FormValues = Record<string, string | number | null>

/** 新增模式的空表单；数值字段用 `null`（NInputNumber 不接受空字符串） */
export function createEmptyForm(fields: FieldConfig[]): FormValues {
  const form: FormValues = {}
  for (const field of fields) {
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
      form[field.key] = field.type === 'number' ? null : ''
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
