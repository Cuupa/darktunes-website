'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { SignOut, SidebarSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface PressNavProps {
  email: string
  links: Array<{ href: string; label: string }>
}

export function PressNav({ email, links }: PressNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const signOut = async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card p-4 md:hidden">
        <div>
          <p className="font-semibold">Press Dashboard</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="press-dashboard-nav" aria-label="Toggle press navigation">
          <SidebarSimple size={18} weight="bold" aria-hidden="true" />
        </Button>
      </div>
      <aside className={["border-r border-border bg-card p-4 md:flex md:min-h-screen md:w-64 md:shrink-0 md:flex-col md:gap-4", open ? 'block' : 'hidden md:flex'].join(' ')}>
        <div>
          <p className="font-semibold">Press Dashboard</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
        <nav id="press-dashboard-nav" className="flex-1 space-y-1" aria-label="Press dashboard navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={[
                'block rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                pathname === link.href ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Button variant="outline" onClick={() => void signOut()} className="gap-2">
          <SignOut size={16} weight="bold" aria-hidden="true" />
          Logout
        </Button>
      </aside>
    </>
  )
}
