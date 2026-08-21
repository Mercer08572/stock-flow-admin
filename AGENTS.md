# Stock-Flow Admin — AGENTS.md

## 项目范围

本文件仅适用于 `stock-flow-admin/` 前端项目。后端专用说明位于 `../stock-flow/AGENTS.md`，不适用于本项目。

## 项目概述

Stock-Flow Admin 是 Stock-Flow 库存管理系统的前端管理应用。

## 前端技术栈

- Vue 3
- TypeScript
- Naive UI
- AG Grid
- Pinia
- Vue Router

## 必须执行的命令

请在 `stock-flow-admin/` 目录下使用 pnpm 执行命令。

```bash
pnpm install
pnpm dev
pnpm check
```

在交付工作前，迭代期间先运行与改动最相关且范围最小的测试，然后运行 `pnpm check`。对于浏览器可见的改动，当 Playwright 浏览器可用时，还需运行 `pnpm test:e2e`，并检查桌面端和移动端布局。

## 源码目录结构

```text
src/api/           共享传输层、错误处理和接口封装
src/app/           根级提供者、主题和应用级视图
src/components/    可复用的展示组件和布局组件
src/features/      业务功能；将功能专属状态和视图组织在一起
src/router/        路由定义和全局守卫
src/stores/        Pinia 安装配置和真正跨功能共享的 store
src/styles/        全局设计令牌和基础样式
src/types/         共享 API 类型和领域类型
tests/             Playwright 端到端测试
tasks/             可直接供 Agent 执行的实现任务说明
```

## 架构规则

- 视图应调用功能模块的 API 或 store，禁止直接调用 `fetch`。
- `src/api/client.ts` 是唯一的共享 HTTP 传输层。错误中必须保留后端响应封装结构和跟踪 ID。
- 身份认证使用后端的 HttpOnly 会话 Cookie。禁止在浏览器存储中持久化会话令牌。
- 路由专属状态应保留在对应功能模块内。只有当状态需要跨路由共享或在导航后继续保留时，才将其提升至 Pinia。
- 服务端数据应保持为服务端数据。若没有明确的缓存失效设计，禁止在长期存活的 Pinia store 中复制 API 记录。
- 优先使用带类型的请求/响应模型。后端契约发生变化时，运行 `pnpm api:generate`，并有意识地核对项目实际使用的类型。
- 业务术语应与 `../stock-flow/openapi/swagger.json` 及后端模块名称保持一致。
- 应用控件使用 Naive UI，图标使用 Lucide，业务操作表格使用 AG Grid。
- 每个异步页面都必须包含加载、空数据、错误和重试状态。
- 保持键盘可访问性、清晰可见的焦点状态、语义化标签，并确保响应式布局支持低至 320 px 的宽度。

## 变更边界

- 除非任务明确同时涉及前后端项目，否则处理前端任务时不得编辑 `../stock-flow/`。
- 生成的 API 文件应放在 `src/api/generated/` 中，禁止手动编辑。
- 禁止提交 `.env`、构建产物、覆盖率报告或 Playwright 报告。
- 除非现有技术栈无法清晰解决需求，否则避免引入新依赖。

## 完成标准

- 满足相关 `tasks/` 任务说明中的验收标准。
- 未引入虚假的生产数据或静默 API 降级方案。
- `pnpm check` 执行通过。
- 面向用户的工作流具备适当的加载、空数据、错误、成功以及权限/会话状态。
- UI 改动已在桌面端和移动端宽度下完成检查。
- 当命令、架构或配置发生变化时，已同步更新文档和 `.env.example`。

## 项目边界

- 前端 UI、状态管理、路由和 API 客户端代码应保留在本项目中。
- 将后端 API 视为本项目的外部依赖。
- 不得将后端架构、持久化、迁移或 Go 专用规则应用于前端代码。
