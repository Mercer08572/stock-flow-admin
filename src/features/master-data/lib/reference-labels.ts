/**
 * 主数据枚举的共享选项，以及「引用实体 → 可读标签」的取数逻辑。
 *
 * 枚举是静态常量；引用型（分类 / 单位 / 物料）选项走 `reference-cache.ts` 的缓存加载，
 * 这里把它变成组件可用的响应式数据。
 */

import { computed, onMounted, ref, type ComputedRef } from 'vue'

import {
  optionLabel,
  type FieldOption,
  type ReferenceKey,
} from '@/features/master-data/lib/entity-form'
import { loadReferenceOptions } from '@/features/master-data/lib/reference-cache'

/** 启用 / 停用，5 个资源的 `status` 字段共用 */
export const statusOptions: readonly FieldOption[] = [
  { label: '正常', value: 'active' },
  { label: '停用', value: 'inactive' },
]

/** 状态列的筛选选项（`FieldOption` 与 `DataTableFilterOption` 同形，都是 label + value） */
export const statusFilterOptions: readonly FieldOption[] = statusOptions

/** 计量单位类型 */
export const unitTypeOptions: readonly FieldOption[] = [
  { label: '计数', value: 'count' },
  { label: '重量', value: 'weight' },
  { label: '长度', value: 'length' },
  { label: '面积', value: 'area' },
  { label: '体积', value: 'volume' },
  { label: '包装', value: 'package' },
  { label: '时间', value: 'time' },
  { label: '其他', value: 'other' },
]

/** 仓库类型 */
export const warehouseTypeOptions: readonly FieldOption[] = [
  { label: '普通仓', value: 'normal' },
  { label: '虚拟仓', value: 'virtual' },
]

/**
 * 页面/组件级的引用选项：进入页面时并发加载，加载完成后靠 `optionsMap` 触发重渲染。
 *
 * 表格列直接依赖 `label()`，因此选项到位后「编码 - 名称」会自动出现；
 * 取数失败时静默保持 `#<id>` 回退——引用标签取不到不应拖垮整个列表
 * （表单里的选项加载是另一条路径，失败会在抽屉内显示错误与重试）。
 */
export function useReferenceOptions(keys: readonly ReferenceKey[]): {
  optionsMap: ComputedRef<Record<string, FieldOption[]>>
  label: (key: ReferenceKey, id: unknown) => string
} {
  const optionsBySource = ref<Record<string, FieldOption[]>>({})

  onMounted(() => {
    void Promise.all(
      keys.map(async (key) => {
        try {
          return [key, await loadReferenceOptions(key)] as const
        } catch {
          return [key, []] as const
        }
      }),
    ).then((entries) => {
      optionsBySource.value = Object.fromEntries(entries)
    })
  })

  return {
    optionsMap: computed(() => optionsBySource.value),
    label: (key, id) => optionLabel(optionsBySource.value[key], id),
  }
}
