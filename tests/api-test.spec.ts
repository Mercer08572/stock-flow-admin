import { expect, test, type Page } from '@playwright/test'

import { fail, mockApi, ok, type StubRoute } from './support/api-mock'

/**
 * 「API 测试」开发调试页。
 *
 * 通过 VITE_ENABLE_API_TEST=true 注册（见 playwright.config.ts 的 webServer.env）。
 * 这里覆盖：菜单入口、五种操作的路径与请求体、预留单回填、成功/失败响应展示。
 */

const warehouse = {
  id: 3,
  code: 'WH-01',
  name: '主仓',
  type: 'normal',
  status: 'active',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
}

const sku = {
  id: 7,
  code: 'SKU-01',
  name: '标准箱',
  material_id: 1,
  unit_id: 1,
  status: 'active',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
}

const reservation = {
  id: 21,
  warehouse_id: warehouse.id,
  warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name, deleted: false },
  sku_id: sku.id,
  sku: { id: sku.id, code: sku.code, name: sku.name, deleted: false },
  total_qty: '10.000000',
  released_qty: '0.000000',
  consumed_qty: '0.000000',
  remaining_qty: '10.000000',
  status: 'active',
  close_reason: null,
  idempotency_key: 'reservation-demo',
  source_type: 'sales_order',
  source_id: 'SO-1',
  source_line_id: 'SO-1-1',
  actor_type: 'admin',
  actor_id: 1,
  actor_label: 'admin',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
}

const stock = {
  warehouse_id: warehouse.id,
  warehouse: { id: warehouse.id, code: warehouse.code, name: warehouse.name, deleted: false },
  sku_id: sku.id,
  sku: { id: sku.id, code: sku.code, name: sku.name, deleted: false },
  on_hand_qty: '100.000000',
  reserved_qty: '10.000000',
  available_qty: '90.000000',
  updated_at: '2026-09-01T10:00:00Z',
  layers: [
    {
      id: 11,
      warehouse_id: warehouse.id,
      sku_id: sku.id,
      batch_id: 12,
      received_at: '2026-09-01T10:00:00Z',
      on_hand_qty: '100.000000',
      reserved_qty: '10.000000',
      available_qty: '90.000000',
      created_at: '2026-09-01T10:00:00Z',
      updated_at: '2026-09-01T10:00:00Z',
    },
  ],
}

interface CapturedCall {
  path: string
  body: Record<string, unknown>
}

function operationResult(
  operationType: string,
  qty: string,
  options: { reservation?: boolean } = {},
) {
  return {
    operation_type: operationType,
    warehouse_id: warehouse.id,
    sku_id: sku.id,
    batch_id: null,
    qty,
    stock_after: {
      on_hand_qty: '100.000000',
      reserved_qty: '10.000000',
      available_qty: '90.000000',
    },
    movements: [{ id: 31, stock_layer_id: 11, qty }],
    ...(options.reservation
      ? {
          reservation: {
            id: reservation.id,
            status: 'active',
            close_reason: null,
            total_qty: '10.000000',
            released_qty: '0.000000',
            consumed_qty: '0.000000',
            remaining_qty: '10.000000',
            allocations: [],
          },
        }
      : {}),
  }
}

