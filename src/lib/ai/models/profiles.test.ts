import { describe, expect, it } from 'vitest'
import {
  FAST_MODEL_ID,
  REASONING_MODEL_ID,
  getModelProfile,
  inferRoleFromModelId,
  shouldEnableThinking,
} from '@/lib/ai/models/profiles'

describe('model profiles', () => {
  it('should keep Lightning thinking off for simple tasks', () => {
    expect(shouldEnableThinking('fast', 'simple')).toBe(false)
    expect(shouldEnableThinking('fast', 'complex')).toBe(true)
  })

  it('should enable thinking on Super for complex admin work', () => {
    expect(shouldEnableThinking('reasoning', 'complex')).toBe(true)
    expect(getModelProfile(REASONING_MODEL_ID).supports_low_effort).toBe(true)
  })

  it('should default unknown models to the fast profile without claiming Super capabilities', () => {
    const profile = getModelProfile('openai/some-local-model')
    expect(profile.role).toBe('fast')
    expect(profile.supports_low_effort).toBe(false)
    expect(inferRoleFromModelId(FAST_MODEL_ID)).toBe('fast')
  })
})
