import { Skeleton } from '@/components/ui/skeleton'

export default function EpkBuilderLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[480px] w-full max-w-2xl mx-auto" />
    </div>
  )
}