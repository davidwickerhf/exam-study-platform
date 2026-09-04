"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleStopIcon,
  Clock3Icon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { CanvasMark } from "@/components/brand/canvas-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { readJson, useJson } from "@/components/workspace/use-json";
import { cn } from "@/lib/utils";
import {
  type CorpusJob,
  type CorpusStatus,
  canvasCorpusSummary,
  canvasSyncProgress,
} from "@/lib/workspace/account.mjs";
import { NUMERALS, relative } from "../../account/shared";

type CanvasConnection = { origin: string };
type View = "courses" | "history";
type StatusFilter = "all" | "active" | "attention" | "completed";

const POLL_MS = 10_000;
const ACTIVE = new Set(["pending", "running"]);

function jobLabel(job: CorpusJob) {
  if (job.status === "running") return job.error ? "Retrying" : "Indexing";
  if (job.status === "pending") return job.error ? "Retry queued" : "Queued";
  if (job.status === "completed") return "Complete";
  if (job.status === "failed") return "Needs attention";
  if (job.status === "cancelled") return "Stopped";
  return job.status || "Unknown";
}

function JobStatus({ job }: { job: CorpusJob }) {
  const active = ACTIVE.has(job.status);
  const failed = job.status === "failed";
  const complete = job.status === "completed";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold whitespace-nowrap",
        active && "border-primary/25 bg-primary/6 text-primary",
        failed && "border-destructive/20 bg-destructive/6 text-destructive",
        complete && "border-border bg-background text-foreground",
        !active && !failed && !complete && "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-border-strong",
          active && "bg-primary motion-safe:animate-pulse",
          failed && "bg-destructive",
          complete && "bg-foreground",
        )}
      />
      {jobLabel(job)}
    </span>
  );
}

function when(job: CorpusJob) {
  const value = job.finishedAt || job.startedAt || job.createdAt;
  return value ? relative(value) : "Time unavailable";
}

function matchesFilter(job: CorpusJob, filter: StatusFilter) {
  if (filter === "active") return ACTIVE.has(job.status);
  if (filter === "attention") return job.status === "failed";
  if (filter === "completed") return job.status === "completed";
  return true;
}

function matchesSearch(job: CorpusJob, query: string) {
  if (!query) return true;
  return [
    job.courseCode,
    job.courseName,
    job.academicYear,
    job.type,
    job.error,
    job.origin,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
    .includes(query.toLocaleLowerCase());
}

function AttemptLine({ job }: { job: CorpusJob }) {
  return (
    <li className="grid gap-2 border-t px-4 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-start sm:px-5">
      <span className="min-w-0">
        <span className="font-medium">
          Attempt {job.attempts || 1}
          {job.syncId ? <span className="text-muted-foreground font-normal"> · run {job.syncId.slice(0, 8)}</span> : null}
        </span>
        {job.error ? (
          <span className="text-muted-foreground mt-1 block max-w-[80ch] [overflow-wrap:anywhere]">
            {ACTIVE.has(job.status) ? "Previous attempt: " : ""}{job.error}
          </span>
        ) : null}
      </span>
      <span className={`text-muted-foreground ${NUMERALS}`}>{when(job)}</span>
      <JobStatus job={job} />
    </li>
  );
}

function CourseRow({ job, attempts }: { job: CorpusJob; attempts: CorpusJob[] }) {
  const indexed = Number(job.result?.indexed) || 0;
  const skipped = Number(job.result?.skipped) || 0;
  return (
    <details className="group border-b last:border-b-0">
      <summary className="hover:bg-muted/35 focus-visible:outline-ring grid cursor-pointer list-none gap-3 px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:grid-cols-[minmax(15rem,1.6fr)_minmax(8rem,.7fr)_minmax(8rem,.7fr)_9rem_auto] sm:items-center sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="flex min-w-0 items-baseline gap-2">
            <strong className={`${NUMERALS} shrink-0 text-sm`}>{job.courseCode || "Canvas course"}</strong>
            {job.courseName && <span className="text-muted-foreground truncate text-sm">{job.courseName}</span>}
          </span>
          {job.error && ACTIVE.has(job.status) ? <small className="text-muted-foreground mt-1 block truncate">Previous attempt: {job.error}</small> : null}
        </span>
        <span className="text-muted-foreground text-xs">{job.academicYear || "Year not supplied"}</span>
        <span className={`text-xs ${NUMERALS}`}>
          {job.status === "completed" ? `${indexed} indexed${skipped ? ` · ${skipped} skipped` : ""}` : ACTIVE.has(job.status) ? "Collection in progress" : "No material stored"}
        </span>
        <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{when(job)}</span>
        <span className="flex items-center justify-between gap-2 sm:justify-end">
          <JobStatus job={job} />
          <ChevronDownIcon className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="bg-muted/25 border-t">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.1em] uppercase">Attempt history</span>
          <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{attempts.length} recorded</span>
        </div>
        <ul>{attempts.slice(0, 8).map((attempt) => <AttemptLine key={attempt.id} job={attempt} />)}</ul>
      </div>
    </details>
  );
}

