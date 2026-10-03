/**
 * 业务错误码 → 中文文案。
 *
 * key 是后端 `pkg/apperr/codes.go` 的错误码，是本文件与后端之间**唯一的契约**：
 * 后端可以自由修改英文 message，只要不改错误码，这里的文案就继续生效。
 * 未命中的码回退到后端 message（见 `getErrorMessage`），不会吞掉信息。
 *
 * 新增后端错误码时，在这里补一条即可；不补也能正常展示（回退英文原文）。
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // 认证与授权
  AUTH_INVALID_CREDENTIALS: '用户名或密码错误',
  AUTH_REQUIRED: '登录已过期，请重新登录',
  AUTH_SESSION_EXPIRED: '登录已过期，请重新登录',
  AUTH_AMBIGUOUS_METHOD: '请求同时使用了两种认证方式，请只保留一种',
  AUTH_PASSWORD_CHANGE_REQUIRED: '请先修改初始密码后再继续',
  AUTH_RATE_LIMITED: '登录尝试过于频繁，请稍后再试',
  AUTH_API_APP_NOT_FOUND: '应用不存在',
  AUTH_API_SECRET_NOT_FOUND: '密钥不存在',
  AUTH_API_APP_DUPLICATE: '应用标识已存在，请更换后重试',
  AUTH_API_SECRET_DUPLICATE: '密钥标识已存在，请更换后重试',

  // 仓库
  WAREHOUSE_NOT_FOUND: '仓库不存在',
  WAREHOUSE_CODE_DUPLICATE: '编码已存在，请更换后重试',
  WAREHOUSE_REFERENCED_BY_INVENTORY: '已被库存引用，无法删除',

  // SKU
  SKU_NOT_FOUND: 'SKU 不存在',
  SKU_CODE_DUPLICATE: '编码已存在，请更换后重试',
  SKU_ACTIVE_EXISTS_FOR_MATERIAL: '该物料已存在启用的 SKU',
  SKU_REFERENCED_BY_INVENTORY: '已被库存引用，无法删除',
  SKU_MATERIAL_NOT_FOUND: '所选物料不存在',
  SKU_UNIT_NOT_FOUND: '所选单位不存在',
  SKU_UNIT_NOT_ALLOWED: '该单位不适用于此物料，请先维护单位换算',

  // 计量单位
  MATERIAL_UNIT_NOT_FOUND: '单位不存在',
  MATERIAL_UNIT_CODE_DUPLICATE: '编码已存在，请更换后重试',

  // 物料分类
  MATERIAL_CATEGORY_NOT_FOUND: '物料分类不存在',
  MATERIAL_CATEGORY_CODE_DUPLICATE: '编码已存在，请更换后重试',
  MATERIAL_CATEGORY_PARENT_NOT_FOUND: '所选上级分类不存在',

  // 物料
  MATERIAL_NOT_FOUND: '物料不存在',
  MATERIAL_CODE_DUPLICATE: '编码已存在，请更换后重试',
  MATERIAL_CATEGORY_REFERENCE_INVALID: '所选分类不存在',
  MATERIAL_BASE_UNIT_REFERENCE_INVALID: '所选基本单位不存在',

  // 物料单位换算
  MATERIAL_CONVERSION_NOT_FOUND: '单位换算不存在',
  MATERIAL_CONVERSION_DUPLICATE: '该单位换算已存在',
  MATERIAL_CONVERSION_REVERSE_DUPLICATE:
    '已存在方向相反的换算关系（换算方向固定为基础单位 → 另一单位）',
  MATERIAL_CONVERSION_MATERIAL_INVALID: '所选物料不存在',
  MATERIAL_CONVERSION_FROM_UNIT_INVALID: '所选来源单位不存在',
  MATERIAL_CONVERSION_TO_UNIT_INVALID: '所选目标单位不存在',
  MATERIAL_CONVERSION_UNIT_TYPE_MISMATCH:
    '两个单位类型不可互算，请选择同类型单位（包装与计数除外）',
  MATERIAL_CONVERSION_BASE_UNIT_REQUIRED: '换算必须有一端是物料的基础单位',

  // 库存
  INVENTORY_STOCK_NOT_FOUND: '库存记录不存在',
  INVENTORY_WAREHOUSE_NOT_FOUND: '所选仓库不存在',
  INVENTORY_SKU_NOT_FOUND: '所选 SKU 不存在',
  INVENTORY_BATCH_NOT_FOUND: '所选批次不存在',
}
