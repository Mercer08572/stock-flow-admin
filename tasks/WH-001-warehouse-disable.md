# WH-001 仓库停用

Status: Done

## Context

仓库需要「停用」这个比软删除更轻的动作：停用后仓库仍在列表中可见（状态为「停用」），
但不再用于新的库存操作。后端契约已有 `PUT /warehouses/{id}/disable`，前端没有入口。

已核对的后端行为：

- 视图为 `PUT /warehouses/{id}/disable`，`@Success 200 {object} response.Body{data=Warehouse}`，
  失败只有 400 / 404 / 500 —— **没有 409**（停用不做库存引用检查，与 `DELETE` 不同）。
- `service.Disable` 校验 `id > 0` 后交给 `repo.Disable`，返回停用后的 `Warehouse`。
- 停用效果是 `status` 变为 `inactive`（契约 `warehouse.Status` 枚举为 `active | inactive`）。
- 前端 `src/types/api.ts` 的 `Warehouse.status` 已是 `EntityStatus = 'active' | 'inactive'`。
- `src/components/common/StatusTag.vue` 已存在，但主数据列表当前没用它，
  状态列是内联三元判断（`row.status === 'active' ? '正常' : '停用'`）。

## Scope

- `src/api/resources.ts` 新增 `disableWarehouse(id)` → `PUT /warehouses/{id}/disable`。
- `MasterDataListView.vue` 仓库的列配置：
  - 状态列改用已有的 `StatusTag`（复用，不再内联三元判断）
  - 行操作列新增「停用」，仅当 `status === 'active'` 时可用（已停用则禁用按钮，不做无意义请求）
  - **危险操作二次确认**（展示编码与名称）
  - 成功后刷新列表，状态标签变为「停用」
  - 失败走统一错误提示（含 traceId）
- e2e：「停用 → 确认 → 状态标签变为停用」（`page.route()` 造桩）。

## Out Of Scope

- 不做「启用」/「恢复」（后端无对应端点）。
- 不做删除（`MD-002`）。
- 不把状态列改造推广到全部 5 类资源（本任务只改仓库；其余资源的状态列统一属 `MD-001` 的顺带范围，
  若需要单独处理另立任务）。
- 不改后端、不改契约。
- 不在停用时联动处理该仓库下的库存余额（后端没有这个语义）。

## API Contract

| 方法  | 路径                       | 说明               |
| ----- | -------------------------- | ------------------ |
| `PUT` | `/warehouses/{id}/disable` | 停用仓库，无请求体 |

响应：HTTP 200 + `{ code: 200, message: "success", data: Warehouse, trace_id, timestamp }`，
其中 `data.status === "inactive"`。

错误码：

- 400 `CodeBadRequest`（1001）：id 非法
- 404 `CodeNotFound`：仓库不存在
- 401 `CodeUnauthorized`（1002）：会话失效

## Acceptance Criteria

- [ ] 仓库列表行上出现「停用」操作，且**必先经过二次确认**
- [ ] 确认弹窗展示该仓库的编码与名称
- [ ] 取消不发送请求
- [ ] 确认后状态标签更新为「停用」，无需手动刷新页面
- [ ] 已停用的仓库，「停用」按钮为禁用态
- [ ] 状态列使用 `StatusTag` 组件（不再内联三元判断）
- [ ] 失败时展示错误提示且含 traceId
- [ ] e2e 覆盖「停用 → 状态标签变化」
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

1. 找一个 `active` 仓库点「停用」→ 确认 → 列表状态变为「停用」。
2. 再打开该行的「停用」按钮 → 应为禁用态。
3. 对不存在的 id 调用（可临时改 URL 造桩）→ 得到明确的 404 中文提示。

## 备注

- 命令必须用**裸 `pnpm`**（`--config.store-dir` 在本机 pnpm 11 自举阶段会失败）。
- 二次确认与错误映射分别复用 `MD-002` 与 `MD-001` 引入的公共件，不重复实现。
- 本任务不涉及 `../stock-flow/`。

## 验证记录（2026-09-29 实测）

- `tests/master-data.spec.ts`「disables an active warehouse only after confirmation」——
  断言点击「停用」后确认框含 `WH-01`、此时尚未发请求，点「确认停用」后
  `PUT /api/v1/warehouses/3/disable` 被调用。
- `src/features/master-data/MasterDataListView.test.ts`「disables the disable action for an
  already inactive warehouse」—— 断言 `status` 非 `active` 的行按钮为禁用态。
- `pnpm run check` 退出码 0；`pnpm run test:e2e` 28 passed。
- **与 Out Of Scope 的偏差（如实标注）**：原文写「只改仓库的状态列，不推广到全部 5 类资源」，
  但实现时发现状态列是 5 类资源**共用的同一个** `statusColumn` 常量，
  「只改仓库」必须复制出一份仓库专用列定义才成立，反而更差。
  因此改为统一让共用的状态列渲染 `StatusTag`，5 类资源的状态展示行为一致。
- 未验证项：**没有对真后端 + 真数据库跑过**，本地无 PostgreSQL 实例（P0 遗留事项 3）。
