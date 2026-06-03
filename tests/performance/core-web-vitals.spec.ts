import { test, expect } from '@playwright/test'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * CI-aware budget helper.
 *
 * GitHub Actions shared runners are significantly slower than production
 * hardware.  Timing-based tests use generous CI thresholds to catch only
 * catastrophic regressions, while still documenting the production target.
 */
const budget = (production: number, ci: number) => (process.env.CI ? ci : production)

test.describe('Core web vitals budgets', () => {
  test('Homepage LCP is under 2500ms', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Perf budget is enforced in Chromium only')

    await page.goto('/')
    // Wait for the page to fully settle so the LCP entry is present in the buffer.
    await page.waitForLoadState('networkidle')

    const lcp = await page.evaluate((): Promise<number> => {
      return new Promise((resolve) => {
        let latestValue = 0

        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
            startTime: number
          }
          latestValue = lastEntry?.startTime ?? latestValue
        })

        observer.observe({ type: 'largest-contentful-paint', buffered: true })

        // Short wait to flush any already-buffered entries before disconnecting.
        setTimeout(() => {
          observer.disconnect()
          resolve(latestValue)
        }, 200)
      })
    })

    // Production target: 2 500 ms.  CI budget: 15 000 ms (shared runners are slow).
    expect(lcp).toBeGreaterThan(0)
    expect(lcp).toBeLessThan(budget(2_500, 15_000))
  })

  test('Artist page TTI is under 3500ms', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Perf budget is enforced in Chromium only')

    await page.goto('/artists')
    await page.waitForLoadState('networkidle')

    const tti = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return nav.domInteractive
    })

    // Production target: 3 500 ms.  CI budget: 15 000 ms.
    expect(tti).toBeLessThan(budget(3_500, 15_000))
  })

  test('Lenis smooth scroll keeps long tasks low', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Perf budget is enforced in Chromium only')

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const longTaskCount = await page.evaluate(async () => {
      return await new Promise<number>((resolve) => {
        let count = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              count += 1
            }
          }
        })

        observer.observe({ type: 'longtask', buffered: true })

        let steps = 0
        const id = window.setInterval(() => {
          window.scrollBy({ top: 200, behavior: 'smooth' })
          steps += 1
          if (steps >= 10) {
            window.clearInterval(id)
            setTimeout(() => {
              observer.disconnect()
              resolve(count)
            }, 1000)
          }
        }, 150)
      })
    })

    expect(longTaskCount).toBeLessThanOrEqual(3)
  })

  test('Navigation transitions stay performant', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Perf budget is enforced in Chromium only')

    const measureNavigation = async (url: string) => {
      const started = Date.now()
      await page.goto(url)
      await page.waitForLoadState('domcontentloaded')
      return Date.now() - started
    }

    const artistsTime = await measureNavigation('/artists')
    const newsTime = await measureNavigation('/news')
    const videosTime = await measureNavigation('/videos')

    // Production target: 3 500 ms each.  CI budget: 15 000 ms.
    const navBudget = budget(3_500, 15_000)
    expect(artistsTime).toBeLessThan(navBudget)
    expect(newsTime).toBeLessThan(navBudget)
    expect(videosTime).toBeLessThan(navBudget)
  })

  test('Shared JS bundle stays under 450 KB (uncompressed)', async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Bundle budget is enforced in Chromium only')

    const manifestPath = path.join(process.cwd(), '.next', 'build-manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      rootMainFiles?: string[]
    }

    const totalMainBytes = (manifest.rootMainFiles ?? [])
      .filter((file) => file.endsWith('.js'))
      .reduce((total, file) => {
        const filePath = path.join(process.cwd(), '.next', file)
        return total + statSync(filePath).size
      }, 0)

    // 450 KB uncompressed ≈ 104 KB gzipped (as reported by `next build`).
    // Increase this threshold only when a deliberate new dependency is added.
    expect(totalMainBytes).toBeLessThan(450 * 1024)
  })
})

