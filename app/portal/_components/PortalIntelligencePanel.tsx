'use client'

import Link from 'next/link'
import { Lightbulb, TrendDown, TrendUp, Info, ArrowRight } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { OverviewInsight } from '@/lib/analytics/overviewInsights'
import type { Dictionary } from '@/i18n/types'
import { cn } from '@/lib/utils'

interface PortalIntelligencePanelProps {
  dict: Dictionary['portal']
  insights: OverviewInsight[]
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`))
}

function severityIcon(severity: OverviewInsight['severity']) {
  switch (severity) {
    case 'positive':
      return TrendUp
    case 'negative':
      return TrendDown
    default:
      return Info
  }
}

function severityClass(severity: OverviewInsight['severity']): string {
  switch (severity) {
    case 'positive':
      return 'text-emerald-500'
    case 'negative':
      return 'text-amber-500'
    default:
      return 'text-muted-foreground'
  }
}

export function PortalIntelligencePanel({ dict, insights }: PortalIntelligencePanelProps) {
  if (insights.length === 0) return null

  const dictRecord = dict as Record<string, string>

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb size={16} className="text-primary" aria-hidden="true" />
          {dict.overview_intelligence_heading}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{dict.overview_intelligence_subheading}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight) => {
          const Icon = severityIcon(insight.severity)
          const title = dictRecord[insight.titleKey] ?? insight.titleKey
          const body = interpolate(dictRecord[insight.bodyKey] ?? insight.bodyKey, insight.values)
          const content = (
            <div className="flex gap-3 rounded-lg border border-border/60 bg-background/50 p-3">
              <Icon
                size={18}
                className={cn('shrink-0 mt-0.5', severityClass(insight.severity))}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
              </div>
              {insight.href && (
                <ArrowRight size={14} className="shrink-0 text-muted-foreground self-center" aria-hidden="true" />
              )}
            </div>
          )

          if (insight.href) {
            return (
              <Link key={insight.id} href={insight.href} className="block hover:opacity-90 transition-opacity">
                {content}
              </Link>
            )
          }

          return <div key={insight.id}>{content}</div>
        })}
      </CardContent>
    </Card>
  )
}