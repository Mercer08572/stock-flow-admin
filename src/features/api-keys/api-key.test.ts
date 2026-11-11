import { describe, expect, it } from 'vitest'

import {
  apiAppStatusLabel,
  apiAppStatusTagType,
  apiSecretStatusLabel,
  apiSecretStatusTagType,
  canBlock,
  canReissue,
  canUnblock,
  formatExpiry,
  formatLastUsed,
  isSecretExpired,
  isoToTimestamp,
  timestampToIso,
} from '@/features/api-keys/api-key'

const now = Date.parse('2026-11-10T12:00:00.000Z')

describe('API 密钥状态展示', () => {
  it('labels an active, non-expired secret as 启用', () => {
    const secret = { status: 'active' as const, expires_at: '2026-12-01T00:00:00.000Z' }
    expect(apiSecretStatusLabel(secret, now)).toBe('启用')
    expect(apiSecretStatusTagType(secret, now)).toBe('success')
    expect(isSecretExpired(secret, now)).toBe(false)
  })

  it('labels an active but expired secret as 已过期', () => {
    const secret = { status: 'active' as const, expires_at: '2026-11-01T00:00:00.000Z' }
    expect(apiSecretStatusLabel(secret, now)).toBe('已过期')
    expect(apiSecretStatusTagType(secret, now)).toBe('warning')
    expect(isSecretExpired(secret, now)).toBe(true)
  })

  it('labels a blocked secret as 已禁用 regardless of expiry', () => {
    const secret = { status: 'blocked' as const, expires_at: null }
    expect(apiSecretStatusLabel(secret, now)).toBe('已禁用')
    expect(apiSecretStatusTagType(secret, now)).toBe('default')
  })

  it('never treats a missing expiry as expired', () => {
    expect(isSecretExpired({ expires_at: null }, now)).toBe(false)
  })
})

describe('API 应用状态展示', () => {
  it('maps active / inactive to labels and tag types', () => {
    expect(apiAppStatusLabel('active')).toBe('启用')
    expect(apiAppStatusLabel('inactive')).toBe('停用')
    expect(apiAppStatusTagType('active')).toBe('success')
    expect(apiAppStatusTagType('inactive')).toBe('default')
  })
})

describe('时间与操作可用性', () => {
  it('formats empty expiry and last-used values', () => {
    expect(formatExpiry(null)).toBe('永不过期')
    expect(formatLastUsed(null)).toBe('从未使用')
    expect(formatExpiry('not-a-date')).toBe('-')
  })

  it('only allows reissue and block for active secrets', () => {
    expect(canReissue({ status: 'active' })).toBe(true)
    expect(canReissue({ status: 'blocked' })).toBe(false)
    expect(canBlock({ status: 'active' })).toBe(true)
    expect(canBlock({ status: 'blocked' })).toBe(false)
  })

  it('only allows unblock for blocked secrets', () => {
    expect(canUnblock({ status: 'blocked' })).toBe(true)
    expect(canUnblock({ status: 'active' })).toBe(false)
  })

  it('round-trips RFC3339 timestamps through the date picker value', () => {
    const iso = '2026-12-01T08:30:00.000Z'
    expect(timestampToIso(isoToTimestamp(iso))).toBe(iso)
    expect(timestampToIso(null)).toBeNull()
    expect(isoToTimestamp(null)).toBeNull()
    expect(isoToTimestamp('not-a-date')).toBeNull()
  })
})
