'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePortalPassword } from '../_actions/updatePassword'

interface SettingsPanelProps {
  email: string
}

export function SettingsPanel({ email }: SettingsPanelProps) {
  const t = useTranslations('portal')
  const locale = useLocale()

  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updating, setUpdating] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 8) {
      toast.error(t('settings_password_too_short'))
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('settings_password_mismatch'))
      return
    }

    setUpdating(true)
    try {
      await updatePortalPassword({ newPassword, confirmPassword })
      setNewPassword('')
      setConfirmPassword('')
      toast.success(t('settings_password_success'))
    } catch {
      toast.error(t('settings_password_error'))
    } finally {
      setUpdating(false)
    }
  }

  const switchLocale = () => {
    const next = locale === 'de' ? 'en' : 'de'
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('settings_heading')}</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t('settings_email')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input readOnly value={email} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t('settings_password_heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('settings_password_new')}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('settings_password_confirm')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={updating}>
              {updating ? t('settings_password_saving') : t('settings_password_save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t('settings_language')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('settings_language_current')}: {locale === 'de' ? 'Deutsch' : 'English'}
          </p>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={switchLocale}>
            {t('settings_language_switch_to')} {locale === 'de' ? 'English' : 'Deutsch'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
