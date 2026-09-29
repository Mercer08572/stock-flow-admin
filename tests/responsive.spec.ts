import { expect, test } from '@playwright/test'

import { mockApi, ok } from './support/api-mock'

/**
 * P2 的 Definition of Done 要求「320 px 与桌面宽度均实测通过」。
 * Playwright 自带的 mobile-chrome 是 412 px 宽的 Pixel 7，覆盖不到 320 px，
 * 因此这里显式指定视口。
 */

const MOBILE = { width: 320, height: 720 }

const warehouse = { id: 3, code: 'WH-01', name: '主仓', deleted: false }
const sku = { id: 7, code: 'SKU-01', name: '标准箱', deleted: false }

async function stubLists(page: Parameters<typeof mockApi>[0]) {
  await mockApi(page, [
    {
      method: 'GET',
      path: '/units',
      respond: (route) =>
        route.fulfill({
          json: ok({
            items: [
              {
                id: 1,
                code: 'KG',
                name: '千克',
                symbol: 'kg',
                unit_type: 'weight',
                precision: 3,
                status: 'active',
                created_at: '2026-09-01T10:00:00Z',
                updated_at: '2026-09-01T10:00:00Z',
              },
            ],
            limit: 100,
            offset: 0,
          }),
        }),
    },
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
    {
      method: 'GET',
      path: '/inventory/stocks',
      respond: (route) =>
        route.fulfill({
          json: ok({
            items: [
              {
                warehouse_id: warehouse.id,
                warehouse,
                sku_id: sku.id,
                sku,
                on_hand_qty: '100.000000',
                reserved_qty: '10.000000',
                available_qty: '90.000000',
                updated_at: '2026-09-01T10:00:00Z',
              },
            ],
            limit: 100,
            offset: 0,
          }),
        }),
    },
  ])
}

/** 页面整体不应横向溢出；宽表格应由表格容器自己滚动 */
async function expectNoPageOverflow(page: Parameters<typeof mockApi>[0]) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe('320 px', () => {
  test.use({ viewport: MOBILE })

  test('master data list and its row actions remain usable', async ({ page }) => {
    await stubLists(page)
    await page.goto('/master-data/units')

    await expect(page.getByRole('cell', { name: 'KG', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '新增' })).toBeVisible()

    // 行操作在窄屏下必须仍可点击（表格容器横向滚动）
    for (const name of ['编辑', '删除']) {
      const button = page.getByRole('button', { name }).first()
      await button.scrollIntoViewIfNeeded()
      await expect(button).toBeVisible()
    }

    await expectNoPageOverflow(page)
  })

  test('stock filters stack vertically and paging stays reachable', async ({ page }) => {
    await stubLists(page)
    await page.goto('/inventory/stocks')

    await expect(page.locator('.filters .n-select').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '查询' })).toBeVisible()
    await expect(page.getByRole('button', { name: '上一页' })).toBeVisible()
    await expect(page.getByRole('button', { name: '下一页' })).toBeVisible()

    await expectNoPageOverflow(page)
  })

  test('the edit drawer is usable', async ({ page }) => {
    await stubLists(page)
    await page.goto('/master-data/units')
    await page.getByRole('button', { name: '编辑' }).click()

    const drawer = page.locator('.n-drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('button', { name: '保存' })).toBeVisible()

    const overflow = await drawer.evaluate((element) => element.scrollWidth - element.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
