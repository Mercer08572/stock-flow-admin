export interface ApiEnvelope<T> {
  code: number
  message: string
  /** 稳定的业务错误码（后端 pkg/apperr），成功响应不返回 */
  error_code?: string
  data: T
  trace_id: string
  timestamp: number
}

export interface ListResult<T> {
  items: T[]
  limit: number
  offset: number
}

export type EntityStatus = 'active' | 'inactive'

export interface AdminIdentity {
  id: number
  username: string
  must_change_password: boolean
}

export interface LoginResponse {
  admin: AdminIdentity
  expires_at: string
}

export interface HealthStatus {
  service: string
  status: string
}

export interface Reference {
  id: number
  code: string
  name: string
  deleted: boolean
}

export interface BaseEntity {
  id: number
  code: string
  name: string
  status: EntityStatus
  created_at: string
  updated_at: string
}

export interface Unit extends BaseEntity {
  symbol: string
  precision: number
  unit_type: 'count' | 'weight' | 'length' | 'area' | 'volume' | 'package' | 'time' | 'other'
}

export interface MaterialCategory extends BaseEntity {
  parent_id?: number
  remark?: string
}

export interface Material extends BaseEntity {
  base_unit_id: number
  category_id: number
  remark?: string
}

export interface SKU extends BaseEntity {
  material_id: number
  unit_id: number
  remark?: string
}

export interface Warehouse extends BaseEntity {
  type: 'normal' | 'virtual'
  location?: string
  contact_name?: string
  contact_phone?: string
  remark?: string
}

export interface StockBalance {
  warehouse_id: number
  /** 后端为 *Reference + omitempty：主数据被软删除后整个字段缺失 */
  warehouse?: Reference
  sku_id: number
  sku?: Reference
  on_hand_qty: string
  reserved_qty: string
  available_qty: string
  updated_at: string | null
  /** 仅在 include_layers=true 时返回 */
  layers?: StockLayer[]
}

export interface StockLayer {
  id: number
  warehouse_id: number
  sku_id: number
  warehouse?: Reference
  sku?: Reference
  batch_id: number | null
  received_at: string
  on_hand_qty: string
  reserved_qty: string
  available_qty: string
  created_at: string
  updated_at: string
}

/**
 * 更新入参（`PUT /xxx/:id`）。
 *
 * 后端 `PUT` 是**全量替换**：请求体字段全为非指针且无 `binding:"required"`，
 * 漏发的字段会以 Go 零值落库。因此这里把可选的 `*T` 字段显式建模为 `T | null`，
 * 调用方必须把「清空」表达成 `null` 而不是省略。
 */
export interface UpdateUnitInput {
  code: string
  name: string
  symbol: string
  unit_type: Unit['unit_type']
  precision: number
  status: EntityStatus
}

export interface UpdateCategoryInput {
  code: string
  name: string
  parent_id: number | null
  status: EntityStatus
  remark: string | null
}

export interface UpdateMaterialInput {
  code: string
  name: string
  category_id: number
  base_unit_id: number
  status: EntityStatus
  remark: string | null
}

export interface UpdateSkuInput {
  material_id: number
  code: string
  name: string
  unit_id: number
  status: EntityStatus
  remark: string | null
}

export interface UpdateWarehouseInput {
  code: string
  name: string
  type: Warehouse['type']
  status: EntityStatus
  location: string | null
  contact_name: string | null
  contact_phone: string | null
  remark: string | null
}
