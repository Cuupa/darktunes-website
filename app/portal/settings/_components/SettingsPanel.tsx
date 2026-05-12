'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary, Locale } from '@/i18n/types'
import { updatePortalPassword } from '../_actions/updatePassword'

interface SettingsPanelProps {
  dict: Dictionary['portal']
  email: string
  locale: Locale
}

export function SettingsPanel({ dict, email, locale }: SettingsPanelProps) {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updating, setUpdating] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 8) {
      toast.error(dict.settings_password_too_short)
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error(dict.settings_password_mismatch)
      return
    }

    setUpdating(true)
    try {
      await updatePortalPassword({ newPassword, confirmPassword })
      setNewPassword('')
      setConfirmPassword('')
      toast.success(dict.settings_password_success)
    } catch {
      toast.error(dict.settings_password_error)
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
      <h1 className="text-3xl font-bold">{dict.settings_heading}</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{dict.settings_email}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input readOnly value={email} />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{dict.settings_password_heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">{dict.settings_password_new}</Label>
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
              <Label htmlFor="confirm-password">{dict.settings_password_confirm}</Label>
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
              {updating ? dict.settings_password_saving : dict.settings_password_save}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{dict.settings_language}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={switchLocale}>
            {locale === 'de' ? 'English' : 'Deutsch'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
