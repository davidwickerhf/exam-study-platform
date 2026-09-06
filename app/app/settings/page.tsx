"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useJson } from "@/components/workspace/use-json";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AccountSummary } from "@/lib/workspace/account.mjs";
import { TAB_LIST, TAB_TRIGGER } from "../account/shared";

function TabLoading() {
  return <div className="flex flex-col gap-4" aria-hidden="true"><Skeleton className="h-6 w-48" /><Skeleton className="h-48 w-full" /></div>;
}

const PersonalAiSettings = dynamic(() => import("@/components/workspace/personal-ai-settings").then((module) => module.PersonalAiSettings), { loading: TabLoading, ssr: false });
const ConnectionsTab = dynamic(() => import("../account/connections-tab").then((module) => module.ConnectionsTab), { loading: TabLoading, ssr: false });
const ApiTab = dynamic(() => import("../account/api-tab").then((module) => module.ApiTab), { loading: TabLoading, ssr: false });
const UsageTab = dynamic(() => import("../account/usage-tab").then((module) => module.UsageTab), { loading: TabLoading, ssr: false });
const DataTab = dynamic(() => import("../account/data-tab").then((module) => module.DataTab), { loading: TabLoading, ssr: false });

const AgentActivityTab = dynamic(() => import("../account/agent-activity-tab").then((module) => module.AgentActivityTab), { loading: TabLoading, ssr: false });

const TABS = [
  ["connections", "Connections"],
  ["api", "API access"],
  ["activity", "AI activity"],
  ["usage", "AI usage"],
  ["ai-key", "Your AI key"],
  ["data", "Data & privacy"],
] as const;

export default function SettingsPage() {

  const isMobile = useIsMobile();
  const [tab, setTab] = useState<string>("connections");
  const summary = useJson<AccountSummary>(tab === "data" ? "/api/account/summary" : null);

  useEffect(() => {
    const readTab = () => {
      const requested = new URLSearchParams(window.location.search).get("tab");
      setTab(TABS.some(([id]) => id === requested) ? String(requested) : "connections");
    };
    readTab();
    window.addEventListener("popstate", readTab);
    return () => window.removeEventListener("popstate", readTab);
  }, []);

  return (
    <div className="flex w-full flex-col">
      <header className="flex min-h-[6.5rem] items-center border-b px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">Settings</h1>
      </header>

      <Tabs
        orientation={isMobile ? "horizontal" : "vertical"}
        value={tab}
        onValueChange={(value) => {
          const next = String(value);
          setTab(next);
          history.replaceState(null, "", `/app/settings?tab=${next}`);
        }}
        className="items-stretch gap-0 lg:min-h-[calc(100dvh-6.5rem)]"
      >
        {isMobile ? (
          <TabsList data-tour="settings" variant="line" className={`${TAB_LIST} px-4 pt-4 sm:px-6`}>
            {TABS.map(([id, label]) => <TabsTrigger key={id} value={id} className={TAB_TRIGGER}>{label}</TabsTrigger>)}
          </TabsList>
        ) : (
          <div className="min-h-[calc(100dvh-6.5rem)] w-52 shrink-0 border-r">
            <TabsList data-tour="settings" variant="line" className="w-full items-stretch gap-0 px-4 py-4">
              {TABS.map(([id, label]) => <TabsTrigger key={id} value={id} className="h-10 justify-start rounded-none px-3 after:right-[-17px]">{label}</TabsTrigger>)}
            </TabsList>
          </div>
        )}
        <TabsContent value="connections" className="min-w-0 p-4 sm:p-6 lg:px-8 lg:py-6">{tab === "connections" && <ConnectionsTab />}</TabsContent>
        <TabsContent value="api" className="min-w-0 p-4 sm:p-6 lg:px-8 lg:py-5">{tab === "api" && <ApiTab />}</TabsContent>
        <TabsContent value="activity" className="min-w-0 p-4 sm:p-6 lg:px-8 lg:py-5">{tab === "activity" && <AgentActivityTab />}</TabsContent>
        <TabsContent value="ai-key" className="min-w-0 p-4 sm:p-6 lg:px-8 lg:py-5">{tab === "ai-key" && <PersonalAiSettings />}</TabsContent>
        <TabsContent value="usage" className="min-w-0 p-4 sm:p-6 lg:px-8 lg:py-5">{tab === "usage" && <UsageTab />}</TabsContent>
        <TabsContent value="data" className="min-w-0 p-4 sm:p-6 lg:px-8 lg:py-5">
          {tab === "data" && <DataTab summary={summary.data} summaryError={summary.error} reload={summary.reload} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
