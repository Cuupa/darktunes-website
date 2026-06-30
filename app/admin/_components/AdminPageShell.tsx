'use client'

/**
 * app/admin/_components/AdminPageShell.tsx
 *
 * Shared wrapper used by every dedicated admin section page.
 * Provides a consistent page header (title + description) and
 * a padded content area, matching the existing admin dashboard style.
 */

interface AdminPageShellProps {
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
  /** Fill the admin viewport so nested panels (e.g. file explorer) scroll internally. */
  fill?: boolean
  /** List pages: pass height to AdminListShell so the table pane scrolls internally. */
  layout?: 'default' | 'list'
}

export function AdminPageShell({ title, description, children, actions, fill, layout = 'default' }: AdminPageShellProps) {
  const viewportFill = fill || layout === 'list'

  return (
    <div className={viewportFill ? 'flex h-full min-h-0 w-full flex-col' : 'flex w-full flex-col'}>
      <header className="shrink-0 border-b border-border bg-card px-6 py-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className={viewportFill ? 'flex min-h-0 flex-1 flex-col p-6' : 'flex-1 p-6'}>
        {children}
      </div>
    </div>
  )
}
