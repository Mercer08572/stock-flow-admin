<script setup lang="ts" generic="T extends string | number">
/* global Event, HTMLElement, clearTimeout, setTimeout */
/**
 * 引用型下拉：面板比输入框宽，选项按「名称 / 编码」两行展示，支持远程搜索与滚动分页。
 *
 * 为什么不用 NSelect 默认行为：面板宽度默认等于输入框（筛选区只有 200px），
 * 而 Naive 又给选项内容写了 `white-space: nowrap; text-overflow: ellipsis`，
 * 于是长编码 + 长名称必然只剩「...」。这里做三件事：
 * 1. `consistent-menu-width=false`：面板按内容自适应，最小宽度仍等于输入框；
 * 2. 面板 `max-width` 封顶（520px 或视口宽度），避免超长内容撑出屏幕；
 * 3. 选项渲染为两行：名称主行（可换行，最多两行）+ 编码次行（次要色）。
 *
 * 传入 `remote` 后切换成远程搜索：
 * - 输入停止 300ms 才发请求（防抖），空白关键字回到页面预取的首屏选项；
 * - 用请求序号丢弃过期响应，避免慢请求覆盖后发的快响应；
 * - 滚到菜单底部时**追加**下一页，已渲染的行与滚动位置保持不变；
 * - 搜索结果里没有当前已选项时，仍用记住的那条渲染选中值，不会退化成数字 ID。
 *
 * 闭合态的触发器受输入框宽度限制，因此额外用原生 `title` 兜底完整文本。
 */
import { NButton, NSelect, type SelectOption } from 'naive-ui'
import { computed, h, nextTick, onBeforeUnmount, ref, shallowRef, watch, type VNode } from 'vue'

import type {
  ReferenceSelectOption,
  ReferenceSelectPage,
  ReferenceSelectQuery,
} from './reference-select'

/** 远程搜索的防抖间隔：太短会打满接口，太长会让输入有滞后感 */
const SEARCH_DEBOUNCE_MS = 300
/** 每页条数：搜索首页与「加载更多」共用 */
const PAGE_SIZE = 50
/** 累计上限：面板没有虚拟滚动，避免一直追加把 DOM 撑爆 */
const MAX_LOADED = 300
/** 距底部多少像素开始加载下一页 */
const LOAD_MORE_THRESHOLD = 48

const props = withDefaults(
  defineProps<{
    value?: T | null
    options: ReferenceSelectOption<T>[]
    placeholder?: string
    filterable?: boolean
    clearable?: boolean
    disabled?: boolean
    size?: 'small' | 'medium' | 'large'
    /** 远程搜索/分页：按 { keyword, offset, limit } 取一页；`null` 表示继续用传入的 `options` 本地过滤 */
    remote?: ((query: ReferenceSelectQuery) => Promise<ReferenceSelectPage<T>>) | null
  }>(),
  {
    value: null,
    placeholder: '',
    filterable: true,
    clearable: true,
    disabled: false,
    size: 'medium',
    remote: null,
  },
)

const emit = defineEmits<{ 'update:value': [value: T | null] }>()

const isRemote = computed(() => props.remote !== null)

/**
 * 面板宽度随内容增长，但不超过 520px 或视口宽度。
 *
 * `minWidth` 由 Naive 自己按触发器宽度设置（`consistentMenuWidth=false` 时），
 * 这里只负责封顶；`class` 用于 `src/styles/main.css` 里的两行排版覆盖。
 */
const menuProps = {
  class: 'ref-select-menu',
  style: { maxWidth: 'min(520px, calc(100vw - 24px))' },
}

/**
 * 远程结果；`null` 表示当前用页面传入的首屏选项。
 *
 * 滚动加载时**追加**到这个数组，而不是先清空再替换：
 * 已渲染的选项对象保持不变，Naive 按 value 复用行节点，滚动位置不会跳。
 */
const remoteOptions = shallowRef<ReferenceSelectOption<T>[] | null>(null)
const remoteTotal = ref<number | null>(null)
/** 当前结果集对应的关键字；空串表示「浏览模式」 */
const sessionKeyword = ref('')
const exhausted = ref(false)
const remoteLoading = ref(false)
const remoteError = ref('')
const loadingMore = ref(false)
const loadMoreError = ref('')
/**
 * Naive 在选项变化时会重新定位到 pending / 已选项（`resetMenuOnOptionsChange`），
 * 追加下一页时这会把滚动位置拉回顶部。追加期间临时关掉，位置才能保持不变。
 */
const resetMenuOnOptionsChange = ref(true)

/** 上次出现在选项里的已选项：搜索结果不含它时用它渲染选中值 */
const remembered = shallowRef<ReferenceSelectOption<T> | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
/** 请求序号：只有最后一次请求（首页或加载更多）的结果会被采纳 */
let requestSeq = 0

