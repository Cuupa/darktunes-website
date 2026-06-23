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
    await expect(page.locator('section#releases').first()).toBeVisible()
    await expect(page.locator('section#news').first()).toBeVisible()
    await expect(page.locator('section#artists').first()).toBeVisible()
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

  test('newsletter section embeds the Shopify signup iframe', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const newsletter = page.locator('section#newsletter').first()
    await expect(newsletter).toBeVisible()
    await expect(newsletter.locator('iframe[title]')).toBeVisible()
  })
})
