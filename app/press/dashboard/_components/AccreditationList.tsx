import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AccreditationRequest } from '@/types'

interface AccreditationListProps {
  entries: AccreditationRequest[]
  title: string
  emptyLabel: string
}

export function AccreditationList({ entries, title, emptyLabel }: AccreditationListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border p-3">
              <p className="font-medium">{entry.eventName}</p>
              <p className="text-xs text-muted-foreground">
                {entry.publication} · {entry.eventDate} · {entry.status}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
