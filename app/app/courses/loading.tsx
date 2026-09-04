/** The degree runway and active course desk while their sources are loading. */

import { Skeleton } from "@/components/ui/skeleton";

const BAR = "motion-reduce:animate-none";
export default function CoursesLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      role="status"
      aria-busy="true"
      aria-label="Loading your courses"
    >
      <header className="flex flex-col gap-2">
        <Skeleton className={`h-10 w-44 rounded-[4px] ${BAR}`} />
        <Skeleton className={`h-4 w-[38rem] max-w-full rounded-[4px] ${BAR}`} />
      </header>
      <Skeleton className={`h-56 w-full rounded-xl ${BAR}`} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton className={`h-[36rem] w-full rounded-xl ${BAR}`} />
        <div className="flex flex-col gap-4">
          <Skeleton className={`h-32 w-full rounded-xl ${BAR}`} />
          <Skeleton className={`h-64 w-full rounded-xl ${BAR}`} />
          <Skeleton className={`h-72 w-full rounded-xl ${BAR}`} />
        </div>
      </div>
    </div>
  );
}
