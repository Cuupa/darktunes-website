import { describe, expect, it } from 'vitest'
import { AiProviderError } from '@/lib/ai/provider/errors'
import { apiErrorFromProvider } from '@/lib/ai/provider/mapToApiError'

describe('apiErrorFromProvider', () => {
  it('should map INVALID_KEY to AI_PROVIDER_INVALID_KEY', () => {
    const apiError = apiErrorFromProvider(new AiProviderError('INVALID_KEY', 'bad'))
    expect(apiError.code).toBe('AI_PROVIDER_INVALID_KEY')
    expect(apiError.status).toBe(401)
  })

  it('should map unknown errors to AI_PROVIDER_UNAVAILABLE', () => {
    const apiError = apiErrorFromProvider(new Error('boom'))
    expect(apiError.code).toBe('AI_PROVIDER_UNAVAILABLE')
    expect(apiError.status).toBe(503)
  })
})
