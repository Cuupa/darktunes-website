import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getZammadConfig, isZammadConfigured } from './config'

describe('getZammadConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null when env vars are missing', () => {
    expect(getZammadConfig()).toBeNull()
    expect(isZammadConfigured()).toBe(false)
  })

  it('returns config when url and token are set', () => {
    vi.stubEnv('ZAMMAD_URL', 'https://support.example.com/')
    vi.stubEnv('ZAMMAD_API_TOKEN', 'secret-token')
    vi.stubEnv('ZAMMAD_GROUP', '2nd Level')

    expect(getZammadConfig()).toEqual({
      baseUrl: 'https://support.example.com',
      apiToken: 'secret-token',
      group: '2nd Level',
    })
    expect(isZammadConfigured()).toBe(true)
  })

  it('defaults group to Support', () => {
    vi.stubEnv('ZAMMAD_URL', 'https://support.example.com')
    vi.stubEnv('ZAMMAD_API_TOKEN', 'token')

    expect(getZammadConfig()?.group).toBe('Support')
  })

  it('returns null for invalid url scheme', () => {
    vi.stubEnv('ZAMMAD_URL', 'ftp://bad.example.com')
    vi.stubEnv('ZAMMAD_API_TOKEN', 'token')

    expect(getZammadConfig()).toBeNull()
  })
})