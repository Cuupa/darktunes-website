import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

function collectKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    collectKeys(nested, prefix ? `${prefix}.${key}` : key),
  )
}

const messagesDir = path.join(import.meta.dirname, 'messages')

describe('i18n message parity', () => {
  it('en and de namespaces match', () => {
    const enNamespaces = readdirSync(path.join(messagesDir, 'en'))
      .filter((file) => file.endsWith('.json'))
      .sort()
    const deNamespaces = readdirSync(path.join(messagesDir, 'de'))
      .filter((file) => file.endsWith('.json'))
      .sort()
    expect(deNamespaces).toEqual(enNamespaces)
  })

  it('en and de namespace contents expose the same key paths', () => {
    const enNamespaces = readdirSync(path.join(messagesDir, 'en')).filter((file) => file.endsWith('.json'))

    for (const namespaceFile of enNamespaces) {
      const en = JSON.parse(readFileSync(path.join(messagesDir, 'en', namespaceFile), 'utf8'))
      const de = JSON.parse(readFileSync(path.join(messagesDir, 'de', namespaceFile), 'utf8'))
      expect(collectKeys(de).sort()).toEqual(collectKeys(en).sort())
    }
  })
})