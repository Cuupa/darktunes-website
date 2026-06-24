'use client'

import { FilePdf, type Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { PdfExportSettings } from '@/lib/sos/types'

interface PdfExportSettingsProps {
  settings: PdfExportSettings
  onUpdate: (next: PdfExportSettings) => void
}

interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function ToggleRow({ id, label, description, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 rounded-xl bg-muted/20 border border-border/40">
      <div className="space-y-0.5 flex-1 min-w-0">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function SectionHeading({ icon: Icon, title }: { icon: PhosphorIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-border/40">
      <Icon size={15} weight="bold" className="text-primary shrink-0" />
      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h4>
    </div>
  )
}

export function PdfExportSettingsPanel({ settings, onUpdate }: PdfExportSettingsProps) {
  const patch = (partial: Partial<PdfExportSettings>) => onUpdate({ ...settings, ...partial })

  return (
    <div className="space-y-4 p-8">
      <div className="flex items-center gap-2">
        <FilePdf size={20} weight="bold" className="text-primary" />
        <h3 className="font-semibold">PDF export modules</h3>
      </div>

      <Card className="p-6 space-y-8">
        <div className="space-y-3">
          <SectionHeading icon={FilePdf} title="Statement PDF content" />
          <p className="text-xs text-muted-foreground">
            Choose which sections to include in exported PDFs.
            Required fields (summary, artist info) are always included.
          </p>

          <div className="space-y-2">
            <ToggleRow
              id="pdf-releases"
              label="Release breakdown"
              description="Table of all releases with revenue and quantity per album or single."
              checked={settings.includeReleaseBreakdown}
              onCheckedChange={v => patch({ includeReleaseBreakdown: v })}
            />
            <ToggleRow
              id="pdf-hide-compilations"
              label="Hide compilations"
              description="Hides sampler releases in the statement release breakdown."
              checked={settings.hideCompilationsInStatement ?? true}
              onCheckedChange={v => patch({ hideCompilationsInStatement: v })}
            />
            <ToggleRow
              id="pdf-platforms"
              label="Platform breakdown"
              description="Revenue per streaming service (Spotify, Apple Music, etc.)."
              checked={settings.includePlatformBreakdown}
              onCheckedChange={v => patch({ includePlatformBreakdown: v })}
            />
            <ToggleRow
              id="pdf-countries"
              label="Country breakdown"
              description="Revenue by country or territory."
              checked={settings.includeCountryBreakdown}
              onCheckedChange={v => patch({ includeCountryBreakdown: v })}
            />
            {settings.includeCountryBreakdown && (
              <div className="ml-4 flex items-center gap-3 py-2 px-4 rounded-xl bg-muted/10 border border-border/30">
                <Label htmlFor="pdf-top-countries" className="text-xs text-muted-foreground whitespace-nowrap">
                  Max countries shown
                </Label>
                <Input
                  id="pdf-top-countries"
                  type="number"
                  min={1}
                  max={200}
                  step={1}
                  value={settings.topCountriesCount ?? 15}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10)
                    if (!Number.isNaN(val) && val >= 1 && val <= 200) patch({ topCountriesCount: val })
                  }}
                  className="w-20 h-7 text-xs"
                />
                <span className="text-xs text-muted-foreground">(default: 15)</span>
              </div>
            )}
            <ToggleRow
              id="pdf-monthly"
              label="Monthly trend"
              description="Month-by-month streaming revenue within the statement period."
              checked={settings.includeMonthlyBreakdown}
              onCheckedChange={v => patch({ includeMonthlyBreakdown: v })}
            />
            <ToggleRow
              id="pdf-cover"
              label="Email cover letter as first page"
              description="Prepends the filled email template as a cover page on the PDF."
              checked={settings.includeEmailCoverLetter}
              onCheckedChange={v => patch({ includeEmailCoverLetter: v })}
            />
            <ToggleRow
              id="pdf-pie-chart"
              label="Revenue pie chart"
              description="Adds a pie chart showing the share of each revenue category."
              checked={settings.includePieChart ?? true}
              onCheckedChange={v => patch({ includePieChart: v })}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}