# Stock Flow Admin

Stock Flow 的 Vue 3 管理端，面向库存、物料、SKU、仓库和计量单位等后台工作流。项目直接对接相邻目录 `../stock-flow` 提供的 API。

## 技术栈

- Vue 3 + TypeScript + Vite
- Vue Router + Pinia
- Naive UI + Lucide Icons
- AG Grid Community
- Vitest + Vue Test Utils
- Playwright
- ESLint + Prettier

## 本地启动

需要 Node.js 22+ 和 pnpm 10+。

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

开发服务器默认运行在 [http://127.0.0.1:5173](http://127.0.0.1:5173)，并将 `/api/v1` 代理到 `http://localhost:8181`。先在 `../stock-flow` 中启动后端（`make run`，监听地址来自后端 `.env` 的 `HTTP_ADDR`），登录、会话和数据页面才能正常工作。首次部署还需要按后端 README 第 4 步执行一次 `go run ./cmd/admin init` 创建管理员口令。

## 常用命令

| 命令                 | 用途                                    |
| -------------------- | --------------------------------------- |
| `pnpm dev`           | 启动开发服务器                          |
| `pnpm build`         | 类型检查并生成生产构建                  |
| `pnpm typecheck`     | 检查 Vue 与 TypeScript 类型             |
| `pnpm lint`          | 运行 ESLint                             |
| `pnpm format:check`  | 检查代码格式                            |
| `pnpm test:run`      | 运行单元测试一次                        |
| `pnpm test:coverage` | 生成单元测试覆盖率                      |
| `pnpm test:e2e`      | 运行桌面与移动端端到端测试              |
| `pnpm api:generate`  | 从后端 Swagger 2.0 文档生成接口类型快照 |
| `pnpm check`         | 执行提交前完整校验                      |

首次运行端到端测试前安装浏览器：

```bash
pnpm exec playwright install chromium
```

## 环境变量

| 变量                    | 默认值                  | 说明                      |
| ----------------------- | ----------------------- | ------------------------- |
| `VITE_API_BASE_URL`     | `/api/v1`               | 浏览器使用的 API 路径前缀 |
| `VITE_API_PROXY_TARGET` | `http://localhost:8181` | 本地 Vite 代理目标        |

环境文件加载顺序（Vite 原生规则，后者覆盖前者）：

```text
.env  →  .env.local  →  .env.[mode]  →  .env.[mode].local
```

- `.env` 只放**可入库的默认值**（端口、路径前缀）；个人覆盖写进 `.env.local`。
- 两者都已被 `.gitignore` 忽略，只有 `.env.example` 会随仓库分发。
- 变量必须带 `VITE_` 前缀才会暴露给浏览器端代码；其余变量只在 `vite.config.ts` 中可用。

`VITE_API_PROXY_TARGET` 必须与后端实际监听地址一致：后端内置默认是 `:8080`，而
`../stock-flow/.env.example` 提供的是 `:8181`。若你改过后端 `HTTP_ADDR`，这里要同步修改。

生产环境推荐保持同源部署：由网关将 `/api/v1` 转发到后端，前端只使用相对路径。这样可以直接复用后端的 HttpOnly 会话 Cookie，并避免额外的 CORS 配置。

## 目录

```text
src/
  api/             统一 HTTP 客户端、错误模型、API 模块
  app/             根组件、主题、全局页面
  components/      通用组件与管理端布局
  features/        按业务功能组织的页面、状态和逻辑
  router/          路由表与认证守卫
  stores/          Pinia 实例与跨功能 store
  styles/          全局样式和设计令牌
  types/           共享 API/领域类型
docs/              架构与开发约定
tasks/             可直接交给 coding agent 的任务说明
tests/             Playwright 测试
```

架构边界和新增功能流程见 [docs/architecture.md](docs/architecture.md)。Agent 开始工作前必须阅读 [AGENTS.md](AGENTS.md) 和对应的 `tasks/` 任务说明。

## API 契约

后端契约源是：

```text
../stock-flow/openapi/swagger.json
```

后端接口变化后运行：

```bash
pnpm api:generate
pnpm typecheck
```

生成文件用于发现契约差异，业务代码仍应通过 `src/api/` 中的小型 endpoint wrapper 暴露稳定、明确的调用边界。
