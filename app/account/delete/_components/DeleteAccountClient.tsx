'use client'

/**
 * app/account/delete/_components/DeleteAccountClient.tsx
 *
 * Multi-step confirmation UI for account deletion.
 * Step 1: Explain what will happen
 * Step 2: Require "I understand" checkbox + confirm button
 * Step 3: Call DELETE /api/account and sign out
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WarningCircle, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

interface Props {
  email: string
}

export function DeleteAccountClient({ email }: Props) {
  const router = useRouter()
  const [understood, setUnderstood] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!understood) return
    setIsDeleting(true)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? 'Deletion failed')
      }
      toast.success('Your account has been scheduled for deletion. Signing you out…')
      // Sign out from Supabase session
      const supabase = createBrowserSupabaseClient()
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deletion failed')
      setIsDeleting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <WarningCircle size={22} aria-hidden="true" />
            Delete Account
          </CardTitle>
          <CardDescription>
            You are about to delete the account for <strong>{email}</strong>.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Deleting your account will:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Anonymise your personal information</li>
            <li>Prevent you from signing in immediately</li>
            <li>Schedule permanent removal after a 7-day grace period</li>
            <li>Retain audit records with your identity anonymised</li>
          </ul>

          <Separator />

          <div className="flex items-start gap-3 pt-1">
            <Checkbox
              id="understood"
              checked={understood}
              onCheckedChange={(v) => setUnderstood(v === true)}
              aria-describedby="understood-desc"
            />
            <div>
              <Label htmlFor="understood" className="text-sm font-medium cursor-pointer">
                I understand this is permanent
              </Label>
              <p id="understood-desc" className="text-xs text-muted-foreground mt-0.5">
                This action cannot be undone. All your data will be anonymised and your
                account will be permanently deleted.
              </p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between gap-3">
          <Button variant="outline" onClick={() => router.back()} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!understood || isDeleting}
            className="gap-2"
          >
            <Trash size={15} aria-hidden="true" />
            {isDeleting ? 'Deleting…' : 'Delete My Account'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
