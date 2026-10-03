import { describe, expect, it } from 'vitest'

import {
  buildPayload,
  createEmptyForm,
  fillForm,
  findMissingRequired,
  optionLabel,
  referenceSources,
  resolveFieldOptions,
  type FieldConfig,
} from './entity-form'

// 与 units/UnitListView 的字段配置同形（含必填与数值字段）
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

// 物料详情页新增 SKU 的字段：物料锁定、只保留单位选项
const lockedSkuFields: FieldConfig[] = [
  { key: 'code', label: '编码', type: 'text', required: true },
  { key: 'name', label: '名称', type: 'text', required: true },
  { key: 'status', label: '状态', type: 'select', required: true },
  {
    key: 'material_id',
    label: '物料',
    type: 'select',
    required: true,
    disabled: true,
    lockedValue: 101,
  },
  { key: 'unit_id', label: '单位', type: 'select', required: true, optionsSource: 'units' },
  { key: 'remark', label: '备注', type: 'textarea' },
]

describe('锁定字段', () => {
  it('新增时用 lockedValue 预置，且不因禁用而漏发', () => {
    const form = createEmptyForm(lockedSkuFields)

    // 锁定值不走「数字字段默认 null」的分支
    expect(form.material_id).toBe(101)

    form.code = 'SKU-002'
    form.name = '钢板 2mm'
    form.unit_id = 1

    const payload = buildPayload(lockedSkuFields, form)

    // PUT 是全量替换：锁定字段必须出现在载荷里，否则会被写成零值
    expect(payload.material_id).toBe(101)
    expect(payload.unit_id).toBe(1)
  })

  it('新增时的默认值必须保留：status=active 不能被空实体覆盖', () => {
    // 这条曾经真的坏过：抽屉在新增模式下又 fillForm 了一次空实体，status 变成空串，
    // 提交时被必填校验拦下（「请填写状态」）。
    const form = createEmptyForm(lockedSkuFields)
    expect(form.status).toBe('active')

    form.code = 'SKU-002'
    form.name = '钢板 2mm'
    form.unit_id = 1

    expect(buildPayload(lockedSkuFields, form)).toEqual({
      code: 'SKU-002',
      name: '钢板 2mm',
      status: 'active',
      material_id: 101,
      unit_id: 1,
      remark: null,
    })
  })

  it('编辑时以实体自身的值为准', () => {
    const form = fillForm(lockedSkuFields, {
      ...createEmptyForm(lockedSkuFields),
      material_id: 202,
    })

    expect(form.material_id).toBe(202)
  })
})

describe('引用型选项', () => {
  it('按字段声明去重收集数据源', () => {
    expect(referenceSources(lockedSkuFields)).toEqual(['units'])
  })

  it('把加载到的选项合并进字段，静态 options 不受影响', () => {
    const fields = resolveFieldOptions(lockedSkuFields, {
      units: [{ label: 'KG - 千克', value: 1 }],
    })

    expect(fields.find((field) => field.key === 'unit_id')?.options).toEqual([
      { label: 'KG - 千克', value: 1 },
    ])
    expect(fields.find((field) => field.key === 'status')?.options).toBeUndefined()
  })

  it('找不到引用时回退成可读的 ID 而不是空白', () => {
    expect(optionLabel([{ label: 'KG - 千克', value: 1 }], 1)).toBe('KG - 千克')
    expect(optionLabel([], 99)).toBe('#99')
    expect(optionLabel(undefined, null)).toBe('')
  })
})
