/**
 * 行操作列：详情 / 编辑 /（可选）停用 / 删除。
 *
 * 5 个资源的按钮集合、顺序与禁用规则完全一致（停用在 `inactive` 行上禁用），
 * 差异只有「回调做什么」。放在 lib 里是为了让各资源页不必各自写一遍 `h()` 渲染。
 */

import { h, type VNode } from 'vue'
import { NButton } from 'naive-ui'

import type { DataTableColumn } from '@/components/common/data-table'
import type { BaseEntity } from '@/types/api'

export interface RowActionHandlers<T> {
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  /** 仅仓库提供；缺省时不渲染「停用」按钮 */
  onDisable?: ((row: T) => void) | undefined
  /** 仅物料提供；缺省时不渲染「详情」按钮（有详情页的资源才传） */
  onDetail?: ((row: T) => void) | undefined
}

export function actionColumn<T extends BaseEntity>(
  handlers: RowActionHandlers<T>,
): DataTableColumn<T> {
  return {
    key: 'actions',
    title: '操作',
    width: 208,
    align: 'right',
    sortable: false,
    exportable: false,
    render: (row) => {
      const buttons: VNode[] = []

      // 详情只对物料开放：它是进入下级数据（该物料的 SKU）的入口
      if (handlers.onDetail) {
        buttons.push(
          h(
            NButton,
            {
              size: 'tiny',
              quaternary: true,
              type: 'primary',
              onClick: () => handlers.onDetail?.(row),
            },
            { default: () => '详情' },
          ),
        )
      }

      buttons.push(
        h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            type: 'primary',
            onClick: () => handlers.onEdit(row),
          },
          { default: () => '编辑' },
        ),
      )

      // 停用只对仓库开放：状态已是 inactive 时禁用，避免无意义的重复请求
      if (handlers.onDisable) {
        buttons.push(
          h(
            NButton,
            {
              size: 'tiny',
              quaternary: true,
              disabled: row.status !== 'active',
              onClick: () => handlers.onDisable?.(row),
            },
            { default: () => '停用' },
          ),
        )
      }

      buttons.push(
        h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            type: 'error',
            onClick: () => handlers.onDelete(row),
          },
          { default: () => '删除' },
        ),
      )

      return h('div', { class: 'row-actions' }, buttons)
    },
  }
}
