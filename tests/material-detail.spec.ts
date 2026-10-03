import { expect, test, type Locator, type Page } from '@playwright/test'

import { fieldInput, mockApi, ok, type StubRoute } from './support/api-mock'

/**
 * 物料详情页（主子表）的端到端验证。
 *
 * 关键断言不是「页面上有字」，而是**请求形状**：子表只按 material_id 取数、
 * 新增 SKU 时 material_id 恒为当前物料——这两条出错时页面看起来仍然正常。
 */

const MATERIAL_ID = 101
const now = '2026-09-01T10:00:00Z'

const material = {
  id: MATERIAL_ID,
  code: 'M-001',
  name: '钢板',
  category_id: 11,
  base_unit_id: 1,
  status: 'active',
  remark: null,
  created_at: now,
  updated_at: now,
}

const otherMaterial = { ...material, id: 102, code: 'M-002', name: '螺丝' }

const sku = {
  id: 1001,
  code: 'SKU-001',
  name: '钢板 1mm',
  material_id: MATERIAL_ID,
  unit_id: 1,
  status: 'active',
  remark: null,
  created_at: now,
  updated_at: now,
}

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

const poundUnit = {
  id: 11,
  code: 'LB',
  name: '磅',
  symbol: 'lb',
  unit_type: 'weight',
  precision: 3,
  status: 'active',
  created_at: now,
  updated_at: now,
}

const gramUnit = {
  id: 4,
  code: 'G',
  name: '克',
  symbol: 'g',
  unit_type: 'weight',
  precision: 3,
  status: 'active',
  created_at: now,
  updated_at: now,
}

/** 详情页默认带一条换算：`1 KG = 1000 G`，同时把 G 纳入 SKU 单位候选 */
const gramConversion = {
  id: 900,
  material_id: MATERIAL_ID,
  from_unit_id: kgUnit.id,
  to_unit_id: gramUnit.id,
  factor: '1000',
  created_at: now,
  updated_at: now,
}

/** 基础信息里某个字段的取值元素（标签与取值分开渲染） */
function factValue(page: Page, label: string): Locator {
  return page
    .locator('.material-fact')
    .filter({ has: page.locator('dt', { hasText: label }) })
    .locator('dd')
}

/** NSelect 的选中值渲染在 `.n-base-selection-label`，而 input.value 始终为空 */
function selectionLabel(scope: Locator, label: string): Locator {
  return scope
    .locator('.n-form-item')
    .filter({ has: scope.page().locator('.n-form-item-label', { hasText: label }) })
    .locator('.n-base-selection-label')
}

function detailRoutes(onSkuList: (url: URL) => void): StubRoute[] {
  return [
    {
      method: 'GET',
      path: '/materials/:id/unit-conversions',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [gramConversion], limit: 100, offset: 0 }) }),
    },
    {
      method: 'GET',
      path: '/materials',
      respond: (route) =>
        route.fulfill({ json: ok({ items: [material, otherMaterial], limit: 100, offset: 0 }) }),
    },
    {
      method: 'GET',
      path: '/materials/:id',
      respond: (route) => route.fulfill({ json: ok(material) }),
    },
    {
      method: 'PUT',
      path: '/materials/:id',
      respond: (route) => route.fulfill({ json: ok(material) }),
    },
    {
      method: 'POST',
      path: '/materials/:id/unit-conversions',
      respond: (route) => route.fulfill({ json: ok(gramConversion) }),
    },
    {
      method: 'PUT',
      path: '/materials/:id/unit-conversions/:conversion_id',
      respond: (route) => route.fulfill({ json: ok(gramConversion) }),
    },
    {
      method: 'GET',
      path: '/material-categories',
      respond: (route) =>
        route.fulfill({
          json: ok({
            items: [
              {
                id: 11,
                code: 'CAT-01',
                name: '金属件',
                parent_id: null,
                status: 'active',
                remark: null,
                created_at: now,
                updated_at: now,
              },
            ],
            limit: 100,
            offset: 0,
          }),
        }),
    },
    {
      method: 'GET',
      path: '/units',
      respond: (route) =>
        route.fulfill({
          json: ok({ items: [kgUnit, gramUnit, poundUnit], limit: 100, offset: 0 }),
        }),
    },
    {
      method: 'GET',
      path: '/skus',
      respond: (route) => {
        const url = new URL(route.request().url())
        onSkuList(url)
        // 只有按当前物料过滤时才返回数据：漏传 material_id 会立刻暴露成空表
        const filtered = url.searchParams.get('material_id') === String(MATERIAL_ID)
        return route.fulfill({ json: ok({ items: filtered ? [sku] : [], limit: 100, offset: 0 }) })
      },
    },
    { method: 'POST', path: '/skus', respond: (route) => route.fulfill({ json: ok(sku) }) },
  ]
}

