/**
 * 库存余额列表的纯逻辑：查询参数组装、翻页判定、引用回退、下拉选项。
 *
 * 三点契约约束决定了这里的形状（均已在后端核对）：
 * 1. `GET /inventory/stocks` 只有 `warehouse_id` / `sku_id` / `limit` / `offset`，**没有 `total`**，
 *    所以翻页只能靠「本页是否满页」推断，且不显示总条数。
 * 2. 后端 `MaxListLimit = 100`，页大小不能超过它。
 * 3. `StockBalance.warehouse` / `sku` 是 `*Reference` + `omitempty`：主数据被软删除后
 *    字段可能整体缺失，也可能带着 `deleted: true` 保留。两种都要有可读回退。
 */

/** 后端 `MaxListLimit` */
export const STOCK_PAGE_SIZE = 100

export interface StockFilters {
  warehouseId: number | null
  skuId: number | null
}

export interface StockQuery {
  warehouse_id?: number
  sku_id?: number
  limit: number
  offset: number
}

/** 空条件不发送该参数（`client.ts` 也会丢弃 undefined / null，这里显式表达意图） */
export function buildStockQuery(
  filters: StockFilters,
  offset: number,
  limit: number = STOCK_PAGE_SIZE,
): StockQuery {
  return {
    ...(filters.warehouseId === null ? {} : { warehouse_id: filters.warehouseId }),
    ...(filters.skuId === null ? {} : { sku_id: filters.skuId }),
    limit,
    offset: Math.max(0, offset),
  }
}

/**
 * 契约没有 `total`，只能用「本页是否满页」推断是否还有下一页。
 * 满页时可能恰好是最后一页，点「下一页」会得到空列表 —— 这是已知近似。
 */
export function hasNextPage(itemCount: number, limit: number = STOCK_PAGE_SIZE): boolean {
  return itemCount >= limit
}

export interface StockReferenceLike {
  id: number
  code: string
  name: string
  deleted: boolean
}

/** 引用整体缺失时回退展示 ID，避免界面静默空白 */
export function referenceCode(
  reference: StockReferenceLike | undefined,
  fallbackId: number,
): string {
  return reference?.code || `#${fallbackId}`
}

export function referenceName(
  reference: StockReferenceLike | undefined,
  fallbackId: number,
): string {
  if (!reference) return `#${fallbackId}`
  const name = reference.name || `#${fallbackId}`
  return reference.deleted ? `${name}（已删除）` : name
}

/** 下拉选项：标签同时给出编码与名称，避免用户只看得到数字 ID */
export function toSelectOptions(
  items: Array<{ id: number; code: string; name: string }>,
): Array<{ label: string; value: number }> {
  return items.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))
}
