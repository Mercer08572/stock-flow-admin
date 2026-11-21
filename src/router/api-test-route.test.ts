import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * 「API 测试」页的总闸同时控制路由注册：
 * 关闭时路由不存在，直接访问只能落到 catch-all 的 404 页面。
 */
describe('API 测试路由开关', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('关闭时 /settings/api-test 路由不存在', async () => {
    vi.stubEnv('VITE_ENABLE_API_TEST', 'false')
    vi.resetModules()

    const { router } = await import('@/router')
    expect(router.hasRoute('api-test')).toBe(false)
  })

  it('开启时注册 api-test 路由', async () => {
    vi.stubEnv('VITE_ENABLE_API_TEST', 'true')
    vi.resetModules()

    const { router } = await import('@/router')
    expect(router.hasRoute('api-test')).toBe(true)
  })
})
