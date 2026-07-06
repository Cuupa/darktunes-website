import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="relative h-[70vh] overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
      <div className="container mx-auto px-4 lg:px-8 pb-24 max-w-5xl space-y-8 pt-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-1/2" />
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
