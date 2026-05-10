'use client'

/**
 * app/promo-pool/login/_components/PromoLoginClient.tsx
 *
 * Login form + journalist application form for unauthenticated visitors.
 * Uses the browser Supabase client for sign-in; application is submitted
 * via the API route POST /api/journalist-applications.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Newspaper } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/i18n/types'

interface Props {
  dict: Dictionary['promoPool']
}

export function PromoLoginClient({ dict }: Props) {
  // Login state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState(false)

  // Application state
  const [applyName, setApplyName] = useState('')
  const [applyEmail, setApplyEmail] = useState('')
  const [applyOutlet, setApplyOutlet] = useState('')
  const [applyMessage, setApplyMessage] = useState('')
  const [applyLoading, setApplyLoading] = useState(false)
  const [applySuccess, setApplySuccess] = useState(false)
  const [applyError, setApplyError] = useState(false)

  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(false)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setLoginError(true)
      } else {
        router.refresh()
        router.push('/promo-pool')
      }
    } catch {
      setLoginError(true)
    } finally {
      setLoginLoading(false)
    }
  }

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    setApplyLoading(true)
    setApplyError(false)
    try {
      const res = await fetch('/api/journalist-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: applyEmail,
          name: applyName,
          outlet: applyOutlet,
          message: applyMessage,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setApplySuccess(true)
    } catch {
      setApplyError(true)
    } finally {
      setApplyLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Login card */}
        <Card className="bg-card border-border">
          <CardHeader className="space-y-2 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Newspaper size={40} weight="bold" className="text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">{dict.login.title}</CardTitle>
            <CardDescription>{dict.login.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="login-email">{dict.login.email}</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loginLoading}
                  className="bg-background border-input"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="login-password">{dict.login.password}</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loginLoading}
                  className="bg-background border-input"
                />
              </div>
              {loginError && (
                <p className="text-destructive text-sm" role="alert">
                  {dict.login.error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? dict.login.submitting : dict.login.submit}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Application card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{dict.login.applyHeading}</CardTitle>
            <CardDescription>{dict.login.applyDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {applySuccess ? (
              <p className="text-green-400 font-medium" role="status">
                {dict.login.applySuccess}
              </p>
            ) : (
              <form onSubmit={handleApply} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="apply-name">{dict.login.applyName}</Label>
                  <Input
                    id="apply-name"
                    value={applyName}
                    onChange={(e) => setApplyName(e.target.value)}
                    required
                    className="bg-background border-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="apply-email">{dict.login.email}</Label>
                  <Input
                    id="apply-email"
                    type="email"
                    value={applyEmail}
                    onChange={(e) => setApplyEmail(e.target.value)}
                    placeholder={dict.login.applyEmailPlaceholder}
                    required
                    className="bg-background border-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="apply-outlet">{dict.login.applyOutlet}</Label>
                  <Input
                    id="apply-outlet"
                    value={applyOutlet}
                    onChange={(e) => setApplyOutlet(e.target.value)}
                    required
                    className="bg-background border-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="apply-message">{dict.login.applyMessage}</Label>
                  <Textarea
                    id="apply-message"
                    value={applyMessage}
                    onChange={(e) => setApplyMessage(e.target.value)}
                    rows={3}
                    className="bg-background border-input"
                  />
                </div>
                {applyError && (
                  <p className="text-destructive text-sm" role="alert">
                    {dict.login.applyError}
                  </p>
                )}
                <Button type="submit" variant="outline" className="w-full" disabled={applyLoading}>
                  {applyLoading ? dict.login.applySubmitting : dict.login.applySubmit}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