/** 公共桩：主数据下拉、库存预览、预留单列表，以及四个变更端点 */
function routes(calls: CapturedCall[], options: { increaseError?: boolean } = {}): StubRoute[] {
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
    {
      method: 'GET',
      path: '/inventory/reservations',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [reservation], total: 1, limit: 100, offset: 0 }) }),
    },
    {
      method: 'GET',
      path: '/inventory/stocks/:warehouseId/:skuId',
      respond: (route) => route.fulfill({ json: ok(stock) }),
    },
    {
      method: 'POST',
      path: '/inventory/increase',
      respond: async (route) => {
        calls.push({ path: 'increase', body: route.request().postDataJSON() })
        if (options.increaseError) {
          await route.fulfill({
            status: 409,
            json: fail(409, 1005, '该幂等键已用于不同的请求内容', 'idempotency_conflict'),
          })
          return
        }
        await route.fulfill({ json: ok(operationResult('increase', '2')) })
      },
    },
    {
      method: 'POST',
      path: '/inventory/reserve',
      respond: async (route) => {
        calls.push({ path: 'reserve', body: route.request().postDataJSON() })
        await route.fulfill({
          json: ok(operationResult('reserve', '2', { reservation: true })),
        })
      },
    },
    {
      method: 'POST',
      path: '/inventory/decrease',
      respond: async (route) => {
        const body = route.request().postDataJSON() as Record<string, unknown>
        const reserved = body.reservation_id !== undefined
        calls.push({ path: reserved ? 'decrease_reserved' : 'decrease_available', body })
        await route.fulfill({
          json: ok(
            operationResult(reserved ? 'decrease_reserved' : 'decrease_available', '2', {
              reservation: reserved,
            }),
          ),
        })
      },
    },
    {
      method: 'POST',
      path: '/inventory/release',
      respond: async (route) => {
        calls.push({ path: 'release', body: route.request().postDataJSON() })
        await route.fulfill({
          json: ok(operationResult('release_reserved', '10', { reservation: true })),
        })
      },
    },
  ]
}

function formItem(page: Page, label: string) {
  return page.locator('.n-form-item').filter({ has: page.getByText(label, { exact: true }) })
}

async function pickSelect(page: Page, label: string, option: string) {
  await formItem(page, label).locator('.n-select').click()
  await page.locator('.n-base-select-option').filter({ hasText: option }).click()
}

async function pickOperation(page: Page, label: string) {
  await page.locator('.n-radio-button').filter({ hasText: label }).click()
}

function sendButton(page: Page) {
  return page.getByRole('button', { name: '发送请求' })
}

async function fillBaseParameters(page: Page) {
  await pickSelect(page, '仓库', 'WH-01 - 主仓')
  await pickSelect(page, 'SKU', 'SKU-01 - 标准箱')
  await page.locator('.qty-field input').fill('2')
}

test('系统设置中展示「API 测试」入口，点击后进入页面', async ({ page }) => {
  await mockApi(page, routes([]))

  const width = page.viewportSize()?.width ?? 1280
  await page.goto('/')
  if (width < 768) {
    await page.getByRole('button', { name: '打开导航' }).click()
  }

  await page.getByText('系统设置', { exact: true }).click()
  await page.getByText('API 测试', { exact: true }).click()

  await expect(page).toHaveURL(/\/settings\/api-test$/)
  await expect(page.getByRole('heading', { name: 'API 测试', level: 1 })).toBeVisible()
  await expect(page.getByText('此页会真实变更库存')).toBeVisible()
})

test('库存增加与库存预留使用各自的端点与请求体', async ({ page }) => {
  const calls: CapturedCall[] = []
  await mockApi(page, routes(calls))

  await page.goto('/settings/api-test')
  await fillBaseParameters(page)

  await sendButton(page).click()
  await expect(page.locator('.response-card')).toContainText('库存增加')
  expect(calls[0]).toMatchObject({
    path: 'increase',
    body: { warehouse_id: 3, sku_id: 7, qty: '2' },
  })

  await pickOperation(page, '库存预留（占用）')
  await sendButton(page).click()
  await expect(page.locator('.response-card')).toContainText('库存预留（占用）')
  expect(calls[1]).toMatchObject({
    path: 'reserve',
    body: { warehouse_id: 3, sku_id: 7, qty: '2' },
  })
})

