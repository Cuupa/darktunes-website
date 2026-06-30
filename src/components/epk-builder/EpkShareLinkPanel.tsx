'use client'

/**
 * src/components/epk-builder/EpkShareLinkPanel.tsx
 *
 * Create and manage tokenized public EPK share links.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, Link as LinkIcon, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { EpkShareLink } from '@/lib/api/epkShareLinks'

interface EpkShareLinkPanelProps {
  open: boolean
  onClose: () => void
  artistId: string
}

export function EpkShareLinkPanel({ open, onClose, artistId }: EpkShareLinkPanelProps) {
  const t = useTranslations('portal')
  const [links, setLinks] = useState<EpkShareLink[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')
  const [password, setPassword] = useState('')
  const [expiryPreset, setExpiryPreset] = useState<'never' | '7' | '30' | '90' | 'custom'>('never')
  const [customExpiryDate, setCustomExpiryDate] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const computeExpiresAt = (): string | undefined => {
    if (expiryPreset === 'never') return undefined
    if (expiryPreset === 'custom' && customExpiryDate) {
      return new Date(`${customExpiryDate}T23:59:59.000Z`).toISOString()
    }
    const days = Number(expiryPreset)
    if (Number.isFinite(days) && days > 0) {
      return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString()
    }
    return undefined
  }

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch(`/api/portal/epk/share?artist_id=${artistId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('fetch failed')
      const data = (await res.json()) as { links: EpkShareLink[] }
      setLinks(data.links)
    } catch {
      toast.error(t('epk_share_load_error'))
    } finally {
      setLoading(false)
    }
  }, [artistId, t])

  useEffect(() => {
    if (open) void fetchLinks()
  }, [open, fetchLinks])

  const handleCreate = async () => {
    if (expiryPreset === 'custom' && !customExpiryDate) {
      toast.error(t('epk_share_expiry_date_required'))
      return
    }

    setCreating(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(t('epk_builder_export_auth_error'))
        return
      }

      const res = await fetch('/api/portal/epk/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artist_id: artistId,
          label: label.trim() || undefined,
          password: password.trim() || undefined,
          expires_at: computeExpiresAt(),
        }),
      })

      if (!res.ok) throw new Error('create failed')
      const data = (await res.json()) as { link: EpkShareLink }
      setLinks((prev) => [data.link, ...prev])
      setLabel('')
      setPassword('')
      setExpiryPreset('never')
      setCustomExpiryDate('')
      toast.success(t('epk_share_create_success'))
    } catch {
      toast.error(t('epk_share_create_error'))
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (linkId: string) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch(`/api/portal/epk/share?id=${linkId}&artist_id=${artistId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('revoke failed')
      setLinks((prev) => prev.filter((l) => l.id !== linkId))
      toast.success(t('epk_share_revoke_success'))
    } catch {
      toast.error(t('epk_share_revoke_error'))
    }
  }

  const copyShareUrl = async (token: string, linkId: string) => {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin
    const url = `${base}/epk/share/${token}`
    await navigator.clipboard.writeText(url)
    setCopiedId(linkId)
    toast.success(t('epk_share_copied'))
    window.setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0"
        aria-labelledby="epk-share-title"
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle id="epk-share-title">{t('epk_share_title')}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto overscroll-contain max-h-[70vh] p-6 space-y-6" data-lenis-prevent>
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">{t('epk_share_description')}</p>
            <div className="space-y-2">
              <Label htmlFor="epk-share-label">{t('epk_share_label_field')}</Label>
              <Input
                id="epk-share-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('epk_share_label_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="epk-share-password">{t('epk_share_password_field')}</Label>
              <Input
                id="epk-share-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('epk_share_password_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="epk-share-expiry">{t('epk_share_expiry_field')}</Label>
              <Select
                value={expiryPreset}
                onValueChange={(value) =>
                  setExpiryPreset(value as 'never' | '7' | '30' | '90' | 'custom')
                }
              >
                <SelectTrigger id="epk-share-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">{t('epk_share_expiry_never')}</SelectItem>
                  <SelectItem value="7">{t('epk_share_expiry_7_days')}</SelectItem>
                  <SelectItem value="30">{t('epk_share_expiry_30_days')}</SelectItem>
                  <SelectItem value="90">{t('epk_share_expiry_90_days')}</SelectItem>
                  <SelectItem value="custom">{t('epk_share_expiry_custom')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {expiryPreset === 'custom' ? (
              <div className="space-y-2">
                <Label htmlFor="epk-share-expiry-date">{t('epk_share_expiry_date')}</Label>
                <Input
                  id="epk-share-expiry-date"
                  type="date"
                  value={customExpiryDate}
                  onChange={(e) => setCustomExpiryDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
            ) : null}
            <Button
              type="button"
              className="min-h-[44px]"
              disabled={creating || (expiryPreset === 'custom' && !customExpiryDate)}
              onClick={() => void handleCreate()}
            >
              <LinkIcon size={18} className="mr-2" aria-hidden="true" />
              {creating ? t('epk_share_creating') : t('epk_share_create')}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t('epk_share_loading')}</p>
          ) : links.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('epk_share_empty')}</p>
          ) : (
            <ul className="space-y-3">
              {links.map((link) => (
                <li
                  key={link.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{link.label ?? t('epk_share_untitled')}</p>
                    <p className="text-xs text-muted-foreground">
                      {link.hasPassword ? t('epk_share_protected') : t('epk_share_public')}
                      {link.expiresAt ? ` · ${t('epk_share_expires')} ${new Date(link.expiresAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => void copyShareUrl(link.token, link.id)}
                    >
                      {copiedId === link.id ? (
                        <Check size={16} className="mr-2" aria-hidden="true" />
                      ) : (
                        <Copy size={16} className="mr-2" aria-hidden="true" />
                      )}
                      {t('epk_share_copy')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] min-w-[44px]"
                      aria-label={t('epk_share_revoke')}
                      onClick={() => void handleRevoke(link.id)}
                    >
                      <Trash size={16} aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}