/**
 * app/portal/_components/PortalAccessGate.tsx — Client Component
 *
 * Shown to authenticated users without artist portal membership.
 */

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, EnvelopeSimple, SignOut } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface PortalAccessGateProps {
  role: string
}

export function PortalAccessGate({ role }: PortalAccessGateProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock size={32} className="text-muted-foreground" role="img" aria-label="Access restricted" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Access Pending</h1>
          <p className="text-muted-foreground">
            Your account is not linked to an artist profile yet. Portal access is granted via{' '}
            <strong>artist membership</strong> — an administrator must add you to an artist in
            User Management before you can use the portal.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-sm text-left space-y-2">
          <p className="font-medium">What to do next:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Contact the label administrator</li>
            <li>Ask them to link your account to your artist profile (artist membership)</li>
            <li>Sign out and sign back in once they&apos;ve made the changes</li>
          </ol>
          {role !== 'user' && (
            <p className="text-muted-foreground pt-1">
              Current role: <strong>{role}</strong> — membership is required regardless of role.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors min-w-[44px] min-h-[44px]"
          >
            <EnvelopeSimple size={16} aria-hidden="true" />
            Contact the Label
          </Link>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="min-w-[44px] min-h-[44px]"
          >
            <SignOut size={16} className="mr-2" aria-hidden="true" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}