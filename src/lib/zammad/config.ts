/**
 * src/lib/zammad/config.ts
 *
 * Reads Zammad connection settings from environment variables.
 * Returns null when not fully configured — callers must handle gracefully.
 */

export interface ZammadConfig {
  baseUrl: string
  apiToken: string
  group: string
}

const DEFAULT_GROUP = 'Support'

export function getZammadConfig(): ZammadConfig | null {
  const rawUrl = process.env.ZAMMAD_URL?.trim()
  const apiToken = process.env.ZAMMAD_API_TOKEN?.trim()
  const group = process.env.ZAMMAD_GROUP?.trim() || DEFAULT_GROUP

  if (!rawUrl || !apiToken) return null

  const baseUrl = rawUrl.replace(/\/+$/, '')
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    return null
  }

  return { baseUrl, apiToken, group }
}

export function isZammadConfigured(): boolean {
  return getZammadConfig() !== null
}