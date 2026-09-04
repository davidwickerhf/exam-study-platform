import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex w-full flex-col">
      <div className="flex flex-col gap-2 border-b p-4 sm:p-6 lg:px-8"><Skeleton className="h-9 w-36" /><Skeleton className="h-4 w-[34rem] max-w-full" /></div>
      <Skeleton className="h-9 w-96 max-w-full" />
      <Skeleton className="h-[420px] w-full rounded-[14px]" />
    </div>
  );
}
