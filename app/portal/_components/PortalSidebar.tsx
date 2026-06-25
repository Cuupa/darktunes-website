'use client'

import { useTranslations } from 'next-intl'
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CaretUpDown,
  ChartBar,
  ChatCircleText,
  Chats,
  Eye,
  FileText,
  Files,
  List,
  CalendarDots,
  MapPin,
  MegaphoneSimple,
  MusicNotes,
  Question,
  Receipt,
  SignOut,
  User,
  Gear,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { portalKey } from '@/i18n/portalKey'
import { toast } from 'sonner'
import type { Artist } from '@/types'
import { useUnreadMessages } from './PortalNotificationProvider'

interface PortalSidebarProps {
  artists: Artist[]
  userId: string | null
  featureFlags: Record<string, boolean>
}

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  flag?: string
}

type NavGroup = {
  groupKey: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: 'nav_group_dashboard',
    items: [
      { href: '/portal', label: 'overview', icon: ChartBar },
      { href: '/portal/analytics', label: 'analytics', icon: ChartBar, flag: 'artist.analytics' },
    ],
  },
  {
    groupKey: 'nav_group_music',
    items: [
      { href: '/portal/profile', label: 'profile', icon: User },
      { href: '/portal/epk-builder', label: 'epk_builder_nav', icon: FileText, flag: 'artist.epk_builder' },
      { href: '/portal/releases', label: 'releases', icon: MusicNotes },
      { href: '/portal/calendar', label: 'calendar', icon: CalendarDots, flag: 'artist.calendar' },
      { href: '/portal/releases/submissions', label: 'releases_submissions_heading', icon: List },
      { href: '/portal/releases/videos', label: 'video_submissions_heading', icon: Eye },
    ],
  },
  {
    groupKey: 'nav_group_live',
    items: [
      { href: '/portal/events', label: 'tour', icon: MapPin },
      { href: '/portal/marketing', label: 'marketing', icon: MegaphoneSimple, flag: 'artist.marketing' },
    ],
  },
  {
    groupKey: 'nav_group_finance',
    items: [
      { href: '/portal/statements', label: 'statements', icon: FileText, flag: 'artist.statements' },
      { href: '/portal/invoices', label: 'invoices_heading', icon: Receipt, flag: 'artist.invoices' },
      { href: '/portal/billing', label: 'billing_heading', icon: Files },
    ],
  },
  {
    groupKey: 'nav_group_communication',
    items: [
      { href: '/portal/messages', label: 'messages', icon: ChatCircleText },
      { href: '/portal/interviews', label: 'interviews', icon: Chats },
    ],
  },
  {
    groupKey: 'nav_group_files',
    items: [
      { href: '/portal/documents', label: 'documents_heading', icon: Files, flag: 'artist.documents' },
    ],
  },
  {
    groupKey: 'nav_group_account',
    items: [
      { href: '/portal/settings', label: 'settings', icon: Gear },
      { href: '/portal/help', label: 'help', icon: Question },
    ],
  },
]

export function PortalSidebar({ artists, featureFlags }: PortalSidebarProps) {
  const t = useTranslations('portal')

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { unreadCount } = useUnreadMessages()

  // Derive active artist directly from URL — no stale local state
  const activeArtistId = searchParams.get('artistId')
  const activeArtist = useMemo(
    () =>
      (activeArtistId ? artists.find((a) => a.id === activeArtistId) : null) ??
      artists[0] ??
      null,
    [activeArtistId, artists],
  )

  /** Append artistId to nav links so server components always get the correct artist */
  const navHref = (base: string) =>
    artists.length > 1 && activeArtistId ? `${base}?artistId=${activeArtistId}` : base

  const navGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.flag || (featureFlags[item.flag] ?? true)),
      })).filter((group) => group.items.length > 0),
    [featureFlags],
  )

  const handleSignOut = async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    toast.success(t('signOut'))
    router.push('/login')
    router.refresh()
  }

  /** Switch active artist — URL is the single source of truth */
  const handleArtistSwitch = (artist: Artist) => {
    router.push(`${pathname}?artistId=${artist.id}`)
    router.refresh()
  }

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Artist portal navigation">
      {navGroups.map(({ groupKey, items }) => (
        <div key={groupKey} className="mb-3">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {t(portalKey(groupKey))}
          </p>
          <div className="space-y-0.5">
            {items.map(({ href, label, icon: Icon }) => {
              const isActive = href === '/portal' ? pathname === '/portal' : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={navHref(href)}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'portal-nav-active bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon size={18} weight={isActive ? 'bold' : 'regular'} aria-hidden="true" />
                  <span className="truncate">{t(portalKey(label))}</span>
                  {href === '/portal/messages' && unreadCount > 0 && (
                    <span className="ml-auto inline-flex min-w-[20px] justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  const artistBlock = activeArtist ? (
    <div className="px-6 py-4">
      <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">{t('title')}</p>
      {artists.length > 1 ? (
        // Multi-artist selector — dropdown to switch active artist
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex w-full items-center justify-between gap-2 truncate font-semibold hover:text-primary transition-colors mb-2"
              aria-label="Switch active artist"
            >
              <span className="truncate">{activeArtist.name}</span>
              <CaretUpDown size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {artists.map((a) => (
              <DropdownMenuItem
                key={a.id}
                onSelect={() => handleArtistSwitch(a)}
                className={a.id === activeArtist?.id ? 'font-semibold text-primary' : ''}
              >
                {a.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <p className="mb-2 truncate font-semibold">{activeArtist.name}</p>
      )}
      {activeArtist.slug && (
        <Link
          href={`/artists/${activeArtist.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary/80"
          aria-label={`Preview public profile for ${activeArtist.name}`}
        >
          <Eye size={13} aria-hidden="true" />
          {t('profile_preview_public')}
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
              <Separator className="bg-border" />
              <div className="p-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                  onClick={handleSignOut}
                >
                  <SignOut size={18} aria-hidden="true" />
                  {t('signOut')}
                </Button>
              </div>
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
            {t('signOut')}
          </Button>
        </div>
      </aside>
    </>
  )
}
