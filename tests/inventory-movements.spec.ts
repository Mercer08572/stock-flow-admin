import { expect, test, type Page } from '@playwright/test'

import { fail, mockApi, ok, type StubRoute } from './support/api-mock'

/**
 * 库存流水页。
 *
 * 数据量按「远超一屏」造：默认页大小 100，虚拟列表要求 DOM 里的行数明显少于数据条数，
 * 否则断言会退化成「表格能显示」而无法证明虚拟化生效。
 */

const warehouse = { id: 3, code: 'WH-01', name: '主仓', deleted: false }
const sku = { id: 7, code: 'SKU-01', name: '标准箱', deleted: false }

interface MovementOptions {
  operation_type?: string
  batch_id?: number | null
  reservation_id?: number | null
  source_type?: string | null
  actor_label?: string | null
}

function movement(id: number, options: MovementOptions = {}) {
  const {
    operation_type = 'increase',
    batch_id = null,
    reservation_id = null,
    source_type = null,
    actor_label = 'admin',
  } = options
  return {
    id,
    operation_type,
    warehouse_id: warehouse.id,
    sku_id: sku.id,
    batch_id,
    stock_layer_id: 11,
    reservation_id,
    reservation_item_id: null,
    qty: `${id}.000000`,
    idempotency_key: `movement-${id}`,
    source_type,
    source_id: source_type ? 'SO-1' : null,
    source_line_id: source_type ? '5' : null,
    actor_type: 'admin',
    actor_id: 1,
    actor_label,
    created_at: '2026-10-27T10:41:27+08:00',
  }
}

/** 造 n 条连续流水，id 从 start 开始 */
function movements(count: number, start = 1) {
  return Array.from({ length: count }, (_, index) => movement(start + index))
}

function referenceRoutes(): StubRoute[] {
  return [
    {
      method: 'GET',
      path: '/warehouses',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [warehouse], total: 1, limit: 100, offset: 0 }) }),
    },
    {
      method: 'GET',
      path: '/skus',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [sku], total: 1, limit: 100, offset: 0 }) }),
    },
  ]
}

/** 按 offset 切片的列表桩：记录每次请求的 query，便于断言分页与筛选参数 */
function listRoute(
  items: unknown[],
  queries: string[] = [],
  total: number = items.length,
): StubRoute {
  return {
    method: 'GET',
    path: '/inventory/movements',
    respond: async (route) => {
      const url = new URL(route.request().url())
      queries.push(url.search)
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? 0)
      await route.fulfill({
        json: ok({ items: items.slice(offset, offset + limit), total, limit, offset }),
      })
    },
  }
}

const headers = (page: Page) =>
  page.locator('.app-sidebar .n-menu-item-content-header').allTextContents()

