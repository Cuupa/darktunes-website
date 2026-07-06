import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 lg:px-8 pt-36 pb-24 max-w-3xl space-y-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
    </div>
  )
}
