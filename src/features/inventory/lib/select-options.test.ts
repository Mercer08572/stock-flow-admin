import { describe, expect, it } from 'vitest'

import { toSelectOptions } from './select-options'

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
