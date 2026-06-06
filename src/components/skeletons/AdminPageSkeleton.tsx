import { Skeleton } from '@/components/ui/skeleton'

/**
 * AdminPageSkeleton — Generic loading skeleton for Admin area pages.
 * Used by all /admin/* loading.tsx files.
 */
export function AdminPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav skeleton */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}
