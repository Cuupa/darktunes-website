import type { Page } from '@playwright/test'

/** CI-aware timing budgets (production target vs generous CI threshold). */
export const budget = (production: number, ci: number) => (process.env.CI ? ci : production)

const networkIdleTimeout = budget(15_000, 30_000)

/**
 * Wait for a page to settle before screenshots or assertions.
 *
 * Prefers `networkidle` when the environment allows it, but falls back to `load`
 * when CI runners never reach idle (homepage Spotify/vitals long-polling).
 */
export async function waitForPageSettled(page: Page): Promise<void> {
  await page.waitForLoadState('load')
  await page.waitForLoadState('networkidle', { timeout: networkIdleTimeout }).catch(() => undefined)
}

/** Navigate and wait for best-effort settle (replaces `goto(..., { waitUntil: 'networkidle' })`). */
export async function gotoAndSettle(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await waitForPageSettled(page)
}