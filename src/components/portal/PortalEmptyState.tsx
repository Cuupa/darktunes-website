import Link from 'next/link'
import type { ComponentType } from 'react'
import { Button } from '@/components/ui/button'

interface PortalEmptyStateProps {
  icon: ComponentType<{ size: number; className?: string; 'aria-hidden'?: boolean }>
  heading: string
  description: string
  action?: { label: string; href?: string; onClick?: () => void }
}

export function PortalEmptyState({ icon: Icon, heading, description, action }: PortalEmptyStateProps) {
  return (
    <div className="rounded-md border border-dashed border-border p-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
        <Icon size={48} className="text-muted-foreground/40" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Button asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      )}
    </div>
  )
}
