import { expect, test, type Page } from '@playwright/test'

import { fail, fieldInput, mockApi, ok, type StubRoute } from './support/api-mock'

const NOW = '2026-11-10T08:00:00Z'

interface AppRow {
  id: number
  app_id: string
  name: string
  description: string | null
  status: 'active' | 'inactive'
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface SecretRow {
  id: number
  api_app_id: number
  secret_id: string
  name: string
  status: 'active' | 'blocked'
  bound_metadata: Record<string, unknown>
  expires_at: string | null
  last_used_at: string | null
  created_at: string
  updated_at: string
}

interface MockState {
  apps: AppRow[]
  secrets: SecretRow[]
  nextAppId: number
  nextSecretId: number
  failAppsOnce: boolean
}

function app(overrides: Partial<AppRow> = {}): AppRow {
  return {
    id: 1,
    app_id: 'app_wms',
    name: 'WMS 仓储系统',
    description: '负责出入库调用',
    status: 'active',
    metadata: { owner: 'team-a' },
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

function secret(overrides: Partial<SecretRow> = {}): SecretRow {
  return {
    id: 10,
    api_app_id: 1,
    secret_id: 'key_primary',
    name: '生产密钥',
    status: 'active',
    bound_metadata: { owner: 'team-a' },
    expires_at: null,
    last_used_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

function state(overrides: Partial<MockState> = {}): MockState {
  return {
    apps: [],
    secrets: [],
    nextAppId: 1,
    nextSecretId: 10,
    failAppsOnce: false,
    ...overrides,
  }
}

function pathOf(pathname: string): string[] {
  return pathname
    .replace(/^\/api\/v1/, '')
    .split('/')
    .filter(Boolean)
}

function makeSecret(
  current: MockState,
  apiAppId: number,
  name: string,
  expiresAt: string | null,
): SecretRow {
  const id = current.nextSecretId++
  return {
    id,
    api_app_id: apiAppId,
    secret_id: `key_${id}`,
    name,
    status: 'active',
    bound_metadata: { owner: 'team-a' },
    expires_at: expiresAt,
    last_used_at: null,
    created_at: NOW,
    updated_at: NOW,
  }
}

function apiRoutes(current: MockState): StubRoute[] {
  return [
    {
      method: 'GET',
      path: '/auth/apps',
      respond: async (route) => {
        if (current.failAppsOnce) {
          current.failAppsOnce = false
          await route.fulfill({ status: 500, json: fail(500, 1500, 'internal server error') })
          return
        }
        await route.fulfill({
          json: ok({
            items: current.apps,
            total: current.apps.length,
            limit: 100,
            offset: 0,
          }),
        })
      },
    },
    {
      method: 'GET',
      path: '/auth/apps/:id',
      respond: async (route) => {
        const id = Number(pathOf(new URL(route.request().url()).pathname)[2])
        const found = current.apps.find((item) => item.id === id)
        await route.fulfill({
          json: found ? ok(found) : fail(404, 1004, 'api app not found', 'AUTH_API_APP_NOT_FOUND'),
        })
      },
    },
    {
      method: 'POST',
      path: '/auth/apps',
      respond: async (route) => {
        const body = route.request().postDataJSON() as Partial<AppRow>
        const id = current.nextAppId++
        const created = app({
          id,
          app_id: `app_${id}`,
          name: body.name ?? '',
          description: body.description ?? null,
          status: body.status ?? 'active',
          metadata: body.metadata ?? {},
        })
        current.apps.unshift(created)
        await route.fulfill({ status: 201, json: ok(created) })
      },
    },
    {
      method: 'PUT',
      path: '/auth/apps/:id',
      respond: async (route) => {
        const id = Number(pathOf(new URL(route.request().url()).pathname)[2])
        const found = current.apps.find((item) => item.id === id)
        if (!found) {
          await route.fulfill({ json: fail(404, 1004, 'api app not found') })
          return
        }
        Object.assign(found, route.request().postDataJSON(), { updated_at: NOW })
        await route.fulfill({ json: ok(found) })
      },
    },
    {
      method: 'DELETE',
      path: '/auth/apps/:id',
      respond: async (route) => {
        const id = Number(pathOf(new URL(route.request().url()).pathname)[2])
        current.apps = current.apps.filter((item) => item.id !== id)
        current.secrets = current.secrets.filter((item) => item.api_app_id !== id)
        await route.fulfill({ json: ok(null) })
      },
    },
    {
      method: 'GET',
      path: '/auth/apps/:id/secrets',
      respond: async (route) => {
        const appId = Number(pathOf(new URL(route.request().url()).pathname)[2])
        await route.fulfill({
          json: ok({ items: current.secrets.filter((item) => item.api_app_id === appId) }),
        })
      },
    },
    {
      method: 'POST',
      path: '/auth/apps/:id/secrets',
      respond: async (route) => {
        const appId = Number(pathOf(new URL(route.request().url()).pathname)[2])
        const body = route.request().postDataJSON() as { name: string; expires_at?: string | null }
        const created = makeSecret(current, appId, body.name, body.expires_at ?? null)
        current.secrets.push(created)
        await route.fulfill({
          status: 201,
          json: ok({ ...created, secret: 'sfsec_plain_once' }),
        })
      },
    },
    {
      method: 'PUT',
      path: '/auth/apps/:id/secrets/:secret_id',
      respond: async (route) => {
        const parts = pathOf(new URL(route.request().url()).pathname)
        const found = current.secrets.find((item) => item.secret_id === parts[4])
        if (!found) {
          await route.fulfill({ json: fail(404, 1004, 'api secret not found') })
          return
        }
        const body = route.request().postDataJSON() as { name: string; expires_at: string | null }
        found.name = body.name
        found.expires_at = body.expires_at
        found.updated_at = NOW
        await route.fulfill({ json: ok(found) })
      },
    },
    {
      method: 'DELETE',
      path: '/auth/apps/:id/secrets/:secret_id',
      respond: async (route) => {
        const parts = pathOf(new URL(route.request().url()).pathname)
        current.secrets = current.secrets.filter((item) => item.secret_id !== parts[4])
        await route.fulfill({ json: ok(null) })
      },
    },
    {
      method: 'POST',
      path: '/auth/apps/:id/secrets/:secret_id/block',
      respond: async (route) => {
        const parts = pathOf(new URL(route.request().url()).pathname)
        const found = current.secrets.find((item) => item.secret_id === parts[4])
        if (!found) {
          await route.fulfill({ json: fail(404, 1004, 'api secret not found') })
          return
        }
        found.status = 'blocked'
        found.updated_at = NOW
        await route.fulfill({ json: ok(found) })
      },
    },
    {
      method: 'POST',
      path: '/auth/apps/:id/secrets/:secret_id/unblock',
      respond: async (route) => {
        const parts = pathOf(new URL(route.request().url()).pathname)
        const found = current.secrets.find((item) => item.secret_id === parts[4])
        if (!found) {
          await route.fulfill({ json: fail(404, 1004, 'api secret not found') })
          return
        }
        found.status = 'active'
        found.updated_at = NOW
        await route.fulfill({ json: ok(found) })
      },
    },
    {
      method: 'POST',
      path: '/auth/apps/:id/secrets/:secret_id/reissue',
      respond: async (route) => {
        const parts = pathOf(new URL(route.request().url()).pathname)
        const old = current.secrets.find((item) => item.secret_id === parts[4])
        if (!old) {
          await route.fulfill({ json: fail(404, 1004, 'api secret not found') })
          return
        }
        if (old.status !== 'active') {
          await route.fulfill({
            status: 409,
            json: fail(409, 1009, 'api secret is not active', 'AUTH_API_SECRET_NOT_ACTIVE'),
          })
          return
        }
        const body = route.request().postDataJSON() as { name: string; expires_at?: string | null }
        old.status = 'blocked'
        old.updated_at = NOW
        const created = makeSecret(current, old.api_app_id, body.name, body.expires_at ?? null)
        current.secrets.push(created)
        await route.fulfill({
          status: 201,
          json: ok({ ...created, secret: 'sfsec_rotated_once' }),
        })
      },
    },
  ]
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

test('creates an app with its first key and shows the secret only once', async ({ page }) => {
  const current = state()
  await mockApi(page, apiRoutes(current))

  await page.goto('/settings/api-keys')
  await expect(page.getByText('还没有 API 应用')).toBeVisible()

  await page.getByRole('button', { name: '新建应用' }).click()
  const drawer = page.locator('.n-drawer:visible')
  await expect(drawer.getByText('新建 API 应用')).toBeVisible()

  await fieldInput(page, '应用名称').fill('WMS 仓储系统')
  await fieldInput(page, '首把密钥名称').fill('生产密钥')
  await drawer.getByRole('button', { name: '保存' }).click()

  const modal = page.locator('.n-modal:visible')
  await expect(modal.getByText('密钥已签发')).toBeVisible()
  await expect(modal.getByText('sfsec_plain_once')).toBeVisible()
  await expect(modal.getByText('app_1', { exact: true })).toBeVisible()

  await modal.getByRole('button', { name: '我已妥善保存' }).click()
  await expect(modal).toBeHidden()
  await expect(page.getByRole('cell', { name: 'WMS 仓储系统' })).toBeVisible()

  // 刷新后仍然只有列表数据，明文不会再次出现
  await page.reload()
  await expect(page.getByRole('cell', { name: 'WMS 仓储系统' })).toBeVisible()
  await expect(page.getByText('sfsec_plain_once')).toHaveCount(0)
})

test('edits an app while preserving its metadata', async ({ page }) => {
  const current = state({ apps: [app()], nextAppId: 2 })
  const putBodies: Array<Record<string, unknown>> = []

  const routes = apiRoutes(current).map((route) =>
    route.method === 'PUT' && route.path === '/auth/apps/:id'
      ? {
          ...route,
          respond: async (target) => {
            putBodies.push(target.request().postDataJSON() as Record<string, unknown>)
            const id = Number(pathOf(new URL(target.request().url()).pathname)[2])
            const found = current.apps.find((item) => item.id === id)
            if (found) Object.assign(found, target.request().postDataJSON(), { updated_at: NOW })
            await target.fulfill({ json: ok(found) })
          },
        }
      : route,
  )

  await mockApi(page, routes)
  await page.goto('/settings/api-keys')
  await page.getByRole('button', { name: '编辑' }).click()

  const drawer = page.locator('.n-drawer:visible')
  await expect(fieldInput(page, '应用名称')).toHaveValue('WMS 仓储系统')
  await fieldInput(page, '应用名称').fill('WMS 仓储系统（改）')
  await drawer.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => putBodies.length).toBe(1)
  expect(putBodies[0]).toMatchObject({
    name: 'WMS 仓储系统（改）',
    status: 'active',
    metadata: { owner: 'team-a' },
  })
  await expect(page.getByRole('cell', { name: 'WMS 仓储系统（改）' })).toBeVisible()
})

test('disables and re-enables a key from the drawer', async ({ page }) => {
  const current = state({ apps: [app()], secrets: [secret()], nextAppId: 2 })
  await mockApi(page, apiRoutes(current))

  await page.goto('/settings/api-keys')
  await page.getByRole('button', { name: '密钥' }).click()

  const drawer = page.locator('.n-drawer:visible')
  await expect(drawer.getByRole('cell', { name: '生产密钥' })).toBeVisible()

  await drawer.getByRole('button', { name: '禁用' }).click()
  const dialog = page.locator('.n-dialog:visible')
  await expect(dialog.getByRole('button', { name: '确认禁用' })).toBeVisible()
  await dialog.getByRole('button', { name: '确认禁用' }).click()

  await expect(drawer.getByText('已禁用')).toBeVisible()
  await expect(drawer.getByRole('button', { name: '启用' })).toBeVisible()

  await drawer.getByRole('button', { name: '启用' }).click()
  await expect(drawer.getByText('已禁用')).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: '禁用' })).toBeVisible()
})

test('reissues a key and deletes the blocked one', async ({ page }) => {
  const current = state({ apps: [app()], secrets: [secret()], nextAppId: 2 })
  await mockApi(page, apiRoutes(current))

  await page.goto('/settings/api-keys')
  await page.getByRole('button', { name: '密钥' }).click()

  const drawer = page.locator('.n-drawer:visible')
  await expect(drawer.getByRole('cell', { name: '生产密钥' })).toBeVisible()

  await drawer.getByRole('button', { name: '重新签发' }).click()
  const formModal = page.locator('.n-modal:visible')
  await expect(formModal.getByText('重新签发密钥')).toBeVisible()
  await fieldInput(page, '密钥名称').fill('轮换密钥')
  await formModal.getByRole('button', { name: '确认重新签发' }).click()

  const revealModal = page.locator('.n-modal:visible')
  await expect(revealModal.getByText('密钥已签发')).toBeVisible()
  await expect(revealModal.getByText('sfsec_rotated_once')).toBeVisible()
  await revealModal.getByRole('button', { name: '我已妥善保存' }).click()
  await expect(revealModal).toBeHidden()

  await expect(drawer.getByRole('cell', { name: '轮换密钥' })).toBeVisible()
  await expect(drawer.getByText('已禁用')).toBeVisible()

  const blockedRow = drawer.locator('tbody tr').filter({ hasText: '已禁用' })
  await blockedRow.getByRole('button', { name: '删除' }).click()
  const dialog = page.locator('.n-dialog:visible')
  await expect(dialog.getByRole('button', { name: '确认删除' })).toBeVisible()
  await dialog.getByRole('button', { name: '确认删除' }).click()

  await expect(drawer.getByText('已禁用')).toHaveCount(0)
  await expect(drawer.getByRole('cell', { name: '生产密钥' })).toHaveCount(0)
})

test('shows a retry state when the app list fails', async ({ page }) => {
  const current = state({ apps: [app()], nextAppId: 2, failAppsOnce: true })
  await mockApi(page, apiRoutes(current))

  await page.goto('/settings/api-keys')
  await expect(page.getByText('internal server error')).toBeVisible()
  await page.getByRole('button', { name: '重试' }).click()

  await expect(page.getByRole('cell', { name: 'WMS 仓储系统' })).toBeVisible()
})

test.describe('320 px', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('the list and key drawer stay usable without page overflow', async ({ page }) => {
    const current = state({ apps: [app()], secrets: [secret()], nextAppId: 2 })
    await mockApi(page, apiRoutes(current))

    await page.goto('/settings/api-keys')
    await expect(page.getByRole('cell', { name: 'WMS 仓储系统' })).toBeVisible()
    await expectNoPageOverflow(page)

    await page.getByRole('button', { name: '密钥' }).click()
    const drawer = page.locator('.n-drawer:visible')
    await expect(drawer.getByRole('cell', { name: '生产密钥' })).toBeVisible()
    await expect(drawer.getByRole('button', { name: '签发密钥' })).toBeVisible()

    const drawerOverflow = await drawer.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    )
    expect(drawerOverflow).toBeLessThanOrEqual(1)
  })
})
