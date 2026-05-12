'use client'

/**
 * app/portal/_components/PortalSidebar.tsx — Client Component
 *
 * Navigation sidebar for the Artist Portal. Receives all data as props (IoC).
 * Handles sign-out on the client side.
 * Shows/hides Statements nav item based on the sosStatementsEnabled feature toggle.
 * Provides a "Preview Profile" link to the public artist page.
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MusicNote, ChartBar, FileText, User, SignOut, MapPin, MegaphoneSimple, MusicNotes, Eye, ChatCircleText } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Dictionary } from '@/i18n/types'

interface PortalSidebarProps {
  dict: Dictionary['portal']
  artistName: string | null
  userId: string | null
  /** Slug of the linked artist — used for the public preview link */
  artistSlug: string | null
  featureFlags: Record<string, boolean>
  unreadMessages: number
}

const baseNavItems = [
  { href: '/portal', label: 'overview', icon: ChartBar },
  { href: '/portal/profile', label: 'profile', icon: User },
  { href: '/portal/analytics', label: 'analytics', icon: ChartBar, flag: 'artist.analytics' },
  { href: '/portal/releases', label: 'releases', icon: MusicNotes, flag: 'artist.releases' },
  { href: '/portal/tour', label: 'tour', icon: MapPin, flag: 'artist.tour' },
  { href: '/portal/marketing', label: 'marketing', icon: MegaphoneSimple, flag: 'artist.marketing' },
  { href: '/portal/messages', label: 'messages', icon: ChatCircleText, flag: 'artist.messages' },
] as const

const statementsNavItem = { href: '/portal/statements', label: 'statements', icon: FileText, flag: 'artist.statements' } as const

export function PortalSidebar({ dict, artistName, artistSlug, featureFlags, unreadMessages }: PortalSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/portal/login')
    router.refresh()
  }

  const navItems = [...baseNavItems, statementsNavItem].filter((item) => {
    if (!('flag' in item)) return true
    return featureFlags[item.flag] ?? true
  })

  return (
    <aside className="w-64 min-h-screen bg-card border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <MusicNote size={28} weight="bold" className="text-primary" aria-hidden="true" />
        <span className="font-bold text-lg tracking-wide">darkTunes</span>
      </div>

      <Separator className="bg-border" />

      {/* Artist name + preview link */}
      {artistName && (
        <div className="px-6 py-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {dict.title}
          </p>
          <p className="font-semibold truncate mb-2">{artistName}</p>
          {artistSlug && (
            <Link
              href={`/artists/${artistSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              aria-label={`Preview public profile for ${artistName}`}
            >
              <Eye size={13} aria-hidden="true" />
              Preview Public Profile
            </Link>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Artist portal navigation">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/portal' ? pathname === '/portal' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}
            >
              <Icon size={18} weight={isActive ? 'bold' : 'regular'} aria-hidden="true" />
              {dict[label as keyof typeof dict]}
              {href === '/portal/messages' && unreadMessages > 0 && (
                <span className="ml-auto inline-flex min-w-[20px] justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                  {unreadMessages}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-border" />

      {/* Sign out */}
      <div className="p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
        >
          <SignOut size={18} aria-hidden="true" />
          {dict.signOut}
        </Button>
      </div>
    </aside>
  )
}
