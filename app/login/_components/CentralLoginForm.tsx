'use client'

/**
 * app/login/_components/CentralLoginForm.tsx — Client Component
 *
 * Centralized login form for the whole application.
 * Supports sign-in, forgot-password email, and password recovery (?type=recovery).
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MusicNote, Warning } from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isRecoverySessionEvent } from '@/lib/auth/recoverySession'
import { resolveRedirectPath } from '@/lib/auth/resolveRedirectPath'
import { useTranslations } from 'next-intl'
import type { UserRole } from '@/types/users'

type View = 'login' | 'forgot' | 'recovery'

export function CentralLoginForm() {
  const t = useTranslations('portal')
  const searchParams = useSearchParams()

  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)

  const errorParam = searchParams.get('error')
  const isRecoveryUrl = searchParams.get('type') === 'recovery'
  const recoveryCode = searchParams.get('code')

  useEffect(() => {
    if (isRecoveryUrl) {
      setView('recovery')
    }
  }, [isRecoveryUrl])

  useEffect(() => {
    if (view !== 'recovery') return

    // Legacy emails pointed at /login?type=recovery&code=… — exchange server-side.
    if (recoveryCode) {
      const params = new URLSearchParams({ recovery: '1', code: recoveryCode })
      window.location.replace(`/auth/callback?${params}`)
      return
    }

    const supabase = createBrowserSupabaseClient()
    let cancelled = false
    let hashFallbackTimer: number | undefined
    const trustInitialSession = true

    const markReady = () => {
      if (cancelled) return
      setSessionReady(true)
      setRecoveryError(null)
    }

    const fail = () => {
      if (cancelled) return
      setRecoveryError(t('login_recovery_error'))
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || cancelled) return
      if (isRecoverySessionEvent(event, { codeExchangeSucceeded: false, trustInitialSession })) {
        markReady()
      }
    })

    void (async () => {
      setSessionReady(false)
      setRecoveryError(null)

      const hasHashTokens =
        window.location.hash.includes('access_token') ||
        window.location.hash.includes('type=recovery')

      if (hasHashTokens) {
        // Let Supabase parse the hash — do not sign out first.
        hashFallbackTimer = window.setTimeout(() => {
          if (cancelled) return
          void supabase.auth.getSession().then(({ data: { session } }) => {
            if (cancelled) return
            if (session) markReady()
            else fail()
          })
        }, 2000)
        return
      }

      // Session already established by /auth/callback server exchange.
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        markReady()
        return
      }

      hashFallbackTimer = window.setTimeout(() => {
        if (cancelled) return
        void supabase.auth.getSession().then(({ data: { session: retrySession } }) => {
          if (cancelled) return
          if (retrySession) markReady()
          else fail()
        })
      }, 2000)
    })()

    return () => {
      cancelled = true
      if (hashFallbackTimer !== undefined) window.clearTimeout(hashFallbackTimer)
      subscription.unsubscribe()
    }
  }, [view, recoveryCode, t])

  const redirectAfterAuth = async () => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let role: UserRole | null = null
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      role = (profile?.role as UserRole | null) ?? null
    }

    window.location.assign(resolveRedirectPath(role))
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        toast.error(t('login_error'))
      } else {
        window.location.assign('/login')
      }
    } catch {
      toast.error(t('login_error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (!res.ok) {
        toast.error(t('login_forgot_error'))
      } else {
        toast.success(t('login_forgot_success'))
      }
    } catch {
      toast.error(t('login_forgot_error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 8) {
      toast.error(t('settings_password_too_short'))
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('settings_password_mismatch'))
      return
    }

    setIsLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) {
        setRecoveryError(t('login_recovery_error'))
        toast.error(t('login_recovery_error'))
        return
      }

      toast.success(t('login_recovery_success'))
      await redirectAfterAuth()
    } catch {
      setRecoveryError(t('login_recovery_error'))
      toast.error(t('login_recovery_error'))
    } finally {
      setIsLoading(false)
    }
  }

  const title =
    view === 'forgot'
      ? t('login_forgot_title')
      : view === 'recovery'
        ? t('login_recovery_title')
        : t('login_title')

  const description =
    view === 'forgot'
      ? t('login_forgot_description')
      : view === 'recovery'
        ? t('login_recovery_description')
        : t('login_description')

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <MusicNote size={40} weight="bold" className="text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorParam === 'no_artist' && view === 'login' && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-400">
              <Warning size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{t('login_no_artist')}</p>
            </div>
          )}
          {errorParam === 'unauthorized' && view === 'login' && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <Warning size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{t('login_unauthorized')}</p>
            </div>
          )}

          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('login_email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="artist@darktunes.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-muted border-border"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('login_password')}</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setView('forgot')}
                  >
                    {t('login_forgot_link')}
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-muted border-border"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} size="lg">
                {isLoading ? t('login_submitting') : t('login_submit')}
              </Button>
            </form>
          )}

          {view === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">{t('login_email')}</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="artist@darktunes.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-muted border-border"
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} size="lg">
                {isLoading ? t('login_forgot_submitting') : t('login_forgot_submit')}
              </Button>
              <p className="text-center text-sm">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setView('login')}
                >
                  {t('login_back_to_signin')}
                </button>
              </p>
            </form>
          )}

          {view === 'recovery' && (
            <>
              {recoveryError && !sessionReady && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <Warning size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
                  <p>{recoveryError}</p>
                </div>
              )}
              <form onSubmit={handleRecovery} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-password">{t('settings_password_new')}</Label>
                  <Input
                    id="recovery-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={isLoading || !sessionReady}
                    className="bg-muted border-border"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recovery-password-confirm">{t('settings_password_confirm')}</Label>
                  <Input
                    id="recovery-password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={isLoading || !sessionReady}
                    className="bg-muted border-border"
                    autoComplete="new-password"
                  />
                </div>
                {!sessionReady && !recoveryError && (
                  <p className="text-xs text-muted-foreground text-center">
                    {t('login_recovery_verifying')}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !sessionReady}
                  size="lg"
                >
                  {isLoading ? t('login_recovery_submitting') : t('login_recovery_submit')}
                </Button>
                <p className="text-center text-sm">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setView('login')}
                  >
                    {t('login_back_to_signin')}
                  </button>
                </p>
              </form>
            </>
          )}

          {view === 'login' && (
            <div className="mt-4 text-center text-sm">
              <a href="/press/apply" className="text-primary hover:underline">
                {t('login_request_press')}
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}