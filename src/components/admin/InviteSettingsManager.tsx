'use client'

import { useTranslations } from 'next-intl'
/**
 * Admin System → Invites: configure durable invite link validity (24h–7d).
 */

import { useCallback, useEffect, useState } from 'react'
import { FloppyDisk, EnvelopeSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import {
  INVITE_LINK_EXPIRY_HOURS_DEFAULT,
  INVITE_LINK_EXPIRY_PRESETS,
  normalizeInviteLinkExpiryHours,
} from '@/lib/auth/inviteLinkExpiry'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

export function InviteSettingsManager() {
  const tToast = useTranslations('admin.toast')


  const { settings, isLoading, saveSettings } = useSiteSettings()
  const [hours, setHours] = useState(INVITE_LINK_EXPIRY_HOURS_DEFAULT)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setHours(normalizeInviteLinkExpiryHours(settings.inviteLinkExpiryHours))
    }
  }, [isLoading, settings.inviteLinkExpiryHours])

  const dirty = normalizeInviteLinkExpiryHours(settings.inviteLinkExpiryHours) !== hours

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const next = normalizeInviteLinkExpiryHours(hours)
      await saveSettings({
        ...settings,
        inviteLinkExpiryHours: next,
      })
      setHours(next)
      toast.success(tToast('invite_validity_saved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save invite settings')
    } finally {
      setSaving(false)
    }
  }, [hours, saveSettings, settings])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full max-w-md mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-64" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <EnvelopeSimple size={20} aria-hidden="true" />
          Invite links
        </CardTitle>
        <CardDescription>
          How long invitation links stay valid after they are sent. Minimum 24 hours, maximum
          7 days. Default is 7 days. The invite email always shows the exact expiry time (UTC).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-w-sm">
          <Label htmlFor="invite-expiry-hours">Link validity</Label>
          <Select
            value={String(hours)}
            onValueChange={(v) => setHours(normalizeInviteLinkExpiryHours(v))}
          >
            <SelectTrigger id="invite-expiry-hours" aria-label="Invite link validity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITE_LINK_EXPIRY_PRESETS.map((preset) => (
                <SelectItem key={preset.hours} value={String(preset.hours)}>
                  {preset.label}
                  {preset.hours === INVITE_LINK_EXPIRY_HOURS_DEFAULT ? ' (default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground max-w-xl">
          Changing this only affects new invites and resends. Links already sent keep their
          original expiry.
        </p>
        <Button
          onClick={() => void handleSave()}
          disabled={!dirty || saving}
          className="gap-1.5"
        >
          <FloppyDisk size={16} aria-hidden="true" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  )
}
