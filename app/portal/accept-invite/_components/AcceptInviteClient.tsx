'use client'

import { useTranslations } from 'next-intl'
/**
 * app/portal/accept-invite/_components/AcceptInviteClient.tsx
 *
 * Handles the Supabase invite token from the URL hash, shows a branded
 * "set your password" form, then redirects to the onboarding wizard on success.
 *
 * Flow:
 *  1. Supabase SSR client automatically detects the #access_token hash and
 *     establishes a session (detectSessionInUrl = true by default).
 *  2. The artist enters and confirms their new password.
 *  3. supabase.auth.updateUser({ password }) persists the password.
 *  4. Redirect to /portal/onboarding.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MusicNote, CheckCircle, Warning } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export function AcceptInviteClient() {
  const t = useTranslations('portal')
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  // Wait for Supabase to process the invite hash and establish a session.
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    // onAuthStateChange fires when the hash token is processed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session) {
          setSessionReady(true)
        }
      }
      if (event === 'PASSWORD_RECOVERY') {
        // Also handle the password recovery flow (same page can be reused)
        setSessionReady(true)
      }
    })

    // Also check if there's already an active session (e.g. page refresh)
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 8) {
      toast.error(t('register_password_too_short'))
      return
    }

    if (password !== passwordConfirm) {
      toast.error(t('acceptInvite_mismatch'))
      return
    }

    setIsLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setSessionError(t('acceptInvite_error'))
        toast.error(t('acceptInvite_error'))
        return
      }
      toast.success(t('acceptInvite_success'))
      router.push('/portal/onboarding')
    } catch {
      setSessionError(t('acceptInvite_error'))
      toast.error(t('acceptInvite_error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MusicNote size={32} className="text-primary" aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t('acceptInvite_title')}</h1>
          <p className="text-muted-foreground">{t('acceptInvite_subtitle')}</p>
        </div>

        {/* Session error — invite link expired or invalid */}
        {sessionError && !sessionReady && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <Warning size={20} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-destructive">{sessionError}</p>
            </CardContent>
          </Card>
        )}

        {/* Password form — shown once session is ready */}
        {!sessionError && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('acceptInvite_title')}</CardTitle>
              <CardDescription>{t('acceptInvite_subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-password">{t('acceptInvite_password')}</Label>
                  <Input
                    id="ai-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-muted border-border"
                    required
                    minLength={8}
                    disabled={isLoading || !sessionReady}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-password-confirm">{t('acceptInvite_confirm')}</Label>
                  <Input
                    id="ai-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="bg-muted border-border"
                    required
                    minLength={8}
                    disabled={isLoading || !sessionReady}
                  />
                </div>

                {!sessionReady && (
                  <p className="text-xs text-muted-foreground text-center">
                    Verifying invite link…
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isLoading || !sessionReady}
                >
                  <CheckCircle size={16} aria-hidden="true" />
                  {isLoading ? '…' : t('acceptInvite_submit')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
