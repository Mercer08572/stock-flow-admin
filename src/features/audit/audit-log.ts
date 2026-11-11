import { formatDateTime } from '@/components/common/data-table'

import type { AuditAuthMethod, AuditLog } from '@/types/api'

export const auditAuthMethodOptions: Array<{ label: string; value: AuditAuthMethod }> = [
  { label: '管理员会话', value: 'admin_session' },
  { label: 'API 密钥', value: 'api_app' },
  { label: '未认证', value: 'none' },
  { label: '认证冲突', value: 'ambiguous' },
]

export function authMethodLabel(method: string | undefined): string {
  return auditAuthMethodOptions.find((option) => option.value === method)?.label ?? method ?? '-'
}

export function authMethodTagType(
  method: string | undefined,
): 'success' | 'info' | 'warning' | 'default' {
  switch (method) {
    case 'api_app':
      return 'success'
    case 'admin_session':
      return 'info'
    case 'ambiguous':
      return 'warning'
    default:
      return 'default'
  }
}

/** 调用方展示：优先 username / app_id，并附上内部 id；未认证请求没有调用方 */
export function actorText(log: Pick<AuditLog, 'actor_label' | 'actor_id' | 'actor_type'>): string {
  if (log.actor_label) {
    return log.actor_id === undefined ? log.actor_label : `${log.actor_label} (#${log.actor_id})`
  }
  if (log.actor_id !== undefined) {
    return `${log.actor_type === 'api_app' ? 'API 应用' : '管理员'} #${log.actor_id}`
  }
  return '未认证'
}

export function statusTagType(
  statusCode: number,
): 'success' | 'info' | 'warning' | 'error' | 'default' {
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 300 && statusCode < 400) return 'info'
  if (statusCode >= 400 && statusCode < 500) return 'warning'
  if (statusCode >= 500) return 'error'
  return 'default'
}

export function formatLatency(latencyMS: number): string {
  if (latencyMS < 1000) return `${latencyMS} ms`
  return `${(latencyMS / 1000).toFixed(2)} s`
}

export function formatAuditTime(value: string): string {
  return formatDateTime(value)
}

/** 审计展示实际 path；route 模板只作为悬浮说明，避免不同 id 看起来相同 */
export function pathText(log: Pick<AuditLog, 'path' | 'route'>): string {
  return log.path || log.route || '-'
}
