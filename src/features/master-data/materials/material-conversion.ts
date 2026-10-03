/**
 * 单位换算区块的纯逻辑：展示行、可用单位、请求体构造。
 *
 * **展示不做任何数值加工**：换算系数是后端 `NUMERIC(24,10)` 的十进制字符串，
 * 每条记录本身就是一条有向关系（例如 `1 CM = 0.01 M`），前端原样呈现。
 *
 * 曾经这里把反向行取倒数归一成「1 基础单位 = x 目标单位」，代价是：
 * 一对互为反向的存量数据在界面上显示成同一条（`M→CM` 与 `CM→M` 都显示成
 * 「1 M = 100 CM」），且引入了浮点求倒数的精度隐患。现已移除。
 */

import { computed, ref } from 'vue'

import { conversionsApi } from '@/api/conversions'
import { commensurableUnitTypes, type UnitDef } from '@/features/master-data/lib/unit-catalog'

import type { FieldOption } from '@/features/master-data/lib/entity-form'
import type { MaterialUnitConversion } from '@/types/api'

/** 换算列表的取数上限（后端 `MaxListLimit`） */
export const CONVERSION_PAGE_SIZE = 100

export interface ConversionRow {
  id: number
  /** 存储的起始单位，与接口返回一致 */
  fromUnitId: number
  /** 存储的目标单位，与接口返回一致 */
  toUnitId: number
  /** 换算系数的原始十进制字符串 */
  factor: string
}

/** 单位显示文本：编码 - 名称，取不到时回退 `#id` */
export function unitLabel(units: readonly UnitDef[], unitId: number): string {
  const unit = units.find((candidate) => candidate.id === unitId)
  return unit ? `${unit.code} - ${unit.name}` : `#${unitId}`
}

/**
 * 把接口返回的换算原样映射成展示行：保持存储方向与系数，不做换向或求倒数。
 *
 * 因此界面上可能出现 `1 M = 100 CM` 与 `1 CM = 0.01 M` 两行——这如实反映了
 * 库里的两条记录（互为反向的存量数据），也让人一眼能看出它们是同一对单位的两个方向。
 */
export function toConversionRow(conversion: MaterialUnitConversion): ConversionRow {
  return {
    id: conversion.id,
    fromUnitId: conversion.from_unit_id,
    toUnitId: conversion.to_unit_id,
    factor: conversion.factor,
  }
}

/**
 * 可作为换算目标的单位：与基础单位可公度，且尚未建立换算规则。
 *
 * `excludeUnitId` 用于编辑：当前行自己的单位要留在候选里。
 */
export function availableTargetUnits(
  units: readonly UnitDef[],
  baseUnitId: number,
  conversions: readonly MaterialUnitConversion[],
  excludeUnitId?: number,
): UnitDef[] {
  const baseUnit = units.find((unit) => unit.id === baseUnitId)

  const usedUnitIds = new Set<number>()
  for (const conversion of conversions) {
    if (
      conversion.id !== undefined &&
      excludeUnitId !== undefined &&
      conversion.id === excludeUnitId
    ) {
      continue
    }
    usedUnitIds.add(conversion.from_unit_id)
    usedUnitIds.add(conversion.to_unit_id)
  }

  return units.filter((unit) => {
    if (unit.id === baseUnitId) return false
    if (usedUnitIds.has(unit.id)) return false
    // 基础单位未知时不额外收窄，交由后端给出明确错误
    if (!baseUnit) return true

    return commensurableUnitTypes(baseUnit.unitType, unit.unitType)
  })
}

/**
 * SKU 表单的单位候选：**基础单位 ∪ 已建立换算的单位**。
 *
 * 需求原文是「单位必须是物料的基础单位，及设置过换算的单位」，因此这里除了可公度，
 * 还要看该物料是否真的建立过换算（后端 `SKU_UnitAllowed` 也会这样校验）。
 * 未选物料时返回空数组，让下拉呈禁用态而不是给出一个必然被拒的选项。
 */
export function skuUnitOptions(
  units: readonly UnitDef[],
  baseUnitId: number | null,
  conversions: readonly MaterialUnitConversion[],
): FieldOption[] {
  if (baseUnitId === null) return []

  const allowedUnitIds = new Set<number>([baseUnitId])
  for (const conversion of conversions) {
    allowedUnitIds.add(conversion.from_unit_id)
    allowedUnitIds.add(conversion.to_unit_id)
  }

  return units
    .filter((unit) => allowedUnitIds.has(unit.id))
    .map((unit) => ({ label: `${unit.code} - ${unit.name}`, value: unit.id }))
}

/**
 * 选中物料后拉取该物料的换算规则，产出 SKU 表单的单位候选。
 */
export function useMaterialUnitOptions() {
  const units = ref<UnitDef[]>([])
  const conversions = ref<MaterialUnitConversion[]>([])
  const loading = ref(false)
  const error = ref('')

  async function load(materialId: number | null) {
    if (materialId === null) {
      conversions.value = []
      return
    }

    loading.value = true
    error.value = ''
    try {
      const result = await conversionsApi.list(materialId, {
        limit: CONVERSION_PAGE_SIZE,
        offset: 0,
      })
      conversions.value = result.items
    } catch (loadError) {
      conversions.value = []
      error.value = loadError instanceof Error ? loadError.message : '单位换算加载失败'
    } finally {
      loading.value = false
    }
  }

  return {
    units,
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    load,
    options: (baseUnitId: number | null) =>
      skuUnitOptions(units.value, baseUnitId, conversions.value),
  }
}
