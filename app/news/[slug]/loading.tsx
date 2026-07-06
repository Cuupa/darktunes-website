import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 lg:px-8 pt-36 pb-24 max-w-3xl space-y-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="aspect-video w-full rounded-lg" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <div className="space-y-3 pt-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
