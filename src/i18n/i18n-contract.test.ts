/**
 * Enterprise i18n contract — Vitest wrapper around scripts/check-i18n-contract.mjs
 */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const script = path.join(root, 'scripts/check-i18n-contract.mjs')

describe('i18n contract', () => {
  it('passes check-i18n-contract.mjs (parity, keys, no toast hardcodes, bundles)', () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
    })
    if (result.status !== 0) {
      const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
      expect(out, out).toBe('')
    }
    expect(result.status).toBe(0)
  })
})
