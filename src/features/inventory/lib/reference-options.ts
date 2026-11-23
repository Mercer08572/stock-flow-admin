/**
 * 库存筛选下拉的远程搜索与分页。
 *
 * 后端 `/warehouses` 与 `/skus` 的 `limit` 上限是 100，前端本地过滤只能覆盖前 100 条；
 * 这里把关键字与 offset 交给服务端，第 101 条以后的数据也能被搜到、也能滚动翻到。
 *
 * 首屏仍由页面的 `loadOptions()` 预取一小页（`REFERENCE_OPTION_PREFETCH`），
 * 打开下拉即有内容；继续滚动或输入时才走这里。
 */

import { skusApi } from '@/api/skus'
import { warehousesApi } from '@/api/warehouses'
import type {
  ReferenceSelectPage,
  ReferenceSelectQuery,
} from '@/components/common/reference-select'
import { toSelectOptions } from '@/features/inventory/lib/select-options'

/**
 * 首屏预取的条数。
 *
 * 本地过滤时代取 100 是因为「本地只能从已取回的里筛」；改成服务端搜索后，
 * 首屏只需要够用户打开时看到一屏、不用等网络，多余的部分滚动/输入再取。
 */
export const REFERENCE_OPTION_PREFETCH = 20

export async function searchWarehouseOptions({
  keyword,
  offset,
  limit,
}: ReferenceSelectQuery): Promise<ReferenceSelectPage<number>> {
  const result = await warehousesApi.list({ q: keyword, limit, offset })
  return { options: toSelectOptions(result.items ?? []), total: result.total }
}

export async function searchSkuOptions({
  keyword,
  offset,
  limit,
}: ReferenceSelectQuery): Promise<ReferenceSelectPage<number>> {
  const result = await skusApi.list({ q: keyword, limit, offset })
  return { options: toSelectOptions(result.items ?? []), total: result.total }
}
