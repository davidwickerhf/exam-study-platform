import { Skeleton } from '@/components/ui/skeleton'

export default function CourseLoading() {
  return <div className="w-full" role="status" aria-busy="true" aria-label="Loading this course">
    <header className="border-b px-4 py-6 sm:px-6 lg:px-8"><Skeleton className="mb-5 h-3 w-24" /><Skeleton className="h-9 w-full max-w-lg" /><Skeleton className="mt-3 h-4 w-48" /></header>
    <div className="mx-auto max-w-[1280px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="flex gap-5 overflow-hidden border-b pb-4">{[0,1,2,3,4].map(n=><Skeleton key={n} className="h-4 w-24 shrink-0" />)}</div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]"><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
    </div>
  </div>
}
