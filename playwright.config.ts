import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: './node_modules/.bin/vite --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173/login',
    reuseExistingServer: !process.env.CI,
    // e2e 需要覆盖「API 测试」页，显式打开构建期开关。
    // 本地复用已启动的 dev server 时，以该服务的 .env 为准（默认已开启）。
    env: { VITE_ENABLE_API_TEST: 'true' },
  },
})
