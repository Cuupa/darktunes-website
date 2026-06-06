import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="relative h-[60vh] overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
      <div className="container mx-auto px-4 lg:px-8 pb-24 space-y-8 -mt-32 relative z-10">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}
