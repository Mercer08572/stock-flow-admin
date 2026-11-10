import { expect, test } from '@playwright/test'

import { mockApi, ok } from './support/api-mock'

/**
 * 路由级加载进度条：导航开始到路由确认之间应可见。
 *
 * 直接点菜单通常几十毫秒就结束，断言会不稳定；这里把目标页面的懒加载模块延迟 800ms，
 * 让导航停留在 chunk 下载阶段，从而能稳定观察到进度条出现与收尾。
 */
test('shows a progress bar while a lazy route chunk loads', async ({ page }) => {
  await mockApi(page, [
    {
      method: 'GET',
      path: '/health',
      respond: (route) => route.fulfill({ json: ok({ service: 'stock-flow', status: 'ok' }) }),
    },
  ])

  await page.goto('/')
  await expect(page.locator('.app-shell')).toBeVisible()

  // 延迟「库存余额」页面的懒加载模块，导航会停在 beforeEach 之后的 chunk 下载阶段
  await page.route('**/src/features/inventory/StockListView.vue*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })

  // 移动端导航在抽屉里，桌面端在常驻侧栏里
  const width = page.viewportSize()?.width ?? 0
  if (width < 768) await page.getByRole('button', { name: '打开导航' }).click()

  const bar = page.locator('.n-loading-bar-container')

  await page.locator('.n-menu-item-content').filter({ hasText: '库存余额' }).click()

  await expect(bar).toBeVisible()
  await expect(bar).toBeHidden({ timeout: 5000 })
})
