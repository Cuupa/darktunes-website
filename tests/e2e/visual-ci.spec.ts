import { test, expect, type Page } from '@playwright/test'

async function getRootCssVar(page: Page, name: string): Promise<string> {
  return page.evaluate((varName) => {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  }, name)
}

test.describe('Corporate identity visual validation', () => {
  test('primary token uses CI violet #493687', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(await getRootCssVar(page, '--primary')).toBe('#493687')
  })

  test('background token uses CI black #101010 via --background-rgb', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(await getRootCssVar(page, '--background-rgb')).toBe('16, 16, 16')
  })

  test('secondary token uses CI pink #7e1e37', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(await getRootCssVar(page, '--secondary')).toBe('#7e1e37')
  })
})