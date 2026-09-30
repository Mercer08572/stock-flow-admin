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
