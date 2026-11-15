/**
 * 后端内联引用快照（`Reference`）的展示辅助。
 *
 * 列表与详情接口已经把引用实体的 `code` / `name` / `deleted` / `status` 一并返回，
 * 前端只负责渲染，不再按 ID 二次拉取整表后再自行对应。
 *
 * 仍然保留 `#id` 回退：引用字段是 `*Reference + omitempty`，
 * 关联行缺失（历史数据、外键被绕过）时字段可能整体不存在，此时宁可显示 ID，
 * 也不能让单元格静默空白。
 */

import type { Reference } from '@/types/api'

/** 引用整体缺失时回退展示 ID，避免界面静默空白 */
export function referenceCode(reference: Reference | undefined, fallbackId: number): string {
  return reference?.code || `#${fallbackId}`
}

/**
 * 名称后的状态标记。
 *
 * 软删除优先于停用：已删除的记录即便 `status` 仍是 `active` 也不该被当成可用引用。
 */
export function referenceName(reference: Reference | undefined, fallbackId: number): string {
  if (!reference) return `#${fallbackId}`

  const name = reference.name || `#${fallbackId}`
  if (reference.deleted) return `${name}（已删除）`
  if (reference.status === 'inactive') return `${name}（已停用）`
  return name
}

/** 「编码 - 名称」：表格列与下拉选项共用的一种可读形式 */
export function referenceLabel(reference: Reference | undefined, fallbackId: number): string {
  if (!reference?.code) return `#${fallbackId}`
  return `${reference.code} - ${referenceName(reference, fallbackId)}`
}
