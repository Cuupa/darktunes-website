'use client'

/**
 * app/portal/_components/PortalSidebar.tsx — Client Component
 *
 * Navigation sidebar for the Artist Portal. Receives all data as props (IoC).
 * Handles sign-out on the client side.
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MusicNote, ChartBar, FileText, User, SignOut } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Dictionary } from '@/i18n/types'

interface PortalSidebarProps {
  dict: Dictionary['portal']
  artistName: string | null
  userId: string | null
}

const navItems = [
  { href: '/portal', label: 'overview', icon: ChartBar },
  { href: '/portal/profile', label: 'profile', icon: User },
  { href: '/portal/analytics', label: 'analytics', icon: ChartBar },
  { href: '/portal/statements', label: 'statements', icon: FileText },
] as const

export function PortalSidebar({ dict, artistName }: PortalSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/portal/login')
    router.refresh()
  }

  return (
    <aside className="w-64 min-h-screen bg-card border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <MusicNote size={28} weight="bold" className="text-primary" />
        <span className="font-bold text-lg tracking-wide">darkTunes</span>
      </div>

      <Separator className="bg-border" />

      {/* Artist name */}
      {artistName && (
        <div className="px-6 py-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {dict.title}
          </p>
          <p className="font-semibold truncate">{artistName}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
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
              <Icon size={18} weight={isActive ? 'bold' : 'regular'} />
              {dict[label as keyof typeof dict]}
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
          <SignOut size={18} />
          {dict.signOut}
        </Button>
      </div>
    </aside>
  )
}
