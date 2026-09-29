export class ApiError extends Error {
  readonly status: number
  readonly code?: number
  readonly traceId?: string

  constructor(message: string, options: { status: number; code?: number; traceId?: string }) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    if (options.code !== undefined) this.code = options.code
    if (options.traceId !== undefined) this.traceId = options.traceId
  }
}

/** 错误的结构化明细，供页面统一渲染（错误文案 + 追踪 ID） */
export interface ErrorDetail {
  message: string
  /** 后端响应封装中的 trace_id，排障用 */
  traceId?: string
  status?: number
  code?: number
}

export function getErrorDetail(error: unknown): ErrorDetail {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      status: error.status,
      ...(error.code === undefined ? {} : { code: error.code }),
      ...(error.traceId === undefined ? {} : { traceId: error.traceId }),
    }
  }

  if (error instanceof Error) return { message: error.message }

  return { message: '请求失败，请稍后重试' }
}

export function getErrorMessage(error: unknown): string {
  return getErrorDetail(error).message
}

/** 后端 `pkg/response.CodeConflict` */
const CODE_CONFLICT = 1009

/**
 * 409 冲突的中文映射。
 *
 * 后端把领域错误直接透传为 `message`（英文原文，如 `unit code already exists`），
 * 而 P2 不允许改动后端，因此只能按「状态码 / 业务码 + 关键词」在前端做映射。
 * 未命中的情况回退到原文，不会吞掉信息。
 */
const CONFLICT_MESSAGES: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /code already exists/i, message: '编码已存在，请更换后重试' },
  { pattern: /referenced by inventory/i, message: '已被库存引用，无法删除' },
  { pattern: /cannot be deleted/i, message: '该记录已被引用，无法删除' },
]

export function getConflictMessage(error: unknown): string {
  const detail = getErrorDetail(error)
  const isConflict = detail.status === 409 || detail.code === CODE_CONFLICT
  if (!isConflict) return detail.message

  for (const { pattern, message } of CONFLICT_MESSAGES) {
    if (pattern.test(detail.message)) return message
  }

  return detail.message
}
