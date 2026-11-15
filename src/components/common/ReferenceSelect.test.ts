import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ReferenceSelect from './ReferenceSelect.vue'
import type { ReferenceSelectPage, ReferenceSelectOption } from './reference-select'

const longName = '特级初榨橄榄油 500ml 玻璃瓶装 冷压初榨 单支礼盒'
const warehouseOptions: ReferenceSelectOption<number>[] = [
  { label: `SKU-0001 - ${longName}`, value: 1, code: 'SKU-0001', name: longName },
  { label: 'WH-01 - 主仓', value: 2, code: 'WH-01', name: '主仓' },
]
const skuOptions: ReferenceSelectOption<number>[] = [
  { label: 'SKU-01 - 标准箱', value: 7, code: 'SKU-01', name: '标准箱' },
]
const extraOption: ReferenceSelectOption<number> = {
  label: 'SKU-02 - 礼盒装',
  value: 8,
  code: 'SKU-02',
  name: '礼盒装',
}

function page(
  options: ReferenceSelectOption<number>[],
  total: number,
): ReferenceSelectPage<number> {
  return { options, total }
}

/**
 * jsdom 没有实现 `Element.scrollTo`，而 Naive 的滚动条在菜单打开、
 * 自动定位到已选项时会调用它；只在本测试文件里补一个空实现。
 */
Element.prototype.scrollTo = () => {}

const wrappers: VueWrapper[] = []

