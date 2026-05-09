'use client'

/**
 * app/portal/_components/PortalLoginForm.tsx — Client Component
 *
 * Login form for the Artist Portal. Receives i18n dict as props (IoC).
 * Uses the browser Supabase client to sign in, then navigates to /portal.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MusicNote } from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/i18n/types'

interface PortalLoginFormProps {
  dict: Dictionary['portal']
}

export function PortalLoginForm({ dict }: PortalLoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <MusicNote size={40} weight="bold" className="text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">{dict.login_title}</CardTitle>
          <CardDescription>{dict.login_description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{dict.login_email}</Label>
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
              <Label htmlFor="password">{dict.login_password}</Label>
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
            <Button type="submit" className="w-full" disabled={isLoading} size="lg">
              {isLoading ? dict.login_submitting : dict.login_submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
