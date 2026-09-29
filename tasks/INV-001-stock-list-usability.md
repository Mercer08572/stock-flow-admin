# INV-001 库存余额列表可用性

Status: Done

## Context

`src/features/inventory/StockListView.vue` 当前有三个可用性硬伤：

1. **筛选要手填数字 ID**：仓库与 SKU 都是 `NInputNumber`（「仓库 ID」「SKU ID」）。
   用户不可能知道 ID。
2. **没有分页**：`limit: 100, offset: 0` 写死，超过 100 条的数据不可达。
3. **层明细不可见**：`inventory_stock_layers` 的明细没有任何入口。

### 关键约束（已核对后端契约，直接决定实现方式）

1. **`include_layers` 不在列表端点。** 它只存在于详情端点
   `GET /inventory/stocks/{warehouse_id}/{sku_id}?include_layers=true`
   （`internal/inventory/handler.go`）。列表端点 `GET /inventory/stocks` 只接受
   `warehouse_id` / `sku_id` / `limit` / `offset`。
   → 「列表内联展开」需要改后端，**超出本任务边界**；改为「点行 → 抽屉展示层明细」。
2. **契约里没有 `total`。** 所有 `ListResult` 只有 `items` / `limit` / `offset`，
   且 `MaxListLimit = 100`。补 `total` 属后端改动（决策点 **D9** 已定：不补，只做上一页 / 下一页）。
3. **后端没有关键字搜索。** `/skus` 只接受 `status` / `material_id` / `unit_id` / `limit` / `offset`；
   `/warehouses` 只接受 `status` / `type` / `limit` / `offset`（决策点 **D8** 已定：本地可搜索，最多 100 条）。
4. **`omitempty` 字段可能整体缺失**（P1-4 遗留事项 ② 提到的建模缺口，本页正好撞上）：
   - `StockBalance.Warehouse` / `SKU` 是 `*Reference` + `omitempty` → 主数据软删除后**整个字段消失**，
     而前端 `src/types/api.ts` 把它们建模为**必填** `Reference`，会导致「仓库名称 / SKU 名称」静默空白。
   - `StockBalance.UpdatedAt` 是 `*time.Time` → 可能为 `null`。
   - `StockLayer.BatchID` 是 `*int64` → 可能为 `null`。
   - `StockBalance.Layers` 是 `omitempty` → 不带 `include_layers` 时**不出现**。

## Scope

- `src/api/resources.ts`：
  - `stocks(query)` 保持
  - 新增 `stock(warehouseId, skuId, { includeLayers })` → `GET /inventory/stocks/{warehouse_id}/{sku_id}`
- `src/types/api.ts` 修正本页实际渲染字段的可空性（只改这些字段，不做全面契约重写）：
  - `StockBalance.warehouse?` / `sku?` → 可选
  - `StockBalance.updated_at` → `string | null`
  - 新增 `StockLayer` 类型（`batch_id: number | null`、`layers?: StockLayer[]`）
- `StockListView.vue`：
  - 仓库 / SKU 改用 `NSelect` + `filterable`（本地可搜索），选项来自
    `warehouses({ limit: 100 })` / `skus({ limit: 100 })`，标签形如 `编码 - 名称`
  - 选项加载失败**不阻塞**列表：筛选区显示可读提示，列表仍可按「全部」查询
  - 分页：「上一页 / 下一页」，按 `offset` 递增 / 递减 `limit`；**不显示总条数**（无 `total`）
  - 「下一页」的可用性按 `items.length === limit` 推断（末页可能不足一页，属已知近似）
  - 条件变化时 `offset` 归零
  - 点击行 → 抽屉展示层明细：调 `stock(warehouse_id, sku_id, { includeLayers: true })`，
    展示每个层的 `received_at` / `batch_id` / `on_hand_qty` / `reserved_qty` / `available_qty`
  - 层明细抽屉具备加载 / 空 / 错误+重试三态
  - 仓库 / SKU 引用缺失时回退展示 `warehouse_id` / `sku_id`，不显示空白
- 单测：分页偏移计算、筛选条件组装、引用缺失回退、层明细三态。
- e2e：「输入筛选 → 查询」「下一页」「点行展开层明细」（`page.route()` 造桩）。

## Out Of Scope

- 不改后端、不补 `total`、不给 `/skus`、`/warehouses` 加关键字搜索（决策点 D8 / D9）。
- 不做「启用 / 停用」等写操作（属 P3）。
- 不做库存流水（`inventory_movements`）查询（属 P3-6）。
- 不做列表内联展开层明细（需要后端支持）。
- 不引入新的下拉/表格依赖（用 Naive UI 现有组件）。
- 不做服务端排序（`DataTable` 的排序为客户端排序，现状保持不变）。
- 不修复 `StockBalance` 之外的其他 `omitempty` 建模缺口（P1-4 遗留 ② 的其余部分）。

## API Contract