function mountSelect(props: Record<string, unknown>) {
  const wrapper = mount(ReferenceSelect, { props, attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}

async function openMenu(wrapper: VueWrapper) {
  await wrapper.find('.n-base-selection').trigger('click')
  await wrapper.vm.$nextTick()
}

async function typeKeyword(wrapper: VueWrapper, keyword: string) {
  await wrapper.find('input').setValue(keyword)
}

function currentMenu(): HTMLElement {
  const menus = document.querySelectorAll<HTMLElement>('.ref-select-menu')
  const menu = menus[menus.length - 1]
  if (!menu) throw new Error('menu is not open')
  return menu
}

function optionNames(): Array<string | null> {
  return [...currentMenu().querySelectorAll('.ref-select-option__name')].map(
    (element) => element.textContent,
  )
}

/** jsdom 不计算布局，滚动几何需要手工注入 */
function scrollMenuToBottom() {
  const container = currentMenu().querySelector<HTMLElement>('.n-scrollbar-container')
  if (!container) throw new Error('scroll container not found')

  Object.defineProperty(container, 'scrollTop', { value: 900, configurable: true })
  Object.defineProperty(container, 'clientHeight', { value: 250, configurable: true })
  Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true })
  container.dispatchEvent(new Event('scroll'))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('ReferenceSelect', () => {
  it('puts the full selected label in the trigger title', () => {
    const wrapper = mountSelect({ value: 1, options: warehouseOptions })

    expect(wrapper.attributes('title')).toBe(`SKU-0001 - ${longName}`)
  })

  it('has no tooltip text when nothing is selected', () => {
    const wrapper = mountSelect({ value: null, options: warehouseOptions })

    expect(wrapper.attributes('title')).toBeUndefined()
  })

  it('renders the option name and code on separate lines', async () => {
    const wrapper = mountSelect({ value: null, options: warehouseOptions })

    await openMenu(wrapper)

    const name = currentMenu().querySelector('.ref-select-option__name')
    const code = currentMenu().querySelector('.ref-select-option__code')

    expect(name?.textContent).toBe(longName)
    expect(code?.textContent).toBe('SKU-0001')
  })
})

describe('ReferenceSelect remote search', () => {
  it('waits for the debounce before asking the server', async () => {
    const remote = vi.fn().mockResolvedValue(page(skuOptions, 1))
    const wrapper = mountSelect({ value: null, options: [], remote })

    await openMenu(wrapper)
    await typeKeyword(wrapper, '标准')

    expect(remote).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)

    expect(remote).toHaveBeenCalledTimes(1)
    expect(remote).toHaveBeenCalledWith({ keyword: '标准', offset: 0, limit: 50 })
    expect(optionNames()).toContain('标准箱')
  })

  it('falls back to the prefetched options when the keyword is cleared', async () => {
    const remote = vi.fn().mockResolvedValue(page(skuOptions, 1))
    const wrapper = mountSelect({ value: null, options: warehouseOptions, remote })

    await openMenu(wrapper)
    await typeKeyword(wrapper, '标准')
    await vi.advanceTimersByTimeAsync(300)
    expect(optionNames()).toContain('标准箱')

    await typeKeyword(wrapper, '')
    await vi.advanceTimersByTimeAsync(300)

    expect(remote).toHaveBeenCalledTimes(1)
    expect(optionNames()).toContain('主仓')
    expect(optionNames()).not.toContain('标准箱')
  })

  it('ignores a stale response that resolves after a newer one', async () => {
    const first = deferred<ReferenceSelectPage<number>>()
    const second = deferred<ReferenceSelectPage<number>>()
    const remote = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const wrapper = mountSelect({ value: null, options: [], remote })

    await openMenu(wrapper)
    await typeKeyword(wrapper, 'a')
    await vi.advanceTimersByTimeAsync(300)

    await typeKeyword(wrapper, 'ab')
    await vi.advanceTimersByTimeAsync(300)
    expect(remote).toHaveBeenCalledTimes(2)

    second.resolve(page(skuOptions, 1))
    await vi.advanceTimersByTimeAsync(0)
    first.resolve(
      page([{ label: 'SKU-99 - 旧结果', value: 99, code: 'SKU-99', name: '旧结果' }], 1),
    )
    await vi.advanceTimersByTimeAsync(0)

    expect(optionNames()).toContain('标准箱')
    expect(optionNames()).not.toContain('旧结果')
  })

  it('shows a retry hint when the search fails', async () => {
    const remote = vi.fn().mockRejectedValue(new Error('network'))
    const wrapper = mountSelect({ value: null, options: [], remote })

    await openMenu(wrapper)
    await typeKeyword(wrapper, '标准')
    await vi.advanceTimersByTimeAsync(300)

    const empty = currentMenu().querySelector('.reference-select__empty')
    expect(empty?.textContent).toBe('搜索失败，请重新输入')
  })

  it('hints that the list can be searched before any keyword', async () => {
    const remote = vi.fn().mockResolvedValue(page(skuOptions, 1))
    const wrapper = mountSelect({ value: null, options: [], remote })

    await openMenu(wrapper)

    const empty = currentMenu().querySelector('.reference-select__empty')
    expect(empty?.textContent).toBe('输入编码或名称搜索')
  })

  it('resets the search session when the menu is reopened', async () => {
    const remote = vi.fn().mockResolvedValue(page(skuOptions, 1))
    const wrapper = mountSelect({ value: null, options: warehouseOptions, remote })

    await openMenu(wrapper)
    await typeKeyword(wrapper, '标准')
    await vi.advanceTimersByTimeAsync(300)
    expect(optionNames()).toContain('标准箱')

    await wrapper.find('input').trigger('keydown', { key: 'Escape' })
    await wrapper.vm.$nextTick()

    await openMenu(wrapper)
    expect(optionNames()).toContain('主仓')
    expect(optionNames()).not.toContain('标准箱')
  })

  it('keeps the selected option visible when search results do not contain it', async () => {
    const remote = vi.fn().mockResolvedValue(page(skuOptions, 1))
    const wrapper = mountSelect({ value: 2, options: warehouseOptions, remote })

    await openMenu(wrapper)
    await typeKeyword(wrapper, '标准')
    await vi.advanceTimersByTimeAsync(300)

    expect(optionNames()).toEqual(['主仓', '标准箱'])
    expect(wrapper.attributes('title')).toBe('WH-01 - 主仓')
  })

  it('keeps the picked option after the menu closes', async () => {
    const remote = vi.fn().mockResolvedValue(page(skuOptions, 1))
    const wrapper = mountSelect({ value: null, options: warehouseOptions, remote })

    await openMenu(wrapper)
    await typeKeyword(wrapper, '标准')
    await vi.advanceTimersByTimeAsync(300)

    const picked = [...currentMenu().querySelectorAll('.n-base-select-option')].find((element) =>
      element.textContent?.includes('标准箱'),
    )
    picked?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:value')?.[0]).toEqual([7])

    // 父组件把 v-model 写回；菜单关闭后仍应显示「编码 - 名称」而不是数字 ID
    await wrapper.setProps({ value: 7 })
    expect(wrapper.attributes('title')).toBe('SKU-01 - 标准箱')
  })
})

