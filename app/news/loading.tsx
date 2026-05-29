import { Skeleton } from '@/components/ui/skeleton'

const skeletonCards = Array.from({ length: 6 }, (_, index) => index)

export default function NewsLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-7xl px-4 py-24 lg:px-8">
        <Skeleton className="mb-8 h-4 w-24" />

        <div className="mb-12 space-y-4">
          <Skeleton className="h-14 w-48 max-w-full" />
          <Skeleton className="h-6 w-96 max-w-full" />
        </div>

        <div className="mb-12 space-y-6">
          <Skeleton className="aspect-[16/9] w-full rounded-xl md:aspect-[21/9]" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-3/4 max-w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3 max-w-full" />
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {skeletonCards.map((card) => (
            <div key={card} className="flex flex-col gap-3">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
