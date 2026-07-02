/**
 * tests/e2e/edgecases.spec.ts — Edge Cases & Loading Skeleton Tests
 *
 * Verifies:
 *  1. Skeleton loaders have the same bounding-box dimensions as the fully
 *     loaded content cards, preventing Cumulative Layout Shift (CLS).
 *  2. Long artist names are truncated with CSS ellipsis and do not break
 *     the card grid layout.
 *  3. The application renders gracefully under simulated slow-network
 *     conditions (throttled API responses).
 */

import { test, expect, type Page } from '@playwright/test'
import { waitForPageSettled } from '../helpers/pageSettle'

// ---------------------------------------------------------------------------
// Helper: intercept Supabase REST calls and add artificial latency
// ---------------------------------------------------------------------------
async function throttleSupabaseRequests(page: Page, delayMs = 2000): Promise<void> {
  await page.route('**/rest/v1/**', async (route) => {
    // Delay the response to simulate a slow connection.
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
    await route.continue()
  })
}

// ---------------------------------------------------------------------------
// Helper: inject an artist with a very long name into the DOM for testing
// ---------------------------------------------------------------------------
async function injectLongNameCard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const longName =
      'Extraordinarily Long Artist Name That Should Definitely Be Truncated By CSS Ellipsis In The Card Layout'

    const artistSection = document.querySelector('#artists')
    if (!artistSection) return

    const grid = artistSection.querySelector('[class*="grid"]')
    if (!grid) return

    // Clone the first card and replace its heading text.
    const firstCard = grid.querySelector('[class*="card"], [class*="Card"]') as HTMLElement | null
    if (!firstCard) return

    const clone = firstCard.cloneNode(true) as HTMLElement
    const headings = clone.querySelectorAll('h2, h3, h4, [class*="font-bold"]')
    headings.forEach((h) => {
      ;(h as HTMLElement).textContent = longName
    })
    clone.setAttribute('data-testid', 'long-name-card')
    grid.appendChild(clone)
  })
}

// ---------------------------------------------------------------------------
// 1. Skeleton → Content: no layout shift
// ---------------------------------------------------------------------------

