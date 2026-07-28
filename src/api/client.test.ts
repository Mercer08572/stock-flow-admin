import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiRequest } from './client'
import { ApiError } from './error'

describe('apiRequest', () => {
  afterEach(() => vi.restoreAllMocks())

  it('unwraps a successful API envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ code: 200, message: 'success', data: { status: 'ok' }, trace_id: 't1' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    await expect(apiRequest<{ status: string }>('/health')).resolves.toEqual({ status: 'ok' })
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('preserves backend error context', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 1004, message: 'not found', trace_id: 'trace-404' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const error = await apiRequest('/missing').catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 1004, traceId: 'trace-404' })
  })

  it('omits empty query values', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await apiRequest('/items', { query: { limit: 20, status: undefined, search: '' } })

    expect(fetch).toHaveBeenCalledWith('/api/v1/items?limit=20', expect.any(Object))
  })
})
