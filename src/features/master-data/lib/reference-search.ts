/**
 * 主数据引用下拉（分类 / 单位 / 物料）的远程搜索与分页。
 *
 * 与 `reference-cache.ts` 的关系：cache 负责「打开表单时预取首屏选项」，
 * 这里负责「用户输入关键字、或滚到底部时按需查询」。两者共用 `toReferenceOptions`
 * 的标签格式，因此搜索结果与首屏选项在下拉里长得完全一样。
 */

import { categoriesApi } from '@/api/categories'
import { materialsApi } from '@/api/materials'
import { skusApi } from '@/api/skus'
import { unitsApi } from '@/api/units'
import type {
  ReferenceSelectPage,
  ReferenceSelectQuery,
} from '@/components/common/reference-select'
import type { ReferenceKey } from '@/features/master-data/lib/entity-form'
import { toReferenceOptions } from '@/features/master-data/lib/reference-cache'

/**
 * 按来源分页搜索引用选项。
 *
 * 只搜启用中的记录：停用的分类/单位/物料本来就不该被重新选中，
 * 与 `reference-cache.ts` 的 `REFERENCE_QUERY` 保持一致。
 */
export async function searchReferenceOptions(
  key: ReferenceKey,
  { keyword, offset, limit }: ReferenceSelectQuery,
): Promise<ReferenceSelectPage<number>> {
  const query = { q: keyword, status: 'active', limit, offset }

  const result = await loadSource(key, query)
  return { options: toReferenceOptions(result.items ?? []), total: result.total }
}

type ReferenceQuery = { q: string; status: string; limit: number; offset: number }

function loadSource(
  key: ReferenceKey,
  query: ReferenceQuery,
): Promise<{ items?: Array<{ id: number; code: string; name: string }>; total: number }> {
  switch (key) {
    case 'categories':
      return categoriesApi.list(query)
    case 'units':
      return unitsApi.list(query)
    case 'materials':
      return materialsApi.list(query)
    case 'skus':
      return skusApi.list(query)
  }
}
