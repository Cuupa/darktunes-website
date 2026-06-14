'use client'

/**
 * app/login/_components/CentralLoginForm.tsx — Client Component
 *
 * Centralized login form for the whole application.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MusicNote } from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/i18n/types'

interface CentralLoginFormProps {
  dict: Dictionary['portal']
}

export function CentralLoginForm({ dict }: CentralLoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        toast.error(dict.login_error)
      } else {
        // Use a hard navigation instead of router.push so the full HTTP
        // request carries the newly-set auth cookie, ensuring the server
        // component sees the authenticated session on first render.
        window.location.assign('/login')
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
          <CardTitle className="text-3xl font-bold">
            {dict.login_title}
          </CardTitle>
          <CardDescription>
            {dict.login_description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                {dict.login_email}
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
                {dict.login_password}
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
            <Button type="submit" className="w-full" disabled={isLoading} size="lg">
              {isLoading ? dict.login_submitting : dict.login_submit}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <a href="/press/apply" className="text-primary hover:underline">
              {dict.login_request_press}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
