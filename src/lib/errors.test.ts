import { describe, it, expect, vi } from 'vitest'
import { ApiError, withErrorHandler } from './errors'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

function makeRequest(method = 'GET'): NextRequest {
  return new NextRequest('http://localhost/api/test', { method })
}

describe('ApiError', () => {
  it('sets name, message, and status', () => {
    const err = new ApiError(404, 'Not found')
    expect(err.name).toBe('ApiError')
    expect(err.message).toBe('Not found')
    expect(err.status).toBe(404)
  })

  it('sets optional code', () => {
    const err = new ApiError(400, 'Bad input', 'VALIDATION_ERROR')
    expect(err.code).toBe('VALIDATION_ERROR')
  })
})

describe('withErrorHandler', () => {
  it('passes through a successful response unchanged', async () => {
    const handler = withErrorHandler(async (_req) =>
      NextResponse.json({ ok: true }, { status: 200 }),
    )
    const res = await handler(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('catches ApiError and returns the correct status + message', async () => {
    const handler = withErrorHandler(async () => {
      throw new ApiError(403, 'Forbidden')
    })
    const res = await handler(makeRequest())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
    expect(body.status).toBe(403)
  })

  it('catches ApiError with code and includes it in the response', async () => {
    const handler = withErrorHandler(async () => {
      throw new ApiError(429, 'Rate limit exceeded', 'RATE_LIMITED')
    })
    const res = await handler(makeRequest())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMITED')
  })

  it('catches ZodError and returns 400 with VALIDATION_ERROR code', async () => {
    const handler = withErrorHandler(async () => {
      const schema = z.object({
        email: z.string().email({ message: 'Please enter a valid email address.' }),
      })
      schema.parse({ email: 'not-an-email' })
      return NextResponse.json({ ok: true })
    })
    const res = await handler(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.error).toContain('valid email address')
  })

  it('catches unknown errors and returns 500', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const handler = withErrorHandler(async () => {
      throw new Error('Something exploded')
    })
    const res = await handler(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.status).toBe(500)
    consoleSpy.mockRestore()
  })
})