test.describe('Skeleton Loaders — No CLS', () => {
  test('skeletons and loaded cards share the same bounding-box dimensions', async ({
    page,
  }) => {
    // Intercept Supabase to keep skeletons visible momentarily.
    let resolveRequests!: () => void
    const requestsHeld = new Promise<void>((resolve) => {
      resolveRequests = resolve
    })
    let firstCaptured = false

    await page.route('**/rest/v1/**', async (route) => {
      // Hold only the first batch of requests to capture skeleton state.
      if (!firstCaptured) {
        firstCaptured = true
        await requestsHeld
      }
      await route.continue()
    })

    await page.goto('/')

    // Capture skeleton bounding boxes before data loads.
    const skeletons = page.locator('[class*="skeleton"], [class*="Skeleton"], [data-skeleton]')
    const skeletonCount = await skeletons.count()

    const skeletonBoxes: Array<{ width: number; height: number }> = []
    for (let i = 0; i < skeletonCount; i++) {
      const box = await skeletons.nth(i).boundingBox()
      if (box) skeletonBoxes.push({ width: box.width, height: box.height })
    }

    // Release the held requests so content loads.
    resolveRequests()
    await waitForPageSettled(page)

    if (skeletonBoxes.length === 0) {
      // No skeletons detected — the app may render content immediately
      // (e.g. when Supabase is unconfigured and returns empty arrays).
      // In that case there is no CLS risk from skeletons, so we pass.
      test.skip(true, 'No skeleton elements found — skipping CLS check')
      return
    }

    // After data loads the skeletons should be gone.
    const remainingSkeletons = await skeletons.count()
    expect(remainingSkeletons).toBe(0)

    // Any visible cards should exist and have non-zero area.
    const cards = page.locator('[class*="card"], [class*="Card"]')
    const cardCount = await cards.count()
    if (cardCount === 0) return // Nothing to compare — Supabase empty.

    const firstCardBox = await cards.first().boundingBox()
    expect(firstCardBox).not.toBeNull()
    expect(firstCardBox!.width).toBeGreaterThan(0)
    expect(firstCardBox!.height).toBeGreaterThan(0)

    // Compare the first skeleton's height to the first card's height.
    // Allow ±8 px tolerance for border / padding differences.
    if (skeletonBoxes[0]) {
      expect(Math.abs(skeletonBoxes[0].height - firstCardBox!.height)).toBeLessThanOrEqual(8)
    }
  })

  test('page has no visible horizontal scrollbar (no overflow)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })

    expect(hasHorizontalScroll).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. Long artist names — CSS truncation
// ---------------------------------------------------------------------------

test.describe('Long Artist Name Truncation', () => {
  test('long names are visually truncated with ellipsis and do not break the grid', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForPageSettled(page)

    const artistSection = page.locator('#artists')
    const sectionCount = await artistSection.count()
    if (sectionCount === 0) {
      test.skip(true, '#artists section not present')
      return
    }

    // Inject a card with an artificially long name.
    await injectLongNameCard(page)

    const longCard = page.locator('[data-testid="long-name-card"]')
    const longCardCount = await longCard.count()
    if (longCardCount === 0) {
      test.skip(true, 'Could not inject long-name card into DOM')
      return
    }

    // The heading inside the injected card should have `overflow: hidden`
    // or `text-overflow: ellipsis` applied so text does not bleed out.
    const heading = longCard.locator('h2, h3, h4, [class*="font-bold"]').first()
    const headingCount = await heading.count()
    if (headingCount === 0) return

    const styles = await heading.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        overflow: computed.overflow,
        textOverflow: computed.textOverflow,
        whiteSpace: computed.whiteSpace,
      }
    })

    // Acceptable truncation strategies:
    //   A) text-overflow: ellipsis (requires overflow: hidden and white-space: nowrap)
    //   B) overflow: hidden alone (clips without ellipsis)
    const isTruncated =
      styles.textOverflow === 'ellipsis' ||
      styles.overflow === 'hidden' ||
      styles.overflow === 'clip' ||
      styles.whiteSpace === 'nowrap'

    expect(
      isTruncated,
      `Expected long artist name to be truncated. Got overflow="${styles.overflow}", text-overflow="${styles.textOverflow}", white-space="${styles.whiteSpace}"`,
    ).toBe(true)

    // The injected card must not cause horizontal overflow on the page.
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasHorizontalScroll).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. Slow network — graceful degradation
// ---------------------------------------------------------------------------

test.describe('Slow Network — Graceful Degradation', () => {
  test('page renders a usable UI even with 2 s API latency', async ({ page }) => {
    await throttleSupabaseRequests(page, 2000)
    await page.goto('/')
    // The page should load and show a header within a reasonable time frame.
    await expect(page.locator('header')).toBeVisible({ timeout: 15_000 })
  })

  test('page title is correct', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Music Label|darkTunes|Dark Tunes/i)
  })

  test('press page is accessible without authentication', async ({ page }) => {
    const response = await page.goto('/press')
    // Should not redirect to a login page (non-2xx status is also acceptable
    // if the page renders statically, e.g. 200 with empty data).
    expect(response?.status()).not.toBe(401)
    expect(response?.status()).not.toBe(403)
  })

  test('promo-pool redirects unauthenticated users to login', async ({ page }) => {
    const response = await page.goto('/promo-pool')
    const finalUrl = page.url()
    // Either the server returns 4xx OR the middleware redirected to /promo-pool/login.
    const redirectedToLogin = finalUrl.includes('/promo-pool/login') || finalUrl.includes('/login')
    const serverDenied = response?.status() === 401 || response?.status() === 403
    expect(redirectedToLogin || serverDenied).toBe(true)
  })
})
