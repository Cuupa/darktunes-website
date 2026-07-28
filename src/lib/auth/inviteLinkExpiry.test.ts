import { describe, it, expect } from 'vitest'
import {
  INVITE_LINK_EXPIRY_HOURS_DEFAULT,
  INVITE_LINK_EXPIRY_HOURS_MAX,
  INVITE_LINK_EXPIRY_HOURS_MIN,
  computeInviteExpiresAt,
  formatInviteExpiresAt,
  normalizeInviteLinkExpiryHours,
} from './inviteLinkExpiry'

describe('normalizeInviteLinkExpiryHours', () => {
  it('defaults missing / invalid values to 7 days', () => {
    expect(normalizeInviteLinkExpiryHours(undefined)).toBe(INVITE_LINK_EXPIRY_HOURS_DEFAULT)
    expect(normalizeInviteLinkExpiryHours(null)).toBe(INVITE_LINK_EXPIRY_HOURS_DEFAULT)
    expect(normalizeInviteLinkExpiryHours('')).toBe(INVITE_LINK_EXPIRY_HOURS_DEFAULT)
    expect(normalizeInviteLinkExpiryHours('nope')).toBe(INVITE_LINK_EXPIRY_HOURS_DEFAULT)
  })

  it('clamps below minimum to 24h', () => {
    expect(normalizeInviteLinkExpiryHours(1)).toBe(INVITE_LINK_EXPIRY_HOURS_MIN)
    expect(normalizeInviteLinkExpiryHours(23)).toBe(INVITE_LINK_EXPIRY_HOURS_MIN)
  })

  it('clamps above maximum to 7 days', () => {
    expect(normalizeInviteLinkExpiryHours(200)).toBe(INVITE_LINK_EXPIRY_HOURS_MAX)
    expect(normalizeInviteLinkExpiryHours(9999)).toBe(INVITE_LINK_EXPIRY_HOURS_MAX)
  })

  it('accepts values inside the range', () => {
    expect(normalizeInviteLinkExpiryHours(24)).toBe(24)
    expect(normalizeInviteLinkExpiryHours(48)).toBe(48)
    expect(normalizeInviteLinkExpiryHours(168)).toBe(168)
  })
})

describe('computeInviteExpiresAt', () => {
  it('adds the configured hours from a fixed base', () => {
    const from = new Date('2026-01-01T00:00:00.000Z')
    expect(computeInviteExpiresAt(24, from).toISOString()).toBe('2026-01-02T00:00:00.000Z')
    expect(computeInviteExpiresAt(168, from).toISOString()).toBe('2026-01-08T00:00:00.000Z')
  })
})

describe('formatInviteExpiresAt', () => {
  it('includes UTC label', () => {
    const text = formatInviteExpiresAt(new Date('2026-07-28T14:30:00.000Z'))
    expect(text).toContain('UTC')
    expect(text).toContain('2026')
  })
})
