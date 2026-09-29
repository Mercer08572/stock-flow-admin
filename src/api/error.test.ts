import { describe, expect, it } from 'vitest'

import { ApiError, getConflictMessage, getErrorDetail, getErrorMessage } from './error'

function conflict(message: string) {
  return new ApiError(message, { status: 409, code: 1009, traceId: 'trace-1' })
}

describe('getErrorDetail', () => {
  it('exposes message, status, code and trace id', () => {
    expect(getErrorDetail(conflict('unit code already exists'))).toEqual({
      message: 'unit code already exists',
      status: 409,
      code: 1009,
      traceId: 'trace-1',
    })
  })

  it('falls back for non-Error values', () => {
    expect(getErrorDetail('boom')).toEqual({ message: '请求失败，请稍后重试' })
  })

  it('keeps getErrorMessage behaviour', () => {
    expect(getErrorMessage(conflict('unit code already exists'))).toBe('unit code already exists')
  })
})

describe('getConflictMessage', () => {
  it('maps a duplicate code conflict to Chinese', () => {
    expect(getConflictMessage(conflict('warehouse code already exists'))).toBe(
      '编码已存在，请更换后重试',
    )
  })

  it('maps an inventory reference conflict to Chinese', () => {
    expect(
      getConflictMessage(conflict('warehouse is referenced by inventory and cannot be deleted')),
    ).toBe('已被库存引用，无法删除')
  })

  it('falls back to the backend message for an unmapped conflict', () => {
    expect(getConflictMessage(conflict('some future conflict'))).toBe('some future conflict')
  })

  it('leaves non-conflict errors untouched', () => {
    const notFound = new ApiError('warehouse not found', { status: 404, code: 1004 })

    expect(getConflictMessage(notFound)).toBe('warehouse not found')
  })
})
