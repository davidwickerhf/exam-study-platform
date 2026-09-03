"use client";

/**
 * The account, migrated.
 *
 * Four tabs, the same four surfaces the vanilla page carried: who you are and
 * what the workspace holds for you, the personal API keys an agent signs with,
 * the AI allowance, and the record-by-record view of your data with the ways
 * to take it back.
 *
 * Two rules shape this file more than the others.
 *
 * Nothing here is destructive on one click. Every irreversible action —
 * resetting study data, erasing everything, deleting the account, revoking a
 * key — goes through an AlertDialog that will not enable its confirm button
 * until the exact word is typed, matching what the server itself demands.
 *
 * A newly created key's secret exists in React state and in the one place it
 * is rendered, and nowhere else. It is never put in a URL, never written to
 * localStorage, and never logged — including in the copy handler, whose
 * failure path reports that copying failed without echoing what it held.
 *
 * Canvas connections were the vanilla page's fifth tab. They are write-heavy
 * credential handling, so they stay in the previous workspace for now and this
 * page says so rather than looking as though they had gone away.
 */

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import {
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  KeyIcon,
  RotateCcwIcon,
  TrashIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readJson, useJson } from "@/components/workspace/use-json";
import { connectionOrigin } from "@/lib/workspace/updates.mjs";
import {
  type AccountSummary,
  type Activity,
  type AiUsage,
  type ApiKey,
  type CreatedApiKey,
  type NamespaceEntry,
  type ResetScope,
  ACTIVITY_LABEL,
  AI_FEATURE_LABEL,
  KEY_LIFETIMES,
  KEY_STATE_LABEL,
  RESET_SCOPES,
  SCOPE_COPY,
  activeKeys,
  activityBars,
  allowanceMeters,
  availableScopes,
  confirmationMatches,
  formatBytes,
  formatCount,
  groupNamespaces,
  keyState,
  mcpSnippet,
  namespaceLabel,
  normalizeScopes,
  requestTokens,
  skillSnippet,
  weekTrend,
} from "@/lib/workspace/account.mjs";

const NUMERALS = "font-data tabular-nums";
const RULE =
  "text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase";

// ----- plumbing -----------------------------------------------------------

function relative(value: string | null | undefined) {
  if (!value) return null;
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return null;
  if (diff < 0) return "just now";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function longDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function clockOrDate(value: string | null | undefined, mode: "time" | "date") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    "en-GB",
    mode === "date"
      ? { day: "numeric", month: "short", year: "numeric" }
      : {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZoneName: "short",
        },
  ).format(date);
}

// ----- shared pieces ------------------------------------------------------

