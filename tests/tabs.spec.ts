import { expect, test, type Page } from '@playwright/test'

import { mockApi, ok, type StubRoute } from './support/api-mock'

/**
 * 应用外壳的多标签工作台。
 *
 * 这里的断言重点是**标签集合与 URL 的对应关系**——标签只是路由的投影，
 * 一旦它和 `route.path` 脱钩（重复开标签、关掉当前页后 URL 不动），
 * 页面看起来仍然正常，但用户会被带到错误的页面。
 */

const now = '2026-09-01T10:00:00Z'

const kgUnit = {
  id: 1,
  code: 'KG',
  name: '千克',
  symbol: 'kg',
  unit_type: 'weight',
  precision: 3,
  status: 'active',
  created_at: now,
  updated_at: now,
}

const warehouse = {
  id: 3,
  code: 'WH-01',
  name: '主仓',
  type: 'normal',
  status: 'active',
  created_at: now,
  updated_at: now,
}

/**
 * 列表桩的行数按用例调整：有些断言需要一个「必然比内容区高」的页面。
 * 通过变量而不是二次注册路由来实现，避免依赖 Playwright 的处理器优先级。
 */
let unitRows: (typeof kgUnit)[] = [kgUnit]

function manyUnits(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...kgUnit,
    id: index + 1,
    code: `U-${String(index + 1).padStart(2, '0')}`,
    name: `单位 ${index + 1}`,
  }))
}

/** 三个页面各自的最小桩：只服务于「能进得去、并渲染出内容」 */
const routes: StubRoute[] = [
  {
    method: 'GET',
    path: '/health',
    respond: (route) => route.fulfill({ json: ok({ service: 'stock-flow', status: 'ok' }) }),
  },
  {
    method: 'GET',
    path: '/units',
    respond: (route) => route.fulfill({ json: ok({ items: unitRows, limit: 100, offset: 0 }) }),
  },
  {
    method: 'GET',
    path: '/warehouses',
    respond: (route) => route.fulfill({ json: ok({ items: [warehouse], limit: 100, offset: 0 }) }),
  },
  {
    method: 'GET',
    path: '/skus',
    respond: (route) => route.fulfill({ json: ok({ items: [], limit: 100, offset: 0 }) }),
  },
  {
    method: 'GET',
    path: '/inventory/stocks',
    respond: (route) => route.fulfill({ json: ok({ items: [], limit: 100, offset: 0 }) }),
  },
]

const WORKBENCH = '/'
const UNITS = '/master-data/units'
const STOCKS = '/inventory/stocks'
const WAREHOUSES = '/master-data/warehouses'

/** 标签以路由路径为键，Naive UI 会把键渲染到 `data-name` 上 */
function tab(page: Page, path: string) {
  return page.locator(`.n-tabs-tab[data-name="${path}"]`)
}

function allTabs(page: Page) {
  return page.locator('.n-tabs-tab')
}

/**
 * 移动端左侧菜单收进抽屉，先点汉堡按钮；点击后抽屉会由 navigate() 自动关闭。
 *
 * 两个入口都必须等 URL 落地再返回：连续两次不等待的点击会把两次导航压进同一个 tick，
 * 那次被压掉的页面从未渲染，自然也不会留下标签（断言会因此看起来「标签少了」）。
 */
async function openFromMenu(page: Page, label: string, path: string) {
  const width = page.viewportSize()?.width ?? 0
  if (width < 768) await page.getByRole('button', { name: '打开导航' }).click()
  await page.locator('.n-menu-item-content').filter({ hasText: label }).click()
  await expect(page).toHaveURL(path)
}

/** 从工作台的快捷入口跳转（两种宽度下都可见） */
async function openFromQuickLink(page: Page, label: string, path: string) {
  await page.locator('.quick-link').filter({ hasText: label }).click()
  await expect(page).toHaveURL(path)
}

test.beforeEach(async ({ page }) => {
  unitRows = [kgUnit]
  await mockApi(page, routes)
})

test('每个访问过的页面各占一个标签，重复访问不重复开标签', async ({ page }) => {
  await page.goto(WORKBENCH)

  // 工作台常驻且不可关闭：标签上没有关闭按钮
  await expect(allTabs(page)).toHaveCount(1)
  await expect(tab(page, WORKBENCH)).toHaveClass(/n-tabs-tab--active/)
  await expect(tab(page, WORKBENCH).locator('.n-tabs-tab__close')).toHaveCount(0)

  await openFromQuickLink(page, '计量单位', UNITS)
  await expect(page).toHaveURL(UNITS)
  await expect(allTabs(page)).toHaveCount(2)
  await expect(tab(page, UNITS)).toHaveClass(/n-tabs-tab--active/)
  await expect(page.getByRole('cell', { name: 'KG', exact: true })).toBeVisible()

  // 点标签切回工作台，再点回来：数量不变（同一个路由只占一个标签）
  await tab(page, WORKBENCH).click()
  await expect(page).toHaveURL(WORKBENCH)
  await tab(page, UNITS).click()
  await expect(page).toHaveURL(UNITS)
  await expect(allTabs(page)).toHaveCount(2)

  // 关闭非当前页的标签：停留在当前页面不动
  await tab(page, WORKBENCH).click()
  await tab(page, UNITS).locator('.n-tabs-tab__close').click()
  await expect(allTabs(page)).toHaveCount(1)
  await expect(page).toHaveURL(WORKBENCH)
})

