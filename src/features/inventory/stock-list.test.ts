import { describe, expect, it } from 'vitest'

import {
  buildStockQuery,
  hasNextPage,
  referenceCode,
  referenceName,
  toSelectOptions,
  STOCK_PAGE_SIZE,
} from './stock-list'

describe('buildStockQuery', () => {
  it('sends no id filters when both are empty', () => {
    expect(buildStockQuery({ warehouseId: null, skuId: null }, 0)).toEqual({
      limit: STOCK_PAGE_SIZE,
      offset: 0,
    })
  })

  it('sends only the selected filters', () => {
    expect(buildStockQuery({ warehouseId: 9, skuId: null }, 100)).toEqual({
      warehouse_id: 9,
      limit: STOCK_PAGE_SIZE,
      offset: 100,
    })
  })

  it('never sends a negative offset', () => {
    expect(buildStockQuery({ warehouseId: null, skuId: null }, -100).offset).toBe(0)
  })

  it('uses the backend MaxListLimit as the page size', () => {
    // 后端 MaxListLimit = 100，超过会被静默截断
    expect(STOCK_PAGE_SIZE).toBe(100)
    expect(buildStockQuery({ warehouseId: null, skuId: null }, 0).limit).toBe(100)
  })
})

describe('hasNextPage', () => {
  it('assumes more pages only when the page is full', () => {
    // 契约没有 total，只能按「是否满页」推断
    expect(hasNextPage(100, 100)).toBe(true)
    expect(hasNextPage(99, 100)).toBe(false)
    expect(hasNextPage(0, 100)).toBe(false)
  })
})

describe('reference fallback', () => {
  const reference = { id: 5, code: 'WH-01', name: '主仓', deleted: false }

  it('prefers the reference code', () => {
    expect(referenceCode(reference, 5)).toBe('WH-01')
    expect(referenceName(reference, 5)).toBe('主仓')
  })

  it('falls back to the id when the reference is missing entirely', () => {
    // backend 的 *Reference + omitempty 会让字段整体消失
    expect(referenceCode(undefined, 5)).toBe('#5')
    expect(referenceName(undefined, 5)).toBe('#5')
  })

  it('marks a soft deleted reference', () => {
    expect(referenceName({ ...reference, deleted: true }, 5)).toBe('主仓（已删除）')
  })

  it('falls back for a reference with blank fields', () => {
    expect(referenceCode({ ...reference, code: '' }, 5)).toBe('#5')
    expect(referenceName({ ...reference, name: '' }, 5)).toBe('#5')
  })
})

describe('toSelectOptions', () => {
  it('labels options with both code and name', () => {
    expect(
      toSelectOptions([
        { id: 1, code: 'WH-01', name: '主仓' },
        { id: 2, code: 'WH-02', name: '备用仓' },
      ]),
    ).toEqual([
      { label: 'WH-01 - 主仓', value: 1 },
      { label: 'WH-02 - 备用仓', value: 2 },
    ])
  })
})
