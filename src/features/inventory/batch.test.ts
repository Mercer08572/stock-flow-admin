import { describe, expect, it } from 'vitest'

import { BATCH_PAGE_SIZE, batchStatusLabel, buildBatchQuery, formatDateOnly } from './batch'

describe('buildBatchQuery', () => {
  it('sends only pagination when no filter is selected', () => {
    expect(buildBatchQuery({ skuId: null, status: null, keyword: '' }, 0)).toEqual({
      limit: BATCH_PAGE_SIZE,
      offset: 0,
    })
  })

  it('trims the keyword and omits blank search text', () => {
    expect(buildBatchQuery({ skuId: 7, status: 'inactive', keyword: '  B-2025  ' }, 100)).toEqual({
      sku_id: 7,
      status: 'inactive',
      q: 'B-2025',
      limit: BATCH_PAGE_SIZE,
      offset: 100,
    })

    expect(buildBatchQuery({ skuId: null, status: null, keyword: '   ' }, 0).q).toBeUndefined()
  })

  it('never sends a negative offset', () => {
    expect(buildBatchQuery({ skuId: null, status: null, keyword: '' }, -100).offset).toBe(0)
  })

  it('uses the backend MaxListLimit as the page size', () => {
    expect(BATCH_PAGE_SIZE).toBe(100)
  })
})

describe('formatDateOnly', () => {
  it('keeps the calendar day untouched instead of applying a timezone', () => {
    // new Date('2025-05-01').toLocaleString('zh-CN') 在东八区会显示 05-01 08:00
    expect(formatDateOnly('2025-05-01')).toBe('2025-05-01')
  })

  it('takes the date part of a longer timestamp', () => {
    expect(formatDateOnly('2025-05-01T00:00:00Z')).toBe('2025-05-01')
  })

  it('falls back for empty values', () => {
    expect(formatDateOnly(null)).toBe('-')
    expect(formatDateOnly('')).toBe('-')
  })
})

describe('batchStatusLabel', () => {
  it('maps status values to Chinese labels', () => {
    expect(batchStatusLabel('active')).toBe('启用')
    expect(batchStatusLabel('inactive')).toBe('停用')
  })
})
