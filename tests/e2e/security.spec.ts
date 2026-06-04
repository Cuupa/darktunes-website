import { test, expect } from '@playwright/test'

test.describe('Security validation', () => {
  test('admin routes reject unauthenticated users (redirect/401)', async ({ page }) => {
    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    const redirected = page.url().includes('/admin/login')
    const denied = response?.status() === 401

    expect(redirected || denied).toBe(true)
  })

  test('portal routes redirect unauthenticated users to /portal/login', async ({ page }) => {
    await page.goto('/portal', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/portal\/login/)
  })

  test('admin API endpoints reject requests without Authorization header', async ({ request }) => {
    const response = await request.get('/api/admin/users')
    expect(response.status()).toBe(401)
  })

  test('upload endpoint rejects unauthenticated/non-admin requests', async ({ request }) => {
    const response = await request.post('/api/upload')
    expect(response.status()).toBe(401)
  })

  test('service role key is never exposed in rendered HTML', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const html = await page.content()

    expect(html).not.toContain('SUPABASE_SERVICE_ROLE_KEY')

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey) {
      expect(html).not.toContain(serviceKey)
    }
  })

  test('protected API routes validate JWT tokens', async ({ request }) => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      test.skip(true, 'SUPABASE_SERVICE_ROLE_KEY not configured in test environment')
      return
    }

    const response = await request.post('/api/upload', {
      headers: {
        authorization: ['Bearer', 'invalid.jwt.token'].join(' '),
      },
    })

    expect([401, 403]).toContain(response.status())
  })
})
