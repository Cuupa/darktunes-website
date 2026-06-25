'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { JournalistApplication } from '@/lib/api/journalistApplications'
import { updatePortalPassword } from '../../../../portal/settings/_actions/updatePassword'

interface ProfileClientProps {
  user: { id: string; email: string }
  downloadCount: number
  application: JournalistApplication | null
}

export function ProfileClient({ user, downloadCount, application }: ProfileClientProps) {
  const t = useTranslations('pressProfile')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setSavingPassword(true)
    try {
      await updatePortalPassword({ newPassword, confirmPassword })
      setNewPassword('')
      setConfirmPassword('')
      toast.success(t('saved'))
    } catch {
      toast.error('Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('heading')}</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card/70 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('publication')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label>{t('publication')}</Label>
              <Input value={application?.outlet ?? '—'} readOnly />
            </div>
            <div className="space-y-2">
              <Label>{t('website')}</Label>
              <Input value={application?.message?.split('\n\n')[0] ?? '—'} readOnly />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/70">
          <CardHeader>
            <CardTitle>{t('applicationStatus')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{application?.status ?? 'pending'}</p>
            <p>{t('downloadCount')}: {downloadCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card/70">
        <CardHeader>
          <CardTitle>{t('changePassword')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="press-password-new">{t('newPassword')}</Label>
              <Input id="press-password-new" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="press-password-confirm">{t('confirmPassword')}</Label>
              <Input id="press-password-confirm" type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <div>
              <Button type="submit" disabled={savingPassword}>{savingPassword ? t('saving') : t('savePassword')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}