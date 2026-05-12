'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface PressNavProps {
  email: string
  links: Array<{ href: string; label: string }>
}

export function PressNav({ email, links }: PressNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  const signOut = async () => {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    router.push('/press/login')
    router.refresh()
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card min-h-screen p-4 flex flex-col gap-4">
      <div>
        <p className="font-semibold">Press Dashboard</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
      <nav className="space-y-1 flex-1" aria-label="Press dashboard navigation">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={[
              'block rounded-md px-3 py-2 text-sm',
              pathname === link.href ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            ].join(' ')}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Button variant="outline" onClick={signOut}>Logout</Button>
    </aside>
  )
}
