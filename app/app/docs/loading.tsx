import { Skeleton } from "@/components/ui/skeleton";

export default function DocsLoading() {
  return <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8" role="status" aria-label="Loading documentation"><div className="space-y-3 border-b pb-6"><Skeleton className="h-3 w-20" /><Skeleton className="h-9 w-80 max-w-full" /><Skeleton className="h-4 w-[34rem] max-w-full" /></div><Skeleton className="h-80 w-full rounded-xl" /><div className="grid gap-5 md:grid-cols-2"><Skeleton className="h-44 rounded-xl" /><Skeleton className="h-44 rounded-xl" /></div></div>;
}
