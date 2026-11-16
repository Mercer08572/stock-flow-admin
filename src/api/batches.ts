import { api } from './client'

import type {
  BatchStatus,
  CreateBatchInput,
  InventoryBatch,
  InventoryBatchDetail,
  ListResult,
  UpdateBatchInput,
} from '@/types/api'

/**
 * 库存批次接口。
 *
 * 批次是 SKU 级主数据：管理端只维护批号、效期、优先级与状态；
 * 批次库存不在这里读写，而是由库存层按 `batch_id` 聚合（见详情接口的 `stocks`）。
 */
export const batchesApi = {
  list: (query: {
    sku_id?: number
    status?: BatchStatus
    /** 按批号模糊搜索 */
    q?: string
    limit?: number
    offset?: number
  }) => api.get<ListResult<InventoryBatch>>('/inventory/batches', query),
  get: (id: number) => api.get<InventoryBatchDetail>(`/inventory/batches/${id}`),
  create: (body: CreateBatchInput) => api.post<InventoryBatch>('/inventory/batches', body),
  update: (id: number, body: UpdateBatchInput) =>
    api.put<InventoryBatch>(`/inventory/batches/${id}`, body),
  /** 停用：状态置为 inactive；已存在的库存仍可显式指定批次出库 */
  disable: (id: number) => api.put<InventoryBatch>(`/inventory/batches/${id}/disable`),
  /** 删除：仅当批次没有任何库存层或流水引用时可用，否则后端返回 409 */
  remove: (id: number) => api.delete<void>(`/inventory/batches/${id}`),
}
