import { expect, test } from '@playwright/test'

import { fieldInput, mockApi, ok, fail, type StubRoute } from './support/api-mock'

const kgUnit = {
  id: 1,
  code: 'KG',
  name: '千克',
  symbol: 'kg',
  unit_type: 'weight',
  precision: 3,
  status: 'active',
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
}

function unitsRoutes(overrides: Partial<Record<string, StubRoute['respond']>> = {}) {
  const routes: StubRoute[] = [
    {
      method: 'GET',
      path: '/units',
      respond: (route) => route.fulfill({ json: ok({ items: [kgUnit], limit: 100, offset: 0 }) }),
    },
    { method: 'GET', path: '/units/:id', respond: (route) => route.fulfill({ json: ok(kgUnit) }) },
    {
      method: 'PUT',
      path: '/units/:id',
      respond: (route) =>
        route.fulfill({ json: ok({ ...kgUnit, ...route.request().postDataJSON() }) }),
    },
    {
      method: 'DELETE',
      path: '/units/:id',
      respond: (route) => route.fulfill({ json: ok(null) }),
    },
  ]

  return routes.map((route) => {
    const override = overrides[`${route.method} ${route.path}`]
    return override ? { ...route, respond: override } : route
  })
}

test('edits a unit with every field prefilled and submitted', async ({ page }) => {
  const putBodies: Array<Record<string, unknown>> = []

  await mockApi(
    page,
    unitsRoutes({
      'PUT /units/:id': async (route) => {
        putBodies.push(route.request().postDataJSON() as Record<string, unknown>)
        await route.fulfill({ json: ok(kgUnit) })
      },
    }),
  )

  await page.goto('/master-data/units')
  await expect(page.getByRole('cell', { name: 'KG', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '编辑' }).click()

  const drawer = page.locator('.n-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('编辑计量单位')).toBeVisible()

  // 预填：必须来自 GET /units/:id，而不是空表单
  await expect(fieldInput(page, '编码')).toHaveValue('KG')
  await expect(fieldInput(page, '名称')).toHaveValue('千克')
  await expect(fieldInput(page, '精度')).toHaveValue('3')

  await fieldInput(page, '名称').fill('千克（改）')
  await drawer.getByRole('button', { name: '保存' }).click()

  // PUT 是全量替换：漏发 precision 会被后端写成 0，所以每个字段都必须出现
  expect(putBodies).toHaveLength(1)
  expect(putBodies[0]).toEqual({
    code: 'KG',
    name: '千克（改）',
    status: 'active',
    symbol: 'kg',
    unit_type: 'weight',
    precision: 3,
  })
})

test('requires confirmation before deleting and shows the code with the name', async ({ page }) => {
  const deleted: string[] = []

  await mockApi(
    page,
    unitsRoutes({
      'DELETE /units/:id': async (route) => {
        deleted.push(new URL(route.request().url()).pathname)
        await route.fulfill({ json: ok(null) })
      },
    }),
  )

  await page.goto('/master-data/units')
  await expect(page.getByRole('cell', { name: 'KG', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '删除' }).click()

  const dialog = page.locator('.n-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('KG')
  await expect(dialog).toContainText('千克')

  // 只打开确认框不应发出请求
  expect(deleted).toHaveLength(0)

  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(dialog).toBeHidden()
  expect(deleted).toHaveLength(0)

  await page.getByRole('button', { name: '删除' }).click()
  await page.locator('.n-dialog').getByRole('button', { name: '确认删除' }).click()

  await expect.poll(() => deleted).toEqual(['/api/v1/units/1'])
})

test('maps an inventory reference conflict to a readable Chinese message', async ({ page }) => {
  await mockApi(
    page,
    unitsRoutes({
      'DELETE /units/:id': (route) =>
        route.fulfill({
          status: 409,
          json: fail(409, 1009, 'unit is referenced by inventory and cannot be deleted'),
        }),
    }),
  )

  await page.goto('/master-data/units')
  await page.getByRole('button', { name: '删除' }).click()
  await page.locator('.n-dialog').getByRole('button', { name: '确认删除' }).click()

  await expect(page.locator('.n-message')).toContainText('已被库存引用，无法删除')
})

test('disables an active warehouse only after confirmation', async ({ page }) => {
  const warehouse = {
    id: 3,
    code: 'WH-01',
    name: '主仓',
    type: 'normal',
    status: 'active',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  }
  const disabled: string[] = []

  await mockApi(page, [
    {
      method: 'GET',
      path: '/warehouses',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [warehouse], limit: 100, offset: 0 }) }),
    },
    {
      method: 'PUT',
      path: '/warehouses/:id/disable',
      respond: async (route) => {
        disabled.push(new URL(route.request().url()).pathname)
        await route.fulfill({ json: ok({ ...warehouse, status: 'inactive' }) })
      },
    },
  ])

  await page.goto('/master-data/warehouses')
  await expect(page.getByRole('cell', { name: 'WH-01', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '正常', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '停用' }).click()
  await expect(page.locator('.n-dialog')).toContainText('WH-01')
  expect(disabled).toHaveLength(0)

  await page.locator('.n-dialog').getByRole('button', { name: '确认停用' }).click()

  await expect.poll(() => disabled).toEqual(['/api/v1/warehouses/3/disable'])
})
