'use client'

import type { ReactNode } from 'react'
import { Eye, EyeSlash, Asterisk } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ToggleButtonProps {
  pressed: boolean
  onToggle: () => void
  disabled?: boolean
  ariaLabel: string
  children: ReactNode
}

function ToggleButton({ pressed, onToggle, disabled, ariaLabel, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-1',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </button>
  )
}

interface VisibleToggleProps {
  visible: boolean
  onToggle: () => void
  disabled?: boolean
  ariaLabel?: string
}

export function VisibleToggle({ visible, onToggle, disabled, ariaLabel = 'Toggle visibility' }: VisibleToggleProps) {
  return (
    <ToggleButton pressed={visible} onToggle={onToggle} disabled={disabled} ariaLabel={ariaLabel}>
      {visible ? (
        <Badge variant="outline" className="gap-1 text-green-400 border-green-400/30 cursor-pointer hover:opacity-70">
          <Eye size={12} aria-hidden="true" />
          Visible
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 text-muted-foreground border-border cursor-pointer hover:opacity-70">
          <EyeSlash size={12} aria-hidden="true" />
          Hidden
        </Badge>
      )}
    </ToggleButton>
  )
}

interface RequiredToggleProps {
  required: boolean
  onToggle: () => void
  disabled?: boolean
  ariaLabel?: string
}

export function RequiredToggle({ required, onToggle, disabled, ariaLabel = 'Toggle required' }: RequiredToggleProps) {
  return (
    <ToggleButton pressed={required} onToggle={onToggle} disabled={disabled} ariaLabel={ariaLabel}>
      {required ? (
        <Badge variant="outline" className="gap-1 text-amber-400 border-amber-400/30 cursor-pointer hover:opacity-70">
          <Asterisk size={12} aria-hidden="true" weight="bold" />
          Required
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 text-muted-foreground border-border cursor-pointer hover:opacity-70">
          Optional
        </Badge>
      )}
    </ToggleButton>
  )
}

interface SubmissionFieldTogglesProps {
  visible: boolean
  required: boolean
  onVisibleChange: (visible: boolean) => void
  onRequiredChange: (required: boolean) => void
  fieldKey?: string
  releaseType?: string
}

export function SubmissionFieldToggles({
  visible,
  required,
  onVisibleChange,
  onRequiredChange,
  fieldKey,
  releaseType,
}: SubmissionFieldTogglesProps) {
  const prefix = fieldKey ? `${fieldKey}${releaseType ? ` ${releaseType}` : ''}` : 'Field'

  return (
    <div className="flex flex-row flex-wrap items-center gap-1.5">
      <VisibleToggle
        visible={visible}
        onToggle={() => onVisibleChange(!visible)}
        ariaLabel={`${prefix} visibility`}
      />
      <RequiredToggle
        required={required}
        onToggle={() => onRequiredChange(!required)}
        disabled={!visible}
        ariaLabel={`${prefix} required`}
      />
    </div>
  )
}