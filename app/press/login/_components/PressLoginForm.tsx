'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function PressLoginForm() {
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
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('Invalid email or password.')
      } else {
        router.push('/press/dashboard')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader>
          <CardTitle>Press Dashboard Login</CardTitle>
          <CardDescription>Sign in as journalist/admin to access press tools.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {searchParams.get('error') === 'unauthorized' && (
            <p className="text-sm text-destructive">Your account is not authorized for the press dashboard.</p>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="press-email">Email</Label>
              <Input id="press-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="press-password">Password</Label>
              <Input id="press-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <Link href="/press/apply" className="text-primary hover:underline">Apply for press access</Link>
            </p>
            <p>
              Forgot password? Email <a className="text-primary hover:underline" href="mailto:info@darktunes.com?subject=Press%20Portal%20Password%20Reset">info@darktunes.com</a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
