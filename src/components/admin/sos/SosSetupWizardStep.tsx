'use client'

import { useMemo } from 'react'
import { Buildings, CalendarBlank, Percent } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { MonthField } from '@/components/ui/month-field'
import type { AppDefaults, LabelInfo } from '@/lib/sos/types'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'
import { isValidPeriodRange } from '@/lib/sos/accountingInputValidation'
import { PercentField } from '@/components/admin/sos/fields/AccountingNumberFields'
import { LabelIdentityManager } from '@/components/admin/sos/LabelIdentityManager'
import { DEFAULT_LABEL_INFO } from '@/lib/sos/defaults'

interface SosSetupWizardStepProps {
  periodStart: string
  periodEnd: string
  onPeriodStartChange: (value: string) => void
  onPeriodEndChange: (value: string) => void
  appDefaults: AppDefaults
  onAppDefaultsChange: (value: AppDefaults) => void
  labelInfo: LabelInfo
  onLabelInfoChange: (value: LabelInfo) => void
  onLoadPreset?: () => void
  presetLoading?: boolean
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-primary/10 text-primary">
        <Icon size={18} weight="bold" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

export function SosSetupWizardStep({
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
  appDefaults,
  onAppDefaultsChange,
  labelInfo,
  onLabelInfoChange,
  onLoadPreset,
  presetLoading = false,
}: SosSetupWizardStepProps) {
  const t = useAccountingLabels()

  const periodError = useMemo(() => {
    if (!periodStart && !periodEnd) return undefined
    if (!periodStart || !periodEnd) return t.validationPeriodRequired
    if (!isValidPeriodRange(periodStart, periodEnd)) return t.setupPeriodOrderError
    return undefined
  }, [periodStart, periodEnd, t.validationPeriodRequired, t.setupPeriodOrderError])

  const handlePeriodStart = (value: string) => {
    onPeriodStartChange(value)
    if (!periodEnd || !isValidPeriodRange(value, periodEnd)) {
      onPeriodEndChange(value)
    }
  }

  const percentMessages = {
    out_of_range: t.validationPercentRange,
    invalid: t.validationFieldInvalidNumber,
    required: t.validationFieldRequired,
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold mb-1">{t.setupTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.setupSubtitle}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <SectionHeading
            icon={CalendarBlank}
            title={t.setupPeriodTitle}
            description={t.setupPeriodDesc}
          />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <MonthField
            id="sos-setup-period-start"
            label={t.setupPeriodFrom}
            value={periodStart}
            onChange={handlePeriodStart}
            description={t.setupPeriodFromDesc}
            required
            max={periodEnd || undefined}
          />
          <MonthField
            id="sos-setup-period-end"
            label={t.setupPeriodTo}
            value={periodEnd}
            onChange={onPeriodEndChange}
            description={t.setupPeriodToDesc}
            required
            min={periodStart || undefined}
            error={periodError}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionHeading
            icon={Percent}
            title={t.setupFeesTitle}
            description={t.setupFeesDesc}
          />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <PercentField
            id="sos-setup-split"
            label={t.setupDefaultSplit}
            value={appDefaults.defaultSplitPercentage}
            onChange={(v) =>
              onAppDefaultsChange({
                ...appDefaults,
                defaultSplitPercentage: v ?? 0,
              })
            }
            messages={percentMessages}
          />
          <PercentField
            id="sos-setup-fee-digital"
            label={t.setupDigitalFee}
            value={appDefaults.distributionFeeDigital ?? appDefaults.distributionFeePercentage}
            onChange={(v) =>
              onAppDefaultsChange({
                ...appDefaults,
                distributionFeeDigital: v,
              })
            }
            messages={percentMessages}
          />
          <PercentField
            id="sos-setup-fee-physical"
            label={t.setupPhysicalFee}
            value={appDefaults.distributionFeePhysical ?? appDefaults.distributionFeePercentage}
            onChange={(v) =>
              onAppDefaultsChange({
                ...appDefaults,
                distributionFeePhysical: v,
              })
            }
            messages={percentMessages}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionHeading
            icon={Buildings}
            title={t.setupLabelTitle}
            description={t.setupLabelDesc}
          />
        </CardHeader>
        <CardContent>
          <LabelIdentityManager
            labelInfo={labelInfo}
            onUpdate={(next) => onLabelInfoChange({ ...DEFAULT_LABEL_INFO, ...next })}
          />
        </CardContent>
      </Card>

      {onLoadPreset && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={presetLoading} onClick={onLoadPreset}>
            {presetLoading ? t.setupLoadingPreset : t.setupLoadPreset}
          </Button>
          <CardDescription className="text-xs m-0">{t.setupLoadPresetHint}</CardDescription>
        </div>
      )}
    </div>
  )
}
