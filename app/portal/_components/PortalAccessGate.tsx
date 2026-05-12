/**
 * app/portal/_components/PortalAccessGate.tsx — Client Component
 *
 * Shown to authenticated users who do not have the 'artist' or 'admin' role.
 * Displays a clear explanation and instructions for requesting access.
 * The "Sign Out" button signs the user out before redirecting to the login page.
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
    router.push('/portal/login')
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
          {role === 'user' ? (
            <p className="text-muted-foreground">
              Your account has not been assigned an artist role yet. An administrator needs to
              assign you the <strong>Artist</strong> role and link your account to an artist profile
              before you can access the portal.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Your account role (<strong>{role}</strong>) does not include access to the Artist
              Portal. Please contact an administrator if you believe this is an error.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-sm text-left space-y-2">
          <p className="font-medium">What to do next:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Contact the label administrator</li>
            <li>Ask them to assign you the <strong>Artist</strong> role in User Management</li>
            <li>Ask them to link your account to your artist profile</li>
            <li>Sign out and sign back in once they&apos;ve made the changes</li>
          </ol>
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