function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-6 border-b pb-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {note && <p className="text-muted-foreground text-sm">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Figure({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <span className="flex min-w-[8rem] flex-col gap-1">
      <span className={RULE}>{label}</span>
      <strong className={`text-2xl font-semibold tracking-tight ${NUMERALS}`}>
        {value}
      </strong>
      {detail && (
        <small className="text-muted-foreground text-xs">{detail}</small>
      )}
    </span>
  );
}

function Failed({ what, message }: { what: string; message: string }) {
  return (
    <Alert>
      <AlertTitle>{what}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function HostedProfileActions() {
  const clerk = useClerk();
  return (
    <span className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => clerk.openUserProfile()}
      >
        Edit sign-in profile
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => void clerk.signOut({ redirectUrl: "/sign-in" })}
      >
        Sign out of Wicker Study
      </Button>
    </span>
  );
}

/**
 * The one gate every irreversible action passes through.
 *
 * The confirm button stays disabled until the typed word matches exactly —
 * the same comparison the server makes, so a student cannot be waved through
 * here only to be refused there.
 */
function Confirm({
  open,
  onOpenChange,
  title,
  description,
  removes,
  word,
  action,
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  removes?: string[];
  word: string;
  action: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  const ready = confirmationMatches(typed, word) && !busy;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <p className="font-semibold">This cannot be undone.</p>
          {removes && (
            <ul className="text-muted-foreground flex flex-col gap-1">
              {removes.map((line) => (
                <li key={line} className="border-l pl-3">
                  {line}
                </li>
              ))}
            </ul>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">
              Type <b className={`text-foreground ${NUMERALS}`}>{word}</b> to
              confirm
            </span>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={busy}
              aria-label={`Type ${word} to confirm`}
              className={NUMERALS}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <Button variant="secondary" disabled={!ready} onClick={onConfirm}>
            {busy ? "Working…" : action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ----- Profile ------------------------------------------------------------

type CourseRow = { id: string; archived: boolean };
type SrDue = { totalCards: number; dueCount: number };

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
type CanvasCourseOption = { id: string | number; displayName?: string; name?: string; courseCode?: string; term?: { name?: string } };

function ConnectionsTab() {
  const connections = useJson<{ connections: CanvasConnection[] }>(
    "/api/account/integrations/canvas",
  );
  const corpusStatus = useJson<{ status: { jobs?: { id: string; type: string; status: string; error?: string | null; createdAt?: string; finishedAt?: string | null }[]; courses?: { id: string; courseCode: string; courseName: string; sources: number; lastSyncedAt?: string | null }[] } }>("/api/account/integrations/canvas/corpus");
  const [custom, setCustom] = useState(false);
  const [canvasUrl, setCanvasUrl] = useState(
    "https://canvas.maastrichtuniversity.nl",
  );
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CanvasConnection | null>(null);
  const [materialMode, setMaterialMode] = useState<"none" | "private" | "community">("none");
  const [courseCatalog, setCourseCatalog] = useState<Record<string, CanvasCourseOption[]>>({});
  const [selectedCourse, setSelectedCourse] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [addingHost, setAddingHost] = useState(false);

  async function saveMaterialMode(connection: CanvasConnection, mode: "none" | "private" | "community") {
    setBusy(true); setError(null); setNotice(null);
    try {
      await readJson("/api/account/integrations/canvas/corpus", {
        method: "PUT",
        body: JSON.stringify({ canvasUrl: connection.origin, collectionEnabled: mode !== "none", sharingMode: mode === "community" ? "community" : "private" }),
      });
      setNotice(mode === "none" ? "Material collection stopped." : `Material collection authorised for ${mode === "community" ? "community sharing" : "private use"}.`);
      connections.reload();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function refreshMaterials(connection: CanvasConnection) {
    setBusy(true); setError(null); setNotice(null);
    try {
      await readJson("/api/integrations/canvas/corpus/sync", { method: "POST", body: JSON.stringify({ canvasUrl: connection.origin, force: true }) });
      setNotice("A complete Canvas material refresh is queued in the background.");
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function loadCourseArchive(connection: CanvasConnection) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const catalog = await readJson<{ courses: CanvasCourseOption[] }>(`/api/integrations/canvas/courses?canvasUrl=${encodeURIComponent(connection.origin)}`);
      setCourseCatalog((held) => ({ ...held, [connection.origin]: catalog.courses || [] }));
      setNotice("Choose any accessible course edition to archive, including previous years.");
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function archiveCourse(connection: CanvasConnection) {
    const canvasCourseId = selectedCourse[connection.origin];
    if (!canvasCourseId) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await readJson("/api/integrations/canvas/corpus/course", { method: "POST", body: JSON.stringify({ canvasUrl: connection.origin, canvasCourseId, force: true }) });
      setNotice("That course edition is queued for a full local archive.");
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
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
    try {
      await readJson("/api/account/integrations/canvas", {
        method: "PUT",
        body: JSON.stringify({ canvasUrl: origin, accessToken: token }),
      });
      await readJson("/api/account/integrations/canvas/corpus", {
        method: "PUT",
        body: JSON.stringify({ canvasUrl: origin, collectionEnabled: materialMode !== "none", sharingMode: materialMode === "community" ? "community" : "private" }),
      });
      setToken("");
      connections.reload();
    } catch (cause) {
      setError((cause as Error).message);
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

  return (
    <div className="flex flex-col gap-8">
      <Section
        title={connections.data?.connections.length ? "Canvas" : "Connect Canvas"}
        note={connections.data?.connections.length ? "Your connected Canvas accounts and material permissions." : "Bring announcements, deadlines and course material into your private workspace."}
        action={connections.data?.connections.length ? <Button type="button" variant="outline" size="sm" onClick={() => setAddingHost((value) => !value)}>{addingHost ? "Cancel" : "Add another Canvas host"}</Button> : undefined}
      >
        {(!connections.data?.connections.length || addingHost) && (
        <form
          onSubmit={connect}
          className="bg-card grid gap-4 rounded-sm p-4 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-2 sm:col-span-2">
            <p className="text-sm">
              <strong>Create a Personal Access Token in Canvas.</strong> Canvas
              remains responsible for your password and OTP; only the token
              belongs here.
            </p>
            <p className="text-muted-foreground text-sm">
              <a
                className="text-primary font-semibold"
                href="https://canvas.maastrichtuniversity.nl/profile/settings"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Maastricht Canvas settings
              </a>{" "}
              ·{" "}
              <a
                className="text-primary font-semibold"
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
              className="text-primary w-fit text-sm font-semibold"
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
          <fieldset className="flex flex-col gap-2 border-t pt-4 sm:col-span-2">
            <legend className="text-sm font-semibold">Course-material collection</legend>
            <p className="text-muted-foreground text-xs">Choose explicitly whether the server may gather and index lesson materials after connecting.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ["none", "Do not collect", "Canvas still supplies deadlines and announcements."],
                ["private", "Collect privately", "Only your Tutor and authorised MCP clients can retrieve it."],
                ["community", "Share with students", "Eligible students may reuse the edition after rights review."],
              ] as const).map(([value, title, detail]) => (
                <label key={value} className={`cursor-pointer rounded-sm border p-3 ${materialMode === value ? "border-primary bg-primary/5" : "hover:bg-background"}`}>
                  <input type="radio" name="material-mode" value={value} checked={materialMode === value} onChange={() => setMaterialMode(value)} className="accent-primary mr-2" />
                  <strong className="text-sm font-medium">{title}</strong>
                  <small className="text-muted-foreground mt-1 block text-xs leading-relaxed">{detail}</small>
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
          <div className="flex items-center justify-between gap-4 border-t pt-3 sm:col-span-2">
            <p className="text-muted-foreground text-xs">
              Encrypted immediately and never displayed again. Do not paste a
              password, OTP, cookie or session export.
            </p>
            <Button type="submit" disabled={busy}>
              {busy ? "Connecting…" : "Connect Canvas"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium sm:col-span-2">
              {error}
            </p>
          )}
        </form>
        )}
      </Section>
      <Section
        title="Saved Canvas hosts"
        note="Removing one deletes its encrypted token here and changes nothing in Canvas."
        action={
          <a
            href="/app/updates?tab=materials"
            className="text-primary text-sm font-semibold"
          >
            Open course material
          </a>
        }
      >
        {corpusStatus.data?.status && (
          <div className="mb-5 border-y py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <strong>Material collection</strong>
              <button type="button" className="text-primary text-sm font-semibold" onClick={corpusStatus.reload}>Refresh status</button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <span><strong className={`${NUMERALS} block text-xl`}>{corpusStatus.data.status.jobs?.filter((job) => ["pending", "running"].includes(job.status)).length ?? 0}</strong><small className="text-muted-foreground">jobs in progress</small></span>
              <span><strong className={`${NUMERALS} block text-xl`}>{corpusStatus.data.status.courses?.length ?? 0}</strong><small className="text-muted-foreground">course editions found</small></span>
              <span><strong className={`${NUMERALS} block text-xl`}>{corpusStatus.data.status.courses?.reduce((total, course) => total + course.sources, 0) ?? 0}</strong><small className="text-muted-foreground">materials stored</small></span>
            </div>
            {!!corpusStatus.data.status.jobs?.length && <details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-sm font-semibold">View collection history</summary><ul className="mt-3 flex max-h-64 flex-col overflow-y-auto">{corpusStatus.data.status.jobs.slice(0, 20).map((job) => <li key={job.id} className="flex items-start justify-between gap-4 border-b py-2 text-sm"><span><strong className="capitalize">{job.type}</strong>{job.error && <small className="text-muted-foreground mt-0.5 block max-w-[60ch] [overflow-wrap:anywhere]">{job.error}</small>}</span><span className={`${NUMERALS} text-muted-foreground capitalize`}>{job.status}</span></li>)}</ul></details>}
          </div>
        )}
        {connections.error ? (
          <Failed
            what="Canvas settings are unavailable"
            message={connections.error}
          />
        ) : !connections.data ? (
          <Skeleton className="h-24 w-full" />
        ) : !connections.data.connections.length ? (
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
            {connections.data.connections.map((connection) => (
              <li
                key={connection.origin}
                className="border-b py-4"
              >
                <details open className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 focus-visible:outline-2 focus-visible:outline-primary">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <strong className={NUMERALS}>{connection.origin}</strong>
                  <small className="text-muted-foreground">
                    Connected {relative(connection.createdAt)}
                    {connection.lastUsedAt
                      ? ` · last used ${relative(connection.lastUsedAt)}`
                      : " · not used yet"}
                  </small>
                  <small className="text-muted-foreground">
                    {connection.corpus?.collectionEnabled
                      ? connection.corpus.sharingMode === "community" ? "Materials: community sharing enabled" : "Materials: private collection enabled"
                      : "Materials: collection disabled"}
                  </small>
                </span>
                <span className="text-muted-foreground text-sm group-open:hidden">Configure</span><span className="text-muted-foreground hidden text-sm group-open:inline">Hide</span>
                </summary>
                <div className="mt-4 flex flex-col gap-2 border-t pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={!connection.corpus?.collectionEnabled ? "none" : connection.corpus.sharingMode} onValueChange={(value) => void saveMaterialMode(connection, value as "none" | "private" | "community")} disabled={busy}>
                      <SelectTrigger className="w-52"><SelectValue aria-label="Material authorization" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Do not collect material</SelectItem>
                        <SelectItem value="private">Private material library</SelectItem>
                        <SelectItem value="community">Share with community</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" onClick={() => void refreshMaterials(connection)} disabled={busy || !connection.corpus?.collectionEnabled}>Force full refresh</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadCourseArchive(connection)} disabled={busy || !connection.corpus?.collectionEnabled}>Choose older course</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(connection)}>Remove</Button>
                  </div>
                  {courseCatalog[connection.origin] && (
                    <div className="flex flex-wrap items-center gap-2 rounded-sm bg-background p-2">
                      <Select value={selectedCourse[connection.origin] || ""} onValueChange={(value) => setSelectedCourse((held) => ({ ...held, [connection.origin]: value || "" }))}>
                        <SelectTrigger className="min-w-72 flex-1"><SelectValue placeholder="Select any Canvas course edition" /></SelectTrigger>
                        <SelectContent>
                          {courseCatalog[connection.origin].map((course) => <SelectItem key={String(course.id)} value={String(course.id)}>{[course.courseCode, course.displayName || course.name, course.term?.name].filter(Boolean).join(" · ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" onClick={() => void archiveCourse(connection)} disabled={busy || !selectedCourse[connection.origin]}>Archive this course</Button>
                    </div>
                  )}
                </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        {notice && <p role="status" className="text-primary text-sm font-medium">{notice}</p>}
        {error && <p role="alert" className="text-sm font-medium">{error}</p>}
      </Section>
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

function ProfileTab({
  summary,
  summaryError,
}: {
  summary: AccountSummary | null;
  summaryError: string | null;
}) {
  const activity = useJson<Activity>("/api/activity?days=28");
  const courses = useJson<{ courses: CourseRow[] }>("/api/courses");
  const cards = useJson<SrDue>("/api/sr/due");
  const mistakes = useJson<{ length: number } | unknown[]>(
    "/api/mistakes?open=true",
  );

  const account = summary?.account;
  const openMistakes = Array.isArray(mistakes.data)
    ? mistakes.data.length
    : null;
  const active = courses.data
    ? courses.data.courses.filter((course) => !course.archived).length
    : null;
  const archived = courses.data
    ? courses.data.courses.filter((course) => course.archived).length
    : null;
  const trend = weekTrend(activity.data);
  const bars = useMemo(
    () => activityBars(activity.data?.series ?? []),
    [activity.data],
  );

  const identity: [string, ReactNode][] = [
    [
      "Email",
      account?.email ??
        (account?.mode === "local" ? "Local development account" : "—"),
    ],
    [
      "Programme",
      !summary ? (
        "…"
      ) : summary.programmes.length ? (
        <span className="flex flex-col gap-1">
          {summary.programmes.map((membership) => (
            <span
              key={membership.programmeId}
              className="flex items-baseline gap-2"
            >
              {membership.programme
                ? `${membership.programme.degree} ${membership.programme.name}`
                : membership.programmeId}
              {membership.role === "admin" && (
                <Badge variant="secondary">Programme admin</Badge>
              )}
            </span>
          ))}
        </span>
      ) : account?.mode === "local" ? (
        "All programmes (local development)"
      ) : (
        "Not linked to a programme yet"
      ),
    ],
    [
      "Sign-in",
      account?.mode === "local"
        ? "Local development (no sign-in)"
        : "Managed by Clerk",
    ],
    [
      "Storage",
      account?.storage === "neon"
        ? "Encrypted cloud database (Neon)"
        : account
          ? "Local files on this machine"
          : "…",
    ],
    [
      "Account ID",
      account?.id ? (
        <code className={`text-xs ${NUMERALS}`}>{account.id}</code>
      ) : (
        "…"
      ),
    ],
  ];

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Identity"
        note="Who you are signed in as, and where your record lives."
        action={account?.mode === "clerk" ? <HostedProfileActions /> : null}
      >
        <dl className="flex flex-col">
          {identity.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[9rem_minmax(0,1fr)] items-baseline gap-4 border-b py-2"
            >
              <dt className={RULE}>{label}</dt>
              <dd className="text-[15px]">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="Study record"
        note="What Wicker Study currently holds for you."
      >
        {summaryError && (
          <Failed
            what="Your stored record could not be read"
            message={summaryError}
          />
        )}
        <div className="flex flex-wrap gap-x-12 gap-y-6">
          <Figure
            label="Active courses"
            value={active ?? "—"}
            detail={
              courses.error
                ? "Courses unavailable"
                : archived
                  ? `${archived} archived`
                  : "None archived"
            }
          />
          <Figure
            label="Flashcards"
            value={cards.data ? cards.data.totalCards : "—"}
            detail={
              cards.error
                ? "Cards unavailable"
                : cards.data
                  ? `${cards.data.dueCount} due now`
                  : "Reading…"
            }
          />
          <Figure
            label="Open mistakes"
            value={openMistakes ?? "—"}
            detail={
              mistakes.error ? "Mistakes unavailable" : "Scored below 7/10"
            }
          />
          <Figure
            label="Study streak"
            value={activity.data ? `${activity.data.streak}d` : "—"}
            detail={
              activity.data
                ? `${activity.data.activeDays} active days of ${activity.data.days}`
                : "Reading…"
            }
          />
          <Figure
            label="Average score"
            // Absent is not zero: no graded answer means no average, not 0/10.
            value={
              activity.data?.averageScore != null
                ? `${activity.data.averageScore}/10`
                : "—"
            }
            detail="Graded answers, last 120 days"
          />
          <Figure
            label="Stored records"
            value={summary ? formatCount(summary.totals.documents) : "—"}
            detail={
              summary
                ? `${formatBytes(summary.totals.bytes)} · updated ${relative(summary.totals.updatedAt) ?? "never"}`
                : "Reading…"
            }
          />
        </div>
      </Section>

      <Section
        title="Activity"
        note={
          trend
            ? `${trend.now} actions this week — ${trend.label}.`
            : "Your study ledger over the last four weeks."
        }
      >
        {activity.error ? (
          <Failed
            what="Your activity ledger could not be read"
            message={activity.error}
          />
        ) : !activity.data ? (
          <Skeleton className="h-24 w-full" />
        ) : !bars.some((bar) => bar.total) ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                No activity in the last {activity.data.days} days
              </EmptyTitle>
              <EmptyDescription>
                Answer a question, review a card or sit a mock and it is
                recorded here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div
              className="flex h-24 items-end gap-1"
              role="img"
              aria-label={`Study activity, ${bars.reduce((sum, bar) => sum + bar.total, 0)} actions over ${bars.length} days`}
            >
              {bars.map((bar) => (
                <span
                  key={bar.date}
                  title={`${bar.date}: ${bar.total} action${bar.total === 1 ? "" : "s"}`}
                  style={{ height: `${bar.height}%` }}
                  // The one colour marks the day that is live; the rest are ink.
                  className={`flex-1 ${bar.total ? (bar.today ? "bg-primary" : "bg-foreground") : "bg-muted"}`}
                />
              ))}
            </div>
            <ol className="flex flex-col">
              {activity.data.recent.slice(0, 10).map((event, index) => (
                <li
                  key={`${event.at}-${index}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto_5rem] items-baseline gap-4 border-b py-2"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <strong className="text-[15px] font-medium">
                      {ACTIVITY_LABEL[event.type] ?? event.type}
                    </strong>
                    {event.label && (
                      <small className="text-muted-foreground truncate text-xs">
                        {event.label}
                      </small>
                    )}
                  </span>
                  <span className={`text-sm ${NUMERALS}`}>
                    {typeof event.score === "number" && event.type !== "review"
                      ? event.type === "mock"
                        ? `${Math.round(event.score * 10)}%`
                        : `${event.score}/10`
                      : ""}
                  </span>
                  <time
                    dateTime={event.at}
                    className={`text-muted-foreground text-right text-sm ${NUMERALS}`}
                  >
                    {relative(event.at)}
                  </time>
                </li>
              ))}
            </ol>
          </>
        )}
      </Section>
    </div>
  );
}

// ----- API access ---------------------------------------------------------

function SecretOnce({
  created,
  onDismiss,
}: {
  created: CreatedApiKey;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(created.secret);
      setCopied("done");
    } catch {
      // Deliberately says nothing about the value it was holding.
      setCopied("failed");
    }
  }

  return (
    <Alert role="status">
      <KeyIcon />
      <AlertTitle>
        Copy this key now — it is shown once and never again
      </AlertTitle>
      <AlertDescription>
        <span className="flex flex-col gap-3">
          <span>
            Only a hash of it is stored, so it cannot be shown, mailed or
            recovered later. If you lose it, revoke the key and create another.
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <code
              className={`bg-card border px-2 py-1 text-xs break-all ${NUMERALS}`}
            >
              {created.secret}
            </code>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied === "done" ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {copied === "done"
                ? "Copied"
                : copied === "failed"
                  ? "Select and copy"
                  : "Copy"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Done
            </Button>
          </span>
        </span>
      </AlertDescription>
    </Alert>
  );
}

function ApiTab() {
  const keys = useJson<{ keys: ApiKey[]; scopes: string[]; admin: boolean }>(
    "/api/account/api-keys",
  );
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [name, setName] = useState("");
  const [lifetime, setLifetime] = useState("90d");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const admin = Boolean(keys.data?.admin);
  const offered = availableScopes(admin);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const rows = keys.data?.keys ?? [];

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (creating) return;
    setFormError(null);
    let granted: string[];
    try {
      granted = normalizeScopes(scopes, { admin });
    } catch (cause) {
      setFormError((cause as Error).message);
      return;
    }
    setCreating(true);
    try {
      const key = await readJson<CreatedApiKey>("/api/account/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, scopes: granted, lifetime }),
      });
      setCreated(key);
      setName("");
      setScopes(["read"]);
      keys.reload();
    } catch (cause) {
      setFormError((cause as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke() {
    if (!revoking) return;
    setRevokeBusy(true);
    setRevokeError(null);
    try {
      await readJson(
        `/api/account/api-keys/${encodeURIComponent(revoking.id)}`,
        { method: "DELETE" },
      );
      setRevoking(null);
      keys.reload();
    } catch (cause) {
      setRevokeError(
        `The key was not revoked, and still works. ${(cause as Error).message}`,
      );
    } finally {
      setRevokeBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {created && (
        <SecretOnce created={created} onDismiss={() => setCreated(null)} />
      )}

      <Section
        title="Personal API keys"
        note={
          <>
            A key acts as you, limited to its scopes. Send it as{" "}
            <code className="text-xs">Authorization: Bearer wsk_…</code>. Keys
            cannot manage other keys, reset data, or delete your account.
          </>
        }
        action={
          <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
            {activeKeys(rows).length} active
          </span>
        }
      >
        {keys.error ? (
          <Failed what="Your keys could not be read" message={keys.error} />
        ) : !keys.data ? (
          <Skeleton className="h-24 w-full" />
        ) : !rows.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No keys yet</EmptyTitle>
              <EmptyDescription>
                Create one to let an agent or the MCP server work with your
                record.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((key) => {
                const state = keyState(key);
                return (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className={`text-xs ${NUMERALS}`}>
                        {key.prefix}…
                      </code>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <Badge
                            key={scope}
                            variant={
                              scope === "admin" ? "default" : "secondary"
                            }
                          >
                            {scope}
                          </Badge>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className={`text-muted-foreground ${NUMERALS}`}>
                      {relative(key.createdAt)}
                    </TableCell>
                    <TableCell className={`text-muted-foreground ${NUMERALS}`}>
                      {relative(key.lastUsedAt) ?? "never"}
                    </TableCell>
                    <TableCell className={`text-muted-foreground ${NUMERALS}`}>
                      {key.expiresAt
                        ? clockOrDate(key.expiresAt, "date")
                        : "never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {state === "active" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setRevokeError(null);
                            setRevoking(key);
                          }}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {KEY_STATE_LABEL[state]}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <form onSubmit={create} className="flex flex-col gap-4 border-t pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
              <span className={RULE}>Key name</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="e.g. Claude Desktop"
                required
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={RULE}>Expires</span>
              <Select
                value={lifetime}
                onValueChange={(value) =>
                  setLifetime((value as string) ?? "90d")
                }
              >
                <SelectTrigger
                  className="w-[160px]"
                  aria-label="Key lifetime"
                  disabled={creating}
                >
                  <SelectValue>
                    {(value) =>
                      KEY_LIFETIMES.find(([id]) => id === value)?.[1] ??
                      "In 90 days"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {KEY_LIFETIMES.map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className={RULE}>Scopes</legend>
            {offered.map((scope) => (
              <label key={scope} className="flex items-start gap-3 py-1">
                <Checkbox
                  checked={scope === "read" ? true : scopes.includes(scope)}
                  disabled={scope === "read" || creating}
                  onCheckedChange={(checked: boolean) =>
                    setScopes((current) =>
                      checked
                        ? [...current, scope]
                        : current.filter((entry) => entry !== scope),
                    )
                  }
                  className="mt-0.5"
                />
                <span className="flex flex-col gap-0.5">
                  <strong className="text-sm font-semibold">{scope}</strong>
                  <small className="text-muted-foreground text-xs">
                    {SCOPE_COPY[scope]}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>

          {formError && (
            <p role="alert" className="text-sm font-medium">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={creating || !name.trim()}>
              <KeyIcon data-icon="inline-start" />
              {creating ? "Creating…" : "Create key"}
            </Button>
            {admin && <span className={RULE}>Administrator</span>}
          </div>
        </form>
      </Section>

      <Section
        title="Use it from an agent"
        note={
          <>
            The endpoint list with scopes is at{" "}
            <a
              className="text-primary font-semibold"
              href="/api/agent/manifest"
              target="_blank"
              rel="noopener noreferrer"
            >
              /api/agent/manifest
            </a>
            . The MCP server in the repository wraps the same API.
          </>
        }
      >
        <pre className="bg-card overflow-x-auto border p-4 font-mono text-xs leading-relaxed">
          <code>{mcpSnippet(origin)}</code>
        </pre>
        <p className="text-muted-foreground text-sm">
          Teach Claude Code the study, planning and content workflows with the
          skill:
        </p>
        <pre className="bg-card overflow-x-auto border p-4 font-mono text-xs leading-relaxed">
          <code>{skillSnippet(origin)}</code>
        </pre>
      </Section>

      <Confirm
        open={Boolean(revoking)}
        onOpenChange={(next) => {
          if (!next) setRevoking(null);
        }}
        title={`Revoke “${revoking?.name ?? "this key"}”?`}
        description="Any agent, script or MCP client using this key stops working immediately. Revoking cannot be undone; a replacement key is a new secret."
        word="REVOKE"
        action="Revoke key"
        busy={revokeBusy}
        error={revokeError}
        onConfirm={revoke}
      />
    </div>
  );
}

// ----- AI usage -----------------------------------------------------------

function UsageTab() {
  const usage = useJson<AiUsage>("/api/ai/usage");
  const meters = useMemo(() => allowanceMeters(usage.data), [usage.data]);
  const resetsAt = usage.data?.resetsAt ?? null;

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="Allowance"
        note="AI is used for the source-grounded tutor, extra exercises you ask for, and academic documents you explicitly ask to organise."
        action={
          <Button variant="secondary" size="sm" onClick={usage.reload}>
            <RotateCcwIcon data-icon="inline-start" />
            Refresh
          </Button>
        }
      >
        {usage.error ? (
          <Failed
            what="Your allowance could not be read"
            message={usage.error}
          />
        ) : !usage.data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="flex flex-col">
            {meters.map((meter) => (
              <div
                key={meter.id}
                className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] items-center gap-6 border-b py-3"
              >
                <span className="flex flex-col gap-0.5">
                  <strong className="text-[15px] font-medium">
                    {meter.label}
                  </strong>
                  <small
                    className={`text-muted-foreground text-xs ${NUMERALS}`}
                  >
                    {formatCount(meter.used)} of{" "}
                    {meter.limit === null
                      ? "no configured limit"
                      : formatCount(meter.limit)}
                  </small>
                </span>
                {/* An unknown limit gets no bar rather than a full one. */}
                {meter.percent === null ? (
                  <span className="text-muted-foreground text-sm">
                    Not limited on this server
                  </span>
                ) : (
                  <Progress value={meter.percent} />
                )}
                <small
                  className={`text-muted-foreground text-right text-xs ${NUMERALS}`}
                >
                  {meter.remaining === null
                    ? "—"
                    : `${formatCount(meter.remaining)} left`}
                  {" · resets "}
                  {meter.resets === "day"
                    ? clockOrDate(resetsAt?.day, "time")
                    : clockOrDate(resetsAt?.month, "date")}
                </small>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Recent requests"
        note="Every AI request this month, newest first. A pending request reserves its maximum output so concurrent calls cannot exceed your limit."
      >
        {!usage.data ? null : !usage.data.recent.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No AI requests yet this month</EmptyTitle>
              <EmptyDescription>
                The tutor, extra exercises and plan imports all appear here once
                used.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage.data.recent.map((event) => {
                const tokens = requestTokens(event);
                return (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      {AI_FEATURE_LABEL[event.feature] ?? event.feature}
                    </TableCell>
                    <TableCell>
                      {event.status === "completed" ? (
                        <span className="text-muted-foreground text-sm">
                          Completed
                        </span>
                      ) : (
                        <Badge
                          variant={
                            event.status === "failed" ? "default" : "secondary"
                          }
                        >
                          {event.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={`text-right ${NUMERALS}`}>
                      {formatCount(tokens.input)}
                      {tokens.estimated && (
                        <small className="text-muted-foreground"> est.</small>
                      )}
                    </TableCell>
                    <TableCell className={`text-right ${NUMERALS}`}>
                      {formatCount(tokens.output)}
                      {event.status === "pending" && (
                        <small className="text-muted-foreground">
                          {" "}
                          reserved
                        </small>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-muted-foreground text-right ${NUMERALS}`}
                    >
                      {relative(event.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <p className="text-muted-foreground text-sm">
          Direct API calls use provider-reported token totals; local CLI
          providers use a conservative estimate.
        </p>
      </Section>
    </div>
  );
}

// ----- Data & privacy -----------------------------------------------------

function StorageTable({ entries }: { entries: NamespaceEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Record</TableHead>
          <TableHead className="text-right">Rows</TableHead>
          <TableHead className="text-right">Size</TableHead>
          <TableHead className="text-right">Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.namespace}>
            <TableCell>
              <span className="flex flex-col gap-0.5">
                <strong className="text-[15px] font-medium">
                  {namespaceLabel(entry)}
                </strong>
                {entry.detail && (
                  <small className="text-muted-foreground text-xs">
                    {entry.detail}
                  </small>
                )}
              </span>
            </TableCell>
            <TableCell className={`text-right ${NUMERALS}`}>
              {formatCount(entry.count)}
            </TableCell>
            <TableCell className={`text-right ${NUMERALS}`}>
              {formatBytes(entry.bytes)}
            </TableCell>
            <TableCell
              className={`text-muted-foreground text-right ${NUMERALS}`}
            >
              {relative(entry.updatedAt) ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DataTab({
  summary,
  summaryError,
  reload,
}: {
  summary: AccountSummary | null;
  summaryError: string | null;
  reload: () => void;
}) {
  const groups = useMemo(
    () => groupNamespaces(summary?.namespaces ?? []),
    [summary],
  );
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [scope, setScope] = useState<ResetScope | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function exportData() {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch("/api/account/export", {
        headers: { accept: "application/json" },
      });
      if (!response.ok)
        throw new Error(`The export returned ${response.status}`);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `wicker-study-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (cause) {
      setExportError((cause as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function reset() {
    if (!scope) return;
    setResetBusy(true);
    setResetError(null);
    try {
      await readJson("/api/account/data", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "RESET", scope }),
      });
      // The vanilla half keeps read-state in localStorage; both halves have to
      // agree that it is gone.
      for (const key of Object.keys(localStorage)) {
        if (
          /^(chapter-read:|chapter-tab|recent-chapter|attempt|practice|mock)/.test(
            key,
          )
        )
          localStorage.removeItem(key);
      }
      setScope(null);
      reload();
    } catch (cause) {
      setResetError(`Nothing was changed. ${(cause as Error).message}`);
    } finally {
      setResetBusy(false);
    }
  }

  async function deleteAccount() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await readJson("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      localStorage.clear();
      window.location.assign("/?account-deleted=1");
    } catch (cause) {
      setDeleteBusy(false);
      setDeleteError(
        `Your account remains accessible and nothing was deleted. ${(cause as Error).message}`,
      );
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Section
        title="What is stored"
        note="Your personal record, separate from shared course material. Nothing here is used to train models."
        action={
          summary && (
            <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
              {formatCount(summary.totals.documents)} records ·{" "}
              {formatBytes(summary.totals.bytes)}
            </span>
          )
        }
      >
        {summaryError ? (
          <Failed
            what="Your storage record could not be read"
            message={summaryError}
          />
        ) : !summary ? (
          <Skeleton className="h-40 w-full" />
        ) : !summary.namespaces.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nothing stored yet</EmptyTitle>
              <EmptyDescription>
                Records appear here as you read, practise and plan.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h3 className={RULE}>Cleared by a reset</h3>
                <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
                  {formatCount(groups.cleared.count)} rows ·{" "}
                  {formatBytes(groups.cleared.bytes)}
                </span>
              </div>
              {groups.cleared.entries.length ? (
                <StorageTable entries={groups.cleared.entries} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No study records yet.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h3 className={RULE}>Kept on reset</h3>
                <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
                  {formatCount(groups.kept.count)} rows ·{" "}
                  {groups.kept.measured
                    ? formatBytes(groups.kept.bytes)
                    : `at least ${formatBytes(groups.kept.bytes)}`}
                </span>
              </div>
              {groups.kept.entries.length ? (
                <StorageTable entries={groups.kept.entries} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nothing outside your study record.
                </p>
              )}
              {!groups.kept.measured && (
                <p className="text-muted-foreground text-sm">
                  Some of these families are not measured in bytes by the
                  server, so this total is a floor, not a size.
                </p>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Your data"
        note="Export, reset, or remove what Wicker Study holds about you."
      >
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-6 border-b py-3">
            <div className="flex flex-col gap-0.5">
              <strong className="text-[15px] font-medium">
                Export personal data
              </strong>
              <small className="text-muted-foreground text-sm">
                A machine-readable JSON copy of your study records, plan,
                attempts, review history, account details and AI usage. Canvas
                access tokens are never included.
              </small>
              {exportError && (
                <small role="alert" className="text-sm font-medium">
                  The export failed. {exportError}
                </small>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={exportData}
              disabled={exporting}
            >
              <DownloadIcon data-icon="inline-start" />
              {exporting ? "Preparing…" : "Download JSON"}
            </Button>
          </div>
          <div className="flex items-start justify-between gap-6 border-b py-3">
            <div className="flex flex-col gap-0.5">
              <strong className="text-[15px] font-medium">
                Reset study data
              </strong>
              <small className="text-muted-foreground text-sm">
                Clears progress, flashcards, mistakes, mock sessions, personal
                exercises and the activity log. Your account, academic plan and
                AI usage ledger are kept.
              </small>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setResetError(null);
                setScope("study");
              }}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reset study data
            </Button>
          </div>
          <div className="flex items-start justify-between gap-6 border-b py-3">
            <div className="flex flex-col gap-0.5">
              <strong className="text-[15px] font-medium">
                Erase all personal data
              </strong>
              <small className="text-muted-foreground text-sm">
                Removes every record, including your academic plan and usage
                ledger, but keeps your sign-in so you can start again.
              </small>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setResetError(null);
                setScope("everything");
              }}
            >
              <TrashIcon data-icon="inline-start" />
              Erase everything
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          For access, correction, restriction or objection requests that are not
          available here, write to{" "}
          <a
            className="text-primary font-semibold"
            href="mailto:privacy@study.wicker.life"
          >
            privacy@study.wicker.life
          </a>
          . See the{" "}
          <a className="text-primary font-semibold" href="/privacy">
            privacy notice
          </a>
          .
        </p>
      </Section>

      {/*
        The danger zone. There is no danger red in this world, so it is set
        apart by position, a rule and its copy: last on the page, below a full
        separator, alone under its own heading.
      */}
      <div className="flex flex-col gap-6 pt-4">
        <Separator />
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-2xl tracking-tight">
            Deleting your account
          </h2>
          <p className="text-muted-foreground max-w-[60ch] text-sm">
            This is the only action on this page that removes your sign-in as
            well as your data. Your sources are withdrawn from future editorial
            work; material already published after review is unaffected. It
            cannot be undone, and support cannot restore it.
          </p>
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
            >
              <TrashIcon data-icon="inline-start" />
              Delete account and all data
            </Button>
          </div>
        </section>
      </div>

      <Confirm
        open={Boolean(scope)}
        onOpenChange={(next) => {
          if (!next) setScope(null);
        }}
        title={scope ? RESET_SCOPES[scope].title : ""}
        description={scope ? RESET_SCOPES[scope].description : ""}
        removes={scope ? RESET_SCOPES[scope].removes : []}
        word="RESET"
        action={scope ? RESET_SCOPES[scope].action : "Reset"}
        busy={resetBusy}
        error={resetError}
        onConfirm={reset}
      />

      <Confirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Permanently delete your account?"
        description="Your sign-in identity and every personal record are removed, and you are signed out when it finishes."
        removes={[
          "Your authentication identity, so you cannot sign back in",
          "Progress, notes, answers, review history, tutor conversations and usage records",
          "Encrypted Canvas connections and uploaded academic-record history",
        ]}
        word="DELETE"
        action="Delete account and data"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={deleteAccount}
      />
    </div>
  );
}

// ----- the page -----------------------------------------------------------

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
    [account?.firstName, account?.lastName].filter(Boolean).join(" ") ||
    account?.email?.split("@")[0] ||
    (account?.mode === "local" ? "Local student" : "Student");
  const since = longDate(account?.createdAt);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-5 sm:p-8">
      <header className="flex flex-col gap-1">
        {summary.data ? (
          <>
            <h1 className="font-heading text-5xl leading-none tracking-tighter">
              {name}
            </h1>
            <p className={`text-muted-foreground text-sm ${NUMERALS}`}>
              {[account?.email, since ? `Member since ${since}` : null]
                .filter(Boolean)
                .join(" · ") || "Signed in"}
            </p>
          </>
        ) : summary.error ? (
          <h1 className="font-heading text-5xl leading-none tracking-tighter">
            Account
          </h1>
        ) : (
          <>
            <Skeleton className="h-12 w-80" />
            <Skeleton className="h-4 w-64" />
          </>
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
        <TabsList>
          {TABS.map(([id, label]) => (
            <TabsTrigger key={id} value={id}>
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
