'use client'

import type { FanPageSection, FanPageTheme } from '@/lib/fan-page/schema/documentV1'
import type { FanPageDevice } from '@/lib/fan-page/editor/store'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import { cn } from '@/lib/utils'

const PADDING_Y: Record<string, string> = {
  none: 'py-0',
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-20',
}

interface FanPageSectionShellProps {
  section: FanPageSection
  theme: FanPageTheme
  device: FanPageDevice
  children: React.ReactNode
  className?: string
  onClick?: () => void
  selected?: boolean
}

export function FanPageSectionShell({
  section,
  theme,
  device,
  children,
  className,
  onClick,
  selected,
}: FanPageSectionShellProps) {
  const colors = resolveThemeColors(theme)
  const styles = device === 'mobile' ? section.styles.mobile ?? section.styles.desktop : section.styles.desktop
  const hidden = section.hiddenOn?.includes(device)

  if (hidden) return null

  const padding = PADDING_Y[styles.paddingY ?? 'md'] ?? PADDING_Y.md

  return (
    <section
      className={cn(
        'relative w-full',
        padding,
        onClick && 'cursor-pointer',
        selected && 'ring-2 ring-accent ring-inset',
        className,
      )}
      style={{
        backgroundColor: styles.backgroundColor ?? colors.background,
        color: styles.textColor ?? colors.text,
      }}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-section-id={section.id}
      data-section-type={section.type}
    >
      {theme.crtScanlines && (
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 4px)',
          }}
          aria-hidden
        />
      )}
      <div className="relative z-0 mx-auto w-full max-w-5xl px-4 sm:px-6">{children}</div>
    </section>
  )
}