export default function CanvasSyncPage() {
  const statusResource = useJson<{ status: CorpusStatus }>("/api/account/integrations/canvas/corpus");
  const connectionsResource = useJson<{ connections: CanvasConnection[] }>("/api/account/integrations/canvas");
  const [view, setView] = useState<View>("courses");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"refresh" | "retry" | "stop" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const corpus = useMemo(() => canvasCorpusSummary(statusResource.data?.status), [statusResource.data]);
  const progress = useMemo(() => canvasSyncProgress(statusResource.data?.status), [statusResource.data]);
  const courseJobs = useMemo(() => corpus.latestByCourse.filter((job) => job.type === "course" || Boolean(job.courseCode)), [corpus.latestByCourse]);
  const completed = courseJobs.filter((job) => job.status === "completed").length;
  const attention = courseJobs.filter((job) => job.status === "failed").length;

  useEffect(() => {
    if (!progress.active) return;
    let timer = 0;
    const stop = () => { if (timer) window.clearInterval(timer); timer = 0; };
    const start = () => { if (!timer) timer = window.setInterval(statusResource.reload, POLL_MS); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") { statusResource.reload(); start(); }
      else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [progress.active, statusResource.reload]);

  const visibleJobs = useMemo(() => {
    const source = view === "courses" ? courseJobs : corpus.jobs;
    return source.filter((job) => matchesFilter(job, filter) && matchesSearch(job, query.trim()));
  }, [corpus.jobs, courseJobs, filter, query, view]);

  const origins = useMemo(() => {
    const fromConnections = connectionsResource.data?.connections.map((connection) => connection.origin) ?? [];
    return [...new Set([...corpus.jobs.map((job) => job.origin).filter((origin): origin is string => Boolean(origin)), ...fromConnections])];
  }, [connectionsResource.data, corpus.jobs]);

  async function refreshStatus() {
    setBusy("refresh");
    setActionError(null);
    statusResource.reload();
    window.setTimeout(() => setBusy(null), 450);
  }

  async function retryFailed() {
    if (!origins.length) return;
    setBusy("retry");
    setActionError(null);
    setNotice(null);
    try {
      await Promise.all(origins.map((origin) => readJson("/api/integrations/canvas/corpus/sync", {
        method: "POST",
        body: JSON.stringify({ canvasUrl: origin, force: true }),
      })));
      setNotice("A fresh material scan is queued. Previous attempts remain in the run history.");
      statusResource.reload();
    } catch (cause) {
      setActionError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function stopQueued() {
    if (!origins.length) return;
    setBusy("stop");
    setActionError(null);
    setNotice(null);
    try {
      const results = await Promise.all(origins.map((origin) => readJson<{ cancelled: number }>("/api/integrations/canvas/corpus/sync", {
        method: "DELETE",
        body: JSON.stringify({ canvasUrl: origin }),
      })));
      const cancelled = results.reduce((sum, result) => sum + (result.cancelled || 0), 0);
      setNotice(cancelled ? `${cancelled} queued ${cancelled === 1 ? "job" : "jobs"} stopped. Work already indexing finishes safely.` : "No queued work remained to stop.");
      statusResource.reload();
    } catch (cause) {
      setActionError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const statusHeading = progress.active
    ? progress.stage || "Canvas material collection is running"
    : attention
      ? `${attention} ${attention === 1 ? "course needs" : "courses need"} attention`
      : courseJobs.length
        ? "Canvas material is up to date"
        : "No material collection has run yet";

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="border-b px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-start justify-between gap-5">
          <div>
            <Link href="/app/settings?tab=connections" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-semibold">
              <ArrowLeftIcon className="size-3.5" /> Connections
            </Link>
            <h1 className="font-heading mt-3 text-[32px] leading-[1.05] font-semibold tracking-[-0.035em]">Canvas sync</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm">Track collection by course, understand failures, and keep every retry inspectable.</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" onClick={() => void refreshStatus()} disabled={busy !== null}>
              <RefreshCwIcon className={cn(busy === "refresh" && "animate-spin")} data-icon="inline-start" /> Refresh
            </Button>
            <Link href="/app/updates?tab=materials" className="text-primary px-2 text-sm font-semibold hover:underline">Course material</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {statusResource.error ? (
          <div role="alert" className="border-destructive/25 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm">
            <AlertCircleIcon className="text-destructive mt-0.5 size-4 shrink-0" />
            <span><strong>Sync activity is unavailable.</strong><span className="text-muted-foreground mt-0.5 block">{statusResource.error}</span></span>
          </div>
        ) : !statusResource.data ? (
          <div className="rounded-xl border p-5"><Skeleton className="h-5 w-64" /><Skeleton className="mt-4 h-1 w-full" /><Skeleton className="mt-6 h-16 w-full" /></div>
        ) : (
          <>
            <section className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-sheet)]" aria-labelledby="current-run-title">
              <div className="flex flex-wrap items-start gap-4 px-5 py-5 sm:px-6">
                <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-lg"><CanvasMark className="size-5 text-[#e13f2f]" /></span>
                <div className="min-w-56 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 id="current-run-title" className="text-base font-semibold">{statusHeading}</h2>
                    {progress.active ? <span className="text-primary text-[10px] font-semibold tracking-[0.1em] uppercase">Live</span> : null}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{progress.active ? "Collection continues on the server if you leave this page." : attention ? "The rest of your stored material remains available while these imports are retried." : "The next refresh keeps attempt history and only replaces changed material."}</p>
                  {progress.active && progress.percent != null ? (
                    <div className="mt-4 max-w-3xl">
                      <div className={`text-muted-foreground mb-2 flex justify-between text-xs ${NUMERALS}`}><span>{progress.completedCourses} of {progress.totalCourses} courses settled</span><span>{progress.percent}%</span></div>
                      <Progress value={progress.percent} className="h-1" />
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {attention ? <Button variant="outline" size="sm" disabled={busy !== null || !origins.length} onClick={() => void retryFailed()}><RefreshCwIcon className={cn(busy === "retry" && "animate-spin")} data-icon="inline-start" />Retry scan</Button> : null}
                  {progress.active ? <Button variant="ghost" size="sm" disabled={busy !== null || !origins.length} onClick={() => void stopQueued()}><CircleStopIcon data-icon="inline-start" />Stop queued</Button> : null}
                </div>
              </div>
              <dl className="grid border-t sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["In progress", progress.activeJobs.length],
                  ["Course editions", corpus.courseEditions],
                  ["Materials stored", corpus.storedMaterials],
                  ["Needs attention", attention],
                ].map(([label, value], index) => (
                  <div key={String(label)} className={cn("px-5 py-4 sm:px-6", index > 0 && "sm:border-l", index === 2 && "sm:border-l-0 lg:border-l")}>
                    <dt className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">{label}</dt>
                    <dd className={`mt-1 text-xl font-semibold ${NUMERALS}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {(notice || actionError) && (
              <div role={actionError ? "alert" : "status"} className={cn("flex items-start gap-2.5 border-l-2 py-1 pl-3 text-sm", actionError ? "border-destructive" : "border-primary")}>
                {actionError ? <AlertCircleIcon className="text-destructive mt-0.5 size-4 shrink-0" /> : <CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />}
                <span>{actionError || notice}</span>
              </div>
            )}

            {corpus.failureGroups.length ? (
              <section className="rounded-lg border" aria-labelledby="attention-title">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                  <AlertCircleIcon className="text-destructive size-4 shrink-0" />
                  <div className="min-w-56 flex-1">
                    <h2 id="attention-title" className="text-sm font-semibold">What needs attention</h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">Repeated errors are grouped so one server problem does not become a wall of messages.</p>
                  </div>
                  <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{corpus.failed.length} failed attempts</span>
                </div>
                <div className="border-t">
                  {corpus.failureGroups.map(([message, jobs]) => (
                    <details key={message} className="group border-b last:border-b-0">
                      <summary className="hover:bg-muted/35 grid cursor-pointer list-none gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5 [&::-webkit-details-marker]:hidden">
                        <span className="font-medium [overflow-wrap:anywhere]">{message}</span>
                        <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{jobs.length} {jobs.length === 1 ? "course" : "courses"}</span>
                        <ChevronDownIcon className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="text-muted-foreground bg-muted/25 border-t px-4 py-3 text-xs sm:px-5">{jobs.map((job) => job.courseCode || job.courseName || "Canvas catalog").join(" · ")}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="activity-title">
              <div className="flex flex-wrap items-end justify-between gap-4 px-4 pt-4 sm:px-5">
                <div>
                  <h2 id="activity-title" className="font-heading text-xl font-semibold tracking-[-0.02em]">Activity</h2>
                  <p className="text-muted-foreground mt-1 text-xs">Current state by course, with every server attempt retained underneath.</p>
                </div>
                <div className="flex" role="tablist" aria-label="Sync activity view">
                  {([['courses', 'Course progress'], ['history', 'Run history']] as const).map(([value, label]) => (
                    <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)} className={cn("border-b-2 px-3 py-2 text-xs font-semibold", view === value ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-y px-4 py-3 sm:px-5">
                <label className="relative min-w-56 flex-1 sm:max-w-sm">
                  <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input aria-label="Search sync activity" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search course, year or error" className="pl-9" />
                </label>
                <div className="flex max-w-full items-center gap-1 overflow-x-auto" aria-label="Filter status">
                  {([
                    ["all", "All", view === "courses" ? courseJobs.length : corpus.jobs.length],
                    ["active", "In progress", view === "courses" ? courseJobs.filter((job) => ACTIVE.has(job.status)).length : corpus.active.length],
                    ["attention", "Attention", view === "courses" ? attention : corpus.failed.length],
                    ["completed", "Complete", view === "courses" ? completed : corpus.jobs.filter((job) => job.status === "completed").length],
                  ] as const).map(([value, label, count]) => (
                    <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={cn("h-8 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap", filter === value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{label} <span className={`${NUMERALS} ml-1 opacity-70`}>{count}</span></button>
                  ))}
                </div>
              </div>

              {visibleJobs.length ? (
                view === "courses" ? (
                  <div>
                    <div className="text-muted-foreground hidden grid-cols-[minmax(15rem,1.6fr)_minmax(8rem,.7fr)_minmax(8rem,.7fr)_9rem_auto] gap-3 border-b px-5 py-2.5 text-[10px] font-semibold tracking-[0.1em] uppercase sm:grid">
                      <span>Course</span><span>Edition</span><span>Material</span><span>Updated</span><span className="text-right">Status</span>
                    </div>
                    {visibleJobs.map((job) => {
                      const attempts = corpus.jobs.filter((candidate) => candidate.courseCode === job.courseCode).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
                      return <CourseRow key={job.id} job={job} attempts={attempts.length ? attempts : [job]} />;
                    })}
                  </div>
                ) : (
                  <ul>
                    {visibleJobs.map((job) => (
                      <li key={job.id} className="grid gap-2 border-b px-4 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1.4fr)_8rem_minmax(10rem,1fr)_9rem_auto] sm:items-start sm:px-5">
                        <span className="min-w-0"><strong className={`${NUMERALS} text-sm`}>{job.courseCode || (job.type === "catalog" ? "Canvas catalog" : job.type)}</strong>{job.courseName ? <small className="text-muted-foreground ml-2">{job.courseName}</small> : null}<small className="text-muted-foreground mt-0.5 block">Attempt {job.attempts || 1}{job.syncId ? ` · run ${job.syncId.slice(0, 8)}` : ""}</small></span>
                        <span className="text-muted-foreground text-xs">{job.academicYear || "—"}</span>
                        <span className="text-muted-foreground text-xs [overflow-wrap:anywhere]">{job.error ? `${ACTIVE.has(job.status) ? "Previous attempt: " : ""}${job.error}` : job.status === "completed" ? `${job.result?.indexed || 0} indexed · ${job.result?.skipped || 0} skipped` : "Waiting for the server"}</span>
                        <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{when(job)}</span>
                        <JobStatus job={job} />
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
                  <Clock3Icon className="text-muted-foreground size-5" />
                  <h3 className="mt-3 text-sm font-semibold">{corpus.jobs.length ? "No activity matches this view" : "No sync activity yet"}</h3>
                  <p className="text-muted-foreground mt-1 max-w-md text-xs">{corpus.jobs.length ? "Change the status filter or search to see another part of the ledger." : "Enable material collection in Connections, then start a Canvas refresh."}</p>
                  {corpus.jobs.length ? <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setFilter("all"); setQuery(""); }}>Clear filters</Button> : <Link href="/app/settings?tab=connections" className="text-primary mt-3 text-xs font-semibold">Open Connections</Link>}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
