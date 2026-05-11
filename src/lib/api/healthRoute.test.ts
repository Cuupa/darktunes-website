import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

function mockSupabaseClientOnline(): void {
  vi.doMock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
      from: vi.fn(() => {
        let selectedFields = ''

        const builder = {
          select: vi.fn((fields: string) => {
            selectedFields = fields
            return builder
          }),
          eq: vi.fn(() => builder),
          order: vi.fn(() => builder),
          limit: vi.fn(() => builder),
          then: vi.fn((onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve(
              selectedFields === 'id'
                ? { error: null }
                : {
                    data: [{ created_at: '2026-01-01T00:00:00.000Z', status: 'success', rate_limited: false }],
                  },
            ).then(onFulfilled, onRejected),
          ),
          catch: vi.fn((onRejected?: (reason: unknown) => unknown) => Promise.resolve().catch(onRejected)),
          finally: vi.fn((onFinally?: (() => void) | undefined) => Promise.resolve().finally(onFinally)),
        }

        return builder
      }),
    })),
  }))
}

async function loadHealthRoute() {
  vi.resetModules()
  return import('../../../app/api/health/route')
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe('app/api/health/route', () => {
  it('HEAD returns the same status code as GET', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const { GET, HEAD } = await loadHealthRoute()
    const getResponse = await GET()
    const headResponse = await HEAD()

    expect(headResponse.status).toBe(getResponse.status)
    expect(await headResponse.text()).toBe('')
  })

  it('HEAD returns 200 when GET is healthy', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    mockSupabaseClientOnline()

    const { GET, HEAD } = await loadHealthRoute()
    const getResponse = await GET()
    const headResponse = await HEAD()

    expect(getResponse.status).toBe(200)
    expect(headResponse.status).toBe(200)
  })

  it('OPTIONS responds with CORS preflight headers', async () => {
    const { OPTIONS } = await loadHealthRoute()
    const response = await OPTIONS()

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
  })
})
