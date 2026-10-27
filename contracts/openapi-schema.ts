/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ============================================================================
 * 后端契约快照（生成物）
 * ============================================================================
 *
 * 来源：../stock-flow/openapi/swagger.json
 *       （该文件由后端 `make swagger` 从 Go handler 的 swag 注解生成）
 * 生成：pnpm api:generate
 * 校验：pnpm api:verify          —— CI 的 contract job 会执行；快照与后端契约
 *                                  不一致时失败并打印 diff
 *
 * 定位：本文件只用于发现"后端契约漂移"，不是前端的业务类型真源。
 *       - 禁止手工编辑（每次生成都会被整体覆盖）
 *       - 禁止在业务代码中 import（前端实际使用的类型在 src/types/api.ts，
 *         端点声明在 src/api/auth.ts、src/api/resources.ts，均由人工维护）
 *
 * 为什么不能直接用它当业务类型：swag 不产出 required，因此这里所有字段都是
 * optional，直接采用会把 entity.id 变成 number | undefined。
 * ============================================================================
 */

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export enum WarehouseType {
  TypeNormal = "normal",
  TypeVirtual = "virtual",
}

export enum WarehouseStatus {
  StatusActive = "active",
  StatusInactive = "inactive",
}

export enum UnitUnitType {
  UnitTypeCount = "count",
  UnitTypeWeight = "weight",
  UnitTypeLength = "length",
  UnitTypeArea = "area",
  UnitTypeVolume = "volume",
  UnitTypePackage = "package",
  UnitTypeTime = "time",
  UnitTypeOther = "other",
}

export enum UnitStatus {
  StatusActive = "active",
  StatusInactive = "inactive",
}

export enum SkuStatus {
  StatusActive = "active",
  StatusInactive = "inactive",
}

export enum MaterialStatus {
  StatusActive = "active",
  StatusInactive = "inactive",
}

export enum CategoryStatus {
  StatusActive = "active",
  StatusInactive = "inactive",
}

export enum AuthStatus {
  StatusActive = "active",
  StatusInactive = "inactive",
}

export enum AuthSecretStatus {
  SecretStatusActive = "active",
  SecretStatusBlocked = "blocked",
}

export interface AuthAPIApp {
  app_id?: string;
  created_at?: string;
  description?: string;
  id?: number;
  metadata?: AuthMetadata;
  name?: string;
  status?: AuthStatus;
  updated_at?: string;
}

export interface AuthAPIAppListResult {
  items?: AuthAPIApp[];
  limit?: number;
  offset?: number;
}

export interface AuthAPISecret {
  api_app_id?: number;
  bound_metadata?: AuthMetadata;
  created_at?: string;
  expires_at?: string;
  id?: number;
  last_used_at?: string;
  name?: string;
  secret_id?: string;
  status?: AuthSecretStatus;
  updated_at?: string;
}

export interface AuthAPISecretListResponse {
  items?: AuthAPISecret[];
}

export interface AuthAdminIdentity {
  id?: number;
  must_change_password?: boolean;
  username?: string;
}

export interface AuthChangePasswordRequest {
  current_password?: string;
  new_password?: string;
}

export interface AuthCreateAPIAppRequest {
  description?: string;
  metadata?: AuthMetadata;
  name?: string;
  status?: AuthStatus;
}

export interface AuthIssueAPISecretRequest {
  bound_metadata?: AuthMetadata;
  expires_at?: string;
  name?: string;
}

export interface AuthIssuedSecret {
  api_app_id?: number;
  bound_metadata?: AuthMetadata;
  created_at?: string;
  expires_at?: string;
  id?: number;
  last_used_at?: string;
  name?: string;
  secret?: string;
  secret_id?: string;
  status?: AuthSecretStatus;
  updated_at?: string;
}

export interface AuthLoginRequest {
  password?: string;
  username?: string;
}

export interface AuthLoginResponse {
  admin?: AuthAdminIdentity;
  expires_at?: string;
}

export type AuthMetadata = Record<string, any>;

export interface AuthUpdateAPIAppRequest {
  description?: string;
  metadata?: AuthMetadata;
  name?: string;
  status?: AuthStatus;
}

export interface CategoryCategory {
  code?: string;
  created_at?: string;
  id?: number;
  name?: string;
  parent_id?: number;
  remark?: string;
  status?: CategoryStatus;
  updated_at?: string;
}

export interface CategoryCategoryListResult {
  items?: CategoryCategory[];
  limit?: number;
  offset?: number;
}

export interface CategoryCreateCategoryRequest {
  code?: string;
  name?: string;
  parent_id?: number;
  remark?: string;
  status?: CategoryStatus;
}

