import { test, expect } from '@playwright/test'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

test('rootMainFiles bundle stays under 500 KB uncompressed', async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'Bundle budget is enforced in Chromium only')

  const manifestPath = path.join(process.cwd(), '.next', 'build-manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { rootMainFiles?: string[] }

  const entries = (manifest.rootMainFiles ?? [])
    .filter((file) => file.endsWith('.js'))
    .map((file) => {
      const filePath = path.join(process.cwd(), '.next', file)
      const size = statSync(filePath).size
      return { file, size }
    })

  const total = entries.reduce((sum, entry) => sum + entry.size, 0)
  const breakdown = entries.map((entry) => `${entry.file}: ${entry.size} bytes`).join('\n')

  expect(total, `rootMainFiles breakdown:\n${breakdown}`).toBeLessThan(500 * 1024)
})
