import { describe, expect, it } from 'vitest'

import {
  buildPayload,
  createEmptyForm,
  fillForm,
  findMissingRequired,
  type FieldConfig,
} from './master-data-form'

// 与 MasterDataListView 中 units 的字段配置同形（含必填与数值字段）
const unitFields: FieldConfig[] = [
  { key: 'code', label: '编码', type: 'text', required: true },
  { key: 'name', label: '名称', type: 'text', required: true },
  { key: 'status', label: '状态', type: 'select', required: true },
  { key: 'symbol', label: '符号', type: 'text', required: true },
  { key: 'unit_type', label: '类型', type: 'select', required: true },
  { key: 'precision', label: '精度', type: 'number', required: true, min: 0, max: 6 },
]

// 含可选项的字段配置（对应后端 `*T` 字段）
const categoryFields: FieldConfig[] = [
  { key: 'code', label: '编码', type: 'text', required: true },
  { key: 'name', label: '名称', type: 'text', required: true },
  { key: 'status', label: '状态', type: 'select', required: true },
  { key: 'parent_id', label: '上级 ID', type: 'number' },
  { key: 'remark', label: '备注', type: 'textarea' },
]

describe('createEmptyForm', () => {
  it('defaults status to active and numbers to null', () => {
    expect(createEmptyForm(categoryFields)).toEqual({
      code: '',
      name: '',
      status: 'active',
      parent_id: null,
      remark: '',
    })
  })
})

describe('fillForm', () => {
  it('prefills every field from the fetched entity', () => {
    const form = fillForm(unitFields, {
      id: 7,
      code: 'KG',
      name: '千克',
      symbol: 'kg',
      unit_type: 'weight',
      precision: 3,
      status: 'inactive',
    })

    expect(form).toEqual({
      code: 'KG',
      name: '千克',
      symbol: 'kg',
      unit_type: 'weight',
      precision: 3,
      status: 'inactive',
    })
  })

  it('maps a missing optional field to an empty value', () => {
    const form = fillForm(categoryFields, {
      code: 'C1',
      name: '分类一',
      status: 'active',
    })

    // 后端可空字段可能整体缺失（omitempty），不能变成 undefined
    expect(form.parent_id).toBeNull()
    expect(form.remark).toBe('')
  })

  it('keeps a zero numeric value instead of treating it as empty', () => {
    const form = fillForm(unitFields, { precision: 0 })

    expect(form.precision).toBe(0)
  })
})

describe('findMissingRequired', () => {
  it('reports the first empty required field', () => {
    const form = createEmptyForm(unitFields)

    expect(findMissingRequired(unitFields, form)?.key).toBe('code')
  })

  it('ignores empty optional fields', () => {
    const form = {
      code: 'C1',
      name: '分类一',
      status: 'active',
      parent_id: null,
      remark: '',
    }

    expect(findMissingRequired(categoryFields, form)).toBeUndefined()
  })

  it('treats zero as a present value', () => {
    const form = {
      code: 'KG',
      name: '千克',
      status: 'active',
      symbol: 'kg',
      unit_type: 'weight',
      precision: 0,
    }

    expect(findMissingRequired(unitFields, form)).toBeUndefined()
  })
})

describe('buildPayload', () => {
  it('always sends every field so a full PUT replace cannot zero values out', () => {
    const form = {
      code: 'KG',
      name: '千克',
      status: 'active',
      symbol: 'kg',
      unit_type: 'weight',
      precision: 3,
    }

    expect(buildPayload(unitFields, form)).toEqual(form)
  })

  it('sends null (not omission) for empty optional fields', () => {
    const form = {
      code: 'C1',
      name: '分类一',
      status: 'active',
      parent_id: null,
      remark: '',
    }

    const payload = buildPayload(categoryFields, form)

    // 后端可选项是 *T：显式 null 才能清空
    expect(payload).toEqual({
      code: 'C1',
      name: '分类一',
      status: 'active',
      parent_id: null,
      remark: null,
    })
    expect('remark' in payload).toBe(true)
  })

  it('keeps a numeric zero in the payload', () => {
    const form = {
      code: 'KG',
      name: '千克',
      status: 'active',
      symbol: 'kg',
      unit_type: 'weight',
      precision: 0,
    }

    expect(buildPayload(unitFields, form).precision).toBe(0)
  })

  it('does not invent a value for an empty required field', () => {
    const form = {
      code: '',
      name: '千克',
      status: 'active',
      symbol: 'kg',
      unit_type: 'weight',
      precision: 3,
    }

    // 必填留空由 findMissingRequired 拦下，载荷里不应出现该键
    expect('code' in buildPayload(unitFields, form)).toBe(false)
  })
})