export interface CategoryUpdateCategoryRequest {
  code?: string;
  name?: string;
  parent_id?: number;
  remark?: string;
  status?: CategoryStatus;
}

export interface ConversionCreateConversionRequest {
  /** @example "1.000000" */
  factor?: string;
  from_unit_id?: number;
  to_unit_id?: number;
}

export interface ConversionListResult {
  items?: ConversionMaterialUnitConversion[];
  limit?: number;
  offset?: number;
}

export interface ConversionMaterialUnitConversion {
  created_at?: string;
  factor?: string;
  from_unit_id?: number;
  id?: number;
  material_id?: number;
  to_unit_id?: number;
  updated_at?: string;
}

export interface ConversionUpdateConversionRequest {
  /** @example "1.000000" */
  factor?: string;
  from_unit_id?: number;
  to_unit_id?: number;
}

export interface HealthStatusResponse {
  service?: string;
  status?: string;
}

export interface InventoryLayerListResult {
  items?: InventoryStockLayer[];
  limit?: number;
  offset?: number;
}

export interface InventoryMovement {
  actor_id?: number;
  actor_label?: string;
  actor_type?: string;
  batch_id?: number;
  created_at?: string;
  id?: number;
  idempotency_key?: string;
  operation_type?: string;
  qty?: string;
  reservation_id?: number;
  reservation_item_id?: number;
  sku_id?: number;
  source_id?: string;
  source_line_id?: string;
  source_type?: string;
  stock_layer_id?: number;
  warehouse_id?: number;
}

export interface InventoryMovementListResult {
  items?: InventoryMovement[];
  limit?: number;
  offset?: number;
}

export interface InventoryMovementRef {
  id?: number;
  qty?: string;
  stock_layer_id?: number;
}

export interface InventoryReservation {
  actor_id?: number;
  actor_label?: string;
  actor_type?: string;
  close_reason?: string;
  consumed_qty?: string;
  created_at?: string;
  id?: number;
  idempotency_key?: string;
  /** Items 只在详情接口返回，列表接口不携带分配明细。 */
  items?: InventoryReservationItem[];
  released_qty?: string;
  remaining_qty?: string;
  sku?: SkuReference;
  sku_id?: number;
  source_id?: string;
  source_line_id?: string;
  source_type?: string;
  status?: string;
  total_qty?: string;
  updated_at?: string;
  warehouse?: WarehouseReference;
  warehouse_id?: number;
}

export interface InventoryReservationAllocation {
  batch_id?: number;
  qty?: string;
  reservation_item_id?: number;
  stock_layer_id?: number;
}

export interface InventoryReservationItem {
  batch_id?: number;
  consumed_qty?: string;
  created_at?: string;
  id?: number;
  received_at?: string;
  released_qty?: string;
  remaining_qty?: string;
  reservation_id?: number;
  reserved_qty?: string;
  stock_layer_id?: number;
  updated_at?: string;
}

export interface InventoryReservationListResult {
  items?: InventoryReservation[];
  limit?: number;
  offset?: number;
}

export interface InventoryReservationSnapshot {
  allocations?: InventoryReservationAllocation[];
  close_reason?: string;
  consumed_qty?: string;
  id?: number;
  released_qty?: string;
  remaining_qty?: string;
  status?: string;
  total_qty?: string;
}

export interface InventoryStockBalance {
  available_qty?: string;
  layers?: InventoryStockLayer[];
  on_hand_qty?: string;
  reserved_qty?: string;
  sku?: SkuReference;
  sku_id?: number;
  updated_at?: string;
  warehouse?: WarehouseReference;
  warehouse_id?: number;
}

export interface InventoryStockLayer {
  available_qty?: string;
  batch_id?: number;
  created_at?: string;
  id?: number;
  on_hand_qty?: string;
  received_at?: string;
  reserved_qty?: string;
  sku?: SkuReference;
  sku_id?: number;
  updated_at?: string;
  warehouse?: WarehouseReference;
  warehouse_id?: number;
}

export interface InventoryStockListResult {
  items?: InventoryStockBalance[];
  limit?: number;
  offset?: number;
}

export interface InventoryStockOperationResult {
  batch_id?: number;
  movements?: InventoryMovementRef[];
  operation_type?: string;
  qty?: string;
  reservation?: InventoryReservationSnapshot;
  sku_id?: number;
  stock_after?: InventoryStockQuantities;
  warehouse_id?: number;
}

export interface InventoryStockQuantities {
  available_qty?: string;
  on_hand_qty?: string;
  reserved_qty?: string;
}

