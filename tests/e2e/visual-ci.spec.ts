import { test, expect } from '@playwright/test'
import { gotoAndSettle } from '../helpers/pageSettle'

test.describe('Corporate identity visual validation', () => {
  test('primary button uses CI violet #493687', async ({ page }) => {
    await gotoAndSettle(page, '/')

    const primary = page.locator('button[class*="bg-primary"], a[class*="bg-primary"]').first()
    await expect(primary).toBeVisible()

    const background = await primary.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(background).toBe('rgb(73, 54, 135)')
  })

  test('main background uses CI black #101010', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(background).toBe('rgb(16, 16, 16)')
  })

  test('secondary accent elements use #7e1e37', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const accent = page.locator('[class*="bg-secondary"]').first()
    const accentCount = await accent.count()
    if (accentCount === 0) {
      test.skip(true, 'No secondary accent element found on homepage')
      return
    }

    const color = await accent.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(color).toBe('rgb(126, 30, 55)')
  })
})
