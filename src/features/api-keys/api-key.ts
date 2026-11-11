/**
 * API 密钥页面的展示语义与列定义。
 *
 * 页面组件只关心数据加载与动作，状态文案、时间回退、按钮可用性集中在这里，
 * 便于单测覆盖「已过期 / 已禁用 / 永不过期」这些容易出错的边界。
 */

import { h, type VNode } from 'vue'
import { NButton, NTag } from 'naive-ui'

import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'

import type { APIApp, APIAppStatus, APISecret } from '@/types/api'

export function apiAppStatusLabel(status: APIAppStatus): string {
  return status === 'active' ? '启用' : '停用'
}

export function apiAppStatusTagType(status: APIAppStatus): 'success' | 'default' {
  return status === 'active' ? 'success' : 'default'
}

export function isSecretExpired(secret: Pick<APISecret, 'expires_at'>, now = Date.now()): boolean {
  if (!secret.expires_at) return false
  const expiresAt = new Date(secret.expires_at).getTime()
  return !Number.isNaN(expiresAt) && expiresAt <= now
}

/** 密钥状态：active 且已过期时显示「已过期」，避免用户误以为仍可用 */
export function apiSecretStatusLabel(
  secret: Pick<APISecret, 'status' | 'expires_at'>,
  now = Date.now(),
): string {
  if (secret.status === 'blocked') return '已禁用'
  return isSecretExpired(secret, now) ? '已过期' : '启用'
}

export function apiSecretStatusTagType(
  secret: Pick<APISecret, 'status' | 'expires_at'>,
  now = Date.now(),
): 'success' | 'warning' | 'default' {
  if (secret.status === 'blocked') return 'default'
  return isSecretExpired(secret, now) ? 'warning' : 'success'
}

export function formatExpiry(value: string | null): string {
  return value ? formatDateTime(value) : '永不过期'
}

export function formatLastUsed(value: string | null): string {
  return value ? formatDateTime(value) : '从未使用'
}

/** 重新签发要求旧密钥处于启用状态（已过期但仍启用时允许轮换） */
export function canReissue(secret: Pick<APISecret, 'status'>): boolean {
  return secret.status === 'active'
}

/** 仅启用中的密钥可以禁用 */
export function canBlock(secret: Pick<APISecret, 'status'>): boolean {
  return secret.status === 'active'
}

/** 仅已禁用的密钥可以启用 */
export function canUnblock(secret: Pick<APISecret, 'status'>): boolean {
  return secret.status === 'blocked'
}

/** Naive `NDatePicker` 使用毫秒时间戳，后端使用 RFC3339 字符串 */
export function timestampToIso(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString()
}

