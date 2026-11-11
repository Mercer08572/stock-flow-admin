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
  /** 同过滤条件下的总记录数，不受 limit/offset 影响 */
  total: number
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

/** 与后端 `units.unit_type` 的取值一一对应，用于判断两个单位是否可公度 */
export type UnitType =
  'count' | 'weight' | 'length' | 'area' | 'volume' | 'package' | 'time' | 'other'

export interface Unit extends BaseEntity {
  symbol: string
  precision: number
  unit_type: UnitType
}

/**
 * 物料级单位换算（`/materials/:id/unit-conversions`）。
 *
 * `factor` 是**十进制字符串**（后端 `NUMERIC(24,10)`），前端原样透传、不做浮点运算，
 * 否则会出现精度漂移。方向约定：`from_unit_id` 是物料的基础单位。
 */
export interface MaterialUnitConversion {
  id: number
  material_id: number
  from_unit_id: number
  to_unit_id: number
  factor: string
  created_at: string
  updated_at: string
}

export interface CreateMaterialUnitConversionInput {
  from_unit_id: number
  to_unit_id: number
  factor: string
}

export type UpdateMaterialUnitConversionInput = CreateMaterialUnitConversionInput

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

/** 预留单生命周期状态：仍有未处理数量时为 active，全部释放/消耗后为 closed */
export type ReservationStatus = 'active' | 'closed'

/** 预留单关闭原因，后端在 status=closed 时必填 */
export type ReservationCloseReason = 'consumed' | 'released' | 'mixed' | 'cancelled' | 'expired'

/**
 * 预留单在库存层上的 FIFO 分配明细（`GET /inventory/reservations/:id`）。
 *
 * `received_at` 来自库存层；库存层缺失时为 null（后端 LEFT JOIN）。
 */
export interface ReservationItem {
  id: number
  reservation_id: number
  stock_layer_id: number
  batch_id: number | null
  received_at: string | null
  reserved_qty: string
  released_qty: string
  consumed_qty: string
  remaining_qty: string
  created_at: string
  updated_at: string
}

/**
 * 库存预留单（`GET /inventory/reservations`）。
 *
 * 与 `StockBalance` 一样，`warehouse` / `sku` 是 `*Reference + omitempty`，
 * 主数据被软删除后字段可能整体缺失，需要回退展示 ID。
 * `items` 只在详情接口返回。
 */
export interface Reservation {
  id: number
  warehouse_id: number
  warehouse?: Reference
  sku_id: number
  sku?: Reference
  total_qty: string
  released_qty: string
  consumed_qty: string
  remaining_qty: string
  status: ReservationStatus
  close_reason: ReservationCloseReason | null
  idempotency_key: string
  source_type: string | null
  source_id: string | null
  source_line_id: string | null
  actor_type: 'admin' | 'api_app' | null
  actor_id: number | null
  actor_label: string | null
  created_at: string
  updated_at: string
  /** 仅在详情接口返回 */
  items?: ReservationItem[]
}

/**
 * 库存流水的操作类型（`inventory_movements.operation_type`）。
 *
 * 取值受后端 CHECK 约束与 `normalizeListMovementsFilter` 双重限制，
 * 前端的中文映射以这份联合类型为准（见 `features/inventory/movement-list.ts`）。
 */
export type MovementOperationType =
  'increase' | 'reserve' | 'release_reserved' | 'decrease_available' | 'decrease_reserved'

/**
 * 库存流水（`GET /inventory/movements`）。
 *
 * 与预留单不同，后端 `inventory.Movement` **不内联** `warehouse` / `sku` 引用，
 * 只给 ID，因此仓库 / SKU 名称要由筛选下拉的选项表反查，取不到时回退 `#id`。
 *
 * 可空字段与后端指针一一对应（字段本身始终存在，值为 null）：
 * 批次、库存层、预留单与来源在部分操作类型下没有对应实体。
 * `qty` 是 `NUMERIC(20,6)` 的字符串形式，方向由 `operation_type` 决定，前端不做浮点运算。
 */
