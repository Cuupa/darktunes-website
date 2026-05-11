import { afterEach, describe, expect, it } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

async function loadHealthRoute() {
  return import('../../../app/api/health/route?t=' + Date.now())
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
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

  it('OPTIONS responds with CORS preflight headers', async () => {
    const { OPTIONS } = await loadHealthRoute()
    const response = await OPTIONS()

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
  })
})
