import { describe, expect, it } from 'vitest'

import { isApiTestEnabled } from './enabled'

describe('isApiTestEnabled', () => {
  it('仅接受 true（忽略大小写与首尾空白）', () => {
    expect(isApiTestEnabled('true')).toBe(true)
    expect(isApiTestEnabled(' TRUE ')).toBe(true)
  })

  it('未配置或其它值一律关闭', () => {
    expect(isApiTestEnabled(undefined)).toBe(false)
    expect(isApiTestEnabled('')).toBe(false)
    expect(isApiTestEnabled('false')).toBe(false)
    expect(isApiTestEnabled('1')).toBe(false)
    expect(isApiTestEnabled('yes')).toBe(false)
  })
})
