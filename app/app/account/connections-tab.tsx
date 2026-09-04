"use client";

/**
 * Canvas connections.
 *
 * The one tab on this page that holds a credential, so it is also the one that
 * says the least about it: a token is written once, encrypted on arrival, and
 * never read back into this component. Removing a host is destructive and
 * passes the same typed-confirmation gate as everything else here.
 */

import { useEffect, useMemo, useState } from "react";
import { CalendarDaysIcon, RefreshCwIcon } from "lucide-react";
import { CanvasMark } from "@/components/brand/canvas-mark";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { readJson, useJson } from "@/components/workspace/use-json";
import { connectionOrigin } from "@/lib/workspace/updates.mjs";
import {
  type CorpusStatus,
  canvasCorpusSummary,
  canvasSyncProgress,
} from "@/lib/workspace/account.mjs";
import { Confirm, Failed, NUMERALS, Section, relative } from "./shared";

type CanvasConnection = {
  origin: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  corpus?: {
    collectionEnabled: boolean;
    sharingMode: "private" | "community";
    consentedAt?: string | null;
  };
};

type CanvasCourseOption = {
  id: string | number;
  displayName?: string;
  name?: string;
  courseCode?: string;
  term?: { name?: string };
};

type MaterialMode = "none" | "private" | "community";

type CalendarLink = {
  id: string;
  label: string;
  url: string;
  eventCount: number;
  lastSyncedAt?: string | null;
  unselectedCourseCount?: number;
};

type AcademicState = { workspace: { calendars?: CalendarLink[] } };

/**
 * How often the import ledger is asked again while Canvas is working.
 *
 * It used to be four seconds, unconditionally, for as long as the tab existed
 * — a request every four seconds from a backgrounded tab that nobody was
 * looking at, each one re-running the whole job aggregation. Ten seconds is
 * still faster than a Canvas import completes, and the poll stops entirely
 * while the document is hidden, resuming with a fresh read when it is not.
 */
const POLL_MS = 10_000;
const CONNECTION_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(12rem,1.2fr)_7rem_minmax(10rem,1fr)_8rem_auto] sm:gap-3";
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function isStale(value: string | null | undefined) {
  if (!value) return true;
  const time = new Date(value).getTime();
  return !Number.isFinite(time) || Date.now() - time > STALE_AFTER_MS;
}

