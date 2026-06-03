import { test, expect } from '@playwright/test'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

test.describe('Core web vitals budgets', () => {
  test('Homepage LCP is under 2500ms', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Perf budget is enforced in Chromium only')

    await page.goto('/')

    const lcp = await page.evaluate(async () => {
      return await new Promise<number>((resolve) => {
        let latestValue = 0

        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
            startTime?: number
            renderTime?: number
          }
          latestValue = lastEntry?.startTime ?? lastEntry?.renderTime ?? latestValue
        })

        observer.observe({ type: 'largest-contentful-paint', buffered: true })

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            observer.disconnect()
            resolve(latestValue)
          })
        })
      })
    })

    expect(lcp).toBeGreaterThan(0)
    expect(lcp).toBeLessThan(2500)
  })

  test('Artist page TTI is under 3500ms', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Perf budget is enforced in Chromium only')

    await page.goto('/artists')

    const tti = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return nav.domInteractive
    })

    expect(tti).toBeLessThan(3500)
  })

  test('Lenis smooth scroll keeps long tasks low', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Perf budget is enforced in Chromium only')

    await page.goto('/')

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
      return Date.now() - started
    }

    const artistsTime = await measureNavigation('/artists')
    const newsTime = await measureNavigation('/news')
    const videosTime = await measureNavigation('/videos')

    expect(artistsTime).toBeLessThan(3500)
    expect(newsTime).toBeLessThan(3500)
    expect(videosTime).toBeLessThan(3500)
  })

  test('Main bundle stays under 200 KB', async ({ browserName }) => {
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

    expect(totalMainBytes).toBeLessThan(200 * 1024)
  })
})
