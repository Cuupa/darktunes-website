'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/i18n/types'

export function PressLoginForm({ dict }: { dict: Dictionary['pressLogin'] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(dict.errorInvalid)
        return
      }

      // Verify that the account has role 'press' and is active
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', signInData.user.id)
        .single()

      const isPress = profile?.role === 'press'
      const isActive = profile?.is_active !== false

      if (!isPress || !isActive) {
        await supabase.auth.signOut()
        setError(dict.errorUnauthorized)
        return
      }

      router.push('/press/dashboard')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader>
          <CardTitle>{dict.title}</CardTitle>
          <CardDescription>{dict.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {searchParams.get('error') === 'unauthorized' && (
            <p className="text-sm text-destructive">{dict.errorUnauthorized}</p>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="press-email">{dict.emailLabel}</Label>
              <Input id="press-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="press-password">{dict.passwordLabel}</Label>
              <Input id="press-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? dict.signingIn : dict.signIn}
            </Button>
          </form>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <Link href="/press/apply" className="text-primary hover:underline">{dict.applyLink}</Link>
            </p>
            <p>
              {dict.forgotPassword}{' '}
              <a className="text-primary hover:underline" href="mailto:info@darktunes.com?subject=Press%20Portal%20Password%20Reset">info@darktunes.com</a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
