'use client'

/**
 * src/components/admin/FeatureTogglesManager.tsx
 *
 * Admin UI for enabling or disabling portal feature modules.
 * Follows AdminPanelProps<FeatureToggles> contract (IoC: receives value + onChange).
 *
 * Features:
 *  - Toggle Promo Pool (journalist access)
 *  - Toggle Statement of Sales (artist royalty PDFs)
 *  - Toggle Editor Tools (editor CMS access)
 */

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  MusicNote,
  Newspaper,
  FileText,
  Info,
} from '@phosphor-icons/react'
import type { FeatureToggles } from '@/types'

interface FeatureToggleRowProps {
  id: string
  icon: React.ReactNode
  label: string
  description: string
  affectedRole: string
  checked: boolean
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
                Disabled
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
        aria-label={`Toggle ${label}`}
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
  const handleChange = (key: keyof FeatureToggles, checked: boolean) => {
    onChange({ ...value, [key]: checked })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Info size={14} aria-hidden="true" />
        <span>
          Disabling a feature hides it from the respective dashboard and secures the underlying routes.
          Changes take effect immediately on the next page load.
        </span>
      </div>

      <div className="rounded-lg border border-border divide-y divide-border">
        <div className="px-4">
          <FeatureToggleRow
            id="toggle-promo-pool"
            icon={<MusicNote size={18} aria-hidden="true" />}
            label="Promo Pool"
            description="Gives verified journalists access to unreleased music and press kits at /promo-pool."
            affectedRole="journalist"
            checked={value.promoPool}
            onCheckedChange={(checked) => handleChange('promoPool', checked)}
            disabled={isLoading}
          />
        </div>

        <Separator />

        <div className="px-4">
          <FeatureToggleRow
            id="toggle-sos-statements"
            icon={<FileText size={18} aria-hidden="true" />}
            label="Statement of Sales"
            description="Artists can securely download their royalty statement PDFs in the Artist Portal."
            affectedRole="artist"
            checked={value.sosStatements}
            onCheckedChange={(checked) => handleChange('sosStatements', checked)}
            disabled={isLoading}
          />
        </div>

        <Separator />

        <div className="px-4">
          <FeatureToggleRow
            id="toggle-editor-tools"
            icon={<Newspaper size={18} aria-hidden="true" />}
            label="Editor Tools"
            description="Editors can access the restricted CMS to manage news, artists, and releases."
            affectedRole="editor"
            checked={value.editorTools}
            onCheckedChange={(checked) => handleChange('editorTools', checked)}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  )
}
