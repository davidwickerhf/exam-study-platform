import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="-mx-4 flex flex-col gap-2 border-b px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"><Skeleton className="h-9 w-40" /><Skeleton className="h-4 w-[34rem] max-w-full" /></div>
      <Skeleton className="h-[460px] w-full rounded-[14px]" />
      <Skeleton className="h-72 w-full rounded-[14px]" />
    </div>
  );
}
