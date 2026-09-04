/** The calendar while its unified feed is assembled. */

import { Skeleton } from '@/components/ui/skeleton'

const BAR = 'rounded-[4px] motion-reduce:animate-none'
const VIEWS = [0, 1, 2, 3]

export default function CalendarLoading() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col md:h-dvh" role="status" aria-busy="true" aria-label="Loading your calendar">
      <header className="flex min-h-[72px] shrink-0 items-center gap-3 border-b px-4 sm:px-6">
        <Skeleton className={`h-10 w-24 ${BAR}`} />
        <Skeleton className={`h-10 w-20 ${BAR}`} />
        <Skeleton className={`h-8 w-20 ${BAR}`} />
        <Skeleton className={`h-5 w-44 ${BAR}`} />
        <div className="ml-auto flex gap-1 rounded-lg border p-1">
          {VIEWS.map((view) => <Skeleton key={view} className={`h-8 w-16 ${BAR}`} />)}
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_290px] 2xl:grid-cols-[214px_minmax(0,1fr)_310px]">
        <aside className="hidden border-r p-4 2xl:block"><Skeleton className="h-60 w-full rounded-none" /></aside>
        <main className="grid min-h-0 grid-cols-7 gap-px overflow-hidden bg-border">
          {Array.from({ length: 35 }).map((_, index) => <Skeleton key={index} className="min-h-24 rounded-none" />)}
        </main>
        <aside className="hidden border-l p-5 lg:block">
          <Skeleton className={`h-3 w-16 ${BAR}`} />
          <Skeleton className={`mt-3 h-7 w-44 ${BAR}`} />
          <div className="mt-6 grid grid-cols-3 gap-px border-y py-4"><Skeleton className={`h-10 ${BAR}`} /><Skeleton className={`h-10 ${BAR}`} /><Skeleton className={`h-10 ${BAR}`} /></div>
          <Skeleton className={`mt-5 h-4 w-24 ${BAR}`} />
        </aside>
      </div>
    </div>
  )
}
