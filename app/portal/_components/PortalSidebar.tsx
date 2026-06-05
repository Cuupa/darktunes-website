'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChartBar,
  ChatCircleText,
  Chats,
  Eye,
  FileText,
  List,
  MapPin,
  MegaphoneSimple,
  MusicNotes,
  SignOut,
  User,
  Gear,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Dictionary } from '@/i18n/types'

interface PortalSidebarProps {
  dict: Dictionary['portal']
  artistName: string | null
  userId: string | null
  artistSlug: string | null
  featureFlags: Record<string, boolean>
  unreadMessages: number
}

const baseNavItems = [
  { href: '/portal', label: 'overview', icon: ChartBar },
  { href: '/portal/profile', label: 'profile', icon: User },
  { href: '/portal/analytics', label: 'analytics', icon: ChartBar },
  { href: '/portal/releases', label: 'releases', icon: MusicNotes },
  { href: '/portal/releases/submissions', label: 'releases_submissions_heading', icon: List },
  { href: '/portal/releases/videos', label: 'video_submissions_heading', icon: Eye },
  { href: '/portal/tour', label: 'tour', icon: MapPin },
  { href: '/portal/marketing', label: 'marketing', icon: MegaphoneSimple, flag: 'artist.marketing' },
  { href: '/portal/messages', label: 'messages', icon: ChatCircleText },
  { href: '/portal/interviews', label: 'interviews', icon: Chats },
  { href: '/portal/settings', label: 'settings', icon: Gear },
] as const

const statementsNavItem = { href: '/portal/statements', label: 'statements', icon: FileText, flag: 'artist.statements' } as const

export function PortalSidebar({ dict, artistName, artistSlug, featureFlags, unreadMessages }: PortalSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = useMemo(
    () => [...baseNavItems, statementsNavItem].filter((item) => !('flag' in item) || (featureFlags[item.flag] ?? true)),
    [featureFlags],
  )

  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    toast.success(dict.signOut)
    router.push('/portal/login')
    router.refresh()
  }

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Artist portal navigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/portal' ? pathname === '/portal' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={[
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'portal-nav-active bg-primary/20 text-primary'
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
  )

  const artistBlock = artistName ? (
    <div className="px-6 py-4">
      <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">{dict.title}</p>
      <p className="mb-2 truncate font-semibold">{artistName}</p>
      {artistSlug && (
        <Link
          href={`/artists/${artistSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary/80"
          aria-label={`Preview public profile for ${artistName}`}
        >
          <Eye size={13} aria-hidden="true" />
          {dict.profile_preview_public}
        </Link>
      )}
    </div>
  ) : null

  return (
    <>
      <header className="portal-main-header sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <div className="font-bold tracking-widest text-primary">darkTunes</div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open portal navigation" className="min-h-[44px] min-w-[44px]">
              <List size={20} aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Portal Navigation</SheetTitle>
            <div className="flex h-full flex-col bg-card">
              <div className="px-6 py-4 font-bold tracking-widest text-primary">darkTunes</div>
              <Separator className="bg-border" />
              {artistBlock}
              {renderNav(() => setMobileOpen(false))}
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <aside className="portal-sidebar hidden md:flex flex-col min-h-screen w-64 shrink-0 border-r border-border bg-card">
        <div className="p-6">
          <span className="font-bold text-lg tracking-widest text-primary">darkTunes</span>
        </div>
        <Separator className="bg-border" />
        {artistBlock}
        {renderNav()}
        <Separator className="bg-border" />
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
    </>
  )
}
