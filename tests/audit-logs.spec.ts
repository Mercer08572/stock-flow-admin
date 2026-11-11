import { expect, test, type Page } from '@playwright/test'

import { fail, mockApi, ok, type StubRoute } from './support/api-mock'

const NOW = '2026-11-10T08:00:00Z'

interface AuditRow {
  id: number
  occurred_at: string
  trace_id: string
  method: string
  path: string
  route?: string
  status_code: number
  latency_ms: number
  auth_method: 'admin_session' | 'api_app' | 'none' | 'ambiguous'
  actor_type?: 'admin' | 'api_app'
  actor_id?: number
  actor_label?: string
  credential_id?: string
  client_ip?: string
  user_agent?: string
  error_code?: string
  request_bytes: number
  response_bytes: number
}

const adminRow: AuditRow = {
  id: 1,
  occurred_at: NOW,
  trace_id: 'req_admin',
  method: 'GET',
  path: '/api/v1/inventory/stocks',
  route: '/api/v1/inventory/stocks',
  status_code: 200,
  latency_ms: 12,
  auth_method: 'admin_session',
  actor_type: 'admin',
  actor_id: 1,
  actor_label: 'admin',
  client_ip: '192.0.2.10',
  request_bytes: 0,
  response_bytes: 512,
}

const ambiguousRow: AuditRow = {
  id: 2,
  occurred_at: NOW,
  trace_id: 'req_ambiguous',
  method: 'GET',
  path: '/api/v1/inventory/stocks',
  status_code: 400,
  latency_ms: 3,
  auth_method: 'ambiguous',
  client_ip: '192.0.2.20',
  error_code: 'AUTH_AMBIGUOUS_METHOD',
  request_bytes: 0,
  response_bytes: 128,
}

const appRow: AuditRow = {
  id: 3,
  occurred_at: NOW,
  trace_id: 'req_app',
  method: 'GET',
  path: '/api/v1/inventory/stocks',
  status_code: 200,
  latency_ms: 8,
  auth_method: 'api_app',
  actor_type: 'api_app',
  actor_id: 9,
  actor_label: 'app_wms',
  credential_id: 'key_test',
  client_ip: '192.0.2.30',
  request_bytes: 0,
  response_bytes: 256,
}

interface MockState {
  failOnce: boolean
  queries: URLSearchParams[]
}

function auditRoutes(state: MockState): StubRoute[] {
  return [
    {
      method: 'GET',
      path: '/audit/logs',
      respond: async (route) => {
        const url = new URL(route.request().url())
        state.queries.push(url.searchParams)
        if (state.failOnce) {
          state.failOnce = false
          await route.fulfill({ status: 500, json: fail(500, 1500, 'internal server error') })
          return
        }

        const cursor = url.searchParams.get('cursor')
        if (cursor === 'cursor-2') {
          await route.fulfill({ json: ok({ items: [appRow], next_cursor: '' }) })
          return
        }
        await route.fulfill({
          json: ok({ items: [adminRow, ambiguousRow], next_cursor: 'cursor-2' }),
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

test('lists audit rows, shows auth method and loads more by cursor', async ({ page }) => {
  const state: MockState = { failOnce: false, queries: [] }
  await mockApi(page, auditRoutes(state))

  await page.goto('/settings/audit-logs')
  await expect(page.getByRole('cell', { name: '管理员会话' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '认证冲突' })).toBeVisible()
  await expect(page.getByText('AUTH_AMBIGUOUS_METHOD')).toBeVisible()
  await expect(page.getByText('已加载 2 条', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '加载更多' }).click()
  await expect(page.getByRole('cell', { name: 'API 密钥' })).toBeVisible()
  await expect(page.getByText('app_wms (#9)')).toBeVisible()
  await expect(page.getByText('已加载 3 条', { exact: true })).toBeVisible()
  await expect(page.getByText('没有更多了', { exact: true })).toBeVisible()

  expect(state.queries[1]?.get('cursor')).toBe('cursor-2')
})

test('sends the selected filters to the audit API', async ({ page }) => {
  const state: MockState = { failOnce: false, queries: [] }
  await mockApi(page, auditRoutes(state))

  await page.goto('/settings/audit-logs')
  await expect(page.getByRole('cell', { name: '管理员会话' })).toBeVisible()

  await page.getByPlaceholder('管理员用户名或 App ID').fill('app_wms')
  await page.getByPlaceholder('例如 203.0.113.10').fill('192.0.2.30')
  await page.getByPlaceholder('例如 401').fill('401')

  await page.locator('.filter-auth .n-select').click()
  await page.locator('.n-base-select-option').filter({ hasText: 'API 密钥' }).click()
  await page.getByRole('button', { name: '查询' }).click()

  await expect.poll(() => state.queries.length).toBeGreaterThanOrEqual(2)
  const query = state.queries[state.queries.length - 1]
  expect(query?.get('auth_method')).toBe('api_app')
  expect(query?.get('actor_label')).toBe('app_wms')
  expect(query?.get('client_ip')).toBe('192.0.2.30')
  expect(query?.get('status_code')).toBe('401')
})

test('shows an error with retry when the audit API fails', async ({ page }) => {
  const state: MockState = { failOnce: true, queries: [] }
  await mockApi(page, auditRoutes(state))

  await page.goto('/settings/audit-logs')
  await expect(page.getByText('internal server error')).toBeVisible()
  await page.getByRole('button', { name: '重试' }).click()

  await expect(page.getByRole('cell', { name: '管理员会话' })).toBeVisible()
})

test.describe('320 px', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('filters and the audit table stay usable without page overflow', async ({ page }) => {
    const state: MockState = { failOnce: false, queries: [] }
    await mockApi(page, auditRoutes(state))

    await page.goto('/settings/audit-logs')
    await expect(page.getByRole('cell', { name: '管理员会话' })).toBeVisible()
    await expect(page.getByText('时间范围')).toBeVisible()
    await expect(page.getByRole('button', { name: '查询' })).toBeVisible()
    await expectNoPageOverflow(page)
  })
})
