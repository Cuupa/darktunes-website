'use client'

import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  EPK_GRADIENT_PRESETS,
  type EpkGradient,
  type EpkGradientStop,
  DEFAULT_GRADIENT_ANGLE,
} from '@/lib/epk/gradients'
import { cn } from '@/lib/utils'

interface EpkGradientPickerProps {
  gradient: EpkGradient
  onChange: (gradient: EpkGradient) => void
  compact?: boolean
}

function gradientPreviewStyle(gradient: EpkGradient): React.CSSProperties {
  const stops = gradient.stops
    .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(', ')
  return {
    background: `linear-gradient(${gradient.angle ?? DEFAULT_GRADIENT_ANGLE}deg, ${stops})`,
  }
}

export function EpkGradientPicker({ gradient, onChange, compact = false }: EpkGradientPickerProps) {
  const t = useTranslations('portal')

  const patchStops = (index: number, patch: Partial<EpkGradientStop>) => {
    const next = gradient.stops.map((stop, i) =>
      i === index ? { ...stop, ...patch } : stop,
    )
    onChange({ ...gradient, stops: next })
  }

  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {EPK_GRADIENT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="group flex flex-col gap-1 rounded-md border border-border p-1.5 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onChange(structuredClone(preset.gradient))}
            aria-label={preset.name}
          >
            <span
              className="block h-8 w-full rounded-sm"
              style={gradientPreviewStyle(preset.gradient)}
            />
            <span className="truncate text-[10px] text-muted-foreground group-hover:text-foreground">
              {preset.name}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="epk-grad-angle">{t('epk_gradient_angle')}</Label>
        <Input
          id="epk-grad-angle"
          type="number"
          min={0}
          max={360}
          value={Math.round(gradient.angle ?? DEFAULT_GRADIENT_ANGLE)}
          onChange={(e) => onChange({ ...gradient, angle: Number(e.target.value) })}
        />
      </div>

      {gradient.stops.map((stop, index) => (
        <div key={index} className="grid grid-cols-[1fr_5rem] gap-2 items-end">
          <div className="space-y-1">
            <Label htmlFor={`epk-grad-color-${index}`}>
              {t('epk_gradient_stop', { index: index + 1 })}
            </Label>
            <Input
              id={`epk-grad-color-${index}`}
              type="text"
              value={stop.color}
              onChange={(e) => patchStops(index, { color: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`epk-grad-offset-${index}`}>%</Label>
            <Input
              id={`epk-grad-offset-${index}`}
              type="number"
              min={0}
              max={100}
              value={Math.round(stop.offset * 100)}
              onChange={(e) =>
                patchStops(index, { offset: Math.max(0, Math.min(1, Number(e.target.value) / 100)) })
              }
            />
          </div>
        </div>
      ))}

      <div
        className="h-10 w-full rounded-md border border-border"
        style={gradientPreviewStyle(gradient)}
        role="img"
        aria-label={t('epk_gradient_preview')}
      />

      {gradient.stops.length < 4 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full min-h-[44px]"
          onClick={() =>
            onChange({
              ...gradient,
              stops: [
                ...gradient.stops,
                { offset: 1, color: gradient.stops[gradient.stops.length - 1]?.color ?? '#493687' },
              ],
            })
          }
        >
          {t('epk_gradient_add_stop')}
        </Button>
      ) : null}
    </div>
  )
}