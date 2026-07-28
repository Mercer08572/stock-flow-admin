# Agent Tasks

每个可交付功能使用一个独立 Markdown 文件。文件名建议为 `<模块>-<编号>-<简述>.md`，例如 `INV-001-stock-layer-detail.md`。

任务模板：

```markdown
# <任务编号> <标题>

## Context

业务背景、关联页面，以及后端契约位置。

## Scope

- 明确要实现的内容。

## Out Of Scope

- 明确本次不处理的内容。

## API Contract

- METHOD /api/v1/path
- 请求、响应、错误码和权限约束。

## Acceptance Criteria

- [ ] 从用户视角可验证的行为。
- [ ] 加载、空、错误和成功状态。
- [ ] 320 px 和桌面宽度均可用。
- [ ] 关键逻辑有测试。
- [ ] `pnpm check` 通过。

## Verification

列出手工验证数据、账号前置条件或特殊命令。
```

任务正文应描述行为和边界，不要预先规定无必要的组件拆分。Agent 完成任务后，在 PR 或提交说明中记录实际验证结果，不在本文件中勾选未经执行的检查。
