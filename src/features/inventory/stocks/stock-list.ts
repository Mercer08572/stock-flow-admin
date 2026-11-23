/**
 * 库存余额列表的纯逻辑：查询参数组装。
 *
 * 下拉选项见 `@/features/inventory/lib/select-options`；引用快照的渲染见
 * `@/components/common/reference-display`。
 *
 * 契约约束（均已在后端核对）：
 * 1. `GET /inventory/stocks` 只接受 `warehouse_id` / `sku_id` / `limit` / `offset`；
 *    响应额外返回同条件下的 `total`，用于显示总数与页码跳转。
 * 2. 后端 `MaxListLimit = 100`，页大小不能超过它。
 * 3. `StockBalance.warehouse` / `sku` 是 `*Reference` + `omitempty`：主数据被软删除后
 *    字段可能整体缺失，也可能带着 `deleted: true` 保留。渲染交接给 `reference-display`。
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
