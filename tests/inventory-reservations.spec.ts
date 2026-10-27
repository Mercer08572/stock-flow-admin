import { expect, test } from '@playwright/test'

import { mockApi, ok, type StubRoute } from './support/api-mock'

const warehouse = { id: 1, code: 'WH-01', name: '主仓', deleted: false }
const sku = { id: 9, code: 'SKU-09', name: '标准箱', deleted: false }

const reservation = {
  id: 2,
  warehouse_id: warehouse.id,
  warehouse,
  sku_id: sku.id,
  sku,
  total_qty: '5',
  released_qty: '0',
  consumed_qty: '0',
  remaining_qty: '5',
  status: 'active',
  close_reason: null,
  idempotency_key: 'sales_order:SO-20261027-002:5:reserve',
  source_type: 'sales_order',
  source_id: '1',
  source_line_id: '1',
  actor_type: 'admin',
  actor_id: 1,
  actor_label: 'admin',
  created_at: '2026-10-27T10:41:27+08:00',
  updated_at: '2026-10-27T10:41:27+08:00',
}

const reservationItem = {
  id: 11,
  reservation_id: reservation.id,
  stock_layer_id: 3,
  batch_id: null,
  received_at: '2026-10-01T08:00:00+08:00',
  reserved_qty: '5',
  released_qty: '0',
  consumed_qty: '0',
  remaining_qty: '5',
  created_at: '2026-10-27T10:41:27+08:00',
  updated_at: '2026-10-27T10:41:27+08:00',
}

/** 造桩的公共部分：筛选下拉的数据源 */
function filterRoutes(): StubRoute[] {
  return [
    {
      method: 'GET',
      path: '/warehouses',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [warehouse], limit: 100, offset: 0 }) }),
    },
    {
      method: 'GET',
      path: '/skus',
      respond: (route) => route.fulfill({ json: ok({ items: [sku], limit: 100, offset: 0 }) }),
    },
  ]
}

function listRoute(items = [reservation]): StubRoute {
  return {
    method: 'GET',
    path: '/inventory/reservations',
    respond: (route) => route.fulfill({ json: ok({ items, limit: 100, offset: 0 }) }),
  }
}

function referenceRoutes(items = [reservation]): StubRoute[] {
  return [...filterRoutes(), listRoute(items)]
}

test.describe('库存占用（桌面）', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('places 库存占用 between 工作台 and 库存余额', async ({ page }) => {
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

    const labels = await page.locator('.app-sidebar .n-menu-item-content-header').allTextContents()
    expect(labels.slice(0, 3)).toEqual(['工作台', '库存占用', '库存余额'])
  })

  test('lists reservations with readable warehouse and sku references', async ({ page }) => {
    await mockApi(page, referenceRoutes())

    await page.goto('/inventory/reservations')

    await expect(page.getByRole('heading', { level: 1, name: '库存占用' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'WH-01 / 主仓', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'SKU-09 / 标准箱', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'sales_order / 1 / 1' })).toBeVisible()
    await expect(page.locator('td[data-col-key="remaining_qty"]')).toHaveText('5')
    await expect(page.getByText('占用中', { exact: true }).first()).toBeVisible()
  })

  test('sends the status filter and resets to the first page', async ({ page }) => {
    const queries: string[] = []
    await mockApi(page, [
      ...filterRoutes(),
      {
        method: 'GET',
        path: '/inventory/reservations',
        respond: async (route) => {
          queries.push(new URL(route.request().url()).search)
          await route.fulfill({ json: ok({ items: [reservation], limit: 100, offset: 0 }) })
        },
      },
    ])

    await page.goto('/inventory/reservations')
    await expect(page.getByRole('cell', { name: 'WH-01 / 主仓', exact: true })).toBeVisible()

    // 状态是第三个筛选下拉（仓库、SKU、状态）
    await page.locator('.filters .n-select').nth(2).click()
    await page.locator('.n-base-select-option').filter({ hasText: '已关闭' }).click()
    await page.getByRole('button', { name: '查询' }).click()

    await expect.poll(() => queries.at(-1)).toContain('status=closed')
    expect(queries.at(-1)).toContain('offset=0')
  })

  test('opens the allocation drawer for a reservation', async ({ page }) => {
    const detailPaths: string[] = []
    await mockApi(page, [
      ...referenceRoutes(),
      {
        method: 'GET',
        path: '/inventory/reservations/:id',
        respond: async (route) => {
          detailPaths.push(new URL(route.request().url()).pathname)
          await route.fulfill({
            json: ok({
              ...reservation,
              released_qty: '1',
              consumed_qty: '1',
              remaining_qty: '3',
              items: [
                { ...reservationItem, released_qty: '1', consumed_qty: '1', remaining_qty: '3' },
              ],
            }),
          })
        },
      },
    ])

    await page.goto('/inventory/reservations')
    await page.locator('tbody tr').first().click()

    const drawer = page.locator('.n-drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('占用单 #2')).toBeVisible()
    await expect(drawer.getByText('sales_order:SO-20261027-002:5:reserve')).toBeVisible()
    await expect(drawer.getByText('无批次')).toBeVisible()
    await expect(drawer.locator('td[data-col-key="remaining_qty"]')).toHaveText('3')

    expect(detailPaths).toEqual(['/api/v1/inventory/reservations/2'])
  })

  test('shows an explicit empty state', async ({ page }) => {
    await mockApi(page, referenceRoutes([]))

    await page.goto('/inventory/reservations')

    await expect(page.getByText('暂无库存占用')).toBeVisible()
  })
})

test.describe('库存占用（320 px）', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('stacks filters and keeps the page free of horizontal overflow', async ({ page }) => {
    await mockApi(page, referenceRoutes())

    await page.goto('/inventory/reservations')

    await expect(page.locator('.filters .n-select').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '查询' })).toBeVisible()
    await expect(page.getByRole('button', { name: '上一页' })).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('opens the detail drawer at full width', async ({ page }) => {
    await mockApi(page, [
      ...referenceRoutes(),
      {
        method: 'GET',
        path: '/inventory/reservations/:id',
        respond: (route) =>
          route.fulfill({ json: ok({ ...reservation, items: [reservationItem] }) }),
      },
    ])

    await page.goto('/inventory/reservations')
    await page.locator('tbody tr').first().click()

    const drawer = page.locator('.n-drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('占用单 #2')).toBeVisible()

    const width = await drawer.evaluate((element) =>
      Math.round(element.getBoundingClientRect().width),
    )
    expect(width).toBeLessThanOrEqual(320)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
