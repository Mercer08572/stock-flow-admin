import { expect, test } from '@playwright/test'

import { mockApi, ok, type StubRoute } from './support/api-mock'

/**
 * 库存批次页：列表、新增、停用与「有引用不可删除」。
 *
 * 批次是 SKU 级主数据，页面必须显示批号与「SKU 编码 - 名称」，
 * 而不是让用户面对裸 batch_id。
 */

const sku = { id: 7, code: 'SKU-01', name: '标准箱' }

const activeBatch = {
  id: 3,
  sku_id: sku.id,
  sku: { ...sku, deleted: false },
  batch_no: 'B-20250510',
  first_received_at: null,
  production_date: '2025-05-01',
  expiration_date: '2027-04-30',
  status: 'active',
  dispatch_priority: 10,
  remark: null,
  created_at: '2025-05-10T09:00:00+08:00',
  updated_at: '2025-05-10T09:00:00+08:00',
}

const inactiveBatch = {
  ...activeBatch,
  id: 4,
  batch_no: 'B-OLD-RECALL',
  status: 'inactive',
}

function listRoute(batches = [activeBatch, inactiveBatch]): StubRoute {
  return {
    method: 'GET',
    path: '/inventory/batches',
    respond: (route) =>
      route.fulfill({
        json: ok({ items: batches, total: batches.length, limit: 100, offset: 0 }),
      }),
  }
}

/** 页面首屏需要 SKU 选项（新增表单与筛选共用） */
function skuRoute(): StubRoute {
  return {
    method: 'GET',
    path: '/skus',
    respond: (route) =>
      route.fulfill({ json: ok({ items: [sku], total: 1, limit: 20, offset: 0 }) }),
  }
}

test('lists batches with readable SKU references', async ({ page }) => {
  await mockApi(page, [listRoute(), skuRoute()])

  await page.goto('/inventory/batches')

  await expect(page.getByRole('heading', { level: 1, name: '库存批次' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'B-20250510', exact: true })).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'SKU-01 - 标准箱', exact: true }).first(),
  ).toBeVisible()
  await expect(page.getByRole('cell', { name: '2025-05-01', exact: true }).first()).toBeVisible()
})

test('creates a batch from the drawer', async ({ page }) => {
  let payload: Record<string, unknown> | undefined

  await mockApi(page, [
    listRoute(),
    skuRoute(),
    {
      method: 'POST',
      path: '/inventory/batches',
      respond: async (route) => {
        payload = route.request().postDataJSON() as Record<string, unknown>
        await route.fulfill({ json: ok({ ...activeBatch, id: 9, batch_no: 'B-NEW' }) })
      },
    },
  ])

  await page.goto('/inventory/batches')
  await page.getByRole('button', { name: '新增' }).click()
  await expect(page.getByText('新增批次')).toBeVisible()

  // 页头筛选里也有「批号 / SKU」，表单操作必须限定在抽屉内
  const drawer = page.locator('.n-drawer')
  const item = drawer
    .locator('.n-form-item')
    .filter({ has: page.getByText('批号', { exact: true }) })
  await item.locator('input').fill('B-NEW')

  const skuItem = drawer
    .locator('.n-form-item')
    .filter({ has: page.getByText('SKU', { exact: true }) })
  await skuItem.locator('.n-select').click()
  await page.locator('.n-base-select-option').filter({ hasText: '标准箱' }).click()

  await page.getByRole('button', { name: '保存' }).click()

  await expect(page.getByText('批次已新增')).toBeVisible()
  expect(payload).toMatchObject({ sku_id: sku.id, batch_no: 'B-NEW' })
  // 新增表单不出现状态字段，状态由后端默认 active
  expect(payload).not.toHaveProperty('status')
})

test('disables an active batch after confirmation', async ({ page }) => {
  let disabled = false

  await mockApi(page, [
    listRoute(),
    skuRoute(),
    {
      method: 'PUT',
      path: '/inventory/batches/:id/disable',
      respond: async (route) => {
        disabled = true
        await route.fulfill({ json: ok({ ...activeBatch, status: 'inactive' }) })
      },
    },
  ])

  await page.goto('/inventory/batches')
  await page.getByRole('button', { name: '停用' }).first().click()

  const dialog = page.locator('.n-dialog:visible')
  await expect(dialog).toContainText('B-20250510')
  await expect(dialog).toContainText('不再参与自动分配')
  await dialog.getByRole('button', { name: '确认停用' }).click()

  await expect(page.getByText('批次已停用')).toBeVisible()
  expect(disabled).toBe(true)
})

test('explains why a referenced batch cannot be deleted', async ({ page }) => {
  await mockApi(page, [
    listRoute(),
    skuRoute(),
    {
      method: 'DELETE',
      path: '/inventory/batches/:id',
      respond: (route) =>
        route.fulfill({
          status: 409,
          json: {
            code: 409,
            message: 'inventory batch is referenced by inventory records',
            error_code: 'INVENTORY_BATCH_REFERENCED',
            data: null,
            trace_id: 'trace-e2e',
            timestamp: Date.now(),
          },
        }),
    },
  ])

  await page.goto('/inventory/batches')
  await page.getByRole('button', { name: '删除' }).first().click()
  await page.locator('.n-dialog:visible').getByRole('button', { name: '确认删除' }).click()

  await expect(page.getByText('批次已有库存或流水引用，请改用停用')).toBeVisible()
})
