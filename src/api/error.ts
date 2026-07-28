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

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message
  return '请求失败，请稍后重试'
}
