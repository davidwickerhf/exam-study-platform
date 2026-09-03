/**
 * The board while it is still arriving.
 *
 * Every workspace destination opens with the same frame — a title over a rule,
 * then ruled rows — so the placeholder is that frame with its content withheld
 * rather than a spinner over an empty page.
 */

import { Skeleton } from '@/components/ui/skeleton'

const BAR = 'rounded-[4px] motion-reduce:animate-none'
const ROWS = [0, 1, 2, 3, 4]

export default function WorkspaceLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8" role="status" aria-busy="true" aria-label="Loading your board">
      <header className="border-border flex flex-col gap-2 border-b pb-5">
        <Skeleton className={`h-8 w-64 ${BAR}`} />
        <Skeleton className={`h-4 w-[20rem] max-w-full ${BAR}`} />
      </header>
      <div className="flex flex-col">
        {ROWS.map((row) => (
          <div key={row} className="border-border grid grid-cols-[5rem_minmax(0,1fr)_4rem] items-center gap-x-6 border-b py-4">
            <Skeleton className={`h-3.5 w-14 ${BAR}`} />
            <Skeleton className={`h-3.5 w-full max-w-[24rem] ${BAR}`} />
            <Skeleton className={`ml-auto h-3.5 w-12 ${BAR}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
