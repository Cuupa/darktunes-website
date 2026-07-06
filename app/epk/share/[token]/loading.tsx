import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md space-y-6 px-4">
        <Skeleton className="h-10 w-48 mx-auto" />
        <Skeleton className="h-5 w-72 mx-auto" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  )
}
