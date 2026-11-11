# API-001 API 密钥管理

## Context

Stock-Flow 的后端已经提供「API 应用 + 密钥」两级认证。外部系统使用
`X-Stock-Flow-App-ID` 与 `X-Stock-Flow-Secret` 调用受保护接口，但管理端还没有对应的页面。
本任务补齐应用与密钥的管理界面，复用 `internal/auth` 现有接口与本任务新增的
`PUT/DELETE /auth/apps/:id/secrets/:secret_id`、`/unblock`、`/reissue`。

契约来源：`../stock-flow/openapi/swagger.json`。

## Scope

- 新增 `/settings/api-keys` 页面与左侧「系统设置 → API 密钥」入口。
- 应用列表：加载、空数据、错误+重试、分页、刷新。
- 新建/编辑应用；停用/启用；删除前二次确认。
- 新建应用时可同时签发首把密钥。
- 应用内密钥抽屉：列表、签发、编辑名称/过期时间、禁用/启用、删除、重新签发。
- 一次性明文弹窗：展示 App ID 与 Secret，支持复制，关闭后不可再次查看。
- 320 px 与桌面宽度布局检查。

## Out Of Scope

- 不做「输入管理员密码再次查看明文」；需要再次获取时使用「重新签发」。
- 不做 scopes / RBAC / IP 白名单。
- 不做密钥管理操作审计日志。
- 不修改后端鉴权协议与统一响应格式。

## API Contract

- `GET /api/v1/auth/apps?limit=&offset=&status=`
- `GET /api/v1/auth/apps/:id`
- `POST /api/v1/auth/apps`
- `PUT /api/v1/auth/apps/:id`（全量替换，必须回传 `metadata`）
- `DELETE /api/v1/auth/apps/:id`
- `GET /api/v1/auth/apps/:id/secrets`
- `POST /api/v1/auth/apps/:id/secrets`（响应含一次性明文 `secret`）
- `PUT /api/v1/auth/apps/:id/secrets/:secret_id`
- `DELETE /api/v1/auth/apps/:id/secrets/:secret_id`
- `POST /api/v1/auth/apps/:id/secrets/:secret_id/block`
- `POST /api/v1/auth/apps/:id/secrets/:secret_id/unblock`
- `POST /api/v1/auth/apps/:id/secrets/:secret_id/reissue`（响应含一次性明文 `secret`）

所有接口要求管理员会话；错误码与后端 `pkg/apperr` 保持一致，
新增 `AUTH_API_SECRET_NOT_ACTIVE` 的中文文案。

## Acceptance Criteria

- [x] 应用列表显示名称、App ID、描述、状态、更新时间，并支持分页。
- [x] 新建应用成功；勾选「同时签发首把密钥」时，创建后弹窗展示 App ID 与 Secret。
- [x] 关闭明文弹窗后刷新页面，明文不再出现。
- [x] 编辑应用时会回传并保留 `metadata`。
- [x] 应用可停用/启用；停用后页面提示其下密钥不可调用。
- [x] 应用删除前二次确认，确认后从列表消失。
- [x] 密钥抽屉展示名称、Secret ID、状态、过期时间、最后使用、创建时间。
- [x] 密钥可签发、编辑、禁用、启用、删除、重新签发。
- [x] 重新签发后旧密钥状态变为「已禁用」，新密钥明文只展示一次。
- [x] 列表与抽屉具备加载、空数据、错误+重试状态。
- [x] 320 px 下无页面横向溢出，抽屉全宽可用。
- [x] 关键纯逻辑有 Vitest 单测，主流程有 Playwright e2e。
- [x] `pnpm check` 通过；`pnpm api:verify` 通过。

## Verification

- `pnpm test:run src/features/api-keys/api-key.test.ts`
- `pnpm exec playwright test tests/api-keys.spec.ts`
- `pnpm check`
- `pnpm api:generate && pnpm api:verify`
