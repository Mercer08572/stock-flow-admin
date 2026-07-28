export interface ApiEnvelope<T> {
  code: number
  message: string
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
  warehouse: Reference
  sku_id: number
  sku: Reference
  on_hand_qty: string
  reserved_qty: string
  available_qty: string
  updated_at: string
}
