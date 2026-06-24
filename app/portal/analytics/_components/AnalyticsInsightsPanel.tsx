'use client'

import { Lightbulb, TrendDown, TrendUp, Info } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AnalyticsInsight } from '@/lib/analytics/insights'
import type { Dictionary } from '@/i18n/types'
import { cn } from '@/lib/utils'

interface AnalyticsInsightsPanelProps {
  dict: Dictionary['portal']
  insights: AnalyticsInsight[]
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}

function severityIcon(severity: AnalyticsInsight['severity']) {
  switch (severity) {
    case 'positive':
      return TrendUp
    case 'negative':
      return TrendDown
    default:
      return Info
  }
}

function severityClass(severity: AnalyticsInsight['severity']): string {
  switch (severity) {
    case 'positive':
      return 'text-emerald-500'
    case 'negative':
      return 'text-amber-500'
    default:
      return 'text-muted-foreground'
  }
}

export function AnalyticsInsightsPanel({ dict, insights }: AnalyticsInsightsPanelProps) {
  if (insights.length === 0) return null

  const dictRecord = dict as Record<string, string>

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb size={16} className="text-primary" aria-hidden="true" />
          {dict.analytics_insights_heading}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.slice(0, 6).map((insight) => {
          const Icon = severityIcon(insight.severity)
          const title = dictRecord[insight.titleKey] ?? insight.titleKey
          const body = interpolate(dictRecord[insight.bodyKey] ?? insight.bodyKey, insight.values)
          return (
            <div
              key={insight.id}
              className="flex gap-3 rounded-md border border-border/60 bg-background/50 p-3 text-sm"
            >
              <Icon size={18} className={cn('shrink-0 mt-0.5', severityClass(insight.severity))} aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{body}</p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}