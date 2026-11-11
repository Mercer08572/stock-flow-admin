# AUD-001 审计日志列表

## Context

后端新增 `GET /api/v1/audit/logs`，按请求记录认证方式、调用方、IP、状态码、耗时和 trace_id。
本任务在管理端提供查询页面，入口为「系统设置 → 审计日志」。

契约来源：`../stock-flow/openapi/swagger.json`。

## Scope

- 新增 `/settings/audit-logs` 页面与侧栏入口。
- 过滤条件：时间范围、认证方式、调用方（username / app_id）、IP、状态码、请求路径。
- 游标分页：「加载更多」追加结果，不显示总条数，避免长时间范围 COUNT(*)。
- 表格列：时间、认证方式、调用方、方法、路径、状态、耗时、IP、错误码、trace_id。
- 加载、空数据、错误+重试、加载更多失败提示。
- 320 px 与桌面宽度布局检查。

## Out Of Scope

- 不提供修改/删除审计记录。
- 不做聚合图表、全文检索、导出全量数据（CSV 仅导出已加载行）。
- 不展示请求体、响应体、Cookie 或密钥。

## API Contract

`GET /api/v1/audit/logs`

- `from` / `to`：RFC3339，默认最近 24 小时。
- `auth_method`：`admin_session` / `api_app` / `none` / `ambiguous`。
- `actor_label`：管理员用户名或 API 应用 app_id，精确匹配。
- `client_ip`：精确 IP。
- `status_code`：100–599。
- `path`：精确路径。
- `limit`：默认 50，最大 200。
- `cursor`：上一页 `next_cursor`。

响应：`{ "items": [...], "next_cursor"?: "..." }`。

## Acceptance Criteria

- [x] 页面默认查询最近 24 小时，展示审计记录。
- [x] 认证方式显示为「管理员会话 / API 密钥 / 未认证 / 认证冲突」。
- [x] 调用方显示 username 或 app_id，并附内部 id；未认证显示「未认证」。
- [x] 状态码按 2xx/3xx/4xx/5xx 着色，错误码单独展示。
- [x] 支持时间、认证方式、调用方、IP、状态码、路径过滤。
- [x] 游标分页「加载更多」，追加结果且没有更多时提示。
- [x] 具备加载、空数据、错误+重试状态。
- [x] 320 px 无页面横向溢出，过滤区单列、表格容器横向滚动。
- [x] `pnpm check`、`pnpm api:verify`、Playwright e2e 通过。

## Verification

- `pnpm test:run src/features/audit/audit-log.test.ts`
- `pnpm exec playwright test tests/audit-logs.spec.ts`
- `pnpm check`
- `pnpm api:generate && pnpm api:verify`
