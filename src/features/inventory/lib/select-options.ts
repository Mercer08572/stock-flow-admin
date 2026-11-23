/**
 * 库存筛选下拉的选项构造：标签同时给出编码与名称，避免用户只看得到数字 ID。
 *
 * `code` / `name` 单独保留一份，供 `ReferenceSelect` 两行展示；
 * `label` 仍是「编码 - 名称」，它同时承担 `filterable` 的匹配文本。
 */

import type { ReferenceSelectOption } from '@/components/common/reference-select'

export function toSelectOptions(
  items: Array<{ id: number; code: string; name: string }>,
): ReferenceSelectOption<number>[] {
  return items.map((item) => ({
    label: `${item.code} - ${item.name}`,
    value: item.id,
    code: item.code,
    name: item.name,
  }))
}
