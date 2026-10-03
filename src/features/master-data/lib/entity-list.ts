/**
 * 主数据列表页的共享状态机：加载 / 错误、删除确认、停用确认、抽屉开关。
 *
 * 5 个资源页各自保留自己的 `*ListView.vue`（模板与列）与 `*.ts`（字段 / 接口绑定），
 * 但下面这套流程完全一致，且含三条不变量：
 * - 删除必须先二次确认（只给 ID 不足以避免误删）；
 * - 同一时刻只允许一个写请求；
 * - `PUT` 的全量替换载荷只由 `EntityFormDrawer` 构造。
 * 复制 5 份必然漂移，因此集中在这里。
 */

import { ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'

import { getErrorDetail, getErrorMessage, type ErrorDetail } from '@/api/error'
import { clearReferenceOptions } from '@/features/master-data/lib/reference-cache'
import { clearUnitCatalog } from '@/features/master-data/lib/unit-catalog'

import type { BaseEntity } from '@/types/api'

export interface UseEntityListOptions<T extends BaseEntity> {
  /** 资源名，用于提示文案（如「物料已删除」） */
  title: string
  load: () => Promise<{ items: T[] }>
  remove: (id: number) => Promise<unknown>
  /** 仅仓库提供；缺省时 `confirmDisable` 不做任何事，页面也不渲染「停用」 */
  disable?: ((id: number) => Promise<unknown>) | undefined
  /** 停用确认框里的补充说明；仅仓库传入 */
  disableHint?: string | undefined
}

/** 主数据列表的共享状态机；返回的 ref 可直接在 `<script setup>` 模板中使用 */
export function useEntityList<T extends BaseEntity>(options: UseEntityListOptions<T>) {
  const rows = ref<T[]>([]) as { value: T[] }
  const loading = ref(false)
  const errorDetail = ref<ErrorDetail | null>(null)
  const busyId = ref<number | null>(null)
  const drawerOpen = ref(false)
  const drawerMode = ref<'create' | 'edit'>('create')
  const editingId = ref<number | null>(null)
  const message = useMessage()
  const dialog = useDialog()

  async function reload() {
    // 列表刷新可能紧跟在一次写操作之后（新建了分类/单位/物料），
    // 因此顺带作废引用选项与单位目录缓存，避免下拉里看不到刚建的主数据。
    clearReferenceOptions()
    clearUnitCatalog()
    loading.value = true
    errorDetail.value = null
    try {
      const result = await options.load()
      rows.value = result.items
    } catch (error) {
      rows.value = []
      errorDetail.value = getErrorDetail(error)
    } finally {
      loading.value = false
    }
  }

  function openCreate() {
    drawerMode.value = 'create'
    editingId.value = null
    drawerOpen.value = true
  }

  function openEdit(row: T) {
    drawerMode.value = 'edit'
    editingId.value = row.id
    drawerOpen.value = true
  }

  async function onSaved() {
    drawerOpen.value = false
    await reload()
  }

  /** 二次确认：只显示 ID 不足以避免误删，必须给出编码与名称 */
  function confirmDelete(row: T) {
    dialog.warning({
      title: `删除${options.title}`,
      content: `确认删除「${rowLabel(row)}」吗？删除后不可恢复。`,
      positiveText: '确认删除',
      negativeText: '取消',
      onPositiveClick: () => deleteRow(row),
    })
  }

  async function deleteRow(row: T) {
    // 同一时刻只允许一个写请求，避免重复提交
    if (busyId.value !== null) return

    busyId.value = row.id
    try {
      await options.remove(row.id)
      message.success(`${options.title}已删除`)
      await reload()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      busyId.value = null
    }
  }

  function confirmDisable(row: T) {
    if (!options.disable) return

    dialog.warning({
      title: `停用${options.title}`,
      content: `确认停用「${rowLabel(row)}」吗？${options.disableHint ?? ''}`,
      positiveText: '确认停用',
      negativeText: '取消',
      onPositiveClick: () => disableRow(row),
    })
  }

  async function disableRow(row: T) {
    if (busyId.value !== null) return

    busyId.value = row.id
    try {
      await options.disable?.(row.id)
      message.success(`${options.title}已停用`)
      await reload()
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      busyId.value = null
    }
  }

  return {
    rows,
    loading,
    errorDetail,
    busyId,
    drawerOpen,
    drawerMode,
    editingId,
    reload,
    openCreate,
    openEdit,
    onSaved,
    confirmDelete,
    confirmDisable,
  }
}

function rowLabel(row: BaseEntity) {
  return `${row.code ?? ''} ${row.name ?? ''}`.trim()
}
