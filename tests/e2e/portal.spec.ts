import { test, expect } from '@playwright/test'

test.describe('Artist Portal', () => {
  test('unauthenticated users are redirected to /login', async ({ page }) => {
    await page.goto('/portal', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login/)
  })

  test('upload-asset API rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/portal/upload-asset')
    expect(response.status()).toBe(401)
  })

  test('authenticated portal overview renders when credentials are configured', async ({ page }) => {
    const email = process.env.PLAYWRIGHT_PORTAL_EMAIL
    const password = process.env.PLAYWRIGHT_PORTAL_PASSWORD

    if (!email || !password) {
      test.skip(true, 'PLAYWRIGHT_PORTAL_EMAIL / PLAYWRIGHT_PORTAL_PASSWORD not configured')
      return
    }

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /sign in|anmelden/i }).click()

    await page.waitForURL(/\/portal/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})