test('选择预留单会回填仓库/SKU，预留扣减不发送批次', async ({ page }) => {
  const calls: CapturedCall[] = []
  await mockApi(page, routes(calls))

  await page.goto('/settings/api-test')
  await pickOperation(page, '预留扣减（占用扣减）')

  // 预留单选项带单号、仓库/SKU 与剩余数量，选中后自动回填
  await formItem(page, '预留单').locator('.n-select').click()
  await page
    .locator('.n-base-select-option')
    .filter({ hasText: '#21 · WH-01/SKU-01 · 剩余 10.000000' })
    .click()

  await expect(formItem(page, '仓库').locator('.n-select')).toContainText('WH-01')
  await expect(formItem(page, 'SKU').locator('.n-select')).toContainText('SKU-01')

  await page.locator('.qty-field input').fill('2')
  await sendButton(page).click()

  await expect(page.locator('.response-card')).toContainText('预留扣减（占用扣减）')
  const call = calls[0]
  expect(call?.path).toBe('decrease_reserved')
  expect(call?.body).toMatchObject({
    warehouse_id: 3,
    sku_id: 7,
    reservation_id: 21,
    qty: '2',
  })
  expect(call?.body).not.toHaveProperty('batch_id')
})

test('直接扣减可点选库存层批次，请求体带上 batch_id', async ({ page }) => {
  const calls: CapturedCall[] = []
  await mockApi(page, routes(calls))

  await page.goto('/settings/api-test')
  await fillBaseParameters(page)
  await pickOperation(page, '直接扣减')

  // 库存预览里的批次芯片用于一键填入
  await page.locator('.batch-chips').getByRole('button', { name: '12' }).click()
  await sendButton(page).click()

  await expect(page.locator('.response-card')).toContainText('直接扣减')
  expect(calls[0]).toMatchObject({
    path: 'decrease_available',
    body: { warehouse_id: 3, sku_id: 7, batch_id: 12, qty: '2' },
  })
  expect(calls[0]?.body).not.toHaveProperty('reservation_id')
})

test('预留释放数量留空时不发送 qty', async ({ page }) => {
  const calls: CapturedCall[] = []
  await mockApi(page, routes(calls))

  await page.goto('/settings/api-test')
  await pickOperation(page, '预留释放（占用释放）')

  await formItem(page, '预留单').locator('.n-select').click()
  await page.locator('.n-base-select-option').filter({ hasText: '#21' }).click()
  await page.locator('.qty-field input').fill('')

  await sendButton(page).click()
  await expect(page.locator('.response-card')).toContainText('预留释放（占用释放）')
  expect(calls[0]?.path).toBe('release')
  expect(calls[0]?.body).toMatchObject({ warehouse_id: 3, sku_id: 7, reservation_id: 21 })
  expect(calls[0]?.body).not.toHaveProperty('qty')
})

test('成功响应展示状态码、库存快照与原始 JSON', async ({ page }) => {
  const calls: CapturedCall[] = []
  await mockApi(page, routes(calls))

  await page.goto('/settings/api-test')
  await fillBaseParameters(page)
  await sendButton(page).click()

  const response = page.locator('.response-card')
  await expect(response).toContainText(/HTTP 200/)
  await expect(response.locator('.qty-grid')).toContainText('100.000000')
  await expect(response.locator('.code-block')).toContainText('"stock_after"')
  await expect(response).toContainText('#31 · 层 11 · 2')
})

test('失败响应展示错误信息、错误码与 trace_id', async ({ page }) => {
  await mockApi(page, routes([], { increaseError: true }))

  await page.goto('/settings/api-test')
  await fillBaseParameters(page)
  await sendButton(page).click()

  const response = page.locator('.response-card')
  await expect(response).toContainText('该幂等键已用于不同的请求内容')
  await expect(response).toContainText('HTTP 409')
  await expect(response).toContainText('error_code idempotency_conflict')
  await expect(response).toContainText('trace_id trace-e2e')
})

test.describe('320 px', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('页面在 320px 下不产生横向溢出，核心控件可用', async ({ page }) => {
    const calls: CapturedCall[] = []
    await mockApi(page, routes(calls))

    await page.goto('/settings/api-test')
    await expect(page.getByRole('heading', { name: 'API 测试', level: 1 })).toBeVisible()
    await expect(page.locator('.qty-presets').getByRole('button')).toHaveCount(4)

    await pickSelect(page, '仓库', 'WH-01 - 主仓')
    await pickSelect(page, 'SKU', 'SKU-01 - 标准箱')
    await expect(page.locator('.batch-chips').getByRole('button', { name: '12' })).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
