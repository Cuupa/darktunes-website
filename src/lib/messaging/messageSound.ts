/**
 * Optional chime when a new message arrives (portal/admin mailboxes).
 * Preference is stored in localStorage; default is enabled.
 */

export const MESSAGE_SOUND_STORAGE_KEY = 'dt-message-sound-enabled'

/** Default on when unset. */
export function isMessageSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(MESSAGE_SOUND_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

export function setMessageSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MESSAGE_SOUND_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // private mode / blocked storage
  }
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctx()
  }
  return audioCtx
}

/**
 * Short two-tone chime via Web Audio (no asset file).
 * No-ops when sound is disabled or AudioContext unavailable.
 * Call from a user-gesture path once if browsers suspend the context until interaction.
 */
export function playNewMessageSound(): void {
  if (!isMessageSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const start = () => {
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
    gain.connect(ctx.destination)

    const tone = (freq: number, t0: number, dur: number) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t0)
      osc.connect(gain)
      osc.start(t0)
      osc.stop(t0 + dur)
    }

    tone(880, now, 0.18)
    tone(1174.66, now + 0.12, 0.22)
  }

  if (ctx.state === 'suspended') {
    void ctx.resume().then(start).catch(() => {})
  } else {
    start()
  }
}