function findByValue(
  pool: readonly ReferenceSelectOption<T>[],
  value: T | null | undefined,
): ReferenceSelectOption<T> | null {
  if (value === null || value === undefined) return null
  return pool.find((option) => option.value === value) ?? null
}

/** 当前实际的数据列表（不含为显示补进来的已选项） */
const baseOptions = computed(() => remoteOptions.value ?? props.options)

const selectedOption = computed<ReferenceSelectOption<T> | null>(() => {
  const found =
    findByValue(baseOptions.value, props.value) ?? findByValue(props.options, props.value)
  if (found) return found

  const fallback = remembered.value
  return fallback && fallback.value === props.value ? fallback : null
})

const selectedLabel = computed(() => selectedOption.value?.label ?? '')

watch(
  () => [props.value, props.options, remoteOptions.value] as const,
  () => {
    const hit = findByValue(baseOptions.value, props.value)
    if (hit) remembered.value = hit
  },
  { immediate: true },
)

/** 搜索结果会整体替换选项，必须把已选项补回去，否则触发器的值会显示成数字 */
const displayOptions = computed<ReferenceSelectOption<T>[]>(() => {
  const base = baseOptions.value
  const selected = selectedOption.value
  if (!selected || base.some((option) => option.value === selected.value)) return base
  return [selected, ...base]
})

const hasMore = computed(() => {
  if (!isRemote.value || exhausted.value) return false
  if (baseOptions.value.length >= MAX_LOADED) return false
  // total 未知时允许探一次：返回空页即标记为已到底
  if (remoteTotal.value === null) return true
  return baseOptions.value.length < remoteTotal.value
})

const emptyText = computed(() => {
  if (remoteLoading.value) return '搜索中…'
  if (remoteError.value) return '搜索失败，请重新输入'
  // 还没输入过关键字：提示可以搜索，而不是让用户以为数据为空
  if (remoteOptions.value === null) return '输入编码或名称搜索'
  return '无匹配结果'
})

const footerText = computed(() => {
  if (loadingMore.value) return '加载中…'
  if (loadMoreError.value) return loadMoreError.value
  if (isRemote.value && baseOptions.value.length >= MAX_LOADED) {
    return `已加载 ${MAX_LOADED} 条，请继续输入关键字`
  }
  return ''
})

function cancelDebounce(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

/** 结束本次搜索会话：回到页面预取的首屏选项；在途请求全部作废 */
function resetRemoteSession(): void {
  cancelDebounce()
  requestSeq += 1
  remoteOptions.value = null
  remoteTotal.value = null
  sessionKeyword.value = ''
  exhausted.value = false
  remoteLoading.value = false
  loadingMore.value = false
  loadMoreError.value = ''
  remoteError.value = ''
}

function handleSearch(rawKeyword: string): void {
  if (!props.remote) return

  const keyword = rawKeyword.trim()
  cancelDebounce()

  if (!keyword) {
    resetRemoteSession()
    return
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void runSearch(keyword)
  }, SEARCH_DEBOUNCE_MS)
}

/**
 * 每次重新打开菜单都结束上一次的搜索会话。
 *
 * Naive 关闭菜单时只会清空输入框、不会再触发一次 `search`；若不在重新打开时复位，
 * 用户会看到「空输入 + 上一次的过滤结果」，无法判断选项为什么变少。
 *
 * 复位放在「打开」而不是「关闭」：关闭事件与选中事件在同一个事件循环里，
 * 若关闭时就清空结果，选中项会来不及被记住，触发器会退化成数字 ID。
 */
function handleShowChange(show: boolean): void {
  if (!show) return
  resetRemoteSession()
}

async function runSearch(keyword: string): Promise<void> {
  const search = props.remote
  if (!search) return

  const seq = ++requestSeq
  remoteLoading.value = true
  remoteError.value = ''
  loadMoreError.value = ''

  try {
    const page = await search({ keyword, offset: 0, limit: PAGE_SIZE })
    if (seq !== requestSeq) return
    sessionKeyword.value = keyword
    remoteOptions.value = page.options
    remoteTotal.value = page.total
    exhausted.value = page.options.length >= page.total || page.options.length === 0
  } catch {
    if (seq !== requestSeq) return
    remoteOptions.value = []
    remoteTotal.value = 0
    exhausted.value = true
    remoteError.value = '搜索失败'
  } finally {
    if (seq === requestSeq) remoteLoading.value = false
  }
}

/** 按 value 去重后追加；服务端分页期间若有新数据插入，offset 可能重复返回同一条 */
function appendOptions(
  base: readonly ReferenceSelectOption<T>[],
  next: readonly ReferenceSelectOption<T>[],
): ReferenceSelectOption<T>[] {
  const seen = new Set(base.map((option) => option.value))
  const merged = [...base]

  for (const option of next) {
    if (seen.has(option.value)) continue
    seen.add(option.value)
    merged.push(option)
  }

  return merged
}

