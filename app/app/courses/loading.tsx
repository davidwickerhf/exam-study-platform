/** The course ledger while it is being read. */

import { Skeleton } from '@/components/ui/skeleton'

const BAR = 'rounded-[4px] motion-reduce:animate-none'
const ROWS = [0, 1, 2, 3, 4]

export default function CoursesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8" role="status" aria-busy="true" aria-label="Loading your courses">
      <header className="border-border flex flex-col gap-2 border-b pb-5">
        <Skeleton className={`h-8 w-52 ${BAR}`} />
        <Skeleton className={`h-4 w-[24rem] max-w-full ${BAR}`} />
      </header>
      <div className="flex flex-col">
        {ROWS.map((row) => (
          <div key={row} className="border-border grid grid-cols-[7rem_minmax(0,1fr)_6rem] items-center gap-x-6 border-b py-4">
            <Skeleton className={`h-3.5 w-16 ${BAR}`} />
            <Skeleton className={`h-3.5 w-full max-w-[22rem] ${BAR}`} />
            <Skeleton className={`ml-auto h-3.5 w-14 ${BAR}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
