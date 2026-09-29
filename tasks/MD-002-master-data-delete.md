# MD-002 主数据删除

Status: Done

## Context

五类主数据目前完全没有删除入口：`src/api/resources.ts` 里没有 `delete*`，
`MasterDataListView.vue` 的表格也没有行操作列。后端契约侧 5 个删除端点**全部存在**。

已核对的后端行为（`internal/warehouse/service.go` 为同一模式）：

1. **是软删除**：`service.Delete` 先做引用检查，再调用 `repo.SoftDelete` → SQL `SoftDeleteWarehouse`
   （置 `deleted_at`），不是物理删除。
2. **被库存引用时拒绝**：`referenceChecker.HasWarehouseReferences` 为真 → 返回
   `ErrReferencedByInventory` → `http.StatusConflict` + `response.CodeConflict`（**1009**），
   `message` 为**英文原文**（`warehouse is referenced by inventory and cannot be deleted`）。
   SKU 同理（`sku is referenced by inventory and cannot be deleted`）。
3. **响应是 HTTP 200 + `data: null`**，不是 204：`pkg/response` 的 `NoContent` 实际调用
   `JSON(c, http.StatusOK, CodeSuccess, ...)`。因此 `client.ts` 的解析路径天然可用，
   `api.delete<T>()` 返回 `null`。
4. 软删除后该记录不再出现在列表与 `GET /:id` 中（后续 `GET` 返回 404）。

## Scope

- `src/api/resources.ts` 补 5 个方法：`deleteUnit` / `deleteCategory` / `deleteMaterial` /
  `deleteSku` / `deleteWarehouse`。
- `MasterDataListView.vue`：
  - 表格新增行操作列：「删除」
  - **二次确认**：确认弹窗中展示该行的**编码与名称**（只展示 ID 不足以避免误删）
  - 确认后调用删除接口，成功后刷新列表并提示成功
  - 409 被库存引用 → 中文可读提示（走 `getConflictMessage`）
  - 404 → 提示记录已不存在，并刷新列表
  - 删除进行中禁用「确认」按钮，避免重复提交
- 单测：二次确认文案包含编码与名称、取消不发请求、确认才发请求、409 提示为中文。
- e2e：「删除 → 确认 → 列表刷新」与「409 被引用 → 中文提示」（`page.route()` 造桩）。

## Out Of Scope

- 不做批量删除。
- 不做回收站 / 恢复（软删除的恢复能力后端无接口）。
- 不改后端、不改契约、不改 `contracts/openapi-schema.ts`。
- 不做编辑（`MD-001`）、不做仓库停用（`WH-001`）。
- 不引入新的确认弹窗依赖（用 Naive UI 现有 `NPopover` / `NModal` / `useDialog`）。

## API Contract

| 方法     | 路径                                                                                            | 说明   |
| -------- | ----------------------------------------------------------------------------------------------- | ------ |
| `DELETE` | `/units/{id}`、`/material-categories/{id}`、`/materials/{id}`、`/skus/{id}`、`/warehouses/{id}` | 软删除 |

响应：HTTP **200** + `{ code: 200, message: "success", data: null, trace_id, timestamp }`

错误码：

- 400 `CodeBadRequest`（1001）：id 非法
- 404 `CodeNotFound`：记录不存在
- 409 `CodeConflict`（1009）：被库存引用而拒绝删除，`message` 为英文原文
- 401 `CodeUnauthorized`（1002）：会话失效

> 注：`/warehouses/{id}` 的删除**有**引用检查与 409；`PUT /warehouses/{id}/disable` **没有** 409。

## Acceptance Criteria

- [ ] 5 类资源均可在列表行上点「删除」，且**必先经过二次确认**
- [ ] 确认弹窗展示该行的编码与名称
- [ ] 取消不发送任何请求
- [ ] 确认后删除成功、列表刷新、提示成功
- [ ] 删除被库存引用的仓库/SKU 时，提示为**中文**「已被库存引用，无法删除」
- [ ] 对已删除记录再操作时，404 给出明确提示且页面不崩
- [ ] 删除中的重复点击不会重复发送请求
- [ ] 关键逻辑有单元测试
- [ ] e2e 覆盖「删除成功」与「409 被引用」两条路径
- [ ] `pnpm check` 通过
- [ ] `pnpm test:e2e` 通过
- [ ] 320 px 与桌面宽度下确认弹窗可用

## Verification

```bash
cd stock-flow-admin
pnpm run check
pnpm run test:e2e
rm -rf ../.pnpm-store && ls -d ../.pnpm-store 2>/dev/null || echo "工作区干净"
```

手工验证（需后端 + 数据库可用时）：

1. 删除一条未被引用的计量单位 → 确认后列表少一行。
2. 先给某仓库造一条库存余额，再删该仓库 → 期望中文提示「已被库存引用，无法删除」，且仓库仍在列表。
3. 打开确认弹窗后点「取消」→ 列表不变。

## 备注

- 命令必须用**裸 `pnpm`**（`--config.store-dir` 在本机 pnpm 11 自举阶段会失败）。
- 中文错误映射由 `MD-001` 在 `src/api/error.ts` 引入；本任务复用，不重复实现。
- 本任务不涉及 `../stock-flow/`。

## 验证记录（2026-09-29 实测）

- `src/features/master-data/MasterDataListView.test.ts`：6 个用例（与 `WH-001` 共用视图），
  覆盖「每行渲染编辑 / 停用 / 删除」「已停用的仓库停用按钮为禁用态」
  「打开确认框即包含编码与名称且不发请求」「确认后才调用接口并刷新列表」
  「409 被库存引用时提示为中文」「确认后调用停用接口」。
- `tests/master-data.spec.ts`：
  - 「requires confirmation before deleting and shows the code with the name」——
    断言确认框含 `KG` 与 `千克`、点「取消」不产生请求、点「确认删除」后
    `DELETE /api/v1/units/1` 恰好被调用一次。
  - 「maps an inventory reference conflict to a readable Chinese message」——
    造 409 + `code 1009` + 英文原文，断言界面提示为「已被库存引用，无法删除」。
- `pnpm run check` 退出码 0；`pnpm run test:e2e` 28 passed。
- 为让视图可测，新增测试夹具 `src/test/setup.ts`（jsdom 缺 `ResizeObserver` / `matchMedia`）
  与 `src/test/naive.ts`（测试环境注册 Naive UI 组件），并在 `vitest.config.ts` 挂上 `setupFiles`。
- 未验证项（如实标注）：**没有对真后端 + 真数据库跑过**；「软删除后再次 `GET /:id` 返回 404」
  这条路径只由代码约定覆盖，未造桩断言。本地无 PostgreSQL 实例（P0 遗留事项 3）。
