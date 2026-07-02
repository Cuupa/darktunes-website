'use client'

import { useTranslations } from 'next-intl'
/**
 * app/portal/_components/PortalLoginForm.tsx — Client Component
 *
 * Login + Registration form for the Artist Portal.
 * Supports toggling between login and register modes, plus OAuth sign-in via Google/Spotify.
 */

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MusicNote, GoogleLogo, SpotifyLogo, Warning } from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export function PortalLoginForm() {
  const t = useTranslations('portal')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (mode === 'register') {
      if (password.length < 8) {
        toast.error(t('register_password_too_short'))
        setIsLoading(false)
        return
      }
      if (password !== passwordConfirm) {
        toast.error(t('register_password_mismatch'))
        setIsLoading(false)
        return
      }

      try {
        const supabase = createBrowserSupabaseClient()
        const { error } = await supabase.auth.signUp({ email, password })

        if (error) {
          toast.error(t('register_error'))
        } else {
          toast.success(t('register_success'))
          router.refresh()
          router.push('/portal')
        }
      } catch {
        toast.error(t('register_error'))
      } finally {
        setIsLoading(false)
      }
    } else {
      try {
        const supabase = createBrowserSupabaseClient()
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
          toast.error(t('login_error'))
        } else {
          // Use a hard navigation instead of router.push so the full HTTP
          // request carries the newly-set auth cookie, ensuring the server
          // component sees the authenticated session on first render.
          window.location.assign('/portal')
        }
      } catch {
        toast.error(t('login_error'))
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleOAuth = async (provider: 'google' | 'spotify') => {
    setIsOAuthLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: provider === 'spotify' ? 'user-read-email user-read-private' : undefined,
        },
      })
      if (error) {
        toast.error(t('oauth_error'))
        setIsOAuthLoading(false)
      }
      // On success the browser redirects — no need to reset loading state
    } catch {
      toast.error(t('oauth_error'))
      setIsOAuthLoading(false)
    }
  }

  const isRegister = mode === 'register'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <MusicNote size={40} weight="bold" className="text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">
            {isRegister ? t('register_title') : t('login_title')}
          </CardTitle>
          <CardDescription>
            {isRegister ? t('register_description') : t('login_description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorParam === 'no_artist' && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-400">
              <Warning size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{t('login_no_artist')}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                {isRegister ? t('register_email') : t('login_email')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t('login_email_placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {isRegister ? t('register_password') : t('login_password')}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="bg-muted border-border"
              />
            </div>
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="password-confirm">{t('register_password_confirm')}</Label>
                <Input
                  id="password-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-muted border-border"
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading} size="lg">
              {isRegister
                ? isLoading ? t('register_submitting') : t('register_submit')
                : isLoading ? t('login_submitting') : t('login_submit')}
            </Button>
          </form>

          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground shrink-0">{t('oauth_or')}</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isOAuthLoading}
              onClick={() => handleOAuth('google')}
            >
              <GoogleLogo size={18} weight="bold" className="mr-2" />
              {t('oauth_google')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10"
              disabled={isOAuthLoading}
              onClick={() => handleOAuth('spotify')}
            >
              <SpotifyLogo size={18} weight="bold" className="mr-2" />
              {t('oauth_spotify')}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => {
                setMode(isRegister ? 'login' : 'register')
                setPassword('')
                setPasswordConfirm('')
              }}
            >
              {isRegister ? t('register_switch_to_login') : t('login_switch_to_register')}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

