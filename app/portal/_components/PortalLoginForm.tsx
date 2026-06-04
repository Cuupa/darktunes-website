'use client'

/**
 * app/portal/_components/PortalLoginForm.tsx — Client Component
 *
 * Login + Registration form for the Artist Portal. Receives i18n dict as props (IoC).
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
import type { Dictionary } from '@/i18n/types'

interface PortalLoginFormProps {
  dict: Dictionary['portal']
}

export function PortalLoginForm({ dict }: PortalLoginFormProps) {
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
        toast.error(dict.register_password_too_short)
        setIsLoading(false)
        return
      }
      if (password !== passwordConfirm) {
        toast.error(dict.register_password_mismatch)
        setIsLoading(false)
        return
      }

      try {
        const supabase = createBrowserSupabaseClient()
        const { error } = await supabase.auth.signUp({ email, password })

        if (error) {
          toast.error(dict.register_error)
        } else {
          toast.success(dict.register_success)
          router.refresh()
          router.push('/portal')
        }
      } catch {
        toast.error(dict.register_error)
      } finally {
        setIsLoading(false)
      }
    } else {
      try {
        const supabase = createBrowserSupabaseClient()
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
          toast.error(dict.login_error)
        } else {
          router.refresh()
          router.push('/portal')
        }
      } catch {
        toast.error(dict.login_error)
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
        toast.error(dict.oauth_error)
        setIsOAuthLoading(false)
      }
      // On success the browser redirects — no need to reset loading state
    } catch {
      toast.error(dict.oauth_error)
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
            {isRegister ? dict.register_title : dict.login_title}
          </CardTitle>
          <CardDescription>
            {isRegister ? dict.register_description : dict.login_description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorParam === 'no_artist' && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-400">
              <Warning size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{dict.login_no_artist}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                {isRegister ? dict.register_email : dict.login_email}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="artist@darktunes.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                {isRegister ? dict.register_password : dict.login_password}
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
                <Label htmlFor="password-confirm">{dict.register_password_confirm}</Label>
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
                ? isLoading ? dict.register_submitting : dict.register_submit
                : isLoading ? dict.login_submitting : dict.login_submit}
            </Button>
          </form>

          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground shrink-0">{dict.oauth_or}</span>
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
              {dict.oauth_google}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10"
              disabled={isOAuthLoading}
              onClick={() => handleOAuth('spotify')}
            >
              <SpotifyLogo size={18} weight="bold" className="mr-2" />
              {dict.oauth_spotify}
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
              {isRegister ? dict.register_switch_to_login : dict.login_switch_to_register}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

