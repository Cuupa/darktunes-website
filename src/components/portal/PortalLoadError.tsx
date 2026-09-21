'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function PortalLoadError({
  message,
  retryLabel,
}: {
  message: string
  retryLabel: string
}) {
  const router = useRouter()

  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <p className="text-sm text-destructive">{message}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}>
        {retryLabel}
      </Button>
    </div>
  )
}
