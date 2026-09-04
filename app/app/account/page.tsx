"use client";

/** Profile stays behind the account menu; operational settings have their own destination. */

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useJson } from "@/components/workspace/use-json";
import { type AccountSummary } from "@/lib/workspace/account.mjs";

/** What a tab looks like while its module is on the wire. */
function TabLoading() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * Each tab is fetched the first time it is opened. The options object is
 * repeated per call rather than shared: next/dynamic is read by the compiler,
 * not at runtime, and it requires an inline object literal here.
 */
const ProfileTab = dynamic(
  () => import("./profile-tab").then((module) => module.ProfileTab),
  { loading: TabLoading, ssr: false },
);
export default function AccountPage() {
  const summary = useJson<AccountSummary>("/api/account/summary");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && requested !== "profile") window.location.replace(`/app/settings?tab=${requested}`);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="border-b pb-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">
            Profile settings
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">Manage your identity, review your study record and control every piece of personal data attached to your account.</p>
        </div>
      </header>

      <ProfileTab summary={summary.data} summaryError={summary.error} reload={summary.reload} />
    </div>
  );
}
