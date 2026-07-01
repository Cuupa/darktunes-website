'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { AppDefaults, LabelInfo } from '@/lib/sos/types'

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
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold mb-1">Abrechnung einrichten</h2>
        <p className="text-sm text-muted-foreground">
          Tragen Sie die wichtigsten Parameter ein. Erweiterte Regeln finden Sie im Advanced-Modus.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sos-setup-period-start">Zeitraum von (YYYY-MM)</Label>
          <Input
            id="sos-setup-period-start"
            type="month"
            value={periodStart}
            onChange={(e) => onPeriodStartChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sos-setup-period-end">Zeitraum bis (YYYY-MM)</Label>
          <Input
            id="sos-setup-period-end"
            type="month"
            value={periodEnd}
            onChange={(e) => onPeriodEndChange(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="sos-setup-split">Standard-Split %</Label>
          <Input
            id="sos-setup-split"
            type="number"
            min={0}
            max={100}
            value={appDefaults.defaultSplitPercentage}
            onChange={(e) =>
              onAppDefaultsChange({
                ...appDefaults,
                defaultSplitPercentage: Number(e.target.value),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sos-setup-fee-digital">Vertriebsgebühr Digital %</Label>
          <Input
            id="sos-setup-fee-digital"
            type="number"
            min={0}
            max={100}
            value={appDefaults.distributionFeeDigital ?? appDefaults.distributionFeePercentage}
            onChange={(e) =>
              onAppDefaultsChange({
                ...appDefaults,
                distributionFeeDigital: Number(e.target.value),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sos-setup-fee-physical">Vertriebsgebühr Physical %</Label>
          <Input
            id="sos-setup-fee-physical"
            type="number"
            min={0}
            max={100}
            value={appDefaults.distributionFeePhysical ?? appDefaults.distributionFeePercentage}
            onChange={(e) =>
              onAppDefaultsChange({
                ...appDefaults,
                distributionFeePhysical: Number(e.target.value),
              })
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sos-setup-label-name">Label-Name (PDF)</Label>
          <Input
            id="sos-setup-label-name"
            value={labelInfo.name}
            onChange={(e) => onLabelInfoChange({ ...labelInfo, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sos-setup-label-address">Label-Adresse (PDF)</Label>
          <Input
            id="sos-setup-label-address"
            value={labelInfo.address}
            onChange={(e) => onLabelInfoChange({ ...labelInfo, address: e.target.value })}
          />
        </div>
      </div>

      {onLoadPreset && (
        <Button type="button" variant="outline" size="sm" disabled={presetLoading} onClick={onLoadPreset}>
          {presetLoading ? 'Preset wird geladen…' : 'Gespeichertes Preset laden'}
        </Button>
      )}
    </div>
  )
}