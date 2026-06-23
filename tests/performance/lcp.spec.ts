import { test, expect } from '@playwright/test'

const budget = (production: number, ci: number) => (process.env.CI ? ci : production)
const networkIdleTimeout = budget(15_000, 90_000)

test('Homepage LCP remains below budget', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'LCP measurement runs on Chromium only')
  test.setTimeout(budget(30_000, 120_000))

  await page.goto('/')
  await page.waitForLoadState('networkidle', { timeout: networkIdleTimeout })

  const lcp = await page.evaluate((): Promise<number> => {
    return new Promise((resolve) => {
      let latestLcp = 0

      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const last = entries[entries.length - 1] as PerformanceEntry | undefined
        if (last) latestLcp = last.startTime
      })

      observer.observe({ type: 'largest-contentful-paint', buffered: true })

      setTimeout(() => {
        observer.disconnect()
        resolve(latestLcp)
      }, 200)
    })
  })

  expect(lcp).toBeGreaterThan(0)
  expect(lcp).toBeLessThan(budget(2_500, 15_000))
})
