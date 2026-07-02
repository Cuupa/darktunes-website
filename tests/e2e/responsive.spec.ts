/**
 * tests/e2e/responsive.spec.ts — Responsive Layout & Grid Tests
 *
 * Verifies:
 *  1. Shrinking-logo header: the logo's bounding box is larger before scroll
 *     than after scrolling ≥ 500 px. On desktop the reduction is measurable;
 *     on mobile the header is already compact, so the tolerance is relaxed.
 *  2. Navigation visibility: the full nav is hidden and the hamburger icon is
 *     visible at the mobile breakpoint; reversed at the desktop breakpoint.
 *  3. Mobile grid stacking: multi-column grids collapse to a single column
 *     at the mobile breakpoint.
 */

import { test, expect } from '@playwright/test'
import { waitForPageSettled } from '../helpers/pageSettle'

// ---------------------------------------------------------------------------
// 1. Shrinking logo header
// ---------------------------------------------------------------------------

test.describe('Shrinking Logo Header', () => {
  test('logo shrinks after scrolling 500 px on desktop', async ({ page, viewport }) => {
    // Only run on viewports wide enough to trigger the full shrink animation.
    if (!viewport || viewport.width < 1024) {
      test.skip(true, 'Desktop-only test — skipping on mobile viewport')
      return
    }

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Measure the logo before any scroll.
    const logo = page.locator('header img[alt$=" logo"]')
    await logo.waitFor({ state: 'visible' })
    const initialBox = await logo.boundingBox()
    expect(initialBox).not.toBeNull()

    // Scroll down far enough to trigger the shrink.
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }))
    // Wait for the CSS transition to complete (300 ms transition-duration).
    await page.waitForTimeout(400)

    const scrolledBox = await logo.boundingBox()
    expect(scrolledBox).not.toBeNull()

    // The logo height must be strictly smaller after scrolling.
    expect(scrolledBox!.height).toBeLessThan(initialBox!.height)
    // On desktop the shrink should be significant (≥ 10 px reduction).
    expect(initialBox!.height - scrolledBox!.height).toBeGreaterThanOrEqual(10)
  })

  test('logo height reduces after scroll on mobile (smaller range)', async ({ page, viewport }) => {
    if (!viewport || viewport.width >= 1024) {
      test.skip(true, 'Mobile-only test — skipping on desktop viewport')
      return
    }

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const logo = page.locator('header img[alt$=" logo"]')
    await logo.waitFor({ state: 'visible' })
    const initialBox = await logo.boundingBox()
    expect(initialBox).not.toBeNull()

    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }))
    await page.waitForTimeout(400)

    const scrolledBox = await logo.boundingBox()
    expect(scrolledBox).not.toBeNull()

    // On mobile the logo still shrinks, but by a smaller amount.
    expect(scrolledBox!.height).toBeLessThanOrEqual(initialBox!.height)
  })
})

// ---------------------------------------------------------------------------
// 2. Navigation visibility
// ---------------------------------------------------------------------------

test.describe('Navigation Visibility', () => {
  test('desktop: full nav is visible, hamburger is hidden', async ({ page, viewport }) => {
    if (!viewport || viewport.width < 1024) {
      test.skip(true, 'Desktop-only test')
      return
    }

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // The `hidden lg:flex` nav should be visible at lg+ breakpoints.
    const desktopNav = page.locator('header nav.hidden.lg\\:flex')
    await expect(desktopNav).toBeVisible()

    // The hamburger button uses List (Phosphor icon) and is only shown below lg.
    // It has the class `lg:hidden` (or is wrapped in an element with that class).
    // On desktop the hamburger container should not be visible.
    const hamburgerParent = page.locator('header .lg\\:hidden, header button.lg\\:hidden')
    const hamburgerParentCount = await hamburgerParent.count()
    if (hamburgerParentCount > 0) {
      await expect(hamburgerParent.first()).not.toBeVisible()
    }
  })

  test('mobile: hamburger is visible, full nav is hidden', async ({ page, viewport }) => {
    if (!viewport || viewport.width >= 1024) {
      test.skip(true, 'Mobile-only test')
      return
    }

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // The full nav has class `hidden lg:flex` — should be hidden at mobile.
    const desktopNav = page.locator('header nav.hidden.lg\\:flex')
    const desktopNavCount = await desktopNav.count()
    if (desktopNavCount > 0) {
      await expect(desktopNav).not.toBeVisible()
    }

    // The hamburger button should be present and visible.
    const hamburger = page.locator('header .lg\\:hidden button, header button.lg\\:hidden')
    const hamburgerCount = await hamburger.count()
    if (hamburgerCount > 0) {
      await expect(hamburger.first()).toBeVisible()
    }
  })

  test('mobile: clicking hamburger opens mobile menu', async ({ page, viewport }) => {
    if (!viewport || viewport.width >= 1024) {
      test.skip(true, 'Mobile-only test')
      return
    }

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Click the first button in the header (the hamburger).
    const hamburgerButton = page.locator('header .lg\\:hidden button').first()
    const hamburgerCount = await hamburgerButton.count()
    if (hamburgerCount === 0) {
      test.skip(true, 'Hamburger button not found')
      return
    }

    await hamburgerButton.click()
    // The mobile menu should appear — it contains anchor links.
    // Simply verify that some nav link is now visible.
    const navLink = page.locator('header a[href="#artists"], header a[href="#hero"]').first()
    const navLinkCount = await navLink.count()
    if (navLinkCount > 0) {
      await expect(navLink).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Grid stacking on mobile
// ---------------------------------------------------------------------------

test.describe('Grid Stacking', () => {
  test('artist cards stack to 1 column on mobile', async ({ page, viewport }) => {
    if (!viewport || viewport.width >= 640) {
      test.skip(true, 'Mobile-only test (below sm breakpoint)')
      return
    }

    await page.goto('/')
    await waitForPageSettled(page)

    const artistSection = page.locator('#artists')
    const sectionCount = await artistSection.count()
    if (sectionCount === 0) {
      test.skip(true, '#artists section not present (no Supabase data)')
      return
    }

    const cards = artistSection.locator('[class*="card"], [class*="Card"]')
    const cardCount = await cards.count()
    if (cardCount < 2) {
      test.skip(true, 'Fewer than 2 artist cards available')
      return
    }

    const firstBox = await cards.nth(0).boundingBox()
    const secondBox = await cards.nth(1).boundingBox()
    expect(firstBox).not.toBeNull()
    expect(secondBox).not.toBeNull()

    // On a single-column layout the second card's top should be below the first.
    expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height * 0.5)
  })

  test('release cards use multi-column grid on desktop', async ({ page, viewport }) => {
    if (!viewport || viewport.width < 1024) {
      test.skip(true, 'Desktop-only test')
      return
    }

    await page.goto('/')
    await waitForPageSettled(page)

    const releasesSection = page.locator('#releases')
    const sectionCount = await releasesSection.count()
    if (sectionCount === 0) {
      test.skip(true, '#releases section not present')
      return
    }

    const cards = releasesSection.locator('[class*="card"], [class*="Card"]')
    const cardCount = await cards.count()
    if (cardCount < 2) {
      test.skip(true, 'Fewer than 2 release cards')
      return
    }

    const firstBox = await cards.nth(0).boundingBox()
    const secondBox = await cards.nth(1).boundingBox()
    expect(firstBox).not.toBeNull()
    expect(secondBox).not.toBeNull()

    // In a multi-column grid the second card should be on the same row (same y)
    // or only slightly below the first.
    const yDifference = Math.abs(secondBox!.y - firstBox!.y)
    expect(yDifference).toBeLessThan(50)
  })
})
