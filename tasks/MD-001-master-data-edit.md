# MD-001 主数据编辑

Status: Done

## Context

五类主数据（计量单位 / 物料分类 / 物料 / SKU / 仓库）目前只支持「查 + 增」：
`src/features/master-data/MasterDataListView.vue` 的抽屉只有新增模式，
`src/api/resources.ts` 只有 `createXxx` 与 `listXxx`，没有 `GET /:id` 与 `PUT /:id`。
后端契约侧这些端点**全部存在**（`GET`/`PUT /units/{id}`、`/material-categories/{id}`、
`/materials/{id}`、`/skus/{id}`、`/warehouses/{id}`），前端只是没接。

### 关键约束（已核对后端实现，直接影响实现方式）

1. **`PUT` 是全量替换，不是局部更新。**
   `internal/material/unit/unit_handler.go` 的 `UpdateUnitRequest` 字段全为非指针
   （`Code string` / `Precision int32` / …），且**没有 `binding:"required"`**，
   校验在 service 层做。因此漏发的字段会以 Go 零值落库 —— 例如编辑时只发 `name`，
   `precision` 会被写成 **0**。
   → 编辑抽屉**必须**先 `GET /:id` 预填全部字段，提交时把全部字段一起发出。
2. **`remark` 是 `*string`，可清空。**
   `normalizeRemark` / `normalizeOptionalText` 把 `nil` 与 trim 后的 `""` 都归一化为 `nil`。
   因此发 `remark: ""` 等于清空备注，这是期望行为（备注字段留空即清空）。
3. **409 是编码重复。** 后端 `ErrDuplicateCode` → `http.StatusConflict` + `response.CodeConflict`（**1009**），
   `message` 是**英文原文**，形如 `unit code already exists` / `warehouse code already exists`。
   前端要给出中文提示只能按 `code === 1009` + 关键词映射（决策点 D8 已定：采纳此方式）。

## Scope

- `src/api/resources.ts` 为 5 类资源各补 2 个方法（共 10 个）：
  - `getUnit(id)` / `updateUnit(id, body)`
  - `getCategory(id)` / `updateCategory(id, body)`
  - `getMaterial(id)` / `updateMaterial(id, body)`
  - `getSku(id)` / `updateSku(id, body)`
  - `getWarehouse(id)` / `updateWarehouse(id, body)`
- `src/types/api.ts` 补 5 个更新入参类型（`UpdateUnitInput` 等），
  即对应实体去掉 `id` / `created_at` / `updated_at` 后的形态。
- `src/api/error.ts` 增加错误明细读取与 409 中文映射：
  - `getErrorDetail(error)` → `{ message: string; traceId?: string }`
  - `getConflictMessage(error)` → 命中 `status === 409` 或 `code === 1009` 时按关键词映射为中文，否则回退到原文
  - （`getErrorDetail` 由 `SHR-001` 引入，本任务复用）
- `MasterDataListView.vue`：
  - 抽屉支持 `create | edit` 双模式（共用 `fields` 配置渲染表单）
  - 编辑：`GET /:id` 预填全部字段 → `PUT /:id` 提交全部字段
  - 表格新增行操作列：「编辑」
  - 加载态：`GET /:id` 期间抽屉内显示 loading，避免用户看到空表单直接提交
  - 409 提示走 `getConflictMessage`
  - 成功后关闭抽屉并刷新列表
- 单测：`MasterDataListView` 的编辑预填与提交载荷（vitest + `@vue/test-utils`）。
- e2e：编辑一条计量单位并断言列表刷新（`page.route()` 造桩，见 Verification）。

## Out Of Scope

- 不做删除（`MD-002`）、不做仓库停用（`WH-001`）。
- 不改后端、不改后端接口、不改 `contracts/openapi-schema.ts`。
- 不引入新的表单校验库（继续用现有 `fields` 配置 + 手写必填校验）。
- 不做「行内编辑」或批量编辑。
- 不做乐观更新（保持「提交 → 刷新列表」的现行模式）。
- 不把 `parent_id` / `category_id` / `base_unit_id` / `material_id` / `unit_id` 这类
  外键输入改成下拉选择（当前是数字输入，改动属 INV-001 之外的独立任务）。

## API Contract

