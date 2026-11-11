import { describe, expect, it } from 'vitest'

import {
  actorText,
  authMethodLabel,
  authMethodTagType,
  formatLatency,
  pathText,
  statusTagType,
} from '@/features/audit/audit-log'

describe('审计日志展示', () => {
  it('maps authentication methods to labels and tag types', () => {
    expect(authMethodLabel('admin_session')).toBe('管理员会话')
    expect(authMethodLabel('api_app')).toBe('API 密钥')
    expect(authMethodLabel('none')).toBe('未认证')
    expect(authMethodLabel('ambiguous')).toBe('认证冲突')
    expect(authMethodTagType('api_app')).toBe('success')
    expect(authMethodTagType('ambiguous')).toBe('warning')
    expect(authMethodTagType('unknown')).toBe('default')
  })

  it('shows the actor label with its internal id, and falls back to 未认证', () => {
    expect(actorText({ actor_label: 'app_wms', actor_id: 9, actor_type: 'api_app' })).toBe(
      'app_wms (#9)',
    )
    expect(actorText({ actor_id: 7, actor_type: 'admin' })).toBe('管理员 #7')
    expect(actorText({ actor_id: 7, actor_type: 'api_app' })).toBe('API 应用 #7')
    expect(actorText({})).toBe('未认证')
  })

  it('maps status codes to Naive tag types', () => {
    expect(statusTagType(200)).toBe('success')
    expect(statusTagType(204)).toBe('success')
    expect(statusTagType(304)).toBe('info')
    expect(statusTagType(401)).toBe('warning')
    expect(statusTagType(500)).toBe('error')
    expect(statusTagType(99)).toBe('default')
  })

  it('formats latency in ms and seconds', () => {
    expect(formatLatency(0)).toBe('0 ms')
    expect(formatLatency(999)).toBe('999 ms')
    expect(formatLatency(1500)).toBe('1.50 s')
  })

  it('shows the actual path and falls back to the route template', () => {
    expect(pathText({ path: '/api/v1/materials/12', route: '/api/v1/materials/:id' })).toBe(
      '/api/v1/materials/12',
    )
    expect(pathText({ path: '/api/v1/materials/12' })).toBe('/api/v1/materials/12')
    expect(pathText({ path: '', route: '/api/v1/materials/:id' })).toBe('/api/v1/materials/:id')
  })
})
