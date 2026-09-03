/** Setup while the conversation and its checklist are restored. */

import { Skeleton } from '@/components/ui/skeleton'

const BAR = 'rounded-[4px] motion-reduce:animate-none'
const ROWS = [0, 1, 2]

export default function SetupLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8" role="status" aria-busy="true" aria-label="Loading setup">
      <header className="border-border flex flex-col gap-2 border-b pb-5">
        <Skeleton className={`h-8 w-48 ${BAR}`} />
        <Skeleton className={`h-4 w-[22rem] max-w-full ${BAR}`} />
      </header>
      <div className="flex flex-col">
        {ROWS.map((row) => (
          <div key={row} className="border-border grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-4 border-b py-4">
            <Skeleton className={`size-4 ${BAR}`} />
            <Skeleton className={`h-3.5 w-full max-w-[28rem] ${BAR}`} />
          </div>
        ))}
      </div>
      <Skeleton className={`h-10 w-full max-w-[46rem] ${BAR}`} />
    </div>
  )
}
