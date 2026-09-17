# SHR-002 API 契约治理（契约快照漂移检查）

Status: Done

## Context

后端契约链路是四段全手工的：

```text
Go handler 的 swag 注解  --make swagger-->  ../stock-flow/openapi/swagger.json
                                          --pnpm api:generate--> 前端生成文件
```

生成文件此前放在 `src/api/generated/schema.ts`，但**没有任何源码引用它**，同时被 ESLint 忽略、
被 `@ts-nocheck` 抑制类型检查，且没有一句话说明它是"参考快照"还是"业务类型真源"。
结果是契约漂移完全靠人记得执行 `pnpm api:generate` 才能发现：后端改了响应结构而前端没同步时，
编译期（手写类型）、运行时（`client.ts` 中 `data as T` 纯断言）、CI 三处都不会报错。

实测确认：快照与当前契约逐字节一致，问题不是"快照过期"，而是"**没有信号**"。

## Scope

- 契约快照迁移到 `contracts/openapi-schema.ts`，并在文件头写明定位（漂移告警，非业务真源）。
- `pnpm api:generate` 改为调用 `scripts/generate-api-contract.sh`（幂等：临时目录生成后拼接文件头）。
- 新增 `pnpm api:verify` → `scripts/verify-api-contract.sh`：重新生成并与入库快照 diff，不一致即失败并打印 diff。
- 前端 CI 新增 `contract` job（仅在 `pull_request` 与 `workflow_dispatch` 触发），检出后端仓库后执行校验。
- 同步 `.prettierignore`、`eslint.config.js` 忽略清单（`generated/` → `contracts/`）。
- 更新 README「API 契约」一节与 AGENTS.md 变更边界，明确两层类型的职责与同步顺序。

## Out Of Scope

- 不引入运行时响应校验（zod/ajv 等新依赖）。
- 不把生成类型改造成业务类型源（swag 不产出 `required`，所有字段 optional，代价与风险都高于本次预算）。
- **不修改 `src/types/api.ts` 的必填/可空判断**（`StockBalance.warehouse`、`sku` 等 `omitempty` 字段的建模单独处理）。
- 不改动 `src/api/client.ts`、任何视图、store、路由与现有测试。
- 不逐个给后端 operation 补 `@Security` 注解。

## API Contract

本任务不改变任何请求/响应契约，只增加契约本身的校验：

- 输入：`../stock-flow/openapi/swagger.json`（Swagger 2.0，由后端 `make swagger` 产出）
- 输出：`contracts/openapi-schema.ts`
- 校验命令：`pnpm api:verify`，无漂移退出码 0，有漂移退出码 1 并输出 `::error::` 与 diff

## Verification

```bash
pnpm --config.store-dir=/tmp/agent-cache/pnpm-store run api:generate
pnpm --config.store-dir=/tmp/agent-cache/pnpm-store run api:verify      # 期望退出码 0

# 漂移场景：修改后端 swagger.json 的某个 summary 后
pnpm --config.store-dir=/tmp/agent-cache/pnpm-store run api:verify      # 期望退出码 1 + diff
```

CI 侧**不需要任何 secret**：`Mercer08572/stock-flow` 是公开仓库（已用 GitHub API 核实
`private: false`），`actions/checkout` 用默认 `GITHUB_TOKEN`（`contents: read`）即可检出。
仍要求"后端先提交契约、前端再同步"的合并顺序，因为 PR 中对比的是后端 `main` 上的契约。

## Acceptance Criteria

- [x] 契约快照位于 `contracts/openapi-schema.ts`，文件头说明其定位与禁止用途
- [x] `pnpm api:generate` 幂等（连续两次生成 byte-identical），且重复执行不累积文件头
- [x] 快照类型内容与迁移前一致（仅新增文件头说明）
- [x] `pnpm api:verify` 无漂移时退出码 0
- [x] 人为制造契约漂移时 `pnpm api:verify` 退出码 1 并打印可读 diff
- [x] 后端目录或生成器缺失时给出明确报错并以非 0 退出，不产生半成品文件
- [x] 业务代码零改动，且无任何代码 import 契约快照
- [x] `.prettierignore`、`eslint.config.js` 忽略清单同步为 `contracts/`
- [x] 前端 CI 新增 `contract` job，且不在 `push` 事件上触发
- [x] README/AGENTS.md 说明两层类型的职责与同步顺序，并写明无需 secret
- [x] `pnpm check` 通过
- [x] `pnpm test:e2e` 通过

## 验证记录（2026-09-16，本地实测）

- `pnpm api:generate`：连续两次生成结果 byte-identical（幂等）。
- `pnpm api:verify`：无漂移退出码 0；给后端 `swagger.json` 的 `warehouse.Reference` 加字段后
  退出码 1 并打印 diff（只改 `summary` 不会影响生成的类型，因此不作为漂移用例）；复原后后端工作区干净。
- 后端目录不存在时（`bash scripts/verify-api-contract.sh /nonexistent`）报错退出 1；生成器缺失时同样。
- `pnpm check` 退出码 0（format/lint/typecheck/test/build）；`pnpm test:e2e` 4 passed。
- 对比基准核实：远端 `stock-flow` main 的 `openapi/swagger.json` 与本地逐字节一致
  （143740 字节、sha256 前缀 `811a8130883bd876`），因此契约校验在推送后即可工作。

## 未验证项（如实标注）

- CI `contract` job 的实际运行未验证：需要推送后由 GitHub Actions 执行；本机无法运行 Actions。
- 已知覆盖缺口：本方案只覆盖"契约文件发生变化"，覆盖不到"契约文件未变但运行时形状变化"
  （如 `omitempty` 字段在主数据软删除后整体消失），该缺口留待可空字段建模与运行时校验任务处理。
