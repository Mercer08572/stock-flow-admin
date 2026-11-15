import { expect, test } from '@playwright/test'

import { mockApi, ok, type StubRoute } from './support/api-mock'

/**
 * 统计图表：工作台的库存操作趋势，以及系统设置下的 API 监控页。
 *
 * 后端两个统计接口都按时间桶补零后返回，因此这里造的数据必须满足
 * 「buckets 与每条序列等长」——否则断言通过也可能掩盖前端错位渲染。
 */

const TIMEZONE = 'Asia/Shanghai'

function buckets(granularity: 'hour' | 'day', count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    if (granularity === 'day') {
      const day = String(index + 1).padStart(2, '0')
      return `2026-11-${day}T00:00:00+08:00`
    }
    const hour = String(index).padStart(2, '0')
    return `2026-11-12T${hour}:00:00+08:00`
  })
}

function movementStats(granularity: 'hour' | 'day', count: number) {
  const labels = buckets(granularity, count)
  const series = [
    'increase',
    'decrease_available',
    'reserve',
    'decrease_reserved',
    'release_reserved',
  ].map((operationType, seriesIndex) => ({
    operation_type: operationType,
    calls: labels.map((_, index) => (index + seriesIndex) % 7),
  }))

  return {
    granularity,
    timezone: TIMEZONE,
    from: labels[0],
    to: labels[labels.length - 1],
    buckets: labels,
    series,
  }
}

function throughputStats(granularity: 'hour' | 'day', count: number) {
  const labels = buckets(granularity, count)
  return {
    granularity,
    timezone: TIMEZONE,
    from: labels[0],
    to: labels[labels.length - 1],
    buckets: labels,
    total: labels.map((_, index) => 10 + index),
    failed: labels.map((_, index) => index % 2),
    failure_rate: labels.map((_, index) => (index % 2 === 0 ? 0 : 0.1)),
  }
}

const healthRoute: StubRoute = {
  method: 'GET',
  path: '/health',
  respond: (route) => route.fulfill({ json: ok({ status: 'ok', service: 'stock-flow' }) }),
}

/** 按请求 URL 里的 granularity 返回对应粒度的数据，模拟真实后端 */
function movementRoute(requests: string[]): StubRoute {
  return {
    method: 'GET',
    path: '/inventory/movements/stats',
    respond: async (route) => {
      requests.push(route.request().url())
      const granularity = new URL(route.request().url()).searchParams.get('granularity')
      const isDay = granularity === 'day'
      await route.fulfill({
        json: ok(movementStats(isDay ? 'day' : 'hour', isDay ? 7 : 24)),
      })
    },
  }
}

function throughputRoute(requests: string[]): StubRoute {
  return {
    method: 'GET',
    path: '/audit/stats',
    respond: async (route) => {
      requests.push(route.request().url())
      const granularity = new URL(route.request().url()).searchParams.get('granularity')
      const isDay = granularity === 'day'
      await route.fulfill({
        json: ok(throughputStats(isDay ? 'day' : 'hour', isDay ? 7 : 24)),
      })
    },
  }
}

test('工作台只加载库存操作趋势，不再请求接口吞吐统计', async ({ page }) => {
  const requests: string[] = []

  await mockApi(page, [healthRoute, movementRoute(requests), throughputRoute(requests)])

  await page.goto('/')
  await expect(page.locator('.trend-chart canvas')).toBeVisible()

  // 先确认主图请求确实发出，再断言工作台没有拉 /audit/stats
  await expect
    .poll(() => requests.some((url) => url.includes('/inventory/movements/stats')))
    .toBe(true)
  expect(requests.some((url) => url.includes('/audit/stats'))).toBe(false)

  // 切到近 7 天：应改用 day 粒度重新请求
  await page.getByText('近 7 天', { exact: true }).click()
  await expect.poll(() => requests.some((url) => url.includes('granularity=day'))).toBe(true)
  await expect(page.locator('.trend-chart canvas')).toBeVisible()
})

test('API 监控页展示库存接口调用量与失败率，切换范围改用日粒度', async ({ page }) => {
  const requests: string[] = []

  await mockApi(page, [healthRoute, movementRoute(requests), throughputRoute(requests)])

  await page.goto('/settings/api-monitor')

  // PageHeader 只写页面名，图表标题下放到卡片上
  await expect(page.getByRole('heading', { level: 1, name: 'API 监控' })).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: '库存接口调用量与失败率趋势' }),
  ).toBeVisible()

  await expect(page.locator('.throughput-chart canvas')).toBeVisible()
  await expect.poll(() => requests.some((url) => url.includes('granularity=hour'))).toBe(true)

  await page.getByText('近 7 天', { exact: true }).click()
  await expect.poll(() => requests.some((url) => url.includes('granularity=day'))).toBe(true)
  await expect(page.locator('.throughput-chart canvas')).toBeVisible()
})

test.describe('桌面导航', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('从系统设置进入 API 监控', async ({ page }) => {
    await mockApi(page, [healthRoute, movementRoute([]), throughputRoute([])])
    await page.goto('/')

    const sidebar = page.locator('.app-sidebar')
    await sidebar.getByText('系统设置', { exact: true }).click()
    const entry = sidebar.getByText('API 监控', { exact: true })
    await expect(entry).toBeVisible()
    await entry.click()

    await expect(page).toHaveURL(/\/settings\/api-monitor$/)
    await expect(page.getByRole('heading', { level: 1, name: 'API 监控' })).toBeVisible()
  })
})

test.describe('320 px', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  for (const [name, path, selector] of [
    ['工作台', '/', '.trend-chart canvas'],
    ['API 监控', '/settings/api-monitor', '.throughput-chart canvas'],
  ] as const) {
    test(`${name}的统计图不产生横向溢出`, async ({ page }) => {
      await mockApi(page, [healthRoute, movementRoute([]), throughputRoute([])])

      await page.goto(path)
      await expect(page.locator(selector)).toBeVisible()

      const overflow = await page.evaluate(() => {
        const content = document.querySelector('.app-content') as HTMLElement
        return content.scrollWidth - content.clientWidth
      })
      // 允许 1px 的亚像素误差，但不允许出现真正的横向滚动
      expect(overflow).toBeLessThanOrEqual(1)
    })
  }
})