export interface InventoryDecreaseStockHTTPRequest {
  batch_id?: number;
  idempotency_key?: string;
  qty?: string;
  reservation_id?: number;
  sku_id?: number;
  source_id?: string;
  source_line_id?: string;
  source_type?: string;
  warehouse_id?: number;
}

export interface InventoryIncreaseStockHTTPRequest {
  batch_id?: number;
  idempotency_key?: string;
  qty?: string;
  sku_id?: number;
  source_id?: string;
  source_line_id?: string;
  source_type?: string;
  warehouse_id?: number;
}

export interface InventoryReleaseStockHTTPRequest {
  idempotency_key?: string;
  qty?: string;
  reservation_id?: number;
  sku_id?: number;
  source_id?: string;
  source_line_id?: string;
  source_type?: string;
  warehouse_id?: number;
}

export interface InventoryReserveStockHTTPRequest {
  batch_id?: number;
  idempotency_key?: string;
  qty?: string;
  sku_id?: number;
  source_id?: string;
  source_line_id?: string;
  source_type?: string;
  warehouse_id?: number;
}

export interface MaterialCreateMaterialRequest {
  base_unit_id?: number;
  category_id?: number;
  code?: string;
  name?: string;
  remark?: string;
  status?: MaterialStatus;
}

export interface MaterialListResult {
  items?: MaterialMaterial[];
  limit?: number;
  offset?: number;
}

export interface MaterialMaterial {
  base_unit_id?: number;
  category_id?: number;
  code?: string;
  created_at?: string;
  id?: number;
  name?: string;
  remark?: string;
  status?: MaterialStatus;
  updated_at?: string;
}

export interface MaterialUpdateMaterialRequest {
  base_unit_id?: number;
  category_id?: number;
  code?: string;
  name?: string;
  remark?: string;
  status?: MaterialStatus;
}

export interface ResponseBody {
  code?: number;
  data?: any;
  /** ErrorCode 是稳定的业务错误码（见 pkg/apperr）。成功响应与无业务身份的错误不出现。 */
  error_code?: string;
  message?: string;
  timestamp?: number;
  trace_id?: string;
}

export interface SkuCreateSKURequest {
  code?: string;
  material_id?: number;
  name?: string;
  remark?: string;
  status?: SkuStatus;
  unit_id?: number;
}

export interface SkuListResult {
  items?: SkuSKU[];
  limit?: number;
  offset?: number;
}

export interface SkuReference {
  code?: string;
  deleted?: boolean;
  id?: number;
  name?: string;
}

export interface SkuSKU {
  code?: string;
  created_at?: string;
  id?: number;
  material_id?: number;
  name?: string;
  remark?: string;
  status?: SkuStatus;
  unit_id?: number;
  updated_at?: string;
}

export interface SkuUpdateSKURequest {
  code?: string;
  material_id?: number;
  name?: string;
  remark?: string;
  status?: SkuStatus;
  unit_id?: number;
}

export interface UnitCreateUnitRequest {
  code?: string;
  name?: string;
  precision?: number;
  status?: UnitStatus;
  symbol?: string;
  unit_type?: UnitUnitType;
}

export interface UnitUnit {
  code?: string;
  created_at?: string;
  id?: number;
  name?: string;
  precision?: number;
  status?: UnitStatus;
  symbol?: string;
  unit_type?: UnitUnitType;
  updated_at?: string;
}

export interface UnitUnitListResult {
  items?: UnitUnit[];
  limit?: number;
  offset?: number;
}

export interface UnitUpdateUnitRequest {
  code?: string;
  name?: string;
  precision?: number;
  status?: UnitStatus;
  symbol?: string;
  unit_type?: UnitUnitType;
}

export interface WarehouseCreateWarehouseRequest {
  code?: string;
  contact_name?: string;
  contact_phone?: string;
  location?: string;
  name?: string;
  remark?: string;
  status?: WarehouseStatus;
  type?: WarehouseType;
}

export interface WarehouseListResult {
  items?: WarehouseWarehouse[];
  limit?: number;
  offset?: number;
}

export interface WarehouseReference {
  code?: string;
  deleted?: boolean;
  id?: number;
  name?: string;
}

export interface WarehouseUpdateWarehouseRequest {
  code?: string;
  contact_name?: string;
  contact_phone?: string;
  location?: string;
  name?: string;
  remark?: string;
  status?: WarehouseStatus;
  type?: WarehouseType;
}

export interface WarehouseWarehouse {
  code?: string;
  contact_name?: string;
  contact_phone?: string;
  created_at?: string;
  id?: number;
  location?: string;
  name?: string;
  remark?: string;
  status?: WarehouseStatus;
  type?: WarehouseType;
  updated_at?: string;
}
