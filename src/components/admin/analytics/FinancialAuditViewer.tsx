'use client'

import type { FinancialAuditEvent } from '@/lib/api/financialAudit'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface FinancialAuditViewerProps {
  events: FinancialAuditEvent[]
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function FinancialAuditViewer({ events }: FinancialAuditViewerProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No financial audit events recorded yet.
      </p>
    )
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Financial audit trail</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[32rem] overflow-y-auto" data-lenis-prevent>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Time</th>
                <th scope="col" className="px-4 py-3 font-medium">Entity</th>
                <th scope="col" className="px-4 py-3 font-medium">Action</th>
                <th scope="col" className="px-4 py-3 font-medium">Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatTimestamp(event.createdAt)}
                  </td>
                  <td className="px-4 py-3">{event.entityType}</td>
                  <td className="px-4 py-3 font-medium">{event.action}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {event.entityId.slice(0, 8)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}