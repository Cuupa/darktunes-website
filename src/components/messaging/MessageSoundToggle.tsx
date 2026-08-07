'use client'

import { useCallback, useEffect, useState } from 'react'
import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  isMessageSoundEnabled,
  playNewMessageSound,
  setMessageSoundEnabled,
} from '@/lib/messaging/messageSound'
import { cn } from '@/lib/utils'

export interface MessageSoundToggleProps {
  className?: string
  /** Visible label for on state */
  labelOn?: string
  /** Visible label for off state */
  labelOff?: string
  /** Compact icon-only control */
  iconOnly?: boolean
}

/**
 * Toggle for live new-message chime. Persists to localStorage.
 * Enabling plays a preview so the AudioContext unlocks after a user gesture.
 */
export function MessageSoundToggle({
  className,
  labelOn = 'Sound on',
  labelOff = 'Sound off',
  iconOnly = false,
}: MessageSoundToggleProps) {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    setEnabled(isMessageSoundEnabled())
  }, [])

  const toggle = useCallback(() => {
    const next = !isMessageSoundEnabled()
    setMessageSoundEnabled(next)
    setEnabled(next)
    if (next) playNewMessageSound()
  }, [])

  return (
    <Button
      type="button"
      variant="ghost"
      size={iconOnly ? 'icon' : 'sm'}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? labelOn : labelOff}
      title={enabled ? labelOn : labelOff}
      className={cn(iconOnly ? 'min-h-11 min-w-11' : 'gap-1.5 h-8 text-xs', className)}
    >
      {enabled ? (
        <SpeakerHigh size={16} weight="bold" aria-hidden="true" />
      ) : (
        <SpeakerSlash size={16} weight="bold" aria-hidden="true" />
      )}
      {!iconOnly && <span>{enabled ? labelOn : labelOff}</span>}
    </Button>
  )
}
