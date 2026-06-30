'use client'

import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useFanPageEditorStore } from '@/lib/fan-page/editor/FanPageEditorProvider'
import { FAN_PAGE_PALETTES } from '@/lib/fan-page/templates/palettes'
import { checkContrast } from '@/lib/fan-page/a11y/contrastCheck'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import { cn } from '@/lib/utils'

export function FanPageThemePanel() {
  const t = useTranslations('portal')
  const document = useFanPageEditorStore((s) => s.document)
  const applyThemePalette = useFanPageEditorStore((s) => s.applyThemePalette)
  const setThemeCustomColor = useFanPageEditorStore((s) => s.setThemeCustomColor)
  const setDocument = useFanPageEditorStore((s) => s.setDocument)

  const colors = resolveThemeColors(document.theme)
  const contrast = checkContrast(colors.text, colors.background)

  return (
    <div className="rounded-lg border border-border bg-card" data-lenis-prevent>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('fanPage_theme_title')}</h2>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          {FAN_PAGE_PALETTES.map((palette) => (
            <button
              key={palette.id}
              type="button"
              className={cn(
                'rounded-md border p-2 text-left text-xs transition',
                document.theme.paletteId === palette.id
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-border hover:border-muted-foreground',
              )}
              onClick={() => applyThemePalette(palette.id)}
            >
              <div className="mb-1 font-medium">{palette.name}</div>
              <div className="flex gap-1">
                {[palette.background, palette.primary, palette.accent].map((c) => (
                  <span
                    key={c}
                    className="h-4 w-4 rounded-sm border border-white/20"
                    style={{ backgroundColor: c }}
                    aria-hidden
                  />
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {(['primary', 'accent', 'background'] as const).map((key) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`fp-color-${key}`}>{t(`fanPage_color_${key}`)}</Label>
              <div className="flex items-center gap-2">
                <input
                  id={`fp-color-${key}`}
                  type="color"
                  value={colors[key]}
                  onChange={(e) => setThemeCustomColor(key, e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                />
                <span className="font-mono text-xs text-muted-foreground">{colors[key]}</span>
              </div>
            </div>
          ))}
        </div>

        {contrast ? (
          <p
            className={cn(
              'rounded-md px-3 py-2 text-xs',
              contrast.level === 'fail'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            )}
          >
            {contrast.level === 'fail'
              ? t('fanPage_contrast_fail').replace('{ratio}', contrast.ratio.toFixed(1))
              : t('fanPage_contrast_pass').replace('{ratio}', contrast.ratio.toFixed(1))}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="fp-crt">{t('fanPage_crt_scanlines')}</Label>
          <Switch
            id="fp-crt"
            checked={document.theme.crtScanlines ?? false}
            onCheckedChange={(checked) =>
              setDocument({
                ...document,
                theme: { ...document.theme, crtScanlines: checked },
              })
            }
          />
        </div>
      </div>
    </div>
  )
}