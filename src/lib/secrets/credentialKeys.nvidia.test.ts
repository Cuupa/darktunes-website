import { describe, expect, it } from 'vitest'
import {
  CATEGORY_LABELS,
  CREDENTIAL_KEY_DEFINITIONS,
  GROUP_LABELS,
  getCredentialDefinition,
} from '@/lib/secrets/credentialKeys'

describe('NVIDIA credential key', () => {
  it('should register nvidia_api_key as a secret in the AI category', () => {
    const def = getCredentialDefinition('nvidia_api_key')
    expect(def).toMatchObject({
      key: 'nvidia_api_key',
      label: 'NVIDIA API Key',
      category: 'ai',
      group: 'nvidia',
      isSecret: true,
      docsUrl: 'https://build.nvidia.com/models',
    })
    expect(CREDENTIAL_KEY_DEFINITIONS.some((item) => item.key === 'nvidia_api_key')).toBe(true)
    expect(CATEGORY_LABELS.ai).toBe('AI')
    expect(GROUP_LABELS.nvidia).toBe('NVIDIA')
  })
})
