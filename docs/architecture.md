# 前端架构

## 依赖方向

```text
views/components -> feature stores and API modules -> api/client -> stock-flow API
        |                       |
        +------ shared types ---+
```

- 页面负责组合和交互，不处理 HTTP 协议细节。
- feature store 负责跨组件的业务状态和会话生命周期。
- endpoint wrapper 负责路径、请求参数和响应类型。
- `api/client.ts` 负责 URL、Cookie、统一响应解包和错误模型。

## 认证

管理员登录由后端设置 HttpOnly Cookie。前端只保留当前管理员身份和会话状态，不读取、复制或持久化 token。

路由进入受保护页面时：

1. 首次导航调用 `GET /auth/admin/me` 恢复会话。
2. `401` 清除内存态并跳转登录页，同时保留目标路径。
3. `must_change_password=true` 强制进入修改密码页。
4. 退出登录无论请求结果如何都会清理本地内存态。

强制改密与全局拦截的完整实现（状态源头、后端硬拦截、守卫逐条拆解与已知缺口）见
[forced-password-change.md](forced-password-change.md)。

## 应用外壳与多标签

登录后的页面统一渲染在 `src/components/layout/AdminShell.vue` 里：左侧菜单 + 顶栏 + 标签条 + 内容区。

**布局契约（固定 band + 单一滚动容器）**

- 外壳高度锁在 `100vh`/`100dvh`，顶栏与标签条是固定高度的 flex 项（`--shell-topbar-height`、
  `--shell-tabbar-height`），内容区 `.app-content` 是**全应用唯一的滚动容器**，窗口本身不滚动。
- 因此**不要**给这些 band 用 `position: sticky`：naive 的 `NLayout` 会额外渲染一层
  `.n-layout-scroll-container`（`overflow-x: hidden` 会被计算成 `overflow-y: auto`），
  sticky 的吸附基准会落到那一层而不是视口，导致 band 被下移、盖住页面头部按钮。
- 页面（`.page`）不要设视口相关的最小高度：内容区受限时，确定的高度会让 flex 列容器压缩子项
  （列表页表格被压扁且滚不动），而不是让内容区产生滚动。页面比内容区矮时露出的内容区背景与页面同色。
- `DataTable` 的最大高度算式需要减掉 `--shell-tabbar-height`，否则列表页会固定多出一条约标签条高度的滚动条。
- 路由的 `scrollBehavior` 重置的是 `.app-content` 的滚动位置（登录页/404 没有外壳，回退到窗口滚动）。

**多标签规则**

- 内容区按多标签（Tab）组织：工作台常驻第 0 位且不可关闭，其余页面按访问顺序追加、可单独关闭。
- 标签的唯一键是 `route.path`，标签集合恒等于「工作台 + 访问过的路由」；同一路由只占一个标签，
  重复进入（菜单、详情跳转、浏览器前进/后退、深链）都只是切回已有标签。
- **不缓存页面状态**（未启用 `KeepAlive`）：切换标签会重新挂载视图并重新取数，
  宁可多一次请求，也不让跨标签读到过期数据。
- 关闭当前页的标签时激活它左侧的标签（工作台保底）；关闭非当前页的标签不改变当前页面。
- 标签集合不持久化：刷新或深链后重建为「工作台 + 当前页」；退出登录时外壳卸载，标签随之清空。
- 标签规则（登记、去重、关闭后激活谁）集中在 `src/components/layout/shell-tabs.ts` 的纯函数里，
  单测见 `shell-tabs.test.ts`，端到端覆盖见 `tests/tabs.spec.ts`（含 band 固定与「短页面不多出滚动条」两条回归）。

## API 错误

后端返回 `{ code, message, data, trace_id, timestamp }`。传输层将失败转换为 `ApiError`，同时保留 HTTP 状态、业务码和 trace ID。UI 展示可理解的消息；诊断或日志功能可以使用 trace ID，但不要向用户泄露请求体或凭据。

## 新增功能

1. 在 `tasks/` 建任务说明，列出后端 endpoint、验收标准和非目标。
2. 在 `src/features/<feature>/` 建页面、局部组件和必要的 store。
3. 在 `src/api/` 增加或扩展 endpoint wrapper。
4. 只把跨 feature 的模型放进 `src/types/`。
5. 在 `src/router/index.ts` 注册路由，并在管理端菜单增加入口。
6. 覆盖成功、空数据、加载、错误、401 和窄屏状态。
7. 运行 `pnpm check`，对 UI 变更运行 `pnpm test:e2e`。

## 数据表格

- 运营数据表统一使用 `src/components/common/DataTable.vue`（Naive UI DataTable 的适配层）。页面只声明 `DataTableColumn` 列描述，不直接调用底层表格库的列 API；更换表格实现时只改这个适配层。
- 列宽必须有显式 `width`（同时作为可拖拽缩小的下限，必要时再声明 `minWidth`），需要对齐的数字列使用 `align: 'right'`。
- 单元格需要格式化时使用 `render`；时间统一走 `formatDateTime`，CSV 文本走 `exportValue`。
- 远程分页、筛选和排序参数必须显式映射到后端，不在大数据集上伪装成本地全量操作。
- 数量字段保持后端 decimal string，不要转成 JavaScript `number` 后再参与计算。
