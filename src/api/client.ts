import { ApiError } from './error'

import type { ApiEnvelope } from '@/types/api'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  query?: Record<string, QueryValue>
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') searchParams.set(key, String(value))
  }

  const search = searchParams.toString()
  return `${API_BASE_URL}${normalizedPath}${search ? `?${search}` : ''}`
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('application/json') ?? false
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, query, ...requestInit } = options
  const response = await fetch(buildUrl(path, query), {
    ...requestInit,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  if (response.status === 204) return undefined as T

  const payload = isJsonResponse(response)
    ? ((await response.json()) as Partial<ApiEnvelope<T>>)
    : undefined

  if (!response.ok || (payload?.code !== undefined && payload.code !== 200)) {
    throw new ApiError(payload?.message || `请求失败 (${response.status})`, {
      status: response.status,
      ...(payload?.code === undefined ? {} : { code: payload.code }),
      ...(payload?.trace_id ? { traceId: payload.trace_id } : {}),
    })
  }

  return payload?.data as T
}

export const api = {
  get<T>(path: string, query?: Record<string, QueryValue>) {
    return apiRequest<T>(path, { method: 'GET', ...(query ? { query } : {}) })
  },
  post<T>(path: string, body?: unknown) {
    return apiRequest<T>(path, { method: 'POST', body })
  },
  put<T>(path: string, body?: unknown) {
    return apiRequest<T>(path, { method: 'PUT', body })
  },
  delete<T>(path: string) {
    return apiRequest<T>(path, { method: 'DELETE' })
  },
}
