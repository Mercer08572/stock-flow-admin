# SHR-001 异步状态与错误展示统一

Status: Done

## Context

计划原文把本任务描述为「替换现有 AG Grid overlay 内联空态与 `v-else` 隐藏表格的写法」。
**该前提已失效**：AG Grid 已在提交 `7662531`（`refactor(table): 用 Naive UI DataTable 适配层替换 AG Grid`）
被移除，`src/components/common/DataTable.vue` 现基于 Naive UI `NDataTable`，且已内置
loading（`:loading`）、empty（`#empty` 插槽）、error+retry（`NAlert` + `retry` 事件）四态。

核对后真正剩下的两个缺口：

1. **`traceId` 从不展示。** `src/api/client.ts` 已把后端响应封装的 `trace_id` 解析进
   `ApiError.traceId`（`src/api/error.ts`），但除定义与 `client.test.ts` 的断言外，
   **全项目没有任何一处把它渲染给用户**。后端 `pkg/response` 每个响应都带 `trace_id`，
   这等于把唯一的排障线索丢掉了。
2. **非表格异步区域各写一套三件套。** `DashboardView.vue` 用 `health` / `healthError` /
   `checkingHealth` 三个 `ref` 手写三态；`MasterDataListView.vue`、`StockListView.vue`
   各自重复 `loading` / `errorMessage` + `try/catch/finally` + 模板三元判断。
   新增页面（如 P4 的 `AUTH-001`）会再抄一遍。

## Scope

- 新增 `src/components/common/AsyncState.vue`：
  - props：`loading: boolean`、`error?: string`、`errorTraceId?: string`、`empty?: boolean`、`emptyText?: string`
  - emits：`retry`
  - slots：`default`（成功态）、`empty`（覆盖默认空态）、`error`（覆盖默认错误态）
  - 默认错误态统一为：错误文案 + `traceId`（仅在存在时渲染）+ 「重试」按钮
  - `error` 有值时优先于 `loading` 与 `empty`；`loading` 优先于 `empty`
- `DataTable.vue`：错误态改用 `AsyncState`；**保持** `error` prop 为 `string`
  （不破坏现有调用点），**新增** `errorTraceId?: string`；`empty` 仍走 `NDataTable` 的 `#empty` 插槽，
  不改为整块替换（避免表格表头消失）。
- 三个页面接入并把 traceId 传下去：
  - `DashboardView.vue`：健康检查区域改用 `AsyncState`（loading / error+retry / 成功三态）
  - `MasterDataListView.vue`：把错误从 `string` 改为携带 `traceId` 的字段，传给 `DataTable`
  - `StockListView.vue`：同上
- 新增单测 `src/components/common/AsyncState.test.ts`。

## Out Of Scope

- 不改 `src/api/client.ts` 的解析逻辑（`traceId` 已正确解析）。
- 不引入新的第三方依赖（`@vue/test-utils`、`jsdom` 已在 devDependencies 中）。
- 不改后端、不改契约、`contracts/openapi-schema.ts` 不动。
- 不把 `NDataTable` 的 `#empty` 插槽替换为 `AsyncState`（会让表头一并消失）。
- 不为空态新增插图或动效。
- 不做 `MD-001` / `MD-002` / `WH-001` / `INV-001` 的功能改动（本任务只统一状态展示）。

## API Contract

本任务不新增任何端点。仅消费已有响应封装中的 `trace_id`：

- 错误响应：`{ code: number, message: string, data: null, trace_id: string, timestamp: number }`
- `client.ts` 在 `!response.ok` 或 `payload.code !== 200` 时抛出 `ApiError`，其 `traceId` 取自 `payload.trace_id`

## Acceptance Criteria

- [ ] `AsyncState` 支持 loading / empty / error+retry / 成功四态，且有插槽覆盖能力
- [ ] `error` 有值时展示错误态（含重试按钮），不展示 loading 或空态
- [ ] `errorTraceId` 存在时错误态可见该串；不存在时不渲染空的 traceId 行
- [ ] 点击「重试」发出 `retry` 事件
- [ ] `DataTable` 的错误态使用 `AsyncState`，且 `error` prop 仍为 `string`（现有调用点零破坏）
- [ ] 工作台服务状态条、主数据列表、库存列表三处均接入，且错误态可看到 traceId
- [ ] `AsyncState` 有四态与 traceId 的单元测试
- [ ] `pnpm check` 通过
- [ ] `pnpm test:e2e` 通过（现有 4 个用例不回归）
- [ ] 320 px 与桌面宽度下错误态不溢出、重试按钮可点击

## Verification

```bash
cd stock-flow-admin
pnpm run check
pnpm run test:e2e
rm -rf ../.pnpm-store && ls -d ../.pnpm-store 2>/dev/null || echo "工作区干净"
```

手工验证：用浏览器 devtools 把 `/api/v1/inventory/stocks` 改成返回 500（或直接断网），
确认页面显示中文错误 + traceId + 「重试」按钮；点重试后重新发起请求。

## 备注

- 命令必须用**裸 `pnpm`**：`--config.store-dir` 在本机 pnpm 11 的版本自举阶段会失败
  （详见 `docs/development-plan.md` 第十一章命令模板下方说明）。
- 本任务不涉及 `../stock-flow/`；契约快照 `contracts/openapi-schema.ts` 无需重新生成。

## 验证记录（2026-09-29 实测）

- `pnpm run check` 退出码 0：`format:check` → `lint` → `typecheck` → `test:run`
  （本任务新增 `AsyncState.test.ts` 6 个用例）→ `build`。
- `pnpm run test:e2e` 28 passed（含原有 4 个登录用例不回归；28 = 14 用例 × 2 project）。
- 跑完 `rm -rf ../.pnpm-store` 后 `ls -d ../.pnpm-store` 无输出，工作区干净。
- 实现收敛说明（与 Scope 的两处偏差，均为实现时的必要选择）：
  1. **`getErrorDetail` 由本任务引入**（原计划写在 MD-001）：本任务要展示 `traceId`，
     必须先把 `ApiError.traceId` 取出来给模板用；MD-001 只新增 `getConflictMessage` 并复用它。
  2. `getErrorMessage` 改为 `getErrorDetail(error).message` 的薄封装，行为不变
     （`error.test.ts` 有断言）。
- 关于 320 px：本任务未单独加用例，320 px 的实测放在 `tasks/INV-001-stock-list-usability.md`
  引入的 `tests/responsive.spec.ts` 中（覆盖主数据列表与编辑抽屉）。