function TimetableConnections() {
  const academics = useJson<AcademicState>("/api/academics");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("University timetable");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CalendarLink | null>(null);
  const [adding, setAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const calendars = academics.data?.workspace.calendars ?? [];

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await readJson("/api/academics/calendars", {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), label: label.trim() || "University timetable" }),
      });
      setUrl("");
      setNotice("Timetable connected. Appointments will keep refreshing in the background.");
      academics.reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sync(link: CalendarLink) {
    setBusy(true);
    setSyncingId(link.id);
    setError(null);
    setNotice(null);
    try {
      await readJson(`/api/academics/calendars/${encodeURIComponent(link.id)}/sync`, { method: "POST", body: JSON.stringify({}) });
      setNotice(`${link.label} is up to date.`);
      academics.reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      setSyncingId(null);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await readJson(`/api/academics/calendars/${encodeURIComponent(removing.id)}`, { method: "DELETE" });
      setNotice("Timetable connection removed. Its appointments no longer appear in Wicker Study.");
      setRemoving(null);
      academics.reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {academics.error ? (
        <div className="border-b px-4 py-4 sm:px-6 lg:px-8"><Failed what="Timetable settings are unavailable" message={academics.error} /></div>
      ) : !academics.data ? (
        <div className="border-b px-4 py-4 sm:px-6 lg:px-8"><Skeleton className="h-12 w-full" /></div>
      ) : calendars.length ? (
        calendars.map((link) => {
          const refreshing = syncingId === link.id;
          const stale = !refreshing && isStale(link.lastSyncedAt);
          return <div key={link.id} className={`border-b px-4 py-4 sm:px-6 lg:px-8 ${CONNECTION_GRID}`}>
            <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3"><span className="bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-md"><CalendarDaysIcon className="size-[18px]" /></span><span className="min-w-0"><strong className="block truncate text-sm font-semibold">{link.label}</strong><small className="text-muted-foreground sm:hidden">Timetable</small></span></span>
            <span className="col-start-1 row-start-2 flex items-center gap-2 pl-[3.25rem] text-xs sm:col-auto sm:row-auto sm:pl-0"><span className={`${refreshing ? "animate-pulse bg-primary" : stale ? "bg-border-strong" : "bg-foreground"} size-1.5 rounded-full`} />{refreshing ? "Refreshing" : stale ? "Needs refresh" : "Connected"}</span>
            <span className={`text-muted-foreground hidden text-xs sm:block ${NUMERALS}`}>{link.eventCount} appointment{link.eventCount === 1 ? "" : "s"}</span>
            <span className={`text-muted-foreground hidden text-xs sm:block ${NUMERALS}`}>{link.lastSyncedAt ? relative(link.lastSyncedAt) : "Not synced"}</span>
            <span className="col-start-2 row-span-2 row-start-1 flex justify-end gap-1 sm:col-auto sm:row-auto"><Button variant="ghost" size="sm" disabled={busy} onClick={() => void sync(link)}><RefreshCwIcon className="sm:hidden" aria-label="Refresh" /><span className="hidden sm:inline">Refresh</span></Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => setRemoving(link)}>Remove</Button></span>
          </div>;
        })
      ) : (
        <div className={`border-b px-4 py-4 sm:px-6 lg:px-8 ${CONNECTION_GRID}`}>
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3"><span className="bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-md"><CalendarDaysIcon className="size-[18px]" /></span><span><strong className="block text-sm font-semibold">Timetable</strong><small className="text-muted-foreground sm:hidden">Live calendar feed</small></span></span>
          <span className="col-start-1 row-start-2 flex items-center gap-2 pl-[3.25rem] text-xs sm:col-auto sm:row-auto sm:pl-0"><span className="bg-border-strong size-1.5 rounded-full" />Not connected</span>
          <span className="text-muted-foreground hidden text-xs sm:block">Live schedule and exam dates</span>
          <span className="text-muted-foreground hidden text-xs sm:block">Never</span>
          <Button type="button" variant="ghost" size="sm" className="col-start-2 row-span-2 row-start-1 sm:col-auto sm:row-auto" onClick={() => setAdding(true)}>Connect</Button>
        </div>
      )}

        {adding && <form onSubmit={connect} className="bg-muted/45 grid gap-4 border-b p-4 sm:grid-cols-[minmax(0,1fr)_15rem_auto] sm:items-end sm:p-6 lg:px-8">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Feed URL</span>
            <Input type="url" required value={url} disabled={busy} onChange={(event) => setUrl(event.target.value)} placeholder="https://… or webcal://…" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Name</span>
            <Input value={label} maxLength={120} disabled={busy} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <span className="flex items-center justify-end gap-1"><Button type="button" variant="ghost" disabled={busy} onClick={() => { setAdding(false); setError(null); }}>Cancel</Button><Button type="submit" disabled={busy || !url.trim()}>{busy ? "Connecting…" : "Connect timetable"}</Button></span>
        </form>}
        {notice && <p role="status" className="border-b px-4 py-3 text-primary text-sm font-medium sm:px-6 lg:px-8">{notice}</p>}
        {error && <p role="alert" className="border-b px-4 py-3 text-sm font-medium sm:px-6 lg:px-8">{error}</p>}

      <Confirm
        open={Boolean(removing)}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        title="Remove this timetable connection?"
        description="Its live appointments will stop appearing in Wicker Study. Nothing changes in your university timetable."
        word="REMOVE"
        action="Remove connection"
        busy={busy}
        error={error}
        onConfirm={remove}
      />
    </>
  );
}