/**
 * 加载下一页并追加到列表尾部。
 *
 * 关键：**不碰** `remoteLoading`、不清空 `remoteOptions`。
 * 加载状态只体现在菜单底部的 footer 上，因此已渲染的行、滚动位置都不会变化。
 */
async function loadMore(): Promise<void> {
  const search = props.remote
  if (!search || !hasMore.value) return
  if (loadingMore.value || remoteLoading.value) return

  const base = baseOptions.value
  const seq = ++requestSeq
  loadingMore.value = true
  loadMoreError.value = ''

  try {
    const page = await search({
      keyword: sessionKeyword.value,
      offset: base.length,
      limit: PAGE_SIZE,
    })
    if (seq !== requestSeq) return

    remoteTotal.value = page.total
    if (page.options.length === 0) {
      exhausted.value = true
      return
    }

    const merged = appendOptions(base, page.options)

    // 追加期间关闭「选项变化后重新定位」，避免滚动位置被拉回顶部；下一拍恢复
    resetMenuOnOptionsChange.value = false
    remoteOptions.value = merged
    void nextTick(() => {
      resetMenuOnOptionsChange.value = true
    })

    if (merged.length >= page.total) exhausted.value = true
  } catch {
    if (seq !== requestSeq) return
    // 失败不动已有列表，只让 footer 提示重试
    loadMoreError.value = '加载失败，请重试'
  } finally {
    if (seq === requestSeq) loadingMore.value = false
  }
}

/** 菜单滚动：距底部不足阈值时加载下一页 */
function handleScroll(event: Event): void {
  if (!isRemote.value) return

  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (target.scrollTop + target.clientHeight < target.scrollHeight - LOAD_MORE_THRESHOLD) return

  void loadMore()
}

onBeforeUnmount(() => {
  cancelDebounce()
  // 卸载后到达的响应不应再写状态
  requestSeq += 1
})

/**
 * 两行渲染。
 *
 * 没有直接返回自定义节点：那会丢掉 Naive 选项上的内边距、选中态与对勾；
 * 这里只把 `.n-base-select-option__content` 的文本子节点换成两行结构，
 * 其余结构与事件原样保留。结构不符合预期时退回默认渲染
 * （`main.css` 里的换行规则仍能让长文本完整显示）。
 */
function renderOption({ node, option }: { node: VNode; option: SelectOption }): VNode {
  const item = option as ReferenceSelectOption<T>
  if (!item.code || !item.name) return node

  const children = node.children
  if (!Array.isArray(children)) return node

  const content = children[0] as VNode | undefined
  if (!content || !Array.isArray(content.children)) return node

  content.children = [
    h('span', { class: 'ref-select-option' }, [
      h('span', { class: 'ref-select-option__name' }, item.name),
      h('span', { class: 'ref-select-option__code' }, item.code),
    ]),
    // 保留对勾等原有子节点
    ...content.children.slice(1),
  ]
  return node
}

function handleUpdate(value: string | number | null): void {
  // 选中当下就记住完整选项：同一个事件循环里菜单会关闭并清空搜索结果，
  // 若等 watch 统一执行，可能已经找不到这条记录了。
  const hit =
    findByValue(baseOptions.value, value as T | null) ??
    findByValue(props.options, value as T | null)
  if (hit) remembered.value = hit

  emit('update:value', value as T | null)
}
</script>

<template>
  <div class="reference-select" :title="selectedLabel || undefined">
    <NSelect
      :value="value"
      :options="displayOptions"
      :placeholder="placeholder"
      :filterable="filterable"
      :clearable="clearable"
      :disabled="disabled"
      :size="size"
      :remote="isRemote"
      :loading="remoteLoading"
      :consistent-menu-width="false"
      :reset-menu-on-options-change="resetMenuOnOptionsChange"
      :menu-props="menuProps"
      :render-option="renderOption"
      @search="handleSearch"
      @scroll="handleScroll"
      @update:show="handleShowChange"
      @update:value="handleUpdate"
    >
      <template v-if="isRemote" #empty>
        <div class="reference-select__empty">{{ emptyText }}</div>
      </template>
      <template v-if="footerText" #action>
        <div class="reference-select__action">
          <span>{{ footerText }}</span>
          <NButton v-if="loadMoreError" text size="tiny" @click="loadMore">重试</NButton>
        </div>
      </template>
    </NSelect>
  </div>
</template>

<style scoped>
.reference-select {
  display: block;
  max-width: 100%;
}

/* 宽度交给外层（如 `.filters__select`），触发器始终填满它 */
.reference-select :deep(.n-select) {
  width: 100%;
}

.reference-select__empty {
  padding: 10px 12px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.reference-select__action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
}
</style>
