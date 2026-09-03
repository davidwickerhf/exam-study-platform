/** The tutor while its grounded course context loads. */

import { Skeleton } from '@/components/ui/skeleton'

const BAR = 'rounded-[4px] motion-reduce:animate-none'
const ROWS = [0, 1, 2]

export default function TutorLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8" role="status" aria-busy="true" aria-label="Loading the tutor">
      <header className="border-border flex flex-col gap-2 border-b pb-5">
        <Skeleton className={`h-8 w-40 ${BAR}`} />
        <Skeleton className={`h-4 w-[24rem] max-w-full ${BAR}`} />
      </header>
      <div className="flex flex-col">
        {ROWS.map((row) => (
          <div key={row} className="border-border flex flex-col gap-2 border-b py-4">
            <Skeleton className={`h-3.5 w-28 ${BAR}`} />
            <Skeleton className={`h-3.5 w-full max-w-[34rem] ${BAR}`} />
          </div>
        ))}
      </div>
      <Skeleton className={`h-10 w-full max-w-[46rem] ${BAR}`} />
    </div>
  )
}
