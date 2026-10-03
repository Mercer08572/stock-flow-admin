/**
 * 仓库的列表列与表单字段。
 *
 * 与 `warehousesApi` 的绑定只出现在这里。仓库是唯一带「停用」动作的资源，
 * 因此 `disable` 只在本配置中出现，其余资源的操作列不会渲染该按钮。
 */

import { warehousesApi } from '@/api/warehouses'
import {
  statusColumn,
  timeColumn,
  type ResourceConfig,
} from '@/features/master-data/lib/list-config'
import { statusOptions, warehouseTypeOptions } from '@/features/master-data/lib/reference-labels'

import type { DataTableColumn } from '@/components/common/data-table'
import type { Warehouse } from '@/types/api'

const commonFields = [
  { key: 'code', label: '编码', type: 'text', required: true, placeholder: '请输入编码' },
  { key: 'name', label: '名称', type: 'text', required: true, placeholder: '请输入名称' },
  { key: 'status', label: '状态', type: 'select', required: true, options: statusOptions },
] as const

const columns: readonly DataTableColumn<Warehouse>[] = [
  { key: 'code', title: '编码', width: 140 },
  { key: 'name', title: '名称', width: 180 },
  {
    key: 'type',
    title: '类型',
    width: 110,
    filterOptions: warehouseTypeOptions,
    render: (row) => (row.type === 'normal' ? '普通仓' : row.type === 'virtual' ? '虚拟仓' : '-'),
  },
  { key: 'location', title: '位置', width: 160 },
  statusColumn,
  timeColumn,
]

/** 停用确认框里的补充说明（与软删除不同，停用不做引用检查） */
export const warehouseDisableHint = '停用后该仓库不再用于新的库存操作。'

export const warehouseConfig: ResourceConfig<Warehouse> = {
  title: '仓库',
  load: () => warehousesApi.list({ limit: 100, offset: 0 }),
  columns,
  fields: [
    ...commonFields,
    { key: 'type', label: '类型', type: 'select', required: true, options: warehouseTypeOptions },
    { key: 'location', label: '位置', type: 'text', placeholder: '可选' },
    { key: 'contact_name', label: '联系人', type: 'text', placeholder: '可选' },
    { key: 'contact_phone', label: '联系电话', type: 'text', placeholder: '可选' },
    { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
  ],
  create: warehousesApi.create,
  get: warehousesApi.get,
  update: warehousesApi.update,
  remove: warehousesApi.remove,
  disable: warehousesApi.disable,
  // 仓库详情页尚未实现：不提供 detailRoute，列表因此不渲染「详情」按钮、行也不可点击
  detailRoute: undefined,
}
