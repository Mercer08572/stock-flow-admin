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

/**
 * 后端内联的引用实体快照（仓库 / SKU / 物料 / 单位 / 分类）。
 *
 * `deleted` 来自引用表的 `deleted_at`；`status` 只在后端本次查询选出该列时存在，
 * 缺失表示「未查」，不能当成「已停用」。
 */
export interface Reference {
  id: number
  code: string
  name: string
  deleted: boolean
  status?: EntityStatus
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
  /** 两端单位的内联快照（列表 / 详情接口返回，写入接口不返回） */
  from_unit?: Reference
  to_unit?: Reference
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
  /** 分类与基础单位的内联快照（列表 / 详情接口返回，写入接口不返回） */
  category?: Reference
  base_unit?: Reference
}

export interface SKU extends BaseEntity {
  material_id: number
  unit_id: number
  remark?: string
  /** 物料与单位的内联快照（列表 / 详情接口返回，写入接口不返回） */
  material?: Reference
  unit?: Reference
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

/** 批次状态：active 参与常规流转，inactive 表示停用（禁止入库、退出自动分配） */
export type BatchStatus = 'active' | 'inactive'

/**
 * 库存批次（`GET /inventory/batches`）。
 *
 * 批次是 SKU 级主数据：没有数量字段，也没有 warehouse_id；
 * 批次库存要按 `batch_id` 到库存层上过滤（见 `BatchWarehouseStock`）。
 * `production_date` / `expiration_date` 是日历日，固定 `YYYY-MM-DD`。
 */
export interface InventoryBatch {
  id: number
  sku_id: number
  /** 后端为 *Reference + omitempty：SKU 被软删除后字段仍保留并标记 deleted */
  sku?: Reference
  batch_no: string
  first_received_at: string | null
  production_date: string | null
  expiration_date: string | null
  status: BatchStatus
  /** 出库优先级：越小越先出，10 为默认；非批次库存层按 10 参与排序 */
  dispatch_priority: number
  remark: string | null
  created_at: string
  updated_at: string
}

/** 某批次在单个仓库的库存分布（由库存层按 batch_id 聚合得到） */
export interface BatchWarehouseStock {
  warehouse_id: number
  warehouse?: Reference
  on_hand_qty: string
  reserved_qty: string
  available_qty: string
  layer_count: number
}

/** 批次详情：主数据 + 按仓库聚合的库存分布 */
export interface InventoryBatchDetail extends InventoryBatch {
  stocks: BatchWarehouseStock[]
}

export interface CreateBatchInput {
  sku_id: number
  batch_no: string
  production_date?: string | null
  expiration_date?: string | null
  status?: BatchStatus
  dispatch_priority?: number | null
  remark?: string | null
}

/** 编辑批次：sku_id / batch_no 不可改；省略 status / dispatch_priority 时后端保留原值 */
export interface UpdateBatchInput {
  production_date?: string | null
  expiration_date?: string | null
  status?: BatchStatus
  dispatch_priority?: number | null
  remark?: string | null
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
 * 仓库 / SKU 引用由后端 JOIN 内联（`warehouse` / `sku`），名称不需要前端再按 ID 反查。
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
  warehouse?: Reference
  sku?: Reference
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
  /** 请求追踪 ID；历史流水为 null，可通过它关联审计日志 */
  trace_id?: string | null
  created_at: string
}

/**
 * 库存变更接口（`POST /inventory/{increase,reserve,decrease,release}`）的统一返回体。
 *
 * 数量字段全部是 `NUMERIC(20,6)` 的字符串形式，前端只做展示、不做浮点运算。
 * `operation_type` 是后端实际执行的操作：`/inventory/decrease` 带 `reservation_id`
 * 时返回 `decrease_reserved`，不带时返回 `decrease_available`。
 */
export interface StockQuantities {
  on_hand_qty: string
  reserved_qty: string
  available_qty: string
}

/** 一次变更写入的库存流水引用（明细可通过库存流水页查询） */
export interface MovementRef {
  id: number
  stock_layer_id: number | null
  qty: string
}

/** 预留单在库存层上的分配明细快照 */
export interface ReservationAllocation {
  reservation_item_id: number
  stock_layer_id: number
  batch_id: number | null
  qty: string
}

/** 变更操作返回的预留单快照；仅预留类操作返回 */
export interface ReservationSnapshot {
  id: number
  status: ReservationStatus
  close_reason: ReservationCloseReason | null
  total_qty: string
  released_qty: string
  consumed_qty: string
  remaining_qty: string
  allocations: ReservationAllocation[]
}

export interface StockOperationResult {
  operation_type: MovementOperationType
  warehouse_id: number
  sku_id: number
  batch_id: number | null
  qty: string
  stock_after: StockQuantities
  reservation?: ReservationSnapshot
  movements: MovementRef[]
}

/**
 * 库存变更请求体。
 *
 * 仅「API 测试」开发调试页使用；生产页面不直接调用变更接口（库存对管理端是只读资源）。
 * `batch_id` / `reservation_id` / 来源字段可省略；`qty` 仅在预留释放时可以省略
 * （省略表示释放该预留单的全部剩余）。
 */
export interface InventoryOperationInput {
  warehouse_id: number
  sku_id: number
  batch_id?: number
  reservation_id?: number
  qty?: string
  idempotency_key: string
  source_type?: string
  source_id?: string
  source_line_id?: string
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

// ---------------------------------------------------------------------------
// 工作台趋势统计
// ---------------------------------------------------------------------------

/** 趋势统计的时间桶粒度 */
export type StatsGranularity = 'hour' | 'day'

/**
 * 库存操作趋势（`GET /inventory/movements/stats`）。
 *
 * `buckets` 与每条 `series.calls` 等长：无数据的时间桶由后端补 0，
 * 前端不应再假设"缺项代表 0"，否则折线会在空档处画出不存在的趋势。
 *
 * 计数口径是 `count(DISTINCT idempotency_key)`，即**成功**的库存操作次数：
 * 一次请求跨批次 FIFO 分配时会写多行 movement，不能按行数统计。
 */
export interface MovementStatsSeries {
  operation_type: MovementOperationType
  calls: number[]
}

export interface MovementStats {
  granularity: StatsGranularity
  timezone: string
  from: string
  to: string
  buckets: string[]
  series: MovementStatsSeries[]
}

/** 库存接口吞吐与失败率（`GET /audit/stats`） */
export interface ApiThroughputStats {
  granularity: StatsGranularity
  timezone: string
  from: string
  to: string
  buckets: string[]
  total: number[]
  failed: number[]
  /** 与 buckets 等长；空桶为 0，不是 NaN */
  failure_rate: number[]
}
