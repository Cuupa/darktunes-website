'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getFeatureFlags } from '@/lib/api/featureFlags'
import { useTranslations } from 'next-intl'
import { getErrorMessage } from '@/lib/clientErrors'
import type { ApiErrorResponse } from '@/lib/errors'
import type { PortalFeatureFlag } from '@/types'

export function FeatureFlagsManager() {
  const tErrors = useTranslations('errors')
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [flags, setFlags] = useState<PortalFeatureFlag[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    void getFeatureFlags(supabase)
      .then(setFlags)
      .catch(() => toast.error(tErrors('SERVER_ERROR')))
  }, [supabase, tErrors])

  const toggleFlag = async (flag: PortalFeatureFlag, enabled: boolean) => {
    setLoadingId(flag.id)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(tErrors('AUTH_REQUIRED'))

      const res = await fetch(`/api/admin/feature-flags/${flag.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ enabled }),
      })

      if (!res.ok) {
        const body = (await res.json()) as ApiErrorResponse
        throw new Error(getErrorMessage(body, tErrors))
      }

      setFlags((prev) => prev.map((item) => (item.id === flag.id ? { ...item, enabled } : item)))
      toast.success(`Updated ${flag.label}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="rounded-lg border border-border divide-y divide-border">
      {flags.map((flag) => (
        <div key={flag.id} className="p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium">{flag.label}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <code>{flag.id}</code>
              <Badge variant="outline">{flag.targetRole}</Badge>
            </div>
          </div>
          <Switch
            checked={flag.enabled}
            onCheckedChange={(checked) => void toggleFlag(flag, checked)}
            disabled={loadingId === flag.id}
            aria-label={`Toggle ${flag.label}`}
          />
        </div>
      ))}
      {flags.length === 0 && (
        <div className="p-4 text-sm text-muted-foreground">No feature flags found.</div>
      )}
    </div>
  )
}