import { describe, expect, it } from 'vitest'

import { buildStockQuery, STOCK_PAGE_SIZE } from './stock-list'

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
