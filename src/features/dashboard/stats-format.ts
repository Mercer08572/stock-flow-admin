import type { MovementOperationType } from '@/types/api'

/** 库存操作类型的中文名与配色，与后端 operation_type 一一对应 */
export interface OperationMeta {
  label: string
  color: string
}

export const OPERATION_META: Record<MovementOperationType, OperationMeta> = {
  increase: { label: '库存增加', color: '#18a058' },
  decrease_available: { label: '库存减少', color: '#d03050' },
  reserve: { label: '库存占用', color: '#2080f0' },
  decrease_reserved: { label: '占用扣减', color: '#f0a020' },
  release_reserved: { label: '占用释放', color: '#7a8794' },
}

/** 图例顺序：与后端 StatsOperationTypes 保持一致 */
export const OPERATION_ORDER: MovementOperationType[] = [
  'increase',
  'decrease_available',
  'reserve',
  'decrease_reserved',
  'release_reserved',
]
