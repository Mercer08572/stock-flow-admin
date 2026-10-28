# INV-002 库存流水管理页

Status: Done

## Context

`inventory_movements` 记录每次库存变更的审计流水，后端已在 `INV-006` 提供只读查询接口
`GET /api/v1/inventory/movements`，但管理端没有任何入口。流水是排障与对账时最先要看的数据，
没有页面就只能直接查库。

本任务在「库存余额」与「主数据」之间新增「库存流水」页，并用 Naive UI 的虚拟列表承载大体量数据
（参考 <https://www.naiveui.com/zh-CN/components/data-table#virtual.vue>）。

## Scope

- `src/types/api.ts`：新增 `MovementOperationType` 与 `InventoryMovement`（字段与后端 `inventory.Movement` 对齐；
  可空字段显式建模为 `T | null`）。
- `src/api/inventory.ts`：新增 `listMovements(query)`。
- `src/features/inventory/movement-list.ts`：查询参数组装、日期范围 → RFC3339（左闭右开）、
  操作类型中文映射与下拉选项、标签配色、来源/操作人格式化、引用回退、分页合并与「是否还有下一页」。
- `src/features/inventory/MovementListView.vue`：页面本体。
- `src/components/common/DataTable.vue`：适配层新增可选能力 `virtualScroll`、`rowKey`、`scroll` 事件。
- `src/router/index.ts`、`src/components/layout/AdminShell.vue`：路由与菜单入口。
- `src/main.ts`、`src/test/naive.ts`：注册 `NDatePicker`。
- 单测 `src/features/inventory/movement-list.test.ts`，e2e `tests/inventory-movements.spec.ts`。

## Out Of Scope

- 不改后端、不改契约、不跑 `pnpm api:generate`（`/inventory/movements` 已在快照中）。
- 不做修改 / 删除流水（流水不可变）。
- 不做关键字全文搜索：后端没有该参数，前端不伪造「只搜已加载的几条」。
- 不做服务端排序：后端固定 `created_at DESC, id DESC`，页面关闭列排序（增量追加下本地排序会误导读数）。
- 不改其他列表页的分页方式（仍是服务端分页）。

## API Contract

`GET /api/v1/inventory/movements`

| 参数              | 说明                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `warehouse_id?`   | 仓库 ID，整数且 > 0                                                                      |
| `sku_id?`         | SKU ID，整数且 > 0                                                                       |
| `operation_type?` | `increase` / `reserve` / `release_reserved` / `decrease_available` / `decrease_reserved` |
| `created_from?`   | RFC3339，闭区间下界                                                                      |
| `created_to?`     | RFC3339，**开区间**上界（SQL 为 `created_at < created_to`）                              |
| `limit?`          | 默认 20，上限 100（`MaxListLimit`）                                                      |
| `offset?`         | 默认 0，负数归零                                                                         |

响应 `data`：`{ items: InventoryMovement[], total, limit, offset }`。

错误：

- 400 `1001`：参数非法（`operation_type` 不在枚举内、时间格式错误、`created_from > created_to`）
- 404：`warehouse_id` / `sku_id` 对应的主数据不存在
- 401 `1002`：会话失效

## 设计要点

- **虚拟列表走适配层**：页面声明 `DataTableColumn`，通过 `DataTable` 的 `virtualScroll` + `rowKey`
  开启虚拟滚动，页面不接触 `NDataTable` 的列 API（`AGENTS.md` 的硬约束）。
  虚拟滚动要求稳定的行键，因此以流水 `id` 作为 `rowKey`。
- **增量加载而非整页分页**：首屏取 100 条，滚动到接近底部自动按 `offset` 追加下一页，按 `id` 去重；
  另保留「加载更多」按钮，覆盖矮视口 / 键盘操作 / 自动加载未触发的情形。
- **筛选与查询解耦**：点「查询」才把表单条件快照到 `applied`，后续「加载更多」始终按快照取数，
  避免两页数据来自不同条件。
- **操作类型中文**：`increase 增加`、`reserve 预留`、`release_reserved 释放预留`、
  `decrease_available 扣减可用`、`decrease_reserved 扣减预留`；同一份映射同时用于下拉与列渲染。
- **日期按天、按本地时区**：`created_from` 取开始日 00:00，`created_to` 取结束日**次日** 00:00
  （后端开区间），不用 `new Date('yyyy-MM-dd')`（会按 UTC 解析，东八区漏掉当天）。
- **引用回退**：流水只给 `warehouse_id` / `sku_id`，名称取自筛选下拉的 100 条选项；
  取不到时显示 `#id`，不留空白。
- **局部中文 locale**：项目未全局配置 naive locale，日期面板默认英文；本页用 `abstract` 的
  `NConfigProvider` 局部提供 `zhCN` / `dateZhCN`，不改动其他页面文案。
- **追加失败不清空**：下一頁失败时保留已加载流水，底部提示错误并提供「重试加载」。

## Acceptance Criteria

- [x] 菜单「库存流水」位于「库存余额」与「主数据」之间，路由 `/inventory/movements`
- [x] 支持仓库、SKU、操作类型、时间范围四个搜索条件，另有重置与刷新
- [x] `operation_type` 全部以中文展示（5 个枚举值）
- [x] 表格启用 Naive UI 虚拟列表，DOM 行数明显少于已加载条数
- [x] 滚动到底自动追加下一页，并提供「加载更多」按钮兜底
- [x] 加载 / 空数据 / 错误+重试 / 成功四态齐备；追加失败保留已有数据
- [x] 数量按 decimal 字符串直出，不做浮点运算
- [x] 关键逻辑有单元测试，e2e 覆盖菜单、筛选、虚拟化追加、空态、错误、320 px
- [x] `pnpm check` 通过
- [x] 320 px 与桌面宽度均可用（表格容器自行横向滚动，页面无横向溢出）

## Verification

```bash
cd stock-flow-admin
pnpm exec playwright test tests/inventory-movements.spec.ts
pnpm check
pnpm test:e2e
```

手工验证（需后端 + 数据库可用时）：

1. 不做筛选查询 → 首屏 100 条，向下滚动自动追加，底部提示「已加载 200 / 共 N 条」。
2. 选仓库 + 操作类型「预留」+ 日期范围 → 请求 query 含 `warehouse_id`、`operation_type`、
   `created_from`、`created_to`，且 `offset=0`。
3. 造一条 `created_at` 落在结束日当天的流水 → 该条必须出现在结果里（验证开区间上界）。
4. 把浏览器窗口收到 320 px → 筛选区纵向堆叠，表格横向可滚动，页面不横向溢出。

## 备注

- 本任务不涉及 `../stock-flow/`。
- 命令必须用裸 `pnpm`（沙箱内 `--config.store-dir` 在 pnpm 自举阶段可能失效）。
