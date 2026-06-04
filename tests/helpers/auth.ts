import { expect, type Page } from '@playwright/test'

export type TestUserRole = 'admin' | 'artist'

export interface TestUserCredentials {
  email: string
  password: string
}

export function getTestUser(role: TestUserRole): TestUserCredentials | null {
  const prefix = role.toUpperCase()
  const email = process.env[`E2E_${prefix}_EMAIL`]
  const password = process.env[`E2E_${prefix}_PASSWORD`]

  if (!email || !password) return null
  return { email, password }
}

export async function loginAsAdmin(page: Page): Promise<void> {
  const creds = getTestUser('admin')
  if (!creds) throw new Error('Missing E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD')

  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(creds.email)
  await page.getByLabel('Password').fill(creds.password)
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL(/\/admin(\?|$)/, { timeout: 15_000 })
  await expect(page).toHaveURL(/\/admin(\?|$)/)
}

export async function loginAsArtist(page: Page): Promise<void> {
  const creds = getTestUser('artist')
  if (!creds) throw new Error('Missing E2E_ARTIST_EMAIL/E2E_ARTIST_PASSWORD')

  await page.goto('/portal/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/email/i).fill(creds.email)
  await page.getByLabel(/password/i).first().fill(creds.password)
  await page.getByRole('button', { name: /sign in|login|anmelden/i }).first().click()

  await page.waitForURL(/\/portal(\?|$)/, { timeout: 15_000 })
  await expect(page).toHaveURL(/\/portal(\?|$)/)
}
