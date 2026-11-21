import { api } from '@/api/client'
import { inventoryApi } from '@/api/inventory'
import { skusApi } from '@/api/skus'
import { warehousesApi } from '@/api/warehouses'

import type { InventoryOperationInput, StockOperationResult } from '@/types/api'

/**
 * 「API 测试」页的接口封装。
 *
 * 变更方法刻意不进 `src/api/inventory.ts`：那里把库存约定为管理端只读资源，
 * 变更只应由外部业务系统调用。这里是开发调试入口，集中在本功能模块内，
 * 避免被生产页面误用。
 */
export const apiTestApi = {
  send: (endpoint: string, body: InventoryOperationInput) =>
    api.post<StockOperationResult>(endpoint, body),

  /** 当前库存预览（含库存层，用于展示批次 ID 与快捷填入） */
  getStock: (warehouseId: number, skuId: number) =>
    inventoryApi.get(warehouseId, skuId, { include_layers: true }),

  listWarehouses: () => warehousesApi.list({ limit: 100 }),
  listSkus: () => skusApi.list({ limit: 100 }),
  /** 预留扣减 / 释放只能选仍有剩余数量的预留单 */
  listActiveReservations: () => inventoryApi.listReservations({ status: 'active', limit: 100 }),
}
