"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, ActivityIcon, PauseIcon, PlayIcon, RefreshCwIcon, SearchIcon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { readJson } from "@/components/workspace/use-json";
import { cn } from "@/lib/utils";
import { cleanCanvasName } from "@/lib/workspace/course-ledger.mjs";

type Job = { id: string; type: string; status: string; attempts: number; courseCode?: string; courseName?: string; academicYear?: string; heartbeatAt?: string; lastEventAt?: string; createdAt: string; runAfter?: string; stage?: string; lastMessage?: string; completed?: number; total?: number };
type Event = { id: string; jobId: string; attempt: number; stage: string; level: string; message: string; item?: string; completed?: number; total?: number; createdAt: string; courseCode?: string; academicYear?: string; type: string };
type Log = { available: boolean; jobs: Job[]; events: Event[]; nextCursor: string | null };
const stages: Record<string, string> = { queue: "Queue", discovery: "Discovery", download: "Downloads", extraction: "Document text", indexing: "Search index", rules: "Course rules" };
const states: Record<string, string> = { pending: "Queued", running: "Running", completed: "Finished", failed: "Needs attention", cancelled: "Stopped" };
const title = (job: { type: string; courseCode?: string; academicYear?: string }) => job.type === "catalog" ? "Course discovery" : `${job.courseCode || "Canvas course"} · ${job.academicYear || "Year unavailable"}`;
function elapsed(value?: string) { if (!value) return "Not recorded"; const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`; }
function time(value: string) { return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

function LogPortal() {
  const params = useSearchParams();
  const router = useRouter();
  const selected = params.get("job") || "";
  const [stage, setStage] = useState("");
  const [attention, setAttention] = useState(false);
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const [live, setLive] = useState(true);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<Log | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const before = cursors.at(-1) || "";
  const path = `/api/account/integrations/canvas/corpus/logs?${new URLSearchParams({ job: selected, stage, level: attention ? "attention" : "", before })}`;
  useEffect(() => { setCursors([]); }, [selected, stage, attention]);
  useEffect(() => {
    let active = true;
    let pending = false;
    const controller = new AbortController();
    setData(null);
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await readJson<Log>(path, { signal: controller.signal });
        if (active) { setData(result); setError(null); setCheckedAt(new Date().toISOString()); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Could not load sync logs."); }
      finally { pending = false; }
    };
    void load();
    const timer = setInterval(() => { if (liveRef.current && !before && document.visibilityState === "visible") void load(); }, 5000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, [path, before, refresh]);
  const job = data?.jobs.find(row => row.id === selected);
  const jobs = data?.jobs.filter(row => `${title(row)} ${row.courseName || ""}`.toLowerCase().includes(query.toLowerCase())) || [];
  const choose = (id: string) => { setCursors([]); router.replace(`/app/settings/canvas-sync/logs${id ? `?job=${encodeURIComponent(id)}` : ""}`, { scroll: false }); };
  const quiet = job?.status === "running" && job.lastEventAt && Date.now() - new Date(job.lastEventAt).getTime() > 5 * 60_000;
  const stale = job?.status === "running" && (!job.heartbeatAt || Date.now() - new Date(job.heartbeatAt).getTime() > 90_000);
  return <div className="flex min-w-0 flex-1 flex-col">
    <header className="border-b px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-start justify-between gap-4">
        <div><Link href="/app/settings/canvas-sync" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-semibold"><ArrowLeftIcon className="size-3.5" /> Canvas sync</Link>
          <h1 className="font-heading mt-3 text-[32px] font-semibold leading-tight tracking-[-0.035em]">Sync logs</h1>
          <p className="text-muted-foreground mt-2 text-sm">Follow each course edition from discovery to searchable material and course rules.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setLive(!live)}>{live ? <PauseIcon /> : <PlayIcon />}{live ? "Pause updates" : "Resume updates"}</Button><Button variant="ghost" aria-label="Refresh logs" onClick={() => setRefresh(v => v + 1)}><RefreshCwIcon /></Button></div>
      </div>
    </header>
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      {error && <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-destructive/25 p-4 text-sm"><AlertCircleIcon className="size-4 shrink-0 text-destructive" />{error} <button onClick={() => setRefresh(v => v + 1)} className="ml-auto font-semibold underline">Retry</button></div>}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside aria-label="Sync processes" className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between"><h2 className="text-sm font-semibold">Processes</h2><span className="text-xs text-muted-foreground">Latest 100 syncs</span></div>
          <div className="relative mb-3"><SearchIcon className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Find a course or year" placeholder="Find a course or year" value={query} onChange={e => setQuery(e.target.value)} className="pl-9" /></div>
          <button onClick={() => choose("")} aria-pressed={!selected} className={cn("mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-semibold", !selected ? "bg-muted" : "hover:bg-muted/50")}><ActivityIcon className="size-4" /> All processes</button>
          <div className="max-h-64 overflow-y-auto lg:max-h-[65vh]">
            {!data && !error ? <Skeleton className="h-28 w-full" /> : jobs.map(row => <button key={row.id} onClick={() => choose(row.id)} aria-pressed={selected === row.id} className={cn("mb-1 w-full rounded-lg px-3 py-3 text-left", selected === row.id ? "bg-muted" : "hover:bg-muted/50")}>
              <span className="flex items-center justify-between gap-2 text-xs font-semibold"><span>{title(row)}</span><span className={cn("size-1.5 shrink-0 rounded-full", row.status === "running" ? "bg-primary" : row.status === "failed" ? "bg-destructive" : "bg-muted-foreground/40")} /></span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{row.type === "catalog" ? "Find enrolled course editions" : cleanCanvasName(row.courseName || "", row.courseCode || "")}</span>
              <span className="mt-2 block text-[11px] text-muted-foreground">{states[row.status]} · {row.status === "running" && row.stage ? stages[row.stage] : time(row.createdAt)}</span>
            </button>)}
            {data && !jobs.length && <p className="px-3 py-4 text-xs text-muted-foreground">{query ? "No matching processes." : "No syncs recorded yet."}</p>}
          </div>
        </aside>
        <section className="min-w-0 overflow-hidden rounded-xl border bg-card" aria-label="Event timeline">
          <div className="border-b px-4 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{job ? title(job) : selected ? "Sync details" : "All activity"}</h2><p className="mt-1 text-xs text-muted-foreground">{job ? `${states[job.status]} · ${job.attempts} worker attempt${job.attempts === 1 ? "" : "s"}` : "Discovery and course syncs, newest events first."}</p></div>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("size-1.5 rounded-full", live && !before && !error ? "bg-primary" : "bg-muted-foreground")} />{before ? "Older events" : !live ? "Updates paused" : error ? "Connection interrupted" : "Updates every 5s"}</span>
            </div>
            {job && <><dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 text-xs"><div><dt className="text-muted-foreground">Last progress</dt><dd className="mt-1 font-medium">{elapsed(job.lastEventAt)}</dd><dd className="mt-1 text-muted-foreground">{job.lastMessage || "Detailed logging was not available for this run."}</dd></div><div><dt className="text-muted-foreground">Worker heartbeat</dt><dd className="mt-1 font-medium">{elapsed(job.heartbeatAt)}</dd><dd className="mt-1 text-muted-foreground">{job.status === "running" ? "Confirms the worker is connected, not that a stage has finished." : job.status === "pending" ? `Scheduled after ${time(job.runAfter || job.createdAt)}` : "This process is no longer running."}</dd></div></dl>
              {(quiet || stale) && <p className="mt-4 border-l-2 border-amber-600 pl-3 text-xs leading-relaxed">{stale ? "The worker heartbeat is late. The process may be interrupted." : "No new progress event for over 5 minutes. A large file or course-rule analysis may still be processing."} <Link href="/app/settings/canvas-sync" className="font-semibold underline">Open sync controls</Link></p>}
            </>}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">Stage<select aria-label="Filter by stage" value={stage} onChange={e => setStage(e.target.value)} className="h-9 max-w-full rounded-md border bg-card px-2 text-sm text-foreground"><option value="">All stages</option>{Object.entries(stages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button onClick={() => setAttention(!attention)} aria-pressed={attention} className={cn("rounded-md px-3 py-2 text-xs font-medium", attention ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}>Warnings & errors</button>
            <span className="ml-auto text-[11px] text-muted-foreground">Times are local</span>
          </div>
          {!data && !error ? <div className="space-y-4 p-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : data?.events.length ? <ol>{data.events.map(event => <li key={event.id} className="grid gap-2 border-b px-4 py-4 last:border-0 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-5 sm:px-6">
            <time dateTime={event.createdAt} className="text-[11px] tabular-nums text-muted-foreground">{time(event.createdAt)}</time>
            <div className="min-w-0"><div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">{stages[event.stage]}</span><span>· {title(event)}</span>{event.attempt > 0 && <span>· Attempt {event.attempt}</span>}{event.level !== "info" && <span className={event.level === "error" ? "text-destructive" : "text-amber-700"}>{event.level === "error" ? "Error" : "Warning"}</span>}</div>
              <p className="text-sm leading-relaxed">{event.message}{event.completed != null && <span className="ml-2 font-semibold tabular-nums">{event.completed}{event.total != null ? ` / ${event.total}` : ""}</span>}</p>
              {event.item && <p className="mt-1 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{event.item}</p>}
              {!selected && <Link href={`/app/settings/canvas-sync/logs?job=${encodeURIComponent(event.jobId)}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">View this process</Link>}
            </div>
          </li>)}</ol> : !error && <div className="px-6 py-16 text-center"><ActivityIcon className="mx-auto mb-3 size-6 text-muted-foreground" /><h3 className="text-sm font-semibold">{stage || attention ? "No matching events" : "No detailed events yet"}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{!data?.available ? "Detailed logs are available with hosted Canvas collection." : stage || attention ? "Choose another stage or show all event levels." : "Detailed events appear as new syncs run. Earlier runs retain their status and results on Canvas sync."}</p><Link href="/app/settings/canvas-sync" className="mt-4 inline-block text-sm font-semibold text-primary">Go to Canvas sync</Link></div>}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs sm:px-6"><span className="text-muted-foreground">{checkedAt ? `Checked ${time(checkedAt)}` : "Waiting for activity"}</span><div className="flex gap-2">{before && <Button variant="ghost" size="sm" onClick={() => setCursors([])}>Latest events</Button>}{data?.nextCursor && <Button variant="outline" size="sm" onClick={() => setCursors(v => [...v, data.nextCursor!])}>Older events</Button>}</div></footer>
        </section>
      </div>
    </main>
  </div>;
}
export default function CanvasSyncLogsPage() { return <Suspense fallback={<Skeleton className="m-8 h-64" />}><LogPortal /></Suspense>; }
