/**
 * 计量单位目录（含 `unit_type`）的加载与缓存。
 *
 * 与 `reference-cache.ts` 的区别：那里只需要「编码 - 名称」这种选项对，
 * 而换算规则与 SKU 单位下拉需要**单位类型**来判断可公度，因此单独维护一份目录，
 * 避免为了多一个字段把通用引用缓存的形状改宽。
 *
 * 与 `reference-cache.ts` 在列表刷新时一并失效（见 `lib/entity-list.ts`）。
 */

import { computed, ref, type ComputedRef } from 'vue'

import { unitsApi } from '@/api/units'

import type { Unit, UnitType } from '@/types/api'

/** 后端 `MaxListLimit`：单位目录按此上限取数 */
export const UNIT_CATALOG_LIMIT = 100

/** 下拉与换算展示只需要这几个字段 */
export interface UnitDef {
  id: number
  code: string
  name: string
  symbol: string
  unitType: UnitType
}

let cachedCatalog: Promise<UnitDef[]> | null = null

export function toUnitDefs(items: Unit[]): UnitDef[] {
  return items.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    symbol: item.symbol,
    unitType: item.unit_type,
  }))
}

/** 取单位目录；并发调用共用同一次请求，失败不入缓存 */
export function loadUnitCatalog(): Promise<UnitDef[]> {
  if (cachedCatalog) return cachedCatalog

  const request = unitsApi
    .list({ status: 'active', limit: UNIT_CATALOG_LIMIT, offset: 0 })
    .then((result) => toUnitDefs(result.items))

  cachedCatalog = request
  request.catch(() => {
    cachedCatalog = null
  })

  return request
}

export function clearUnitCatalog(): void {
  cachedCatalog = null
}

/**
 * 两个单位类型是否可公度。
 *
 * 与后端 `material.CommensurableUnitTypes` 保持一致：同类型可公度，
 * 另外允许「包装 ↔ 计数」（`1 box = 12 pcs`）。前端这层只做即时反馈，
 * 真正的把关在后端。
 */
export function commensurableUnitTypes(from: UnitType, to: UnitType): boolean {
  if (from === to) return true

  const pair = new Set([from, to])
  return pair.has('package') && pair.has('count')
}

/**
 * 单位目录的组合式：`ensure()` 幂等加载（已缓存则不发请求），
 * `reload()` 强制重新取数（新建单位后使用）。
 */
export function useUnitCatalog(): {
  units: ComputedRef<UnitDef[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<string>
  ensure: () => Promise<void>
  reload: () => Promise<void>
} {
  const units = ref<UnitDef[]>([])
  const loading = ref(false)
  const error = ref('')

  async function load(force: boolean) {
    if (!force && units.value.length > 0) return

    loading.value = true
    error.value = ''
    try {
      units.value = await loadUnitCatalog()
    } catch (loadError) {
      error.value = loadError instanceof Error ? loadError.message : '单位列表加载失败'
    } finally {
      loading.value = false
    }
  }

  return {
    units: computed(() => units.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    ensure: () => load(false),
    reload: () => load(true),
  }
}
