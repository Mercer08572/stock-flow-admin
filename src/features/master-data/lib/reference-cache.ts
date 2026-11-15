/**
 * 引用型下拉选项的进程内缓存。
 *
 * 为什么需要：主数据表单里同一类引用（分类 / 单位 / 物料）会被多个字段、多次打开复用；
 * 没有缓存就会在每次打开抽屉时重复请求。列表页的引用列不走这里——它们用的是后端
 * 随行内联的快照。
 *
 * 缓存的另一面是**新鲜度**：新建的分类/单位不会立刻出现在已缓存的选项里，
 * 后续若需要，应在这里加显式失效而不是把缓存删掉（列表刷新时已调用
 * `clearReferenceOptions`）。
 *
 * 失败不入缓存：一次网络抖动不应让整个页面永远拿不到选项。
 */

import { categoriesApi } from '@/api/categories'
import { materialsApi } from '@/api/materials'
import { unitsApi } from '@/api/units'

import type { FieldOption, ReferenceKey } from '@/features/master-data/lib/entity-form'

/**
 * 首屏引用选项的预取上限（后端 `MaxListLimit`）。
 *
 * 编辑回显不依赖这个上限：详情响应内联了引用快照，`mergeReferenceOptions` 会把
 * 「不在候选列表里」的已选值补成选项。因此这里只服务「新增时打开即有候选」，
 * 与库存筛选下拉一样取一小页即可；更多由滚动分页与关键字搜索补齐。
 */
export const REFERENCE_LIST_LIMIT = 20

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

/** 标签同时给出编码与名称，避免用户只看得到数字 ID；`code`/`name` 供下拉两行展示 */
export function toReferenceOptions(items: ReferenceItem[]): FieldOption[] {
  return items.map((item) => ({
    label: `${item.code} - ${item.name}`,
    value: item.id,
    code: item.code,
    name: item.name,
  }))
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
