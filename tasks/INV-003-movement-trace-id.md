# INV-003 库存流水追踪 ID

## Context

后端给 `inventory_movements` 增加了 `trace_id`，并提供 `GET /api/v1/audit/logs?trace_id=` 过滤。
本任务在管理端库存流水页展示追踪 ID，并支持一键跳转到审计日志。

契约来源：`../stock-flow/openapi/swagger.json`。

## Scope

- `InventoryMovement` 类型增加 `trace_id`。
- 库存流水表格增加「追踪 ID」列；有值时渲染为链接按钮，点击跳转
  `/settings/audit-logs?trace_id=...`；历史流水显示 `-`。
- 审计日志页增加「追踪 ID」过滤输入框。
- 从路由 `?trace_id=` 进入审计页时自动应用过滤，并不再带默认 24 小时时间范围，
  由后端查询整个保留期。
- 重置审计页时清空路由里的 trace_id，避免再次点击同一链接时导航无变化。

## Out Of Scope

- 不展示 `secret_id`。
- 不做 trace_id 反查流水。
- 不改变库存流水现有列与筛选条件。

## API Contract

- `GET /api/v1/inventory/movements`：`items[].trace_id?: string | null`
- `GET /api/v1/audit/logs?trace_id=...`：精确匹配；不传 `from`/`to` 时默认整个保留期。

## Acceptance Criteria

- [x] 流水列表展示 trace_id；历史流水显示 `-`。
- [x] 点击 trace_id 跳转审计日志并自动带上过滤条件。
- [x] 审计日志页可手动输入 trace_id 查询。
- [x] 从路由进入时默认不限制 24 小时，能查到较早的 trace。
- [x] 320 px 下表格横向滚动、无页面横向溢出。
- [x] `pnpm check`、`pnpm api:verify`、Playwright e2e 通过。

## Verification

- `pnpm test:run src/features/audit/audit-log.test.ts`
- `pnpm exec playwright test tests/inventory-movements.spec.ts tests/audit-logs.spec.ts`
- `pnpm check`
- `pnpm api:generate && pnpm api:verify`
