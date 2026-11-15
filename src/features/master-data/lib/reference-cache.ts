/**
 * 引用型下拉选项的进程内缓存。
 *
 * 为什么需要：物料列表一屏 100 行 × 2 个引用列（分类 / 基础单位），
 * 若每行各自取数会造成请求风暴；抽屉与表格又要用同一份数据。
 * 缓存的另一面是**新鲜度**：新建的分类/单位不会立刻出现在已缓存的选项里，
 * 后续若需要，应在这里加显式失效而不是把缓存删掉。
 *
 * 失败不入缓存：一次网络抖动不应让整个页面永远拿不到选项。
 */

import { categoriesApi } from '@/api/categories'
import { materialsApi } from '@/api/materials'
import { unitsApi } from '@/api/units'

import type { FieldOption, ReferenceKey } from '@/features/master-data/lib/entity-form'

/** 后端 `MaxListLimit`：引用选项按此上限取数 */
export const REFERENCE_LIST_LIMIT = 100

/**
 * 只列启用中的引用。
 *
 * 被停用的分类/单位/物料不再出现在下拉里，因此也不能被重新选中；
 * 但列表与详情展示的是后端内联快照，历史行仍照常显示名称。
 */
const REFERENCE_QUERY = { status: 'active', limit: REFERENCE_LIST_LIMIT, offset: 0 } as const

/** 选项的取值来自后端列表项；只需要 id / code / name */
export interface ReferenceItem {
  id: number
  code: string
  name: string
}

const loaders: Record<ReferenceKey, () => Promise<{ items: ReferenceItem[] }>> = {
  categories: () => categoriesApi.list({ ...REFERENCE_QUERY }),
  units: () => unitsApi.list({ ...REFERENCE_QUERY }),
  materials: () => materialsApi.list({ ...REFERENCE_QUERY }),
}

const cache = new Map<ReferenceKey, Promise<FieldOption[]>>()

/** 标签同时给出编码与名称，避免用户只看得到数字 ID */
export function toReferenceOptions(items: ReferenceItem[]): FieldOption[] {
  return items.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))
}

/** 取某类引用选项；并发调用共用同一次请求 */
export function loadReferenceOptions(key: ReferenceKey): Promise<FieldOption[]> {
  const cached = cache.get(key)
  if (cached) return cached

  const request = loaders[key]().then((result) => toReferenceOptions(result.items))
  cache.set(key, request)

  request.catch(() => cache.delete(key))
  return request
}

/** 数据可能已被改动作废时（如新增了分类）清掉缓存 */
export function clearReferenceOptions(): void {
  cache.clear()
}