| 方法  | 路径                                                                                            | 说明                                                                 |
| ----- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET` | `/units/{id}`、`/material-categories/{id}`、`/materials/{id}`、`/skus/{id}`、`/warehouses/{id}` | 取单条，用于预填；404 → `CodeNotFound`                               |
| `PUT` | 同上                                                                                            | 全量替换；请求体字段与 `POST` 创建请求一致（`UpdateUnitRequest` 等） |

响应统一为 `{ code, message, data, trace_id, timestamp }`，`data` 为更新后的实体。

更新请求体字段：

- units：`code` / `name` / `symbol` / `unit_type` / `precision` / `status`
- categories：`code` / `name` / `parent_id` / `remark` / `status`
- materials：`code` / `name` / `category_id` / `base_unit_id` / `remark` / `status`
- skus：`code` / `name` / `material_id` / `unit_id` / `remark` / `status`
- warehouses：`code` / `name` / `type` / `status` / `location` / `contact_name` / `contact_phone` / `remark`

错误码：

- 400 `CodeBadRequest`（1001）：校验失败，`message` 为英文原文
- 404 `CodeNotFound`：记录不存在
- 409 `CodeConflict`（1009）：`xxx code already exists`
- 401 `CodeUnauthorized`（1002）：会话失效

## Acceptance Criteria

- [ ] 5 类资源均可在列表行上点「编辑」，抽屉打开且**全部字段已预填**（含 `precision`、`type` 等）
- [ ] 修改后保存，列表刷新并显示新值；`precision` 等数值字段不会被写成 0
- [ ] 必填校验不通过时不发请求，给出中文提示
- [ ] 编码改成已存在的编码时，提示为**中文**「编码已存在」（而不是 `xxx code already exists`）
- [ ] 备注清空后保存，重新打开编辑抽屉时备注为空
- [ ] 404（记录已被删除）给出明确提示且不破坏页面
- [ ] 加载 / 空 / 错误 / 成功四态齐全，错误态含 traceId
- [ ] 编辑预填与提交载荷有单元测试
- [ ] e2e 覆盖「打开编辑 → 改字段 → 保存 → 列表刷新」
- [ ] `pnpm check` 通过
- [ ] `pnpm test:e2e` 通过
- [ ] 320 px 与桌面宽度下抽屉与表单可用

## Verification

```bash
cd stock-flow-admin
pnpm run check
pnpm run test:e2e
rm -rf ../.pnpm-store && ls -d ../.pnpm-store 2>/dev/null || echo "工作区干净"
```

e2e 用 `page.route('**/api/v1/**')` 造桩（决策点 D10）：
`/auth/admin/me` 返回已登录管理员以通过路由守卫，列表接口返回固定数据，
`GET /:id` 返回待编辑实体，`PUT /:id` 捕获请求体并断言字段齐全。

手工验证（需后端 + 数据库可用时）：

1. 任一主数据页点「编辑」，确认抽屉字段全部预填。
2. 只改「名称」后保存，重新打开编辑，确认「精度 / 类型 / 状态」等字段**未被清空**。
3. 把编码改成同表已有编码，确认提示为中文。

## 备注

- 命令必须用**裸 `pnpm`**（`--config.store-dir` 在本机 pnpm 11 自举阶段会失败）。
- 本任务不涉及 `../stock-flow/`。

## 验证记录（2026-09-29 实测）

- **实现方式**：把表单的纯逻辑抽到 `src/features/master-data/master-data-form.ts`
  （`createEmptyForm` / `fillForm` / `findMissingRequired` / `buildPayload`），
  视图只负责编排。这样「PUT 全量替换」这条规则可以被直接断言，不必挂载整个组件。
- `src/features/master-data/master-data-form.test.ts`：11 个用例，覆盖
  空表单默认值、`GET /:id` 预填、缺失可空字段的回退、`0` 不被当作空值、
  以及 `buildPayload` 必含全部字段 / 空可选项发 `null` / 必填留空不发该键。
- `src/api/error.test.ts`：7 个用例，覆盖 409 关键词映射（编码重复、被库存引用）、
  未命中时回退原文、非 409 错误不受影响。
- `tests/master-data.spec.ts`「edits a unit with every field prefilled and submitted」：
  断言抽屉预填 `KG` / `千克` / `3`，且 `PUT` 请求体为
  `{ code, name, status, symbol, unit_type, precision }` **六个字段齐全** ——
  这是本任务最关键的回归点（漏发 `precision` 会被后端写成 0）。
- `pnpm run check` 退出码 0；`pnpm run test:e2e` 28 passed。
- 未验证项（如实标注）：**没有对真后端 + 真数据库跑过**。`remark` 清空、404、
  编码重复这三条只由造桩用例与单测覆盖；本地无 PostgreSQL 实例（P0 遗留事项 3），
  按决策点 D10 不引入真后端依赖。README 的手工验证步骤保留，供有库时补验。