test('opens a material detail page and lists only its SKUs', async ({ page }) => {
  const skuListUrls: URL[] = []

  await mockApi(
    page,
    detailRoutes((url) => skuListUrls.push(url)),
  )

  // 物料列表把引用渲染成「编码 - 名称」，而不是裸 ID
  await page.goto('/master-data/materials')
  await expect(page.getByRole('cell', { name: 'CAT-01 - 金属件' }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: 'KG - 千克' }).first()).toBeVisible()

  // 从列表进入详情
  await page.getByRole('button', { name: '详情' }).first().click()
  await expect(page).toHaveURL(`/master-data/materials/${MATERIAL_ID}`)
  await expect(page.getByRole('heading', { name: '物料 M-001 - 钢板' })).toBeVisible()
  // 基础信息按「标签 / 取值」成对渲染：标签与取值是两个独立元素，
  // 因此校验某一对而不是整段文本（否则标签与取值混排也测不出来）
  await expect(factValue(page, '分类')).toHaveText('CAT-01 - 金属件')
  await expect(factValue(page, '基础单位')).toHaveText('KG - 千克')

  // 子表只查当前物料
  expect(skuListUrls).toHaveLength(1)
  expect(skuListUrls[0]?.searchParams.get('material_id')).toBe(String(MATERIAL_ID))
  await expect(page.getByRole('cell', { name: 'SKU-001' })).toBeVisible()
  await expect(page.locator('tbody td[data-col-key="unit_id"]').first()).toHaveText('KG - 千克')

  // 左侧菜单保持「物料」高亮；移动端侧边栏整体隐藏，只在桌面宽度断言
  const width = page.viewportSize()?.width ?? 0
  if (width >= 768) {
    await expect(
      page.locator('.n-menu-item-content--selected').filter({ hasText: '物料' }),
    ).toHaveCount(1)
  }
})

test('adds a SKU from the detail page with the material pinned', async ({ page }) => {
  const postBodies: Array<Record<string, unknown>> = []

  await mockApi(
    page,
    detailRoutes(() => {}).map((route) =>
      route.method === 'POST' && route.path === '/skus'
        ? {
            ...route,
            respond: async (request) => {
              postBodies.push(request.request().postDataJSON() as Record<string, unknown>)
              await request.fulfill({ json: ok(sku) })
            },
          }
        : route,
    ),
  )

  await page.goto(`/master-data/materials/${MATERIAL_ID}`)
  await expect(page.getByRole('cell', { name: 'SKU-001' })).toBeVisible()

  await page.getByRole('button', { name: '新增 SKU' }).click()
  const drawer = page.locator('.n-drawer')
  await expect(drawer).toBeVisible()

  // 抽屉先加载引用选项、再拉实体预填；等预填完成后再断言锁定态
  await expect(selectionLabel(drawer, '物料')).toHaveText('101')
  await expect(fieldInput(page, '物料')).toBeDisabled()

  await fieldInput(page, '编码').fill('SKU-002')
  await fieldInput(page, '名称').fill('钢板 2mm')
  // 下拉的选项必须在**新增**模式下也加载出来（否则是空的 No Data）
  await fieldInput(page, '单位').click()
  await page.locator('.n-base-select-option').filter({ hasText: 'KG - 千克' }).click()
  await expect(selectionLabel(drawer, '单位')).toHaveText('KG - 千克')

  await drawer.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => postBodies.length).toBe(1)
  expect(postBodies[0]).toEqual({
    code: 'SKU-002',
    name: '钢板 2mm',
    material_id: MATERIAL_ID,
    status: 'active',
    unit_id: 1,
    remark: null,
  })
})

test('the material detail page fits a 320 px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await mockApi(
    page,
    detailRoutes(() => {}),
  )

  await page.goto(`/master-data/materials/${MATERIAL_ID}`)
  await expect(page.getByRole('cell', { name: 'SKU-001' })).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  // 窄屏下也要能进入新增 SKU 的抽屉
  await page.getByRole('button', { name: '新增 SKU' }).click()
  const drawer = page.locator('.n-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: '保存' })).toBeVisible()
})

