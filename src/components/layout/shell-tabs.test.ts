import { describe, expect, it } from 'vitest'

import {
  closeTab,
  closeTabsBy,
  openTab,
  toTab,
  WORKBENCH_PATH,
  WORKBENCH_TAB,
  type ShellTab,
} from './shell-tabs'

function tab(path: string, title = path): ShellTab {
  return { key: path, path, title, closable: path !== WORKBENCH_PATH }
}

const units = tab('/master-data/units', '计量单位')
const warehouses = tab('/master-data/warehouses', '仓库')

describe('toTab', () => {
  it('uses the route meta title and path', () => {
    expect(toTab({ path: '/master-data/units', meta: { title: '计量单位' } })).toEqual({
      key: '/master-data/units',
      path: '/master-data/units',
      title: '计量单位',
      closable: true,
    })
  })

  it('falls back to the app name when the route has no title', () => {
    expect(toTab({ path: '/master-data/units', meta: {} }).title).toBe('Stock Flow')
  })

  it('keeps the workbench unclosable even when built from the dashboard route', () => {
    expect(toTab({ path: WORKBENCH_PATH, meta: { title: '工作台' } })).toEqual(WORKBENCH_TAB)
  })
})

describe('openTab', () => {
  it('appends a new tab at the end', () => {
    expect(openTab([WORKBENCH_TAB], units)).toEqual([WORKBENCH_TAB, units])
  })

  it('never opens the same route twice', () => {
    const opened = openTab(openTab([WORKBENCH_TAB], units), units)
    expect(opened).toHaveLength(2)
  })

  it('updates the title in place and keeps the order', () => {
    const opened = openTab([WORKBENCH_TAB, units, warehouses], tab('/master-data/units', '单位'))
    expect(opened).toEqual([WORKBENCH_TAB, tab('/master-data/units', '单位'), warehouses])
  })

  it('returns the same array when nothing changed', () => {
    const current = [WORKBENCH_TAB, units]
    expect(openTab(current, units)).toBe(current)
  })
})

describe('closeTab', () => {
  it('refuses to close the workbench', () => {
    const current = [WORKBENCH_TAB, units]
    expect(closeTab(current, WORKBENCH_PATH, WORKBENCH_PATH)).toEqual({
      tabs: current,
      nextActive: null,
    })
  })

  it('ignores an unknown key', () => {
    const current = [WORKBENCH_TAB, units]
    expect(closeTab(current, '/nope', '/nope').tabs).toBe(current)
  })

  it('keeps the current page when another tab is closed', () => {
    const result = closeTab([WORKBENCH_TAB, units, warehouses], warehouses.path, units.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, units])
    expect(result.nextActive).toBeNull()
  })

  it('activates the tab on the left when the current page is closed', () => {
    const result = closeTab([WORKBENCH_TAB, units, warehouses], warehouses.path, warehouses.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, units])
    expect(result.nextActive).toBe(units.path)
  })

  it('falls back to the workbench when the only other tab is closed', () => {
    const result = closeTab([WORKBENCH_TAB, units], units.path, units.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB])
    expect(result.nextActive).toBe(WORKBENCH_PATH)
  })
})

describe('closeTabsBy', () => {
  const stocks = tab('/inventory/stocks', '库存余额')
  // 工作台永远是第 0 位；它右边才是可关闭的标签
  const four = [WORKBENCH_TAB, units, stocks, warehouses]

  it('closes only the closable tabs on the right of the anchor', () => {
    const result = closeTabsBy(four, stocks.path, 'right', stocks.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, units, stocks])
    // 当前页还在，不跳转
    expect(result.nextActive).toBeNull()
  })

  it('closes only the closable tabs on the left of the anchor', () => {
    const result = closeTabsBy(four, stocks.path, 'left', stocks.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, stocks, warehouses])
    expect(result.nextActive).toBeNull()
  })

  it('never closes the workbench when it sits on the left of the anchor', () => {
    const result = closeTabsBy(four, warehouses.path, 'left', warehouses.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, warehouses])
    expect(result.tabs[0]).toBe(WORKBENCH_TAB)
    expect(result.nextActive).toBeNull()
  })

  it('closes everything except the anchor and the workbench', () => {
    const result = closeTabsBy(four, stocks.path, 'others', stocks.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, stocks])
    expect(result.nextActive).toBeNull()
  })

  it('closes only the workbench left when closing all', () => {
    const result = closeTabsBy(four, stocks.path, 'all', stocks.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB])
    // 当前页被关掉：落到工作台
    expect(result.nextActive).toBe(WORKBENCH_PATH)
  })

  it('keeps the workbench as the anchor and closes the other tabs', () => {
    const result = closeTabsBy(four, WORKBENCH_PATH, 'others', units.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB])
    expect(result.nextActive).toBe(WORKBENCH_PATH)
  })

  it('activates the nearest surviving tab on the left of a closed current page', () => {
    // 当前页在工作台右侧、锚点更左：关掉锚点右侧后只剩工作台
    const result = closeTabsBy([WORKBENCH_TAB, units], units.path, 'all', units.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB])
    expect(result.nextActive).toBe(WORKBENCH_PATH)

    // 当前页左侧还有幸存标签时选最近的那个，而不是直接回工作台
    const anchor = tab('/inventory/movements', '库存流水')
    const result2 = closeTabsBy(
      [WORKBENCH_TAB, anchor, stocks, warehouses],
      anchor.path,
      'right',
      warehouses.path,
    )
    expect(result2.tabs).toEqual([WORKBENCH_TAB, anchor])
    expect(result2.nextActive).toBe(anchor.path)
  })

  it('does not touch the current page when it survives', () => {
    const result = closeTabsBy(four, units.path, 'right', WORKBENCH_PATH)
    expect(result.nextActive).toBeNull()
  })

  it('returns the same array when there is nothing to close', () => {
    const onlyWorkbench = [WORKBENCH_TAB]
    expect(closeTabsBy(onlyWorkbench, WORKBENCH_PATH, 'all', WORKBENCH_PATH)).toEqual({
      tabs: onlyWorkbench,
      nextActive: null,
    })
    expect(closeTabsBy(onlyWorkbench, WORKBENCH_PATH, 'left', WORKBENCH_PATH).tabs).toBe(
      onlyWorkbench,
    )

    // 锚点是末尾标签：右侧无可关闭项
    const current = [WORKBENCH_TAB, units]
    expect(closeTabsBy(current, units.path, 'right', units.path)).toEqual({
      tabs: current,
      nextActive: null,
    })
  })

  it('ignores an unknown anchor', () => {
    const current = [WORKBENCH_TAB, units]
    expect(closeTabsBy(current, '/nope', 'all', units.path)).toEqual({
      tabs: current,
      nextActive: null,
    })
  })
})