export interface InventoryMovement {
  id: number
  operation_type: MovementOperationType
  warehouse_id: number
  sku_id: number
  batch_id: number | null
  stock_layer_id: number | null
  reservation_id: number | null
  reservation_item_id: number | null
  qty: string
  idempotency_key: string
  source_type: string | null
  source_id: string | null
  source_line_id: string | null
  actor_type: 'admin' | 'api_app' | null
  actor_id: number | null
  actor_label: string | null
  created_at: string
}

/**
 * 创建入参（`POST /xxx`）。
 *
 * 与下面的 `Update*Input` 不同：创建时可空字段**可以省略**（后端是可空指针，省略即空），
 * 而更新是**全量替换**，可空字段必须显式传 `null`（见 `Update*Input` 的说明）。
 */
export interface CreateUnitInput {
  code: string
  name: string
  symbol: string
  unit_type: Unit['unit_type']
  precision: number
  status: EntityStatus
}

export interface CreateCategoryInput {
  code: string
  name: string
  parent_id?: number
  status: EntityStatus
  remark?: string
}

export interface CreateMaterialInput {
  code: string
  name: string
  category_id: number
  base_unit_id: number
  status: EntityStatus
  remark?: string
}

export interface CreateSkuInput {
  material_id: number
  code: string
  name: string
  unit_id: number
  status: EntityStatus
  remark?: string
}

export interface CreateWarehouseInput {
  code: string
  name: string
  type: Warehouse['type']
  status: EntityStatus
  location?: string
  contact_name?: string
  contact_phone?: string
  remark?: string
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

/** 外部系统（API 应用）状态 */
export type APIAppStatus = 'active' | 'inactive'

/** 密钥状态：active=启用，blocked=已禁用 */
export type APISecretStatus = 'active' | 'blocked'

/**
 * 外部系统（`GET /auth/apps`）。
 *
 * `app_id` 是对外公开标识，与密钥一起通过请求头认证；`metadata` 目前不由页面编辑，
 * 编辑应用时原样回传，避免全量更新把已有值清空。
 */
export interface APIApp {
  id: number
  app_id: string
  name: string
  description: string | null
  status: APIAppStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** API 密钥（`GET /auth/apps/:id/secrets`）；后端不返回 `secret_hash` */
export interface APISecret {
  id: number
  api_app_id: number
  secret_id: string
  name: string
  status: APISecretStatus
  bound_metadata: Record<string, unknown>
  expires_at: string | null
  last_used_at: string | null
  created_at: string
  updated_at: string
}

/**
 * 签发/重新签发的响应。
 *
 * `secret` 是明文，只在这一次响应中出现；页面关闭弹窗后不能再次获取。
 */
export interface IssuedAPISecret extends APISecret {
  secret: string
}

export type APIAppListResult = ListResult<APIApp>

export interface APISecretListResult {
  items: APISecret[]
}

export interface CreateAPIAppInput {
  name: string
  description?: string | null
  status: APIAppStatus
  metadata?: Record<string, unknown>
}

/** `PUT` 是全量替换：`metadata` 必须回传当前值 */
export interface UpdateAPIAppInput {
  name: string
  description: string | null
  status: APIAppStatus
  metadata: Record<string, unknown>
}

export interface IssueAPISecretInput {
  name: string
  bound_metadata?: Record<string, unknown>
  expires_at?: string | null
}

export interface UpdateAPISecretInput {
  name: string
  expires_at: string | null
}

export type ReissueAPISecretInput = UpdateAPISecretInput

/** 审计日志的认证方式；ambiguous 表示同时带了 Cookie 和 API 请求头 */
export type AuditAuthMethod = 'admin_session' | 'api_app' | 'none' | 'ambiguous'

export type AuditActorType = 'admin' | 'api_app'

/** 单条请求审计日志（`GET /audit/logs`）；不包含请求/响应体与密钥 */
export interface AuditLog {
  id: number
  occurred_at: string
  trace_id: string
  method: string
  path: string
  route?: string
  status_code: number
  latency_ms: number
  auth_method: AuditAuthMethod
  actor_type?: AuditActorType
  actor_id?: number
  actor_label?: string
  credential_id?: string
  client_ip?: string
  user_agent?: string
  error_code?: string
  request_bytes: number
  response_bytes: number
}

/** 审计日志使用游标分页：不返回 total，避免对长时间范围做 COUNT(*) */
export interface AuditLogListResult {
  items: AuditLog[]
  next_cursor?: string
}
