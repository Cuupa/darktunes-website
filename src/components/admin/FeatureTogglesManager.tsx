'use client'

/**
 * src/components/admin/FeatureTogglesManager.tsx
 *
 * Admin UI for global site feature toggles (site_settings.feature_toggles).
 */

import { useTranslations } from 'next-intl'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { MusicNote, Newspaper, Info } from '@phosphor-icons/react'
import type { FeatureToggles } from '@/types'

interface FeatureToggleRowProps {
  id: string
  icon: React.ReactNode
  label: string
  description: string
  affectedRole: string
  checked: boolean
  disabledLabel: string
  toggleAria: string
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

function FeatureToggleRow({
  id,
  icon,
  label,
  description,
  affectedRole,
  checked,
  disabledLabel,
  toggleAria,
  onCheckedChange,
  disabled = false,
}: FeatureToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
              {label}
            </Label>
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {affectedRole}
            </Badge>
            {!checked && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {disabledLabel}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={toggleAria}
      />
    </div>
  )
}

interface FeatureTogglesManagerProps {
  value: FeatureToggles
  onChange: (updated: FeatureToggles) => void
  isLoading?: boolean
}

export function FeatureTogglesManager({ value, onChange, isLoading = false }: FeatureTogglesManagerProps) {
  const t = useTranslations('admin.features')

  const handleChange = (key: keyof FeatureToggles, checked: boolean) => {
    onChange({ ...value, [key]: checked })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 text-sm text-muted-foreground mb-4">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{t('globalHint')}</span>
      </div>

      <div className="rounded-lg border border-border divide-y divide-border">
        <div className="px-4">
          <FeatureToggleRow
            id="toggle-promo-pool"
            icon={<MusicNote size={18} aria-hidden="true" />}
            label={t('globalToggles.promoPool.label')}
            description={t('globalToggles.promoPool.description')}
            affectedRole={t('globalToggles.promoPool.role')}
            checked={value.promoPool}
            disabledLabel={t('disabledBadge')}
            toggleAria={t('toggleAria', { label: t('globalToggles.promoPool.label') })}
            onCheckedChange={(checked) => handleChange('promoPool', checked)}
            disabled={isLoading}
          />
        </div>

        <Separator />

        <div className="px-4">
          <FeatureToggleRow
            id="toggle-editor-tools"
            icon={<Newspaper size={18} aria-hidden="true" />}
            label={t('globalToggles.editorTools.label')}
            description={t('globalToggles.editorTools.description')}
            affectedRole={t('globalToggles.editorTools.role')}
            checked={value.editorTools}
            disabledLabel={t('disabledBadge')}
            toggleAria={t('toggleAria', { label: t('globalToggles.editorTools.label') })}
            onCheckedChange={(checked) => handleChange('editorTools', checked)}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  )
}