/** Academic planning while the record is read. */

import { Skeleton } from '@/components/ui/skeleton'

const BAR = 'rounded-[4px] motion-reduce:animate-none'
const ROWS = [0, 1, 2, 3, 4]
const TABS = [0, 1, 2, 3, 4, 5]

export default function PlanningLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8" role="status" aria-busy="true" aria-label="Loading academic planning">
      <header className="flex flex-col gap-2">
        <Skeleton className={`h-8 w-56 ${BAR}`} />
        <Skeleton className={`h-4 w-[24rem] max-w-full ${BAR}`} />
      </header>
      <div className="border-border flex gap-6 overflow-hidden border-y py-3">
        {TABS.map((tab) => <Skeleton key={tab} className={`h-3.5 w-20 shrink-0 ${BAR}`} />)}
      </div>
      <div className="flex flex-col">
        {ROWS.map((row) => (
          <div key={row} className="border-border grid grid-cols-[7rem_minmax(0,1fr)_5rem] items-center gap-x-6 border-b py-4">
            <Skeleton className={`h-3.5 w-16 ${BAR}`} />
            <Skeleton className={`h-3.5 w-full max-w-[24rem] ${BAR}`} />
            <Skeleton className={`ml-auto h-3.5 w-12 ${BAR}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
