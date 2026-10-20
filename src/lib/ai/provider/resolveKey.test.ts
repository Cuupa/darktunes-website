import { afterEach, describe, expect, it } from 'vitest'
import { readNvidiaEnvKey } from '@/lib/ai/provider/resolveKey'

describe('readNvidiaEnvKey', () => {
  const previous = process.env.NVIDIA_API_KEY

  afterEach(() => {
    if (previous === undefined) delete process.env.NVIDIA_API_KEY
    else process.env.NVIDIA_API_KEY = previous
  })

  it('should return null when the env key is blank', () => {
    process.env.NVIDIA_API_KEY = '   '
    expect(readNvidiaEnvKey()).toBeNull()
  })

  it('should trim a configured env key', () => {
    process.env.NVIDIA_API_KEY = ' nvapi-abc '
    expect(readNvidiaEnvKey()).toBe('nvapi-abc')
  })
})
