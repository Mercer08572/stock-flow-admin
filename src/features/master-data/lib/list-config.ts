/**
 * 主数据列表的共享契约与列。
 *
 * 每个资源目录（materials / skus / categories / units / warehouses）各自维护
 * 一份 `*-fields.ts` 的 `ResourceConfig`，这里只放**跨资源不变量**：
 * 配置的形状、状态列、更新时间列。
 *
 * 页面之间不再通过路由参数与 `configs` 表互相切换，因此这里的类型只描述
 * 「一个资源列表需要哪些东西」，不承担选择逻辑。
 */

import { h } from 'vue'

import StatusTag from '@/components/common/StatusTag.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import { statusFilterOptions } from '@/features/master-data/lib/reference-labels'

import type { FieldConfig } from '@/features/master-data/lib/entity-form'
import type { BaseEntity, ListResult } from '@/types/api'

export type {
  FieldConfig,
  FieldOption,
  FieldType,
  FormValues,
} from '@/features/master-data/lib/entity-form'

/**
 * 一个资源列表页需要的全部差异。
 *
 * 状态列与更新时间列由 `statusColumn` / `timeColumn` 提供（其行类型为 `BaseEntity`，
 * 与本接口的行类型无关）；`create` / `update` 的入参声明为 `Record<string, unknown>`，
 * 因为表单载荷由 `buildPayload` 动态构造，而具体 API 只接受各自的 `Create*Input`。
 * 请求体形态由 `*-fields.ts` 里声明的 `fields` 保证。
 */
export interface ResourceConfig<T extends BaseEntity> {
  /** 资源名，用于页头、抽屉标题与提示文案（如「物料」「SKU」） */
  title: string
  /** 列表加载；`limit` 一律取后端 `MaxListLimit`（100） */
  load: () => Promise<ListResult<T>>
  /**
   * 列表列。
   *
   * 需要在单元格里渲染「引用实体编码 - 名称」的资源（物料 / SKU）不在这里提供，
   * 因为标签依赖页面加载到的选项；这类资源把列作为 `columns` prop 传给 `EntityListPage`。
   */
  columns?: readonly DataTableColumn<T>[] | undefined
  fields: readonly FieldConfig[]
  create: (body: Record<string, unknown>) => Promise<T>
  get: (id: number) => Promise<T>
  update: (id: number, body: Record<string, unknown>) => Promise<T>
  remove: (id: number) => Promise<unknown>
  /** 仅仓库提供：停用（软删除之外的独立动作） */
  disable?: ((id: number) => Promise<unknown>) | undefined
  /**
   * 提供后该资源有详情页：操作列渲染「详情」按钮、表格行可点击。
   * 返回路由路径（如 `/master-data/materials/12`），列表页据此 push。
   */
  detailRoute?: ((row: T) => string) | undefined
}

/** `status` 列的筛选与渲染在 5 个资源里完全一致 */
export const statusColumn: DataTableColumn<BaseEntity> = {
  key: 'status',
  title: '状态',
  width: 100,
  filterOptions: statusFilterOptions,
  render: (row) => h(StatusTag, { status: String(row.status ?? '') }),
}

/** `updated_at` 列的格式化在 5 个资源里完全一致 */
export const timeColumn: DataTableColumn<BaseEntity> = {
  key: 'updated_at',
  title: '更新时间',
  width: 170,
  render: (row) => formatDateTime(row.updated_at),
}
