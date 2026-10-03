import { api } from './client'

import type {
  CreateMaterialUnitConversionInput,
  ListResult,
  MaterialUnitConversion,
  UpdateMaterialUnitConversionInput,
} from '@/types/api'

/**
 * 物料级单位换算。
 *
 * 服务端会校验三条规则并把错误码返回给前端展示：
 * 两个单位类型必须可公度、至少一端是物料基础单位、单位对不可重复。
 * 这里只负责传输，方向与系数不做任何加工（`factor` 是十进制字符串）。
 */
export const conversionsApi = {
  list: (
    materialId: number,
    query: { from_unit_id?: number; to_unit_id?: number; limit?: number; offset?: number } = {},
  ) =>
    api.get<ListResult<MaterialUnitConversion>>(`/materials/${materialId}/unit-conversions`, query),
  get: (materialId: number, conversionId: number) =>
    api.get<MaterialUnitConversion>(`/materials/${materialId}/unit-conversions/${conversionId}`),
  create: (materialId: number, body: CreateMaterialUnitConversionInput) =>
    api.post<MaterialUnitConversion>(`/materials/${materialId}/unit-conversions`, body),
  update: (materialId: number, conversionId: number, body: UpdateMaterialUnitConversionInput) =>
    api.put<MaterialUnitConversion>(
      `/materials/${materialId}/unit-conversions/${conversionId}`,
      body,
    ),
  remove: (materialId: number, conversionId: number) =>
    api.delete<void>(`/materials/${materialId}/unit-conversions/${conversionId}`),
}
