/** A course page while its identity header and chapter register load. */

import { Skeleton } from '@/components/ui/skeleton'

const BAR = 'rounded-[4px] motion-reduce:animate-none'
const ROWS = [0, 1, 2, 3, 4]
const TABS = [0, 1, 2, 3]

export default function CourseLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8" role="status" aria-busy="true" aria-label="Loading this course">
      <header className="flex flex-col gap-2">
        <Skeleton className={`h-3 w-24 ${BAR}`} />
        <Skeleton className={`h-8 w-[26rem] max-w-full ${BAR}`} />
      </header>
      <div className="border-border flex gap-6 border-y py-3">
        {TABS.map((tab) => <Skeleton key={tab} className={`h-3.5 w-20 ${BAR}`} />)}
      </div>
      <div className="flex flex-col">
        {ROWS.map((row) => (
          <div key={row} className="border-border grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-x-6 border-b py-4">
            <Skeleton className={`h-3.5 w-8 ${BAR}`} />
            <Skeleton className={`h-3.5 w-full max-w-[26rem] ${BAR}`} />
            <Skeleton className={`ml-auto h-3.5 w-12 ${BAR}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
