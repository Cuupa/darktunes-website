import { expect, test } from '@playwright/test'
import { getTestUser, loginAsAdmin } from '../helpers/auth'

test.describe('Admin table wheel scroll', () => {
  test('submission form table scrolls vertically with mouse wheel over a row', async ({ page }) => {
    if (!getTestUser('admin')) {
      test.skip(true, 'Missing E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD')
      return
    }

    await loginAsAdmin(page)
    await page.goto('/admin/submission-form', { waitUntil: 'domcontentloaded' })

    const scrollPane = page.locator('[data-lenis-prevent].overflow-y-auto').first()
    await expect(scrollPane).toBeVisible({ timeout: 15_000 })

    const tableRow = page.locator('table tbody tr').first()
    await expect(tableRow).toBeVisible({ timeout: 15_000 })

    const before = await scrollPane.evaluate((el) => el.scrollTop)
    const rowBox = await tableRow.boundingBox()
    expect(rowBox).not.toBeNull()

    await page.mouse.move(rowBox!.x + rowBox!.width / 2, rowBox!.y + rowBox!.height / 2)
    await page.mouse.wheel(0, 600)

    await expect
      .poll(async () => scrollPane.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(before)
  })
})