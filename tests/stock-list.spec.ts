import { expect, test } from '@playwright/test'

import { mockApi, ok, type StubRoute } from './support/api-mock'

const warehouse = { id: 3, code: 'WH-01', name: '主仓' }
const sku = { id: 7, code: 'SKU-01', name: '标准箱' }

interface BalanceOptions {
  /** 模拟主数据被软删除后 `*Reference` + omitempty 让字段整体消失 */
  withWarehouse?: boolean
}

function balance(onHand: number, options: BalanceOptions = {}) {
  const { withWarehouse = true } = options
  return {
    warehouse_id: warehouse.id,
    ...(withWarehouse ? { warehouse: { ...warehouse, deleted: false } } : {}),
    sku_id: sku.id,
    sku: { ...sku, deleted: false },
    on_hand_qty: `${onHand}.000000`,
    reserved_qty: '10.000000',
    available_qty: `${onHand - 10}.000000`,
    updated_at: '2026-09-01T10:00:00Z',
  }
}

const layer = {
  id: 11,
  warehouse_id: warehouse.id,
  sku_id: sku.id,
  batch_id: null,
  received_at: '2026-09-01T10:00:00Z',
  on_hand_qty: '100.000000',
  reserved_qty: '10.000000',
  available_qty: '90.000000',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
}

/** 造桩的公共部分：筛选下拉的数据源 */
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

test('filters stock with searchable selects instead of raw ids', async ({ page }) => {
  await mockApi(page, [
    ...referenceRoutes(),
    {
      method: 'GET',
      path: '/inventory/stocks',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [balance(100)], total: 1, limit: 100, offset: 0 }) }),
    },
  ])

  await page.goto('/inventory/stocks')
  await expect(page.getByRole('cell', { name: 'WH-01', exact: true })).toBeVisible()

  // 下拉选项必须带编码与名称，用户不可能知道数字 ID
  await page.locator('.filters .n-select').first().click()
  await expect(
    page.locator('.n-base-select-option').filter({ hasText: 'WH-01 - 主仓' }),
  ).toBeVisible()
})

test('shows the total and jumps pages by number and quick jumper', async ({ page }) => {
  const offsets: string[] = []

  /** 限定到「在库数量」列，避免与「可用数量」出现同值 */
  const onHandCell = (value: string) =>
    page.locator('td[data-col-key="on_hand_qty"]').filter({ hasText: new RegExp(`^${value}$`) })

  await mockApi(page, [
    ...referenceRoutes(),
    {
      method: 'GET',
      path: '/inventory/stocks',
      respond: async (route) => {
        const offset = Number(new URL(route.request().url()).searchParams.get('offset') ?? 0)
        offsets.push(String(offset))
        const items = Array.from({ length: 100 }, (_, index) => balance(offset + index + 11))
        await route.fulfill({ json: ok({ items, total: 250, limit: 100, offset }) })
      },
    },
  ])

  await page.goto('/inventory/stocks')

  await expect(onHandCell('11.000000')).toBeVisible()
  await expect(page.getByText('共 250 条 · 第 1 / 3 页')).toBeVisible()
  await expect(page.locator('.n-pagination')).toBeVisible()

  // 页码跳转
  await page.locator('.n-pagination-item').filter({ hasText: /^2$/ }).click()
  await expect(onHandCell('111.000000')).toBeVisible()
  await expect(onHandCell('11.000000')).toBeHidden()
  expect(offsets).toEqual(['0', '100'])

  // quick jumper 跳页
  const jumpInput = page.locator('.n-pagination-quick-jumper input')
  await jumpInput.fill('3')
  await jumpInput.press('Enter')
  await expect(onHandCell('211.000000')).toBeVisible()
  expect(offsets).toEqual(['0', '100', '200'])
})

test('opens the layer detail drawer with include_layers', async ({ page }) => {
  const detailQueries: string[] = []

  await mockApi(page, [
    ...referenceRoutes(),
    {
      method: 'GET',
      path: '/inventory/stocks',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [balance(100)], total: 1, limit: 100, offset: 0 }) }),
    },
    {
      method: 'GET',
      path: '/inventory/stocks/:warehouseId/:skuId',
      respond: async (route) => {
        detailQueries.push(new URL(route.request().url()).search)
        await route.fulfill({ json: ok({ ...balance(100), layers: [layer] }) })
      },
    },
  ])

  await page.goto('/inventory/stocks')
  await page.locator('tbody tr').first().click()

  const drawer = page.locator('.n-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('无批次')).toBeVisible()

  // 层明细只能通过详情端点的 include_layers 取，列表端点没有这个参数
  expect(detailQueries).toEqual(['?include_layers=true'])
})

test('refreshes the layer drawer without closing it', async ({ page }) => {
  const detailQueries: string[] = []

  await mockApi(page, [
    ...referenceRoutes(),
    {
      method: 'GET',
      path: '/inventory/stocks',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [balance(100)], total: 1, limit: 100, offset: 0 }) }),
    },
    {
      method: 'GET',
      path: '/inventory/stocks/:warehouseId/:skuId',
      respond: async (route) => {
        detailQueries.push(new URL(route.request().url()).search)
        await route.fulfill({ json: ok({ ...balance(100), layers: [layer] }) })
      },
    },
  ])

  await page.goto('/inventory/stocks')
  await page.locator('tbody tr').first().click()

  const drawer = page.locator('.n-drawer')
  await expect(drawer).toBeVisible()
  expect(detailQueries).toHaveLength(1)

  await drawer.getByRole('button', { name: '刷新' }).click()

  await expect.poll(() => detailQueries.length).toBe(2)
  expect(detailQueries).toEqual(['?include_layers=true', '?include_layers=true'])
  await expect(drawer).toBeVisible()
})

test('shows an explicit empty state when the balance has no layers', async ({ page }) => {
  await mockApi(page, [
    ...referenceRoutes(),
    {
      method: 'GET',
      path: '/inventory/stocks',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [balance(100)], total: 1, limit: 100, offset: 0 }) }),
    },
    {
      method: 'GET',
      path: '/inventory/stocks/:warehouseId/:skuId',
      respond: (route) => route.fulfill({ json: ok({ ...balance(100), layers: [] }) }),
    },
  ])

  await page.goto('/inventory/stocks')
  await page.locator('tbody tr').first().click()

  await expect(page.locator('.n-drawer').getByText('该库存暂无层明细')).toBeVisible()
})

test('falls back to the id when the warehouse reference is missing', async ({ page }) => {
  await mockApi(page, [
    ...referenceRoutes(),
    {
      method: 'GET',
      path: '/inventory/stocks',
      respond: (route) =>
        route.fulfill({
          json: ok({
            items: [balance(100, { withWarehouse: false })],
            total: 1,
            limit: 100,
            offset: 0,
          }),
        }),
    },
  ])

  await page.goto('/inventory/stocks')

  await expect(page.getByRole('cell', { name: '#3', exact: true }).first()).toBeVisible()
})