test.describe('库存流水（桌面）', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('places 库存流水 between 库存余额 and 主数据', async ({ page }) => {
    await mockApi(page, [
      {
        method: 'GET',
        path: '/health',
        respond: (route) => route.fulfill({ json: ok({ service: 'stock-flow', status: 'ok' }) }),
      },
    ])

    await page.goto('/')
    // 外壳要等会话 bootstrap 完成才渲染，过早读取会拿到空数组
    await page.locator('.app-sidebar .n-menu-item-content-header').first().waitFor()

    const labels = await headers(page)
    expect(labels.slice(0, 5)).toEqual(['工作台', '库存占用', '库存余额', '库存流水', '主数据'])

    await page.locator('.n-menu-item-content').filter({ hasText: '库存流水' }).click()
    await expect(page).toHaveURL('/inventory/movements')
    await expect(page.getByRole('heading', { level: 1, name: '库存流水' })).toBeVisible()
  })

  test('shows the Chinese operation type instead of the raw enum', async ({ page }) => {
    await mockApi(page, [
      ...referenceRoutes(),
      listRoute([
        movement(1, { operation_type: 'increase' }),
        movement(2, { operation_type: 'reserve', reservation_id: 5 }),
        movement(3, { operation_type: 'release_reserved' }),
        movement(4, { operation_type: 'decrease_available' }),
        movement(5, { operation_type: 'decrease_reserved' }),
      ]),
    ])

    await page.goto('/inventory/movements')

    // 五个枚举值都必须翻译成中文，英文原文不应出现在表格里
    for (const label of ['增加', '预留', '释放预留', '扣减可用', '扣减预留']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }
    await expect(page.locator('tbody td[data-col-key="operation_type"]')).toHaveText([
      '增加',
      '预留',
      '释放预留',
      '扣减可用',
      '扣减预留',
    ])
  })

  test('renders readable references, source and actor', async ({ page }) => {
    await mockApi(page, [
      ...referenceRoutes(),
      listRoute([
        movement(1, { operation_type: 'reserve', reservation_id: 5, source_type: 'sales_order' }),
      ]),
    ])

    await page.goto('/inventory/movements')

    // 流水只带 ID：名称由筛选下拉的选项表反查
    await expect(page.getByRole('cell', { name: 'WH-01 - 主仓', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'SKU-01 - 标准箱', exact: true })).toBeVisible()
    await expect(
      page.getByRole('cell', { name: 'sales_order / SO-1 / 5', exact: true }),
    ).toBeVisible()
    await expect(page.locator('td[data-col-key="reservation_id"]')).toHaveText('5')
    await expect(page.locator('td[data-col-key="batch_id"]')).toHaveText('无批次')
  })

  test('sends every search filter and restarts from the first page', async ({ page }) => {
    const queries: string[] = []
    await mockApi(page, [...referenceRoutes(), listRoute(movements(300), queries)])

    await page.goto('/inventory/movements')
    await expect.poll(() => queries.length).toBeGreaterThan(0)

    await page.locator('.filters .n-select').nth(0).click()
    await page.locator('.n-base-select-option').filter({ hasText: 'WH-01 - 主仓' }).click()
    await page.locator('.filters .n-select').nth(1).click()
    await page.locator('.n-base-select-option').filter({ hasText: 'SKU-01 - 标准箱' }).click()
    await page.locator('.filters .n-select').nth(2).click()
    // 「预留」是「释放预留」「扣减预留」的子串，必须精确匹配
    await page
      .locator('.n-base-select-option')
      .filter({ hasText: /^预留$/ })
      .click()

    // 日期范围：直接输入两端日期并回车确认（比在面板里点格子更稳定）
    const dateRange = page.locator('.filters__date')
    await dateRange.locator('input').first().fill('2026-10-01')
    await dateRange.locator('input').last().fill('2026-10-02')
    await dateRange.locator('input').last().press('Enter')

    queries.length = 0
    await page.getByRole('button', { name: '查询' }).click()

    await expect.poll(() => queries.length).toBe(1)
    const params = new URLSearchParams(queries[0])
    expect(params.get('warehouse_id')).toBe(String(warehouse.id))
    expect(params.get('sku_id')).toBe(String(sku.id))
    expect(params.get('operation_type')).toBe('reserve')
    // 后端 created_to 是开区间：上界必须晚于开始日
    expect(params.get('created_from')).toBeTruthy()
    expect(params.get('created_to')).toBeTruthy()
    expect(new Date(params.get('created_to')!).getTime()).toBeGreaterThan(
      new Date(params.get('created_from')!).getTime(),
    )
    expect(params.get('offset')).toBe('0')
    expect(params.get('limit')).toBe('100')
  })

  test('resets every filter and reloads the first page', async ({ page }) => {
    const queries: string[] = []
    await mockApi(page, [...referenceRoutes(), listRoute(movements(3), queries)])

    await page.goto('/inventory/movements')
    await page.locator('.filters .n-select').nth(2).click()
    await page.locator('.n-base-select-option').filter({ hasText: '扣减可用' }).click()
    queries.length = 0

    await page.getByRole('button', { name: '重置' }).click()

    await expect.poll(() => queries.length).toBe(1)
    const params = new URLSearchParams(queries[0])
    expect(params.get('operation_type')).toBeNull()
    expect(params.get('warehouse_id')).toBeNull()
    expect(params.get('offset')).toBe('0')
  })

  test('virtualises rows and appends the next page on scroll', async ({ page }) => {
    const queries: string[] = []
    await mockApi(page, [...referenceRoutes(), listRoute(movements(300), queries)])

    await page.goto('/inventory/movements')
    await expect(page.locator('tbody tr').first()).toBeVisible()

    // 首页请求 0..99，但 DOM 只渲染可视区
    expect(queries[0]).toContain('offset=0')
    const renderedAfterFirstPage = await page.locator('tbody tr').count()
    expect(renderedAfterFirstPage).toBeLessThan(100)

    await expect(page.locator('.pager__hint')).toHaveText('已加载 100 / 共 300 条')

    // 滚到底部触发自动追加（也可点「加载更多」兜底）
    await page.locator('.v-vl').evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(() => queries.some((query) => query.includes('offset=100'))).toBe(true)
    await expect(page.locator('.pager__hint')).toHaveText('已加载 200 / 共 300 条')

    // 追加不会重复渲染已有行
    const ids = await page.locator('td[data-col-key="id"]').allTextContents()
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('keeps the load-more button as a keyboard-reachable fallback', async ({ page }) => {
    const queries: string[] = []
    await mockApi(page, [...referenceRoutes(), listRoute(movements(250), queries)])

    await page.goto('/inventory/movements')
    await expect(page.getByRole('button', { name: '加载更多' })).toBeVisible()

    await page.getByRole('button', { name: '加载更多' }).click()

    await expect.poll(() => queries.some((query) => query.includes('offset=100'))).toBe(true)
    await expect(page.locator('.pager__hint')).toHaveText('已加载 200 / 共 250 条')

    // 末页不足一页 → 到底
    await page.getByRole('button', { name: '加载更多' }).click()
    await expect(page.locator('.pager__hint')).toHaveText('已加载全部 250 条')
    await expect(page.getByText('没有更多了')).toBeVisible()
  })

  test('shows an explicit empty state', async ({ page }) => {
    await mockApi(page, [...referenceRoutes(), listRoute([], [], 0)])

    await page.goto('/inventory/movements')

    await expect(page.getByText('暂无库存流水')).toBeVisible()
    await expect(page.locator('.pager__hint')).toHaveText('暂无流水')
  })

  test('shows the error with a trace id and recovers on retry', async ({ page }) => {
    let attempt = 0
    await mockApi(page, [
      ...referenceRoutes(),
      {
        method: 'GET',
        path: '/inventory/movements',
        respond: async (route) => {
          attempt += 1
          if (attempt === 1) {
            await route.fulfill({
              status: 500,
              json: fail(500, 1500, '查询库存流水失败', 'internal_error'),
            })
            return
          }
          await route.fulfill({
            json: ok({ items: [movement(1)], total: 1, limit: 100, offset: 0 }),
          })
        },
      },
    ])

    await page.goto('/inventory/movements')

    await expect(page.getByText('查询库存流水失败')).toBeVisible()
    await expect(page.getByText('trace-e2e')).toBeVisible()

    await page.getByRole('button', { name: '重试' }).click()
    await expect(page.getByRole('cell', { name: '增加', exact: true }).first()).toBeVisible()
  })

  test('keeps loaded rows when the next page fails', async ({ page }) => {
    let attempt = 0
    await mockApi(page, [
      ...referenceRoutes(),
      {
        method: 'GET',
        path: '/inventory/movements',
        respond: async (route) => {
          attempt += 1
          if (attempt === 1) {
            await route.fulfill({
              json: ok({ items: movements(100), total: 300, limit: 100, offset: 0 }),
            })
            return
          }
          await route.fulfill({
            status: 500,
            json: fail(500, 1500, '加载下一页失败', 'internal_error'),
          })
        },
      },
    ])

    await page.goto('/inventory/movements')
    await page.getByRole('button', { name: '加载更多' }).click()

    // 已加载的 100 条不能被下一页的失败清空
    await expect(page.locator('.pager__hint')).toHaveText('已加载 100 / 共 300 条')
    await expect(page.getByText('加载更多失败：加载下一页失败')).toBeVisible()
    await expect(page.getByRole('button', { name: '重试加载' })).toBeVisible()
  })
})

test.describe('库存流水（320 px）', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('stacks filters, keeps paging reachable and avoids page overflow', async ({ page }) => {
    await mockApi(page, [...referenceRoutes(), listRoute(movements(250))])

    await page.goto('/inventory/movements')

    await expect(page.locator('.filters .n-select').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '查询' })).toBeVisible()
    await expect(page.getByRole('button', { name: '加载更多' })).toBeVisible()
    await expect(page.locator('tbody tr').first()).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