describe('ReferenceSelect scroll paging', () => {
  it('appends the next page when scrolled to the bottom', async () => {
    const remote = vi.fn().mockResolvedValue(page([extraOption], 3))
    const wrapper = mountSelect({ value: null, options: warehouseOptions, remote })

    await openMenu(wrapper)
    expect(optionNames()).toEqual([longName, '主仓'])

    scrollMenuToBottom()
    await vi.advanceTimersByTimeAsync(0)

    expect(remote).toHaveBeenCalledTimes(1)
    expect(remote).toHaveBeenCalledWith({ keyword: '', offset: 2, limit: 50 })
    expect(optionNames()).toEqual([longName, '主仓', '礼盒装'])
  })

  it('pages the current keyword instead of falling back to browsing', async () => {
    const remote = vi
      .fn()
      .mockResolvedValueOnce(page([skuOptions[0]!], 120))
      .mockResolvedValueOnce(page([extraOption], 120))
    const wrapper = mountSelect({ value: null, options: warehouseOptions, remote })

    await openMenu(wrapper)
    await typeKeyword(wrapper, '标准')
    await vi.advanceTimersByTimeAsync(300)

    scrollMenuToBottom()
    await vi.advanceTimersByTimeAsync(0)

    expect(remote).toHaveBeenLastCalledWith({ keyword: '标准', offset: 1, limit: 50 })
    expect(optionNames()).toEqual(['标准箱', '礼盒装'])
  })

  it('keeps rendered rows while the next page is loading', async () => {
    const next = deferred<ReferenceSelectPage<number>>()
    const remote = vi.fn().mockReturnValue(next.promise)
    const wrapper = mountSelect({ value: null, options: warehouseOptions, remote })

    await openMenu(wrapper)
    scrollMenuToBottom()
    await wrapper.vm.$nextTick()

    // 请求在途：列表不能清空，也不能出现「搜索中…」把面板换成空态
    expect(optionNames()).toEqual([longName, '主仓'])
    expect(currentMenu().querySelector('.reference-select__empty')).toBeNull()
    expect(currentMenu().textContent).toContain('加载中…')

    next.resolve(page([extraOption], 3))
    await vi.advanceTimersByTimeAsync(0)

    expect(optionNames()).toEqual([longName, '主仓', '礼盒装'])
  })

  it('deduplicates options returned twice by a shifted offset', async () => {
    const remote = vi.fn().mockResolvedValue(page([warehouseOptions[1]!, extraOption], 3))
    const wrapper = mountSelect({ value: null, options: warehouseOptions, remote })

    await openMenu(wrapper)
    scrollMenuToBottom()
    await vi.advanceTimersByTimeAsync(0)

    expect(optionNames()).toEqual([longName, '主仓', '礼盒装'])
  })

  it('stops asking the server once total is reached', async () => {
    const remote = vi.fn().mockResolvedValue(page([extraOption], 3))
    const wrapper = mountSelect({ value: null, options: warehouseOptions, remote })

    await openMenu(wrapper)
    scrollMenuToBottom()
    await vi.advanceTimersByTimeAsync(0)
    expect(remote).toHaveBeenCalledTimes(1)

    scrollMenuToBottom()
    await vi.advanceTimersByTimeAsync(0)

    expect(remote).toHaveBeenCalledTimes(1)
  })

  it('keeps the loaded list and offers a retry when loading more fails', async () => {
    const remote = vi.fn().mockRejectedValue(new Error('network'))
    const wrapper = mountSelect({ value: null, options: warehouseOptions, remote })

    await openMenu(wrapper)
    scrollMenuToBottom()
    await vi.advanceTimersByTimeAsync(0)

    expect(optionNames()).toEqual([longName, '主仓'])
    expect(currentMenu().textContent).toContain('加载失败，请重试')

    const retry = currentMenu().querySelector<HTMLButtonElement>('.reference-select__action button')
    retry?.click()
    await vi.advanceTimersByTimeAsync(0)

    expect(remote).toHaveBeenCalledTimes(2)
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
