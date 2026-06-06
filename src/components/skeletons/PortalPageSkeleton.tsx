import { Skeleton } from '@/components/ui/skeleton'

/**
 * PortalPageSkeleton — Generic loading skeleton for Artist Portal pages.
 * Used by all /portal/* loading.tsx files.
 */
export function PortalPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav bar skeleton */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
      <div className="flex">
        {/* Sidebar skeleton */}
        <div className="hidden lg:flex flex-col gap-2 w-56 border-r border-border p-4 min-h-screen">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 p-6 lg:p-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
