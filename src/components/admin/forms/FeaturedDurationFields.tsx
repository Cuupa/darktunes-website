'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export type FeaturedDurationMode = 'days' | 'datetime'

export type FeaturedDurationValue = {
  durationEnabled: boolean
  durationMode: FeaturedDurationMode
  durationDays: number
  untilLocal: string
}

type Props = {
  featured: boolean
  value: FeaturedDurationValue
  onChange: (value: FeaturedDurationValue) => void
  disabled?: boolean
}

export function FeaturedDurationFields({ featured, value, onChange, disabled }: Props) {
  if (!featured) return null

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-semibold text-foreground">Hero feature duration</p>
      <p className="text-xs text-muted-foreground -mt-2">
        Optional. Without a duration, this item stays in the hero until 10 newer featured items exist.
      </p>

      <div className="flex items-center gap-2">
        <Switch
          id="featured-duration-enabled"
          checked={value.durationEnabled}
          onCheckedChange={(checked) => onChange({ ...value, durationEnabled: checked })}
          disabled={disabled}
        />
        <Label htmlFor="featured-duration-enabled">Set a feature duration</Label>
      </div>

      {value.durationEnabled && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="featured-duration-mode"
                checked={value.durationMode === 'days'}
                onChange={() => onChange({ ...value, durationMode: 'days' })}
                disabled={disabled}
              />
              Days from now
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="featured-duration-mode"
                checked={value.durationMode === 'datetime'}
                onChange={() => onChange({ ...value, durationMode: 'datetime' })}
                disabled={disabled}
              />
              End date & time
            </label>
          </div>

          {value.durationMode === 'days' ? (
            <div className="space-y-1 max-w-xs">
              <Label htmlFor="featured-duration-days">Days</Label>
              <Input
                id="featured-duration-days"
                type="number"
                min={1}
                value={value.durationDays || ''}
                onChange={(event) =>
                  onChange({
                    ...value,
                    durationDays: Number.parseInt(event.target.value, 10) || 0,
                  })
                }
                disabled={disabled}
              />
            </div>
          ) : (
            <div className="space-y-1 max-w-sm">
              <Label htmlFor="featured-until-local">Ends at</Label>
              <Input
                id="featured-until-local"
                type="datetime-local"
                value={value.untilLocal}
                onChange={(event) => onChange({ ...value, untilLocal: event.target.value })}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}