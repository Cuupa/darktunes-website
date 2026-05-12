/**
 * app/portal/_components/PortalAccessGate.tsx — Server Component
 *
 * Shown to authenticated users who do not have the 'artist' or 'admin' role.
 * Displays a clear explanation and instructions for requesting access.
 */

import Link from 'next/link'
import { Lock, EnvelopeSimple } from '@phosphor-icons/react/dist/ssr'

interface PortalAccessGateProps {
  role: string
}

export function PortalAccessGate({ role }: PortalAccessGateProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock size={32} className="text-muted-foreground" aria-hidden="true" />
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
            <li>Sign out and sign back in once they've made the changes</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <EnvelopeSimple size={16} aria-hidden="true" />
            Contact the Label
          </Link>
          <Link
            href="/portal/login"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Sign Out &amp; Return
          </Link>
        </div>
      </div>
    </div>
  )
}
