import { describe, expect, it } from 'vitest'

import { referenceCode, referenceLabel, referenceName } from './reference-display'

import type { Reference } from '@/types/api'

const active: Reference = { id: 5, code: 'WH-01', name: '主仓', deleted: false, status: 'active' }

describe('referenceCode', () => {
  it('prefers the reference code', () => {
    expect(referenceCode(active, 5)).toBe('WH-01')
  })

  it('falls back to the id when the reference is missing entirely', () => {
    expect(referenceCode(undefined, 5)).toBe('#5')
  })

  it('falls back for a reference with a blank code', () => {
    expect(referenceCode({ ...active, code: '' }, 5)).toBe('#5')
  })
})

describe('referenceName', () => {
  it('renders the plain name for an active reference', () => {
    expect(referenceName(active, 5)).toBe('主仓')
  })

  it('marks a soft deleted reference', () => {
    expect(referenceName({ ...active, deleted: true }, 5)).toBe('主仓（已删除）')
  })

  it('marks an inactive reference', () => {
    expect(referenceName({ ...active, status: 'inactive' }, 5)).toBe('主仓（已停用）')
  })

  it('prefers the deleted marker when both apply', () => {
    expect(referenceName({ ...active, deleted: true, status: 'inactive' }, 5)).toBe(
      '主仓（已删除）',
    )
  })

  it('does not treat an unqueried status as inactive', () => {
    expect(referenceName({ id: 5, code: 'WH-01', name: '主仓', deleted: false }, 5)).toBe('主仓')
  })

  it('falls back to the id when the reference is missing or nameless', () => {
    expect(referenceName(undefined, 5)).toBe('#5')
    expect(referenceName({ ...active, name: '' }, 5)).toBe('#5')
  })
})

describe('referenceLabel', () => {
  it('joins code and name', () => {
    expect(referenceLabel(active, 5)).toBe('WH-01 - 主仓')
  })

  it('keeps the status marker on the name part', () => {
    expect(referenceLabel({ ...active, status: 'inactive' }, 5)).toBe('WH-01 - 主仓（已停用）')
  })

  it('falls back to a single id when the reference is missing', () => {
    expect(referenceLabel(undefined, 5)).toBe('#5')
  })
})
