"use client";

/** Profile stays behind the account menu; operational settings have their own destination. */

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useJson } from "@/components/workspace/use-json";
import { type AccountSummary, formatCount } from "@/lib/workspace/account.mjs";
import { NUMERALS, longDate } from "./shared";

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

  const account = summary.data?.account;
  const name =
    [account?.firstName, account?.lastName].filter(Boolean).join(" ") || null;
  const since = longDate(account?.createdAt);
  const secondary =
    [
      name,
      account?.email ??
        (account?.mode === "local" ? "Local development account" : null),
      since ? `member since ${since}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Your identity and study record.";

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="-mx-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">
            Profile
          </h1>
          {summary.data || summary.error ? (
            <p
              className={`text-muted-foreground text-sm [overflow-wrap:anywhere] ${NUMERALS}`}
            >
              {summary.error
                ? "Your account record could not be read."
                : secondary}
            </p>
          ) : (
            <Skeleton className="h-4 w-64" />
          )}
        </div>
        {/* The meter: how much of this account there is to look at. */}
        {summary.data && (
          <p className={`text-muted-foreground text-sm ${NUMERALS}`}>
            {formatCount(summary.data.totals.documents)} stored records
          </p>
        )}
      </header>

      <ProfileTab summary={summary.data} summaryError={summary.error} />
    </div>
  );
}
