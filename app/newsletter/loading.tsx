import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-36 pb-24 max-w-2xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-80" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  )
}
