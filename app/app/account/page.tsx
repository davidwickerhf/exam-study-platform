"use client";

/**
 * The account, migrated.
 *
 * Five tabs, five modules. This file is the destination frame and nothing
 * else: the standard page header, the flat local tab row, and the loader that
 * fetches a tab's code the first time it is opened. Splitting them mattered —
 * the surface was one 1,950-line module, so a student opening Profile paid to
 * parse the Canvas connection forms, the API key table, the allowance meters
 * and the storage tables as well.
 *
 * The page is titled for what it is. It used to be titled with whatever the
 * account's email happened to start with, so a test address set the largest
 * type on the screen to "wicker.data+clerk_test". A name and an address are
 * facts about the account; they belong on the line under the title, which is
 * where every other destination puts its secondary copy.
 *
 * The tab ids are load-bearing: `?tab=connections` is where old
 * `#/account/connections` links land.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useJson } from "@/components/workspace/use-json";
import { type AccountSummary, formatCount } from "@/lib/workspace/account.mjs";
import { NUMERALS, TAB_LIST, TAB_TRIGGER, longDate } from "./shared";

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
const ConnectionsTab = dynamic(
  () => import("./connections-tab").then((module) => module.ConnectionsTab),
  { loading: TabLoading, ssr: false },
);
const ApiTab = dynamic(
  () => import("./api-tab").then((module) => module.ApiTab),
  { loading: TabLoading, ssr: false },
);
const UsageTab = dynamic(
  () => import("./usage-tab").then((module) => module.UsageTab),
  { loading: TabLoading, ssr: false },
);
const DataTab = dynamic(
  () => import("./data-tab").then((module) => module.DataTab),
  { loading: TabLoading, ssr: false },
);

const TABS = [
  ["profile", "Profile"],
  ["connections", "Connections"],
  ["api", "API access"],
  ["usage", "AI usage"],
  ["data", "Data & privacy"],
] as const;

export default function AccountPage() {
  const summary = useJson<AccountSummary>("/api/account/summary");
  const [tab, setTab] = useState<string>("profile");
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (TABS.some(([id]) => id === requested)) setTab(requested as string);
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
      .join(" · ") || "Your identity, connections, keys, allowance and data.";

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b pb-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">
            Account
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

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = String(value);
          setTab(next);
          history.replaceState(null, "", `/app/account?tab=${next}`);
        }}
        className="gap-6"
      >
        <TabsList variant="line" className={TAB_LIST}>
          {TABS.map(([id, label]) => (
            <TabsTrigger key={id} value={id} className={TAB_TRIGGER}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile">
          {tab === "profile" && (
            <ProfileTab summary={summary.data} summaryError={summary.error} />
          )}
        </TabsContent>
        <TabsContent value="connections">
          {tab === "connections" && <ConnectionsTab />}
        </TabsContent>
        <TabsContent value="api">{tab === "api" && <ApiTab />}</TabsContent>
        <TabsContent value="usage">
          {tab === "usage" && <UsageTab />}
        </TabsContent>
        <TabsContent value="data">
          {tab === "data" && (
            <DataTab
              summary={summary.data}
              summaryError={summary.error}
              reload={summary.reload}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
