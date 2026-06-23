import type { Page } from '@playwright/test'

/**
 * CI-aware budget helper.
 *
 * GitHub Actions shared runners are significantly slower than production
 * hardware. Timing-based tests use generous CI thresholds to catch only
 * catastrophic regressions, while still documenting the production target.
 */
export const budget = (production: number, ci: number) => (process.env.CI ? ci : production)

const networkIdleTimeout = budget(15_000, 30_000)

/**
 * Wait for a page to settle before reading Web Vitals.
 *
 * Prefers `networkidle` (per AGENTS.md LCP guidance) but falls back to `load`
 * when CI runners never reach idle (homepage Spotify/vitals long-polling).
 * PerformanceObserver `buffered: true` still returns the LCP entry after `load`.
 */
export async function waitForPageSettled(page: Page): Promise<void> {
  await page.waitForLoadState('load')
  await page.waitForLoadState('networkidle', { timeout: networkIdleTimeout }).catch(() => undefined)
}