export function ConnectionsTab() {
  const connections = useJson<{ connections: CanvasConnection[] }>(
    "/api/account/integrations/canvas",
  );
  const corpusStatus = useJson<{ status: CorpusStatus }>(
    "/api/account/integrations/canvas/corpus",
  );
  const [custom, setCustom] = useState(false);
  const [canvasUrl, setCanvasUrl] = useState(
    "https://canvas.maastrichtuniversity.nl",
  );
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CanvasConnection | null>(null);
  const [materialMode, setMaterialMode] = useState<MaterialMode>("none");
  const [courseCatalog, setCourseCatalog] = useState<
    Record<string, CanvasCourseOption[]>
  >({});
  const [selectedCourse, setSelectedCourse] = useState<Record<string, string>>(
    {},
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [addingHost, setAddingHost] = useState(false);
  const [managingHosts, setManagingHosts] = useState(false);

  const corpus = useMemo(
    () => canvasCorpusSummary(corpusStatus.data?.status),
    [corpusStatus.data],
  );
  const syncProgress = useMemo(
    () => canvasSyncProgress(corpusStatus.data?.status),
    [corpusStatus.data],
  );
  const activeCount = corpus.active.length;
  const reloadCorpus = corpusStatus.reload;

  useEffect(() => {
    if (!activeCount) return;
    let timer = 0;
    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    };
    const start = () => {
      if (!timer) timer = window.setInterval(reloadCorpus, POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        reloadCorpus();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeCount, reloadCorpus]);

  useEffect(() => {
    if (window.location.hash === "#canvas-sync") setManagingHosts(true);
  }, []);

  async function cancelQueuedMaterials() {
    const origins = [...new Set(syncProgress.activeJobs.map((job) => job.origin).filter(Boolean))];
    if (!origins.length && saved[0]) origins.push(saved[0].origin);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const results = await Promise.all(origins.map((origin) => readJson<{ cancelled: number }>("/api/integrations/canvas/corpus/sync", {
        method: "DELETE",
        body: JSON.stringify({ canvasUrl: origin }),
      })));
      const cancelled = results.reduce((sum, result) => sum + (result.cancelled || 0), 0);
      setNotice(cancelled ? `${cancelled} queued Canvas ${cancelled === 1 ? "job was" : "jobs were"} cancelled. A job already indexing a course will finish safely.` : "No queued Canvas jobs remained to cancel.");
      reloadCorpus();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMaterialMode(
    connection: CanvasConnection,
    mode: MaterialMode,
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await readJson("/api/account/integrations/canvas/corpus", {
        method: "PUT",
        body: JSON.stringify({
          canvasUrl: connection.origin,
          collectionEnabled: mode !== "none",
          sharingMode: mode === "community" ? "community" : "private",
        }),
      });
      setNotice(
        mode === "none"
          ? "Material collection stopped."
          : `Material collection authorised for ${mode === "community" ? "community sharing" : "private use"}.`,
      );
      connections.reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshMaterials(connection: CanvasConnection) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await readJson("/api/integrations/canvas/corpus/sync", {
        method: "POST",
        body: JSON.stringify({ canvasUrl: connection.origin, force: true }),
      });
      setNotice(
        "A complete Canvas material refresh is queued in the background.",
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadCourseArchive(connection: CanvasConnection) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const catalog = await readJson<{ courses: CanvasCourseOption[] }>(
        `/api/integrations/canvas/courses?canvasUrl=${encodeURIComponent(connection.origin)}`,
      );
      setCourseCatalog((held) => ({
        ...held,
        [connection.origin]: catalog.courses || [],
      }));
      setNotice(
        "Choose any accessible course edition to archive, including previous years.",
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function archiveCourse(connection: CanvasConnection) {
    const canvasCourseId = selectedCourse[connection.origin];
    if (!canvasCourseId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await readJson("/api/integrations/canvas/corpus/course", {
        method: "POST",
        body: JSON.stringify({
          canvasUrl: connection.origin,
          canvasCourseId,
          force: true,
        }),
      });
      setNotice("That course edition is queued for a full local archive.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    const origin = connectionOrigin(canvasUrl);
    if (!origin) {
      setError("Enter a secure Canvas address beginning with https://.");
      return;
    }
    if (!token.trim()) {
      setError("Paste the Personal Access Token you created in Canvas.");
      return;
    }
    setBusy(true);
    setError(null);
    let credentialsSaved = false;
    try {
      await readJson("/api/account/integrations/canvas", {
        method: "PUT",
        body: JSON.stringify({ canvasUrl: origin, accessToken: token }),
      });
      credentialsSaved = true;
      setToken("");
      setAddingHost(false);
      connections.reload();
      await readJson("/api/account/integrations/canvas/corpus", {
        method: "PUT",
        body: JSON.stringify({
          canvasUrl: origin,
          collectionEnabled: materialMode !== "none",
          sharingMode: materialMode === "community" ? "community" : "private",
        }),
      });
      setNotice("Canvas connected. Your material permission was saved.");
      connections.reload();
    } catch (cause) {
      if (credentialsSaved) {
        setNotice("Canvas is connected.");
        setError(`The material permission was not saved. Open Manage to choose it again. ${(cause as Error).message}`);
        connections.reload();
      } else {
        setError((cause as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await readJson("/api/account/integrations/canvas", {
        method: "DELETE",
        body: JSON.stringify({ canvasUrl: removing.origin }),
      });
      setRemoving(null);
      connections.reload();
    } catch (cause) {
      setError(`The connection was not removed. ${(cause as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const saved = connections.data?.connections ?? [];

  return (
    <div className="flex flex-col">
      <header className="-mx-4 border-b px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <h2 className="text-[18px] font-semibold">Connections</h2>
        <p className="text-muted-foreground mt-1 text-sm">Manage the services and live sources connected to your study desk.</p>
      </header>
      <div className="-mx-4 sm:-mx-6 lg:-mx-8">
        <div className={`text-muted-foreground hidden gap-3 border-b px-8 py-3 text-[10.5px] font-semibold tracking-[0.11em] uppercase sm:grid ${CONNECTION_GRID}`}>
          <span>Connection</span><span>Status</span><span>Details</span><span>Activity</span><span>Actions</span>
        </div>
        {connections.error ? (
          <div className="border-b px-4 py-4 sm:px-6 lg:px-8"><Failed what="Canvas settings are unavailable" message={connections.error} /></div>
        ) : !connections.data ? (
          <div className="border-b px-4 py-4 sm:px-6 lg:px-8"><Skeleton className="h-12 w-full" /></div>
        ) : saved.length ? saved.map((connection) => {
          return <div key={connection.origin} className={`border-b px-4 py-4 sm:px-6 lg:px-8 ${CONNECTION_GRID}`}>
            <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3"><span className="bg-muted text-[#e13f2f] flex size-10 shrink-0 items-center justify-center rounded-md"><CanvasMark className="size-5" /></span><span className="min-w-0"><strong className="block truncate text-sm font-semibold">Canvas</strong><small className="text-muted-foreground block max-w-52 truncate text-xs sm:max-w-none">{connection.origin}</small></span></span>
            <span className="col-start-1 row-start-2 flex items-center gap-2 pl-[3.25rem] text-xs sm:col-auto sm:row-auto sm:pl-0"><span className="bg-foreground size-1.5 rounded-full" />Connected</span>
            <span className="text-muted-foreground hidden text-xs sm:block">{connection.corpus?.collectionEnabled ? connection.corpus.sharingMode === "community" ? "Shared material" : "Private material" : "Deadlines only"}</span>
            <span className={`text-muted-foreground hidden text-xs sm:block ${NUMERALS}`}>{connection.lastUsedAt ? relative(connection.lastUsedAt) : "Not yet used"}</span>
            <Button type="button" variant="ghost" size="sm" className="col-start-2 row-span-2 row-start-1 sm:col-auto sm:row-auto" onClick={() => setManagingHosts((value) => !value)}>{managingHosts ? "Close" : "Manage"}</Button>
          </div>;
        }) : null}
        {connections.data && !saved.length && !addingHost && (
          <div className={`border-b px-4 py-4 sm:px-6 lg:px-8 ${CONNECTION_GRID}`}>
            <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-3"><span className="bg-muted text-[#e13f2f] flex size-10 shrink-0 items-center justify-center rounded-md"><CanvasMark className="size-5" /></span><span><strong className="block text-sm font-semibold">Canvas</strong><small className="text-muted-foreground sm:hidden">Courses, deadlines and rules</small></span></span>
            <span className="col-start-1 row-start-2 flex items-center gap-2 pl-[3.25rem] text-xs sm:col-auto sm:row-auto sm:pl-0"><span className="bg-border-strong size-1.5 rounded-full" />Not connected</span>
            <span className="text-muted-foreground hidden text-xs sm:block">Courses, deadlines and rules</span>
            <span className="text-muted-foreground hidden text-xs sm:block">Never</span>
            <Button type="button" variant="ghost" size="sm" className="col-start-2 row-span-2 row-start-1 sm:col-auto sm:row-auto" onClick={() => setAddingHost(true)}>Connect</Button>
          </div>
        )}
        {addingHost && (
          <form
            onSubmit={connect}
            className="bg-muted/45 grid gap-4 border-b p-4 sm:grid-cols-2 sm:p-6 lg:px-8"
          >
            <div className="flex flex-col gap-2 sm:col-span-2">
              <p className="text-sm">
                <strong>Create a Personal Access Token in Canvas.</strong>{" "}
                Canvas remains responsible for your password and OTP; only the
                token belongs here.
              </p>
              <p className="text-muted-foreground text-sm">
                <a
                  className="text-primary font-semibold hover:underline"
                  href="https://canvas.maastrichtuniversity.nl/profile/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Maastricht Canvas settings
                </a>{" "}
                ·{" "}
                <a
                  className="text-primary font-semibold hover:underline"
                  href="/docs#canvas-access-token"
                >
                  Read the setup guide
                </a>
              </p>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Canvas host</span>
              {custom ? (
                <Input
                  type="url"
                  value={canvasUrl}
                  onChange={(event) => setCanvasUrl(event.target.value)}
                  disabled={busy}
                  required
                />
              ) : (
                <Input value="Maastricht University" disabled />
              )}
              <button
                type="button"
                className="text-primary w-fit text-sm font-semibold hover:underline"
                onClick={() => {
                  setCustom(!custom);
                  setCanvasUrl(
                    custom ? "https://canvas.maastrichtuniversity.nl" : "",
                  );
                }}
              >
                {custom ? "Use Maastricht Canvas" : "Use another institution"}
              </button>
            </label>
            <fieldset className="-mx-4 flex flex-col gap-2 border-t px-4 pt-4 sm:col-span-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <legend className="text-sm font-semibold">
                Course-material collection
              </legend>
              <p className="text-muted-foreground text-xs">
                Choose explicitly whether the server may gather and index lesson
                materials after connecting.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    [
                      "none",
                      "Do not collect",
                      "Canvas still supplies deadlines and announcements.",
                    ],
                    [
                      "private",
                      "Collect privately",
                      "Only your Tutor and authorised MCP clients can retrieve it.",
                    ],
                    [
                      "community",
                      "Share with students",
                      "Eligible students may reuse the edition after rights review.",
                    ],
                  ] as const
                ).map(([value, title, detail]) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-sm border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring ${materialMode === value ? "border-primary bg-primary/5" : "hover:border-input hover:bg-background"}`}
                  >
                    <input
                      type="radio"
                      name="material-mode"
                      value={value}
                      checked={materialMode === value}
                      onChange={() => setMaterialMode(value)}
                      className="accent-primary mr-2"
                    />
                    <strong className="text-sm font-medium">{title}</strong>
                    <small className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                      {detail}
                    </small>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Personal Access Token</span>
              <Input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                placeholder="Paste the token"
                required
              />
            </label>
            <div className="-mx-4 flex flex-wrap items-center justify-between gap-4 border-t px-4 pt-3 sm:col-span-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <p className="text-muted-foreground text-xs">
                Encrypted immediately and never displayed again. Do not paste a
                password, OTP, cookie or session export.
              </p>
              <span className="flex items-center gap-2">
                <Button type="button" variant="ghost" disabled={busy} onClick={() => { setAddingHost(false); setError(null); }}>Cancel</Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Connecting…" : "Connect Canvas"}
                </Button>
              </span>
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium sm:col-span-2">
                {error}
              </p>
            )}
          </form>
        )}
        {!addingHost && !managingHosts && notice && <p role="status" className="border-b px-4 py-3 text-primary text-sm font-medium sm:px-6 lg:px-8">{notice}</p>}
        {!addingHost && !managingHosts && error && <p role="alert" className="border-b px-4 py-3 text-sm font-medium sm:px-6 lg:px-8">{error}</p>}
        <TimetableConnections />
        {saved.length > 0 && <button type="button" onClick={() => setAddingHost(true)} className="hover:bg-muted/45 flex w-full items-center gap-3 border-b px-4 py-4 text-left sm:px-6 lg:px-8">
          <span className="border-border-strong text-muted-foreground flex size-10 items-center justify-center rounded-full border text-xl">+</span>
          <span><strong className="block text-sm font-semibold">Add connection</strong><small className="text-muted-foreground text-xs">Connect another Canvas host</small></span>
          <span className="text-primary ml-auto text-lg">›</span>
        </button>}
      </div>

      {saved.length > 0 && managingHosts && <div id="canvas-sync" className="mt-8 scroll-mt-6"><Section
        title="Canvas management"
        note="Removing one deletes its encrypted token here and changes nothing in Canvas."
        action={
          <a
            href="/app/updates?tab=materials"
            className="text-primary text-sm font-semibold hover:underline"
          >
            Open course material
          </a>
        }
      >
        {corpusStatus.data?.status && (
          <div className="mb-5 border-y py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <strong>Material collection</strong>
              <button
                type="button"
                className="text-primary text-sm font-semibold hover:underline"
                onClick={reloadCorpus}
              >
                Refresh status
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <span>
                <strong className={`${NUMERALS} block text-[21px]`}>
                  {activeCount}
                </strong>
                <small className="text-muted-foreground">
                  jobs in progress
                </small>
              </span>
              <span>
                <strong className={`${NUMERALS} block text-[21px]`}>
                  {corpus.courseEditions}
                </strong>
                <small className="text-muted-foreground">
                  course editions found
                </small>
              </span>
              <span>
                <strong className={`${NUMERALS} block text-[21px]`}>
                  {corpus.storedMaterials}
                </strong>
                <small className="text-muted-foreground">
                  materials stored
                </small>
              </span>
            </div>
            {activeCount > 0 && (
              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p role="status" className="text-muted-foreground text-xs">
                    {syncProgress.stage}. You can leave this page; collection continues on the server.
                  </p>
                  <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void cancelQueuedMaterials()}>Stop queued work</Button>
                </div>
                {syncProgress.percent != null && <><Progress value={syncProgress.percent} className="mt-3 h-1" /><p className={`${NUMERALS} text-muted-foreground mt-2 text-xs`}>{syncProgress.completedCourses} of {syncProgress.totalCourses} courses · {syncProgress.indexedFiles} files indexed</p></>}
              </div>
            )}
            {corpus.failed.length > 0 && (
              <div className="border-primary mt-4 border-l-2 pl-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <strong>
                      {corpus.failed.length} imports need attention
                    </strong>
                    <small className="text-muted-foreground block">
                      Repeated failures are grouped below.
                    </small>
                  </span>
                  {saved[0] && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void refreshMaterials(saved[0])}
                      disabled={busy}
                    >
                      Retry failed imports
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex flex-col">
                  {corpus.failureGroups.map(([message, jobs]) => (
                    <details key={message} className="border-t py-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        {jobs.length} course{jobs.length === 1 ? "" : "s"} ·{" "}
                        {message}
                      </summary>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {jobs
                          .map(
                            (job) =>
                              job.courseCode ||
                              job.courseName ||
                              "Course import",
                          )
                          .join(" · ")}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            )}
            {!!corpus.latestByCourse.length && (
              <details className="mt-4 border-t pt-3" open={activeCount > 0}>
                <summary className="cursor-pointer text-sm font-semibold">
                  Course-by-course progress
                </summary>
                <ul className="mt-3 flex max-h-72 flex-col overflow-y-auto">
                  {corpus.latestByCourse.map((job) => (
                    <li
                      key={job.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b py-2 text-sm"
                    >
                      <span>
                        <strong>{job.courseCode || job.courseName}</strong>
                        {job.courseCode && job.courseName && (
                          <small className="text-muted-foreground ml-2">
                            {job.courseName}
                          </small>
                        )}
                        <small className="text-muted-foreground mt-0.5 block">
                          {job.academicYear || "Year not supplied by Canvas"}
                          {job.status === "completed" && job.result ? ` · ${job.result.indexed || 0} indexed · ${job.result.skipped || 0} skipped` : ""}
                        </small>
                      </span>
                      <span
                        className={`${NUMERALS} text-muted-foreground capitalize`}
                      >
                        {job.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {!!corpus.jobs.length && (
              <details className="mt-3">
                <summary className="text-muted-foreground cursor-pointer text-xs">
                  Technical history
                </summary>
                <ul className="mt-2 flex max-h-64 flex-col overflow-y-auto">
                  {corpus.jobs.slice(0, 30).map((job) => (
                    <li
                      key={job.id}
                      className="flex items-start justify-between gap-4 border-b py-2 text-xs"
                    >
                      <span>
                        {job.courseCode || job.type}
                        <small className="text-muted-foreground mt-0.5 block">Attempt {job.attempts || 0}{job.startedAt ? ` · started ${relative(job.startedAt)}` : ""}{job.finishedAt ? ` · finished ${relative(job.finishedAt)}` : ""}</small>
                        {job.error && job.status !== "running" && (
                          <small className="text-muted-foreground mt-0.5 block max-w-[60ch] [overflow-wrap:anywhere]">
                            {job.status === "pending" ? "Last attempt: " : ""}{job.error}
                          </small>
                        )}
                      </span>
                      <span
                        className={`${NUMERALS} text-muted-foreground capitalize`}
                      >
                        {job.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        {connections.error ? (
          <Failed
            what="Canvas settings are unavailable"
            message={connections.error}
          />
        ) : !connections.data ? (
          <Skeleton className="h-24 w-full" />
        ) : !saved.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No Canvas connection yet</EmptyTitle>
              <EmptyDescription>
                Connect a host above to read your courses.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col">
            {saved.map((connection) => (
              <li key={connection.origin} className="border-b py-4">
                <details open className="group">
                  <summary className="focus-visible:outline-ring flex cursor-pointer list-none items-start justify-between gap-4 focus-visible:outline-2 focus-visible:outline-offset-2">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <strong className={`${NUMERALS} [overflow-wrap:anywhere]`}>
                        {connection.origin}
                      </strong>
                      <small className="text-muted-foreground">
                        Connected {relative(connection.createdAt)}
                        {connection.lastUsedAt
                          ? ` · last used ${relative(connection.lastUsedAt)}`
                          : " · not used yet"}
                      </small>
                      <small className="text-muted-foreground">
                        {connection.corpus?.collectionEnabled
                          ? connection.corpus.sharingMode === "community"
                            ? "Materials: community sharing enabled"
                            : "Materials: private collection enabled"
                          : "Materials: collection disabled"}
                      </small>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-sm group-open:hidden">
                      Configure
                    </span>
                    <span className="text-muted-foreground hidden shrink-0 text-sm group-open:inline">
                      Hide
                    </span>
                  </summary>
                  <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        items={[
                          { value: "none", label: "Do not collect material" },
                          { value: "private", label: "Private material library" },
                          { value: "community", label: "Share with community" },
                        ]}
                        value={
                          !connection.corpus?.collectionEnabled
                            ? "none"
                            : connection.corpus.sharingMode
                        }
                        onValueChange={(value) =>
                          void saveMaterialMode(
                            connection,
                            value as MaterialMode,
                          )
                        }
                        disabled={busy}
                      >
                        <SelectTrigger className="w-52">
                          <SelectValue aria-label="Material authorization" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            Do not collect material
                          </SelectItem>
                          <SelectItem value="private">
                            Private material library
                          </SelectItem>
                          <SelectItem value="community">
                            Share with community
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void refreshMaterials(connection)}
                        disabled={
                          busy || !connection.corpus?.collectionEnabled
                        }
                      >
                        Force full refresh
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void loadCourseArchive(connection)}
                        disabled={
                          busy || !connection.corpus?.collectionEnabled
                        }
                      >
                        Choose older course
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoving(connection)}
                      >
                        Remove
                      </Button>
                    </div>
                    {courseCatalog[connection.origin] && (
                      <div className="bg-background flex flex-wrap items-center gap-2 rounded-sm p-2">
                        <Select
                          items={courseCatalog[connection.origin].map(
                            (course) => ({
                              value: String(course.id),
                              label: [
                                course.courseCode,
                                course.displayName || course.name,
                                course.term?.name,
                              ]
                                .filter(Boolean)
                                .join(" · "),
                            }),
                          )}
                          value={selectedCourse[connection.origin] || ""}
                          onValueChange={(value) =>
                            setSelectedCourse((held) => ({
                              ...held,
                              [connection.origin]: value || "",
                            }))
                          }
                        >
                          <SelectTrigger className="min-w-72 flex-1">
                            <SelectValue placeholder="Select any Canvas course edition" />
                          </SelectTrigger>
                          <SelectContent>
                            {courseCatalog[connection.origin].map((course) => (
                              <SelectItem
                                key={String(course.id)}
                                value={String(course.id)}
                              >
                                {[
                                  course.courseCode,
                                  course.displayName || course.name,
                                  course.term?.name,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void archiveCourse(connection)}
                          disabled={busy || !selectedCourse[connection.origin]}
                        >
                          Archive this course
                        </Button>
                      </div>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        {notice && (
          <p role="status" className="text-primary text-sm font-medium">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium">
            {error}
          </p>
        )}
      </Section></div>}

      <Confirm
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Remove this Canvas connection?"
        description="Its encrypted token is deleted from Wicker Study. Nothing changes in Canvas."
        word="REMOVE"
        action="Remove connection"
        busy={busy}
        error={error}
        onConfirm={remove}
      />
    </div>
  );
}