| 方法  | 路径                                        | 查询参数                                                |
| ----- | ------------------------------------------- | ------------------------------------------------------- |
| `GET` | `/inventory/stocks`                         | `warehouse_id?`、`sku_id?`、`limit?`（≤100）、`offset?` |
| `GET` | `/inventory/stocks/{warehouse_id}/{sku_id}` | `include_layers?: boolean`                              |

响应 `data`：`StockListResult { items: StockBalance[], limit, offset }` /
`StockBalance { warehouse_id, sku_id, warehouse?, sku?, on_hand_qty, reserved_qty, available_qty, updated_at, layers? }`

数量字段（`on_hand_qty` / `reserved_qty` / `available_qty`）是**字符串形式的定点数**
（`NUMERIC(20,6)`），不是 float —— 展示时按字符串直出，**不做浮点运算**，
只在需要比较 / 排序时用字符串安全的比较。

错误码：

- 400 `CodeBadRequest`（1001）：参数非法（如 `limit` 非整数、`include_layers` 非布尔）
- 404：详情端点仓库/SKU 维度无余额时返回 not found
- 401 `CodeUnauthorized`（1002）：会话失效

## Acceptance Criteria

- [ ] 仓库与 SKU 筛选是可搜索下拉，不再是数字输入框
- [ ] 下拉选项标签同时含编码与名称
- [ ] 选项接口失败时，页面给出可读提示且「查询全部」仍可用
- [ ] 「上一页 / 下一页」可翻页，`offset` 正确递增 / 递减，条件变化时归零
- [ ] 不显示总条数（契约无 `total`）
- [ ] 点击列表行打开层明细抽屉，按 `received_at` 升序展示各层数量
- [ ] 层明细为空时有明确空态；失败时可重试
- [ ] 主数据被软删除（`warehouse` / `sku` 引用缺失）时回退展示 ID，不留空白
- [ ] 数量列按字符串原样展示，不经过浮点转换
- [ ] 关键逻辑有单元测试
- [ ] e2e 覆盖筛选、翻页、层明细三条路径
- [ ] `pnpm check` 通过
- [ ] `pnpm test:e2e` 通过
- [ ] **320 px** 与桌面宽度下筛选区、表格、抽屉均可用（表格沿用 `DataTable` 的横向滚动策略）

## Verification

```bash
cd stock-flow-admin
pnpm run check
pnpm run test:e2e
rm -rf ../.pnpm-store && ls -d ../.pnpm-store 2>/dev/null || echo "工作区干净"
```

手工验证（需后端 + 数据库可用时）：

1. 不做任何筛选直接查询 → 返回前 100 条；「下一页」后结果集变化。
2. 选一个仓库 → 查询 → 结果只含该仓库；此时「上一页 / 下一页」从第 1 页重新开始。
3. 点某一行 → 抽屉展示层明细，各层 `on_hand_qty` 之和与列表的在库数量一致。
4. 把浏览器窗口收到 320 px → 筛选区纵向堆叠，表格横向可滚动。

## 备注

- 命令必须用**裸 `pnpm`**（`--config.store-dir` 在本机 pnpm 11 自举阶段会失败）。
- 错误展示与 traceId 复用 `SHR-001` 的 `AsyncState`。
- 本任务不涉及 `../stock-flow/`。

## 验证记录（2026-09-29 实测）

- `src/features/inventory/stock-list.test.ts`：11 个用例，覆盖查询参数组装（空条件不发 id、
  `offset` 不为负、页大小等于后端 `MaxListLimit`）、`hasNextPage` 的满页推断、
  引用缺失 / 软删除 / 字段为空三种回退、下拉选项标签。
- `tests/stock-list.spec.ts`：5 个用例 ——
  可搜索下拉的选项标签带编码与名称；翻页按 `offset=0 → 100 → 0` 发出请求且
  首页「上一页」禁用；点行以 `?include_layers=true` 请求详情端点并渲染层明细；
  层为空时有明确空态；仓库引用缺失时回退展示 `#3`。
- `tests/responsive.spec.ts`：3 个用例，显式视口 **320 × 720**，断言
  主数据列表行操作可用、库存筛选区与翻页按钮可用、编辑抽屉不横向溢出，
  且页面整体 `scrollWidth - clientWidth <= 1`（宽表格由表格容器自己滚动）。
- `pnpm run check` 退出码 0；`pnpm run test:e2e` 28 passed。
- **共享组件的必要扩展**：`DataTable.vue` 新增 `rowClickable` prop 与 `rowClick` 事件
  （原计划要求「点行展开明细」），并带 `tabindex` + 回车/空格触发以保持键盘可访问；
  行属性仍只在适配层接触底层表格库，页面不涉及。
- 未验证项（如实标注）：
  1. **没有对真后端 + 真数据库跑过**；「各层 `on_hand_qty` 之和等于列表在库数量」这条
     需要真数据，未验证（本地无 PostgreSQL 实例）。
  2. 「下一页」的可用性只能按「本页是否满页」推断（契约无 `total`），
     恰好满页时会点出一次空列表，这是决策点 D9 已接受的近似，未额外处理。
  3. 下拉只加载前 100 条且不可远程搜索（决策点 D8），SKU 超过 100 条时的检索能力留待后端任务。
