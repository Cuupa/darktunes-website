'use client'

/**
 * src/components/admin/AdminSidebarNav.tsx
 *
 * Client component for the persistent admin sidebar navigation.
 * Uses usePathname() for active-state highlighting and useAuthContext()
 * to hide admin-only sections from editors.
 *
 * On mobile (< md) the sidebar is hidden; a hamburger button in the layout
 * header opens this nav inside a Sheet drawer.
 */

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useAuthContext } from '@/contexts/AuthContext'
import {
  SquaresFour,
  MusicNotes,
  Wallet,
  ChatCircle,
  MegaphoneSimple,
  Users,
  ToggleRight,
  Gear,
  Cpu,
  SignOut,
  List,
  Palette,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { EditorNotificationBell } from '@/components/admin/EditorNotificationBell'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  adminOnly: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     href: '/admin',            icon: SquaresFour, adminOnly: false },
  { label: 'Content',       href: '/admin/content',    icon: MusicNotes,  adminOnly: false },
  { label: 'Accounting',    href: '/admin/accounting', icon: Wallet,      adminOnly: true  },
  { label: 'Messages',      href: '/admin/messages',   icon: ChatCircle,  adminOnly: true  },
  { label: 'Promo Log',     href: '/admin/promo-log',  icon: MegaphoneSimple, adminOnly: false },
  { label: 'Users',         href: '/admin/users',      icon: Users,       adminOnly: true  },
  { label: 'Feature Flags', href: '/admin/features',   icon: ToggleRight, adminOnly: true  },
  { label: 'Colors',        href: '/admin/colors',     icon: Palette,     adminOnly: true  },
  { label: 'Settings',      href: '/admin/settings',   icon: Gear,        adminOnly: true  },
  { label: 'System',        href: '/admin/system',     icon: Cpu,         adminOnly: true  },
]

export function AdminSidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { isAdmin, isEditor, user, profile, signOut } = useAuthContext()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = useCallback(async () => {
    const { error } = await signOut()
    if (error) {
      toast.error('Failed to sign out')
    } else {
      toast.success('Signed out successfully')
      router.push('/login')
    }
  }, [signOut, router])

  const canSee = (item: NavItem) => {
    if (isAdmin) return true
    if (isEditor) return !item.adminOnly
    return false
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const visibleItems = NAV_ITEMS.filter(canSee)

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav className="flex-1 overflow-y-auto py-3 px-2" style={{ overscrollBehavior: 'contain' }} data-lenis-prevent aria-label="Admin sections">
      <ul className="space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )

  const renderFooter = () => (
    <div className="border-t border-border px-3 py-3 space-y-2">
      <p className="text-xs text-muted-foreground truncate px-1">{user?.email}</p>
      <button
        type="button"
        onClick={handleSignOut}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <SignOut size={16} weight="bold" aria-hidden="true" />
        Sign Out
      </button>
    </div>
  )

  return (
    <>
      {/* Mobile header — only visible below md breakpoint */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <p className="text-sm font-bold tracking-wide">darkTunes Admin</p>
        <div className="flex items-center gap-2">
          {user?.id && <EditorNotificationBell userId={user.id} />}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open admin navigation" className="min-h-[44px] min-w-[44px]">
                <List size={20} aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-56 p-0">
              <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
              <div className="flex h-full flex-col bg-card">
                <div className="px-4 py-5 border-b border-border">
                  <p className="text-sm font-bold tracking-wide">darkTunes Admin</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{profile?.role ?? 'admin'}</p>
                </div>
                {renderNavLinks(() => setMobileOpen(false))}
                {renderFooter()}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Desktop sidebar — hidden below md */}
      <aside
        className="hidden md:flex flex-col h-full w-56 shrink-0 border-r border-border bg-card"
        aria-label="Admin navigation"
      >
        {/* Brand header */}
        <div className="px-4 py-5 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-bold tracking-wide">darkTunes Admin</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{profile?.role ?? 'admin'}</p>
          </div>
          {user?.id && <EditorNotificationBell userId={user.id} />}
        </div>

        {renderNavLinks()}
        <Separator className="bg-border" />
        {renderFooter()}
      </aside>
    </>
  )
}
