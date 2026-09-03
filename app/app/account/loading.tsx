/** Account while identity, usage, and storage figures are read. */

import { Skeleton } from '@/components/ui/skeleton'

const BAR = 'rounded-[4px] motion-reduce:animate-none'
const ROWS = [0, 1, 2, 3]
const TABS = [0, 1, 2, 3]

export default function AccountLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8" role="status" aria-busy="true" aria-label="Loading your account">
      <header className="flex flex-col gap-2">
        <Skeleton className={`h-8 w-44 ${BAR}`} />
        <Skeleton className={`h-4 w-[22rem] max-w-full ${BAR}`} />
      </header>
      <div className="border-border flex gap-6 border-y py-3">
        {TABS.map((tab) => <Skeleton key={tab} className={`h-3.5 w-20 ${BAR}`} />)}
      </div>
      <div className="flex flex-col">
        {ROWS.map((row) => (
          <div key={row} className="border-border grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-x-6 border-b py-4">
            <Skeleton className={`h-3.5 w-24 ${BAR}`} />
            <Skeleton className={`h-3.5 w-full max-w-[20rem] ${BAR}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
