import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 lg:px-8 pt-36 pb-24 max-w-3xl space-y-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-64" />
        <div className="space-y-3">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
