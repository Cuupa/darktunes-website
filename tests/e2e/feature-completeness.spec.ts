import { test, expect } from '@playwright/test'
import { getTestUser, loginAsAdmin } from '../helpers/auth'
import { getVisibleArtists, isSupabaseE2EConfigured } from '../helpers/supabase'

const ADMIN_TABS = [
  'Artists',
  'Releases',
  'News',
  'Videos',
  'Assets',
  'Settings',
  'Health',
  'Media',
  'Users',
  'Features',
  'Feature Flags',
  'Messages',
  'Accreditations',
  'Press Portal',
  'Logs',
  'Roles & Permissions',
  'Statements',
]

test.describe('Feature completeness', () => {
  test('homepage key sections are visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('#hero')).toBeVisible()
    await expect(page.locator('#releases')).toBeVisible()
    await expect(page.locator('#news')).toBeVisible()
    await expect(page.locator('#artists')).toBeVisible()
  })

  test('artist detail shows bio, releases, and concerts sections', async ({ page }) => {
    if (!isSupabaseE2EConfigured()) {
      test.skip(true, 'Supabase env missing for artist route checks')
      return
    }

    const artists = await getVisibleArtists(1)
    if (artists.length === 0) {
      test.skip(true, 'No visible artist found')
      return
    }

    await page.goto(`/artists/${artists[0].slug}`, { waitUntil: 'domcontentloaded' })

    await expect(page.getByText(/full bio|bio|biografie/i).first()).toBeVisible()
    await expect(page.getByText(/releases|veröffentlichungen/i).first()).toBeVisible()
    await expect(page.getByText(/concerts|konzerte|shows/i).first()).toBeVisible()
  })

  test('admin dashboard tabs are visible for admin role', async ({ page }) => {
    if (!getTestUser('admin')) {
      test.skip(true, 'Missing E2E admin credentials')
      return
    }

    await loginAsAdmin(page)

    for (const tabLabel of ADMIN_TABS) {
      await expect(page.getByRole('tab', { name: tabLabel })).toBeVisible()
    }
  })

  test('newsletter submission shows confirmation message', async ({ page }) => {
    await page.route('**/api/newsletter', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Subscription confirmed' }),
      })
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const emailInput = page.locator('input[type="email"]').first()
    await emailInput.fill('qa-test@example.com')

    const submit = page.getByRole('button', { name: /subscribe|anmelden|newsletter/i }).first()
    await submit.click()

    await expect(page.getByText(/confirmed|success|danke|thank/i).first()).toBeVisible()
  })
})
