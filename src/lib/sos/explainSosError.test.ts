import { describe, expect, it } from 'vitest'
import { explainSosError, SOS_ERROR_FALLBACK } from './explainSosError'

const JARGON = /Failed to fetch|PGRST|R2|CORS|JWT|401|403|404|409|413|429|papa parse|AbortError/i

describe('explainSosError', () => {
  it.each([
    [undefined, SOS_ERROR_FALLBACK.explainUnknown],
    [null, SOS_ERROR_FALLBACK.explainUnknown],
    ['', SOS_ERROR_FALLBACK.explainUnknown],
    ['   ', SOS_ERROR_FALLBACK.explainUnknown],
    [{}, SOS_ERROR_FALLBACK.explainUnknown],
  ])('treats %p as unknown without dumping it', (raw, expected) => {
    expect(explainSosError(raw)).toBe(expected)
  })

  it('reads Error.message', () => {
    expect(explainSosError(new Error('Failed to fetch'))).toBe(SOS_ERROR_FALLBACK.explainNetwork)
    expect(explainSosError(new TypeError('Failed to fetch'))).toBe(SOS_ERROR_FALLBACK.explainNetwork)
  })

  it.each([
    ['Failed to fetch', 'explainNetwork'],
    ['NetworkError when attempting to fetch resource.', 'explainNetwork'],
    ['Network request failed', 'explainNetwork'],
    ['Load failed', 'explainNetwork'],
    ['ERR_NETWORK', 'explainNetwork'],
    ['ERR_INTERNET_DISCONNECTED', 'explainNetwork'],
    ['Not authenticated', 'explainSession'],
    ['session expired', 'explainSession'],
    ['JWT expired', 'explainSession'],
    ['Invalid JWT', 'explainSession'],
    ['HTTP 401', 'explainSession'],
    ['Forbidden: admin role required', 'explainForbidden'],
    ['not authorized', 'explainForbidden'],
    ['SETTLEMENT_PERIOD_LOCKED', 'explainPeriodLocked'],
    ['period is locked', 'explainPeriodLocked'],
    ['period is archived', 'explainPeriodLocked'],
    ['Settlement period is not writable', 'explainPeriodLocked'],
    ['STATEMENT_STATUS_CONFLICT', 'explainConflict'],
    ['revision conflict', 'explainConflict'],
    ['concurrent update', 'explainConflict'],
    ['Workspace was changed in another session', 'explainConflict'],
    ['HTTP 404', 'explainNotFound'],
    ['PGRST116', 'explainNotFound'],
    ['Statement not found', 'explainNotFound'],
    ['R2 PUT failed (403)', 'explainStorage'],
    ['CORS error', 'explainStorage'],
    ['AccessDenied', 'explainStorage'],
    ['NoSuchBucket', 'explainStorage'],
    ['payload too large', 'explainTooLarge'],
    ['HTTP 413', 'explainTooLarge'],
    ['too many requests', 'explainRateLimited'],
    ['HTTP 429', 'explainRateLimited'],
    ['timed out', 'explainTimeout'],
    ['Timeout', 'explainTimeout'],
    ['The operation was aborted', 'explainTimeout'],
    ['AbortError', 'explainTimeout'],
    ['Parse error on line 2', 'explainCsvParse'],
    ['Papa Parse failed', 'explainCsvParse'],
    ['malformed CSV', 'explainCsvParse'],
    ['Unexpected token < in JSON', 'explainCsvParse'],
  ] as const)('maps %s → %s without jargon', (input, key) => {
    const msg = explainSosError(input)
    expect(msg).toBe(SOS_ERROR_FALLBACK[key])
    expect(msg).not.toMatch(JARGON)
  })

  it('does not treat a generic load failure as a network outage', () => {
    expect(explainSosError('Failed to load period summaries')).toBe(SOS_ERROR_FALLBACK.explainUnknown)
  })

  it('does not treat R2 403 as an editor-permission problem', () => {
    expect(explainSosError('R2 PUT failed (403)')).toBe(SOS_ERROR_FALLBACK.explainStorage)
    expect(explainSosError('R2 PUT failed (403)')).not.toBe(SOS_ERROR_FALLBACK.explainForbidden)
  })

  it('passes through already speaking English and locale overrides', () => {
    expect(explainSosError(SOS_ERROR_FALLBACK.explainNetwork)).toBe(SOS_ERROR_FALLBACK.explainNetwork)
    const de = {
      explainNetwork: 'Der Browser hat den Server nicht erreicht (offline, VPN oder eine blockierte Anfrage).',
    }
    expect(explainSosError(de.explainNetwork, de)).toBe(de.explainNetwork)
  })

  it('uses locale labels when mapping', () => {
    const de = { explainSession: 'Neu anmelden, die Sitzung ist abgelaufen.' }
    expect(explainSosError('Not authenticated', de)).toBe(de.explainSession)
  })

  it('never echoes unclassified server text', () => {
    const msg = explainSosError('xyzzy-internal-code')
    expect(msg).toBe(SOS_ERROR_FALLBACK.explainUnknown)
    expect(msg).not.toMatch(/xyzzy/)
  })
})
