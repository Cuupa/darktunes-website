'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Dictionary } from '@/i18n/types'
import type { JournalistApplication } from '@/lib/api/journalistApplications'
import { updatePortalPassword } from '../../../../portal/settings/_actions/updatePassword'

interface ProfileClientProps {
  dict: Dictionary['pressProfile']
  user: { id: string; email: string }
  downloadCount: number
  application: JournalistApplication | null
}

export function ProfileClient({ dict, user, downloadCount, application }: ProfileClientProps) {
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
      toast.success(dict.saved)
    } catch {
      toast.error('Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{dict.heading}</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card/70 lg:col-span-2">
          <CardHeader>
            <CardTitle>{dict.publication}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label>{dict.publication}</Label>
              <Input value={application?.outlet ?? '—'} readOnly />
            </div>
            <div className="space-y-2">
              <Label>{dict.website}</Label>
              <Input value={application?.message?.split('\n\n')[0] ?? '—'} readOnly />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/70">
          <CardHeader>
            <CardTitle>{dict.applicationStatus}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{application?.status ?? 'pending'}</p>
            <p>{dict.downloadCount}: {downloadCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card/70">
        <CardHeader>
          <CardTitle>{dict.changePassword}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="press-password-new">{dict.newPassword}</Label>
              <Input id="press-password-new" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="press-password-confirm">{dict.confirmPassword}</Label>
              <Input id="press-password-confirm" type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <div>
              <Button type="submit" disabled={savingPassword}>{savingPassword ? dict.saving : dict.savePassword}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