test('adds a unit conversion with the material base unit as the fixed side', async ({ page }) => {
  const postBodies: Array<Record<string, unknown>> = []

  await mockApi(
    page,
    detailRoutes(() => {}).map((route) =>
      route.method === 'POST' && route.path === '/materials/:id/unit-conversions'
        ? {
            ...route,
            respond: async (request) => {
              postBodies.push(request.request().postDataJSON() as Record<string, unknown>)
              await request.fulfill({ json: ok(null) })
            },
          }
        : route,
    ),
  )

  await page.goto(`/master-data/materials/${MATERIAL_ID}`)
  await expect(page.getByRole('heading', { name: '单位换算' })).toBeVisible()

  await page.getByRole('button', { name: '新增换算' }).click()
  const drawer = page.locator('.n-drawer')
  await expect(drawer).toBeVisible()

  // 基础单位 KG 与已建过换算的 G 都不再出现在候选里，只剩未建规则的 LB
  await fieldInput(page, '目标单位').click()
  await expect(page.locator('.n-base-select-option')).toHaveText(['LB - 磅'])
  await page.locator('.n-base-select-option').first().click()

  await drawer.locator('.n-form-item').last().locator('input').fill('2.2046226218')
  await drawer.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => postBodies.length).toBe(1)
  // 方向固定为「基础单位 → 目标单位」，由前端显式提交，避免后端反向规范化
  expect(postBodies[0]).toEqual({
    from_unit_id: kgUnit.id,
    to_unit_id: poundUnit.id,
    factor: '2.2046226218',
  })
})

test('renders every stored conversion with its own direction and editing keeps it', async ({
  page,
}) => {
  const putBodies: Array<Record<string, unknown>> = []

  // 反向存量行：`1 G = 0.001 KG`，展示时必须仍然是这个方向
  const reverseConversion = {
    id: 901,
    material_id: MATERIAL_ID,
    from_unit_id: gramUnit.id,
    to_unit_id: kgUnit.id,
    factor: '0.001',
    created_at: now,
    updated_at: now,
  }

  await mockApi(
    page,
    detailRoutes(() => {}).map((route) => {
      if (route.method === 'GET' && route.path === '/materials/:id/unit-conversions') {
        return {
          ...route,
          respond: (request) =>
            request.fulfill({
              json: ok({ items: [gramConversion, reverseConversion], limit: 100, offset: 0 }),
            }),
        }
      }
      if (
        route.method === 'PUT' &&
        route.path === '/materials/:id/unit-conversions/:conversion_id'
      ) {
        return {
          ...route,
          respond: async (request) => {
            putBodies.push(request.request().postDataJSON() as Record<string, unknown>)
            await request.fulfill({ json: ok(reverseConversion) })
          },
        }
      }
      return route
    }),
  )

  await page.goto(`/master-data/materials/${MATERIAL_ID}`)

  const relationCells = page.locator('tbody td[data-col-key="relation"]')
  await expect(relationCells).toHaveText([
    '1 KG - 千克 = 1000 G - 克',
    '1 G - 克 = 0.001 KG - 千克',
  ])

  // 编辑第二行（反向行）：方向锁定，只改系数
  await page.locator('tbody tr').nth(1).getByRole('button', { name: '编辑' }).click()
  const drawer = page.locator('.n-drawer')
  await expect(fieldInput(page, '换算方向')).toHaveValue('1 G - 克 = 0.001 KG - 千克')

  await drawer.locator('.n-form-item').last().locator('input').fill('0.002')
  await drawer.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => putBodies.length).toBe(1)
  // 方向沿用该行原本的 from/to，而不是被改写成「基础单位 → 目标单位」
  expect(putBodies[0]).toEqual({
    from_unit_id: gramUnit.id,
    to_unit_id: kgUnit.id,
    factor: '0.002',
  })
})

test('edits the material from its detail page with the base unit locked', async ({ page }) => {
  const putBodies: Array<Record<string, unknown>> = []

  await mockApi(
    page,
    detailRoutes(() => {}).map((route) =>
      route.method === 'PUT' && route.path === '/materials/:id'
        ? {
            ...route,
            respond: async (request) => {
              putBodies.push(request.request().postDataJSON() as Record<string, unknown>)
              await request.fulfill({ json: ok(material) })
            },
          }
        : route,
    ),
  )

  await page.goto(`/master-data/materials/${MATERIAL_ID}`)
  await page.getByRole('button', { name: '编辑物料' }).click()

  const drawer = page.locator('.n-drawer')
  await expect(drawer.getByText('编辑物料')).toBeVisible()

  // 基础单位锁定：PUT 是全量替换，漏发会被写成 0，因此在界面上不可改、但仍在载荷里
  await expect(selectionLabel(drawer, '基础单位')).toHaveText('KG - 千克')
  await expect(fieldInput(page, '基础单位')).toBeDisabled()

  await fieldInput(page, '名称').fill('钢板（改）')
  await drawer.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => putBodies.length).toBe(1)
  expect(putBodies[0]).toMatchObject({
    code: 'M-001',
    name: '钢板（改）',
    base_unit_id: 1,
    status: 'active',
  })
})
