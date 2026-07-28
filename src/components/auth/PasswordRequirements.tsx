'use client'

/**
 * Live password-requirements checklist.
 * Shows what a strong password must contain and which rules are already met.
 */

import { Check, X } from '@phosphor-icons/react'
import {
  getPasswordRequirementChecks,
  type PasswordRequirementCheck,
  type PasswordRequirementId,
} from '@/lib/auth/passwordPolicy'
import { cn } from '@/lib/utils'

interface PasswordRequirementsProps {
  className?: string
  /** Current password value — enables live met/unmet state. */
  password?: string
  /**
   * Optional label resolver (i18n). Falls back to English SSOT labels.
   * Keys: length | upper | lower | digit | special
   */
  labelFor?: (id: PasswordRequirementId, fallback: string) => string
  /** Optional translated heading above the list. */
  heading?: string
}

export function PasswordRequirements({
  className,
  password = '',
  labelFor,
  heading,
}: PasswordRequirementsProps) {
  const checks: PasswordRequirementCheck[] = getPasswordRequirementChecks(password)
  const showLive = password.length > 0

  return (
    <div className={cn('space-y-1.5', className)}>
      {heading ? (
        <p className="text-xs font-medium text-muted-foreground">{heading}</p>
      ) : null}
      <ul className="space-y-1" aria-label={heading ?? 'Password requirements'} aria-live="polite">
        {checks.map((check) => {
          const label = labelFor?.(check.id, check.label) ?? check.label
          const met = showLive && check.met
          const unmet = showLive && !check.met
          return (
            <li
              key={check.id}
              className={cn(
                'flex items-start gap-1.5 text-xs leading-snug',
                !showLive && 'text-muted-foreground',
                met && 'text-emerald-500',
                unmet && 'text-amber-500',
              )}
            >
              <span className="mt-0.5 shrink-0" aria-hidden="true">
                {showLive ? (
                  met ? (
                    <Check size={12} weight="bold" />
                  ) : (
                    <X size={12} weight="bold" />
                  )
                ) : (
                  <span className="inline-block w-3 text-center">•</span>
                )}
              </span>
              <span>
                {label}
                {showLive ? (
                  <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
