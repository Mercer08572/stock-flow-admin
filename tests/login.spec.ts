import { expect, test } from '@playwright/test'

test('renders the login workflow at desktop and mobile widths', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: '库存管理后台' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible()
  await expect(page.getByLabel('账号', { exact: true })).toBeVisible()
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
})

test('validates empty credentials', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: '登录' }).click()

  await expect(
    page.locator('.n-form-item-feedback__line').filter({ hasText: '请输入管理员账号' }),
  ).toBeVisible()
  await expect(
    page.locator('.n-form-item-feedback__line').filter({ hasText: '请输入密码' }),
  ).toBeVisible()
})
