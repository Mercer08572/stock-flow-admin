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


## 沙箱环境构建缓存约定 

Agent 运行在沙箱中，通常只允许写入项目工作区与系统临时目录（/tmp）。因此**所有缓存、
临时文件与临时下载的工具都必须放在系统临时目录下**，禁止在项目仓库内创建任何缓存目录
（如 `.pnpm-store`、`.tools`、`.goroot_tmp`、`.gocache` 等），确保缓存不跟随项目。

### 通用约定

- 统一缓存根目录：`/tmp/agent-cache`（macOS 上 `/tmp` 即 `/private/tmp`）。
  该目录可跨项目共享：pnpm store 与 Go 模块缓存都是内容寻址的，跨项目共享安全且能提高缓存命中率。
- 禁止在项目内创建缓存/依赖目录；需要临时文件时使用 `mktemp -d`（默认位于系统临时目录）。
- 若项目内发现历史遗留的缓存目录（如 `.pnpm-store`、`.tools`），直接删除即可：
  它们是可再生内容，不得提交、不得保留。

### 各工具约定

- Go：执行任何 `go` 命令前，先导出（或写入 Makefile 默认值，可用环境变量覆盖）：
  - `GOCACHE=/tmp/agent-cache/go-build`
  - `GOMODCACHE=/tmp/agent-cache/go-mod`
  - `GOTMPDIR=/tmp/agent-cache/go-tmp`（使用前确保目录存在：`mkdir -p`）
  - `GOPATH=/tmp/agent-cache/go-path`（仅需要时）
  - `GOBIN=/tmp/agent-cache/bin`（仅 `go install` 工具时）
- pnpm / npm：
  - 统一使用 store：`pnpm --store-dir /tmp/agent-cache/pnpm-store <命令>`。
  - 注意：pnpm 10 及以上**忽略项目 `.npmrc` 中的 `store-dir`**（该配置仅在 pnpm ≤9 有效），
    必须使用 `--store-dir` 命令行标志，或设置 `XDG_DATA_HOME=/tmp/agent-cache/data`
    （store 会落到 `$XDG_DATA_HOME/pnpm/store`）。
  - npm 对应 `cache=/tmp/agent-cache/npm-cache`（npm 仍可从 `.npmrc` 读取）。
  - 不得让 store 落到项目内路径（如项目根的 `.pnpm-store`）。
- 需要固定版本的独立工具（如 sqlc）：
  - 优先用 `go run <module>@<version>`（编译产物进 GOCACHE），
    或 `GOBIN=/tmp/agent-cache/bin go install <module>@<version>`。
  - 禁止把工具二进制下载到项目内（如项目内 `.tools/bin`）。

### 例外与权衡

- `node_modules/`、`dist/`、编译产物等属于**构建产物**而非缓存，仍按项目约定放在项目内
  并由 `.gitignore` 排除，不受本约束限制。
- `/tmp` 会被系统清理（重启必清空；macOS 约 3 天未访问即清理）。缓存被清理后重新下载即可，
  属正常现象；不得因此把缓存改回项目内。
- 本条款的意图是约束"缓存与临时文件"的位置，不限制业务数据、源码或文档在项目内的正常存放。