test('关闭当前页的标签时激活它左侧的标签', async ({ page }) => {
  await page.goto(WORKBENCH)
  await openFromQuickLink(page, '计量单位', UNITS)
  await openFromMenu(page, '库存余额', STOCKS)
  await expect(page).toHaveURL(STOCKS)
  await expect(allTabs(page)).toHaveCount(3)

  // 关闭当前页 → 激活左邻（计量单位）
  await tab(page, STOCKS).locator('.n-tabs-tab__close').click()
  await expect(page).toHaveURL(UNITS)
  await expect(tab(page, UNITS)).toHaveClass(/n-tabs-tab--active/)
  await expect(allTabs(page)).toHaveCount(2)

  // 再关掉当前页 → 落到保底的工作台
  await tab(page, UNITS).locator('.n-tabs-tab__close').click()
  await expect(page).toHaveURL(WORKBENCH)
  await expect(tab(page, WORKBENCH)).toHaveClass(/n-tabs-tab--active/)
  await expect(allTabs(page)).toHaveCount(1)
})

test('深链与刷新后重建为「工作台 + 当前页」', async ({ page }) => {
  await page.goto(WAREHOUSES)

  await expect(allTabs(page)).toHaveCount(2)
  await expect(tab(page, WAREHOUSES)).toHaveClass(/n-tabs-tab--active/)
  await expect(tab(page, WAREHOUSES).locator('.n-tabs-tab__close')).toHaveCount(1)

  await page.reload()
  await expect(page).toHaveURL(WAREHOUSES)
  await expect(allTabs(page)).toHaveCount(2)
  await expect(tab(page, WORKBENCH)).toBeVisible()
})

test.describe('固定外壳', () => {
  /** 视口压到 400 px 高，页面必然溢出，用来验证「滚动的是内容区、不是窗口」 */
  test.use({ viewport: { width: 1024, height: 400 } })

  test('内容区滚动时顶栏与标签条纹丝不动', async ({ page }) => {
    // 40 行数据把列表页撑得比内容区高，确保滚动的确实是内容区
    unitRows = manyUnits(40)
    await page.goto(UNITS)
    await expect(allTabs(page)).toHaveCount(2)

    const geometry = () =>
      page.evaluate(() => {
        const rect = (selector: string) => {
          const element = document.querySelector(selector) as HTMLElement | null
          if (!element) return null
          const box = element.getBoundingClientRect()
          return { top: Math.round(box.top), bottom: Math.round(box.bottom) }
        }
        const content = document.querySelector('.app-content') as HTMLElement
        return {
          topbar: rect('.topbar'),
          tabbar: rect('.tabbar'),
          contentScrollTop: Math.round(content.scrollTop),
          contentScrollable: content.scrollHeight - content.clientHeight,
          windowScrollY: Math.round(window.scrollY),
          windowScrollable:
            document.documentElement.scrollHeight - document.documentElement.clientHeight,
        }
      })

    const before = await geometry()
    expect(before.contentScrollable).toBeGreaterThan(0)
    expect(before.windowScrollable).toBe(0)
    expect(before.topbar?.top).toBe(0)

    await page.evaluate(() => {
      const content = document.querySelector('.app-content') as HTMLElement
      content.scrollTop = content.scrollHeight
    })
    await expect
      .poll(async () => (await geometry()).contentScrollTop)
      .toBe(before.contentScrollable)

    const after = await geometry()
    // 顶栏与标签条原地不动，页面内容在它们下面滚动
    expect(after.topbar).toEqual(before.topbar)
    expect(after.tabbar).toEqual(before.tabbar)
    expect(after.windowScrollY).toBe(0)

    // 滚动到底后标签仍然可点（band 在内容之上，没有被内容盖住）
    await tab(page, WORKBENCH).click()
    await expect(page).toHaveURL(WORKBENCH)
  })
})

test.describe('短页面', () => {
  /** 视口给足高度：工作台内容必然装得下，多出来的滚动条只可能来自错误的高度算式 */
  test.use({ viewport: { width: 1440, height: 1200 } })

  test('不会多出多余的滚动条', async ({ page }) => {
    await page.goto(WORKBENCH)
    await expect(tab(page, WORKBENCH)).toHaveClass(/n-tabs-tab--active/)

    // 页面比内容区矮时不能撑出滚动：否则每个短页面都会挂一条约一个标签条高度的滚动条
    const metrics = await page.evaluate(() => {
      const content = document.querySelector('.app-content') as HTMLElement
      const page = document.querySelector('main.page') as HTMLElement
      return {
        contentHeight: content.clientHeight,
        pageHeight: Math.round(page.getBoundingClientRect().height),
        overflow: content.scrollHeight - content.clientHeight,
      }
    })
    expect(metrics.pageHeight).toBeLessThan(metrics.contentHeight)
    expect(metrics.overflow).toBe(0)
  })
})

test.describe('320 px', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('标签条不换行、不横向溢出，且仍可切换与关闭', async ({ page }) => {
    await page.goto(UNITS)
    await expect(allTabs(page)).toHaveCount(2)

    // 标签必须排在同一行（换行会把内容区顶下去）
    const boxes = await allTabs(page).evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    )
    expect(new Set(boxes).size).toBe(1)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)

    await tab(page, WORKBENCH).click()
    await expect(page).toHaveURL(WORKBENCH)
    await tab(page, UNITS).click()
    await expect(page).toHaveURL(UNITS)

    // 关闭当前页 → 回到工作台，标签条只剩常驻的那一个
    await tab(page, UNITS).locator('.n-tabs-tab__close').click()
    await expect(page).toHaveURL(WORKBENCH)
    await expect(allTabs(page)).toHaveCount(1)
  })
})