export function isoToTimestamp(value: string | null): number | null {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function actionButton(
  label: string,
  onClick: () => void,
  options: { disabled?: boolean; type?: 'default' | 'primary' | 'error' } = {},
): VNode {
  return h(
    NButton,
    {
      size: 'tiny',
      quaternary: true,
      type: options.type ?? 'primary',
      disabled: options.disabled === true,
      onClick,
    },
    { default: () => label },
  )
}

function actionCell(buttons: VNode[]): VNode {
  return h('div', { style: 'display: inline-flex; justify-content: flex-end; gap: 2px;' }, buttons)
}

export interface ApiAppColumnHandlers {
  onManageKeys: (row: APIApp) => void
  onEdit: (row: APIApp) => void
  onToggleStatus: (row: APIApp) => void
  onDelete: (row: APIApp) => void
}

export function apiAppColumns(handlers: ApiAppColumnHandlers): DataTableColumn<APIApp>[] {
  return [
    { key: 'name', title: '应用名称', width: 180 },
    {
      key: 'app_id',
      title: 'App ID',
      width: 220,
      render: (row) => h('code', { style: 'font-size: 12px; word-break: break-all;' }, row.app_id),
      exportValue: (row) => row.app_id,
    },
    {
      key: 'description',
      title: '描述',
      width: 200,
      render: (row) => row.description || '-',
    },
    {
      key: 'status',
      title: '状态',
      width: 90,
      filterOptions: [
        { label: '启用', value: 'active' },
        { label: '停用', value: 'inactive' },
      ],
      render: (row) =>
        h(
          NTag,
          { type: apiAppStatusTagType(row.status), size: 'small', bordered: false },
          { default: () => apiAppStatusLabel(row.status) },
        ),
      exportValue: (row) => apiAppStatusLabel(row.status),
    },
    {
      key: 'updated_at',
      title: '更新时间',
      width: 170,
      render: (row) => formatDateTime(row.updated_at),
      exportValue: (row) => formatDateTime(row.updated_at, ''),
    },
    {
      key: 'actions',
      title: '操作',
      width: 236,
      align: 'right',
      sortable: false,
      exportable: false,
      render: (row) =>
        actionCell([
          actionButton('密钥', () => handlers.onManageKeys(row)),
          actionButton('编辑', () => handlers.onEdit(row)),
          actionButton(
            row.status === 'active' ? '停用' : '启用',
            () => handlers.onToggleStatus(row),
            { type: row.status === 'active' ? 'default' : 'primary' },
          ),
          actionButton('删除', () => handlers.onDelete(row), { type: 'error' }),
        ]),
    },
  ]
}

export interface ApiSecretColumnHandlers {
  onReissue: (row: APISecret) => void
  onToggleStatus: (row: APISecret) => void
  onEdit: (row: APISecret) => void
  onDelete: (row: APISecret) => void
}

export function apiSecretColumns(handlers: ApiSecretColumnHandlers): DataTableColumn<APISecret>[] {
  return [
    { key: 'name', title: '密钥名称', width: 150 },
    {
      key: 'secret_id',
      title: 'Secret ID',
      width: 210,
      render: (row) =>
        h('code', { style: 'font-size: 12px; word-break: break-all;' }, row.secret_id),
      exportValue: (row) => row.secret_id,
    },
    {
      key: 'status',
      title: '状态',
      width: 90,
      filterOptions: [
        { label: '启用', value: 'active' },
        { label: '已禁用', value: 'blocked' },
      ],
      render: (row) =>
        h(
          NTag,
          {
            type: apiSecretStatusTagType(row),
            size: 'small',
            bordered: false,
          },
          { default: () => apiSecretStatusLabel(row) },
        ),
      exportValue: (row) => apiSecretStatusLabel(row),
    },
    {
      key: 'expires_at',
      title: '过期时间',
      width: 170,
      render: (row) => formatExpiry(row.expires_at),
      exportValue: (row) => formatExpiry(row.expires_at),
    },
    {
      key: 'last_used_at',
      title: '最后使用',
      width: 170,
      render: (row) => formatLastUsed(row.last_used_at),
      exportValue: (row) => formatLastUsed(row.last_used_at),
    },
    {
      key: 'created_at',
      title: '创建时间',
      width: 170,
      render: (row) => formatDateTime(row.created_at),
      exportValue: (row) => formatDateTime(row.created_at, ''),
    },
    {
      key: 'actions',
      title: '操作',
      width: 250,
      align: 'right',
      sortable: false,
      exportable: false,
      render: (row) =>
        actionCell([
          actionButton('重新签发', () => handlers.onReissue(row), {
            disabled: !canReissue(row),
          }),
          actionButton(
            row.status === 'active' ? '禁用' : '启用',
            () => handlers.onToggleStatus(row),
            {
              disabled: row.status === 'active' ? !canBlock(row) : !canUnblock(row),
              type: row.status === 'active' ? 'default' : 'primary',
            },
          ),
          actionButton('编辑', () => handlers.onEdit(row)),
          actionButton('删除', () => handlers.onDelete(row), { type: 'error' }),
        ]),
    },
  ]
}
