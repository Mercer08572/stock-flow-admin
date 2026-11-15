import { describe, expect, it } from 'vitest'

import { buildStockQuery, toSelectOptions, STOCK_PAGE_SIZE } from './stock-list'

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

describe('toSelectOptions', () => {
  it('labels options with both code and name', () => {
    expect(
      toSelectOptions([
        { id: 1, code: 'WH-01', name: '主仓' },
        { id: 2, code: 'WH-02', name: '备用仓' },
      ]),
    ).toEqual([
      { label: 'WH-01 - 主仓', value: 1, code: 'WH-01', name: '主仓' },
      { label: 'WH-02 - 备用仓', value: 2, code: 'WH-02', name: '备用仓' },
    ])
  })

  it('keeps code and name apart so the dropdown can render two lines', () => {
    const [option] = toSelectOptions([{ id: 7, code: 'SKU-1', name: '橄榄油' }])

    expect(option?.code).toBe('SKU-1')
    expect(option?.name).toBe('橄榄油')
  })
})
