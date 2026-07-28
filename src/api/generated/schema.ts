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
