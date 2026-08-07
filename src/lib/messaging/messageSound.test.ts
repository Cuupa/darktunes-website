import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isMessageSoundEnabled,
  MESSAGE_SOUND_STORAGE_KEY,
  playNewMessageSound,
  setMessageSoundEnabled,
} from './messageSound'

describe('messageSound', () => {
  afterEach(() => {
    try {
      window.localStorage.removeItem(MESSAGE_SOUND_STORAGE_KEY)
    } catch {
      // ignore
    }
    vi.restoreAllMocks()
  })

  it('defaults to enabled when unset', () => {
    expect(isMessageSoundEnabled()).toBe(true)
  })

  it('persists on/off preference', () => {
    setMessageSoundEnabled(false)
    expect(isMessageSoundEnabled()).toBe(false)
    setMessageSoundEnabled(true)
    expect(isMessageSoundEnabled()).toBe(true)
  })

  it('does not throw when sound is disabled', () => {
    setMessageSoundEnabled(false)
    expect(() => playNewMessageSound()).not.toThrow()
  })
})
