import { describe, expect, it } from 'vitest'

import {
  closeTab,
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
