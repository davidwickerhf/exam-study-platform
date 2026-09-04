"use client";

/**
 * THESIS: Updates is a dispatch desk, not four unrelated Canvas lists.
 * OWN-WORLD: A warm board canvas, white ruled panes, indigo selection and one
 * near-black briefing strip extend the dashboard language. Canvas red is only
 * source identity.
 * STORY: Understand what changed and what is due, then scan at left and read
 * or act at right without losing place.
 * FIRST VIEWPORT: Shared 32px header, three-fact briefing, local tabs,
 * edge-to-edge toolbar, compact dispatch list and calm detail pane.
 * FORM: Two-Pane Dispatch fused with Canvas Briefing; candidates 5 and 4,
 * seed ad40c9d9.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 * finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  Clock3Icon,
  FileIcon,
  Layers3Icon,
  MegaphoneIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { CanvasMark } from "@/components/brand/canvas-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  assignmentTitle,
  bucketOf,
  BUCKETS,
  STATUS_LABEL,
  STATES,
} from "@/lib/workspace/canvas";
import {
  ANNOUNCEMENT_SORTS,
  ASSIGNMENT_SORTS,
  UPDATE_WINDOWS,
  canRecordAnnouncementVisit,
  courseRows,
  filterAnnouncements,
  filterAssignments,
  isNewAnnouncement,
  markSeen,
  connectionOrigin,
  readPreferences,
  readSeenAt,
  updateBriefing,
  writePreferences,
} from "@/lib/workspace/updates.mjs";

type Course = {
  id: string;
  courseCode?: string;
  displayName?: string;
  name?: string;
  current?: boolean;
  upcoming?: boolean;
  courseUrl?: string;
  term?: { name?: string };
};
type Announcement = {
  id: string;
  courseId: string;
  courseCode?: string;
  courseName?: string;
  title: string;
  author?: string;
  postedAt?: string;
  html?: string;
  excerpt?: string;
  url?: string;
  read?: boolean | null;
};
type Assignment = {
  id: string;
  courseId: string;
  courseCode?: string;
  courseName?: string;
  title: string;
  description?: string;
  dueAt?: string;
  pointsPossible?: number;
  score?: number;
  status: string;
  url?: string;
};
type Grade = {
  courseId: string;
  currentScore?: number | null;
  currentGrade?: string | null;
};
type Hub = {
  connected: boolean;
  origin?: string;
  fetchedAt?: string;
  truncated?: boolean;
  selectedCourseIds?: string[];
  courses: Course[];
  announcements: Announcement[];
  assignments: Assignment[];
  grades?: Grade[];
  problems?: { part: string; error: string }[];
};
type ModuleItem = {
  id?: string;
  contentId?: string;
  title: string;
  type: string;
  url?: string;
};
type Modules = {
  course?: { name?: string };
  syllabus?: { substantive?: boolean; html?: string };
  modules: { id: string; name: string; items: ModuleItem[] }[];
};

const NUMERALS = "font-data tabular-nums";
const CANVAS_RED = "text-[#e13f29]";
const DESIGN_CONTRACT = "updates-canvas-dispatch-ad40c9d9";
const label = (item: any) =>
  item.courseCode ||
  item.courseName ||
  item.displayName ||
  item.name ||
  "Canvas";
const courseName = (item: any) =>
  item.courseName || item.displayName || item.name || label(item);
const when = (value?: string, time = true) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        ...(time
          ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
          : {}),
      }).format(new Date(value))
    : "Undated";
const daysUntil = (value?: string) => {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
};
const deadlineLabel = (value?: string) => {
  const days = daysUntil(value);
  if (days == null) return "No dated deadline";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return days > 1 ? `Due in ${days} days` : `${Math.abs(days)} days overdue`;
};

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.error || `${path} returned ${response.status}`);
  return body;
}

function hubPath({
  scope,
  days,
  origin,
  refresh = false,
}: {
  scope: string;
  days: string;
  origin?: string;
  refresh?: boolean;
}) {
  const params = new URLSearchParams({ scope, days });
  if (origin) params.set("canvasUrl", origin);
  if (refresh) params.set("refresh", "1");
  return `/api/integrations/canvas/hub?${params}`;
}

function SourceMark({ className = "size-5" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-md bg-[#e13f29]/8 ${className}`}
      aria-hidden="true"
    >
      <CanvasMark className={`size-[58%] ${CANVAS_RED}`} />
    </span>
  );
}

function OpenCanvas({
  href,
  label = "Open in Canvas",
}: {
  href?: string;
  label?: string;
}) {
  if (!href) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      {label}
      <ArrowUpRightIcon data-icon="inline-end" />
    </Button>
  );
}

function Toolbar({
  courses,
  course,
  setCourse,
  query,
  setQuery,
  sort,
  setSort,
  sorts,
  children,
}: any) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
      {children}
      <Select
        value={course}
        onValueChange={(value) => setCourse(value ?? "all")}
      >
        <SelectTrigger className="w-[168px] bg-background" aria-label="Course">
          <SelectValue>
            {(value) =>
              value === "all"
                ? "All courses"
                : label(
                    courses.find((x: Course) => String(x.id) === value) || {},
                  )
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All courses</SelectItem>
          {courses.map((entry: Course) => (
            <SelectItem key={entry.id} value={String(entry.id)}>
              {label(entry)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative min-w-[190px] flex-1">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="bg-background pl-9"
          placeholder="Search updates"
          aria-label="Search updates"
        />
      </div>
      <Select value={sort} onValueChange={setSort}>
        <SelectTrigger className="w-[156px] bg-background" aria-label="Sort">
          <SelectValue>
            {sorts.find(([id]: string[]) => id === sort)?.[1] || "Sort"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sorts.map(([id, text]: string[]) => (
            <SelectItem key={id} value={id}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Briefing({ hub, since }: { hub: Hub; since: string }) {
  const facts = updateBriefing(hub, { since });
  const partial = hub.truncated || Boolean(hub.problems?.length);
  const count = (value: number | null) =>
    value == null ? "Unavailable" : hub.truncated ? `${value}+` : value;
  return (
    <section className="overflow-hidden rounded-xl bg-[#20263b] text-white shadow-[var(--shadow-sheet)]">
      <div className="grid sm:grid-cols-3">
        <BriefingFact
          icon={MegaphoneIcon}
          eyebrow="New since last visit"
          value={since ? count(facts.newAnnouncements) : "Not yet available"}
          detail={since ? "announcements" : "Available after your next visit"}
        />
        <BriefingFact
          icon={CheckCircle2Icon}
          eyebrow="Actionable coursework"
          value={count(facts.openAssignments)}
          detail={facts.assignmentsAvailable ? "open assignments" : "Canvas did not return assignments"}
          bordered
        />
        <BriefingFact
          icon={CalendarClockIcon}
          eyebrow="Next deadline"
          value={
            !facts.assignmentsAvailable
              ? "Unavailable"
              : facts.nextDeadline
              ? when(facts.nextDeadline.dueAt, false)
              : "None dated"
          }
          detail={
            !facts.assignmentsAvailable
              ? "Canvas did not return assignments"
              : facts.nextDeadline
              ? `${hub.truncated ? "Earliest returned · " : ""}${label(facts.nextDeadline)} · ${facts.nextDeadline.title}`
              : "No upcoming Canvas date"
          }
          bordered
        />
      </div>
      {partial && (
        <p className="border-t border-white/12 px-5 py-2.5 text-xs text-white/64 sm:px-6">
          Partial briefing. One or more Canvas sources did not return a complete
          result.
        </p>
      )}
    </section>
  );
}

function BriefingFact({
  icon: Icon,
  eyebrow,
  value,
  detail,
  bordered = false,
}: any) {
  return (
    <div
      className={`flex min-h-28 items-center gap-4 px-5 py-5 sm:px-6 ${bordered ? "border-white/12 sm:border-l" : ""}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/8">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <small className="block text-xs font-semibold tracking-[0.08em] text-white/58 uppercase">
          {eyebrow}
        </small>
        <strong
          className={`mt-1 block truncate text-xl font-semibold ${NUMERALS}`}
        >
          {value}
        </strong>
        <span className="block truncate text-sm text-white/68">{detail}</span>
      </span>
    </div>
  );
}

function DispatchShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 overflow-hidden rounded-xl border bg-background xl:flex xl:flex-1 xl:flex-col">
      {children}
    </div>
  );
}

function AnnouncementDesk({
  rows,
  selected,
  onSelect,
  since,
  partial,
}: {
  rows: Announcement[];
  selected: Announcement | null;
  onSelect: (id: string) => void;
  since: string;
  partial: boolean;
}) {
  const detailRef = useRef<HTMLElement>(null);
  const select = (id: string) => {
    onSelect(id);
    if (window.matchMedia("(max-width: 1023px)").matches)
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "start",
        }),
      );
  };
  if (!rows.length)
    return (
      <DeskEmpty
        title={partial ? "Announcement results are partial" : "No announcements match"}
        detail={
          partial
            ? "Canvas did not return a complete result. Refresh or try again later."
            : "Widen the date window or clear a filter."
        }
      />
    );
  return (
    <div className="grid min-h-0 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)] xl:flex-1">
      <ol className="min-h-0 border-b lg:overflow-y-auto lg:border-r lg:border-b-0">
        {rows.map((item) => {
          const active = item.id === selected?.id;
          return (
            <li key={item.id}>
              <button
                onClick={() => select(item.id)}
                aria-pressed={active}
                className={`group relative flex w-full gap-3 border-b px-4 py-4 text-left transition-colors last:border-b-0 ${active ? "bg-primary/[0.055]" : "hover:bg-muted/55"}`}
              >
                {active && (
                  <span className="bg-primary absolute inset-y-0 left-0 w-[3px]" />
                )}
                <SourceMark className="mt-0.5 size-9" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <strong
                      className={`text-primary text-xs font-semibold tracking-[0.04em] ${NUMERALS}`}
                    >
                      {label(item)}
                    </strong>
                    {isNewAnnouncement(item, since) && (
                      <span
                        className="bg-primary size-1.5 rounded-full"
                        aria-label="New"
                      />
                    )}
                    <time
                      className={`text-muted-foreground ml-auto text-xs ${NUMERALS}`}
                    >
                      {when(item.postedAt, false)}
                    </time>
                  </span>
                  <strong className="mt-1.5 line-clamp-2 block text-sm leading-snug font-semibold">
                    {item.title}
                  </strong>
                  <span className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                    {item.excerpt || "This announcement has no preview text."}
                  </span>
                </span>
                <ChevronRightIcon
                  className={`mt-8 size-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                />
              </button>
            </li>
          );
        })}
      </ol>
      <article
        ref={detailRef}
        className="min-w-0 scroll-mt-4 lg:overflow-y-auto"
      >
        {selected && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 sm:px-7">
              <div className="flex min-w-0 items-start gap-3">
                <SourceMark className="size-10" />
                <div>
                  <p
                    className={`text-primary text-sm font-semibold ${NUMERALS}`}
                  >
                    {label(selected)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {courseName(selected)}
                  </p>
                </div>
              </div>
              <OpenCanvas href={selected.url} />
            </header>
            <div className="mx-auto max-w-[70ch] px-5 py-7 sm:px-7">
              <div className="flex flex-wrap items-center gap-2">
                {isNewAnnouncement(selected, since) && <Badge>New</Badge>}
                <time className={`text-muted-foreground text-sm ${NUMERALS}`}>
                  {when(selected.postedAt)}
                </time>
                {selected.author && (
                  <span className="text-muted-foreground text-sm">
                    by {selected.author}
                  </span>
                )}
              </div>
              <h2 className="font-heading mt-4 text-2xl leading-tight font-semibold tracking-[-0.025em]">
                {selected.title}
              </h2>
              {selected.html ? (
                <div
                  className="mt-6 text-base leading-7 [&_a]:text-primary [&_a]:underline [&_li]:mb-1 [&_ol]:my-4 [&_ol]:pl-5 [&_p]:mb-4 [&_ul]:my-4 [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: selected.html }}
                />
              ) : (
                <p className="text-muted-foreground mt-6 text-base leading-7">
                  {selected.excerpt || "This announcement has no text."}
                </p>
              )}
            </div>
          </>
        )}
      </article>
    </div>
  );
}

function AssignmentDesk({
  rows,
  selected,
  onSelect,
  partial,
}: {
  rows: Assignment[];
  selected: Assignment | null;
  onSelect: (id: string) => void;
  partial: boolean;
}) {
  const detailRef = useRef<HTMLElement>(null);
  const select = (id: string) => {
    onSelect(id);
    if (window.matchMedia("(max-width: 1023px)").matches)
      requestAnimationFrame(() =>
        detailRef.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "start",
        }),
      );
  };
  if (!rows.length)
    return (
      <DeskEmpty
        title={partial ? "Assignment results are partial" : "No assignments match"}
        detail={
          partial
            ? "Canvas did not return a complete result. Refresh or try again later."
            : "Change the status, course, or search filter."
        }
      />
    );
  return (
    <div className="grid min-h-0 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)] xl:flex-1">
      <div className="min-h-0 border-b lg:overflow-y-auto lg:border-r lg:border-b-0">
        {BUCKETS.map((bucket) => {
          const bucketRows = rows.filter(
            (item) => bucketOf(item as any) === bucket.id,
          );
          if (!bucketRows.length) return null;
          return (
            <section key={bucket.id}>
              <header className="bg-muted/45 flex items-center justify-between border-b px-4 py-2.5">
                <h3 className="text-xs font-semibold tracking-[0.08em] uppercase">
                  {bucket.label}
                </h3>
                <span className={`text-muted-foreground text-xs ${NUMERALS}`}>
                  {bucketRows.length}
                </span>
              </header>
              <ol>
                {bucketRows.map((item) => {
                  const active = item.id === selected?.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => select(item.id)}
                        aria-pressed={active}
                        className={`relative flex w-full items-start gap-3 border-b px-4 py-4 text-left transition-colors ${active ? "bg-primary/[0.055]" : "hover:bg-muted/55"}`}
                      >
                        {active && (
                          <span className="bg-primary absolute inset-y-0 left-0 w-[3px]" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <strong
                              className={`text-primary text-xs font-semibold tracking-[0.04em] ${NUMERALS}`}
                            >
                              {label(item)}
                            </strong>
                            <Badge
                              variant="secondary"
                              className="ml-auto text-xs"
                            >
                              {STATUS_LABEL[
                                item.status as keyof typeof STATUS_LABEL
                              ] || item.status}
                            </Badge>
                          </span>
                          <strong className="mt-1.5 line-clamp-2 block text-sm leading-snug font-semibold">
                            {assignmentTitle(item as any)}
                          </strong>
                          <span
                            className={`text-muted-foreground mt-1 block text-xs ${NUMERALS}`}
                          >
                            {when(item.dueAt)}
                            {item.pointsPossible != null
                              ? ` · ${item.pointsPossible} points`
                              : ""}
                          </span>
                        </span>
                        <ChevronRightIcon
                          className={`mt-8 size-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
      <article
        ref={detailRef}
        className="min-w-0 scroll-mt-4 lg:overflow-y-auto"
      >
        {selected && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 sm:px-7">
              <div>
                <p className={`text-primary text-sm font-semibold ${NUMERALS}`}>
                  {label(selected)}
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {courseName(selected)}
                </p>
              </div>
              <OpenCanvas href={selected.url} />
            </header>
            <div className="mx-auto max-w-[70ch] px-5 py-7 sm:px-7">
              <Badge variant="secondary">
                {STATUS_LABEL[selected.status as keyof typeof STATUS_LABEL] ||
                  selected.status}
              </Badge>
              <h2 className="font-heading mt-4 text-2xl leading-tight font-semibold tracking-[-0.025em]">
                {assignmentTitle(selected as any)}
              </h2>
              <dl className="mt-6 grid overflow-hidden rounded-lg border sm:grid-cols-3">
                <div className="px-4 py-3 sm:border-r">
                  <dt className="text-muted-foreground text-xs font-semibold tracking-[0.06em] uppercase">
                    Due
                  </dt>
                  <dd className={`mt-1 text-sm font-semibold ${NUMERALS}`}>
                    {when(selected.dueAt)}
                  </dd>
                  <dd className="text-muted-foreground mt-0.5 text-xs">
                    {deadlineLabel(selected.dueAt)}
                  </dd>
                </div>
                <div className="border-t px-4 py-3 sm:border-t-0 sm:border-r">
                  <dt className="text-muted-foreground text-xs font-semibold tracking-[0.06em] uppercase">
                    Points
                  </dt>
                  <dd className={`mt-1 text-sm font-semibold ${NUMERALS}`}>
                    {selected.pointsPossible ?? "Not stated"}
                  </dd>
                </div>
                <div className="border-t px-4 py-3 sm:border-t-0">
                  <dt className="text-muted-foreground text-xs font-semibold tracking-[0.06em] uppercase">
                    Score
                  </dt>
                  <dd className={`mt-1 text-sm font-semibold ${NUMERALS}`}>
                    {selected.score != null ? selected.score : "Not graded"}
                  </dd>
                </div>
              </dl>
              <section className="mt-7">
                <h3 className="text-sm font-semibold">Assignment brief</h3>
                <p className="text-muted-foreground mt-3 whitespace-pre-wrap text-base leading-7">
                  {selected.description ||
                    "Canvas did not provide a written description for this assignment."}
                </p>
              </section>
            </div>
          </>
        )}
      </article>
    </div>
  );
}

function MaterialsDesk({ hub }: { hub: Hub }) {
  const scoped = courseRows(hub, "current");
  const [courseId, setCourseId] = useState(String(scoped[0]?.id || ""));
  const activeGroupId = scoped.some(
    (course) => String(course.id) === courseId,
  )
    ? courseId
    : String(scoped[0]?.id || "");
  const activeGroup = scoped.find(
    (course) => String(course.id) === activeGroupId,
  );
  const [editionId, setEditionId] = useState("");
  const activeEdition =
    activeGroup?.editions?.find(
      (edition: Course) => String(edition.id) === editionId,
    ) || activeGroup?.editions?.[0];
  const activeCourseId = String(activeEdition?.id || "");
  const [data, setData] = useState<Modules | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!activeCourseId) return;
    let live = true;
    setData(null);
    setError(null);
    json<Modules>(
      `/api/integrations/canvas/courses/${encodeURIComponent(activeCourseId)}/modules?canvasUrl=${encodeURIComponent(hub.origin || "")}`,
    )
      .then((value) => {
        if (live) {
          setData(value);
          setOpen(new Set(value.modules.slice(0, 1).map((x) => x.id)));
        }
      })
      .catch((cause: Error) => {
        if (live) setError(cause.message);
      });
    return () => {
      live = false;
    };
  }, [activeCourseId, hub.origin]);
  if (!scoped.length)
    return (
      <DeskEmpty
        title="No courses in scope"
        detail="Switch to all courses to browse concluded material."
      />
    );
  return (
    <div className="grid min-h-0 lg:grid-cols-[minmax(15rem,0.55fr)_minmax(0,1.45fr)] xl:flex-1">
      <aside
        className="border-b lg:overflow-y-auto lg:border-r lg:border-b-0"
        aria-label="Canvas courses"
      >
        <header className="bg-muted/45 border-b px-4 py-3 text-xs font-semibold tracking-[0.08em] uppercase">
          Course sources
        </header>
        {scoped.map((entry) => (
          <button
            key={entry.id}
            onClick={() => {
              setCourseId(String(entry.id));
              setEditionId("");
            }}
            aria-pressed={String(entry.id) === activeGroupId}
            className={`relative flex w-full items-center gap-3 border-b px-4 py-4 text-left transition-colors ${String(entry.id) === activeGroupId ? "bg-primary/[0.055]" : "hover:bg-muted/55"}`}
          >
            {String(entry.id) === activeGroupId && (
              <span className="bg-primary absolute inset-y-0 left-0 w-[3px]" />
            )}
            <SourceMark className="size-9" />
            <span className="min-w-0 flex-1">
              <strong
                className={`text-primary block text-xs font-semibold ${NUMERALS}`}
              >
                {label(entry)}
              </strong>
              <span className="mt-1 line-clamp-2 block text-sm font-semibold">
                {courseName(entry)}
              </span>
              <small className="text-muted-foreground mt-1 block text-xs">
                {entry.editionCount === 1
                  ? entry.editions[0]?.term?.name || "One Canvas edition"
                  : `${entry.editionCount} Canvas editions`}
              </small>
            </span>
            <ChevronRightIcon className="text-muted-foreground size-4" />
          </button>
        ))}
      </aside>
      <section className="min-w-0 lg:overflow-y-auto">
        {error ? (
          <div className="p-5 sm:p-7">
            <Alert>
              <AlertTitle>Course material could not be read</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : !data ? (
          <div className="space-y-4 p-5 sm:p-7">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 sm:px-7">
              <div>
                <h2 className="font-heading text-2xl font-semibold tracking-[-0.025em]">
                  {courseName(activeGroup || data.course || {})}
                </h2>
                <p className={`text-muted-foreground mt-1 text-sm ${NUMERALS}`}>
                  {data.modules.length} modules ·{" "}
                  {data.modules.reduce(
                    (n, module) => n + module.items.length,
                    0,
                  )}{" "}
                  items
                </p>
                {activeGroup?.editions?.length > 1 && (
                  <Select
                    value={activeCourseId}
                    onValueChange={(value) => value && setEditionId(value)}
                  >
                    <SelectTrigger
                      className="mt-3 w-[240px] bg-background"
                      aria-label="Canvas course edition"
                    >
                      <SelectValue>
                        {activeEdition?.term?.name || "Undated Canvas edition"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {activeGroup.editions.map((edition: Course) => (
                        <SelectItem key={edition.id} value={String(edition.id)}>
                          {edition.term?.name || `Canvas course ${edition.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <OpenCanvas
                href={
                  activeEdition?.courseUrl ||
                  `${hub.origin}/courses/${activeCourseId}`
                }
                label="Open course"
              />
            </header>
            <div className="mx-auto max-w-[76ch] px-5 py-6 sm:px-7">
              {data.syllabus?.substantive && (
                <section className="bg-paper text-paper-ink rounded-lg border p-5">
                  <h3 className="mb-3 text-sm font-semibold">
                    Course requirements
                  </h3>
                  <div
                    className="text-sm leading-6 [&_a]:underline [&_p]:mb-3"
                    dangerouslySetInnerHTML={{
                      __html: data.syllabus.html || "",
                    }}
                  />
                </section>
              )}
              <ol className="mt-6 overflow-hidden rounded-lg border">
                {data.modules.map((module) => (
                  <li key={module.id} className="border-b last:border-b-0">
                    <button
                      className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-semibold hover:bg-muted/45"
                      onClick={() =>
                        setOpen((current) => {
                          const next = new Set(current);
                          next.has(module.id)
                            ? next.delete(module.id)
                            : next.add(module.id);
                          return next;
                        })
                      }
                      aria-expanded={open.has(module.id)}
                    >
                      <span>{module.name}</span>
                      <span className={`text-muted-foreground ${NUMERALS}`}>
                        {module.items.length}
                      </span>
                    </button>
                    {open.has(module.id) && (
                      <ul className="bg-muted/20 border-t">
                        {module.items.map((item, index) => {
                          const href =
                            item.type === "File" && item.contentId
                              ? `/api/integrations/canvas/courses/${activeCourseId}/files/${item.contentId}/download?canvasUrl=${encodeURIComponent(hub.origin || "")}`
                              : item.url;
                          return (
                            <li
                              key={item.id || index}
                              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                            >
                              <FileIcon className="text-muted-foreground size-4 shrink-0" />
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {item.title}
                                <small className="text-muted-foreground">
                                  {" "}
                                  · {item.type}
                                </small>
                              </span>
                              {href && (
                                <a
                                  className="text-primary text-sm font-semibold"
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <span className="sr-only">
                                    Open {item.title}
                                  </span>
                                  <span aria-hidden="true">Open</span>
                                </a>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function CoursesDesk({ rows, hub }: { rows: any[]; hub: Hub }) {
  const [selectedId, setSelectedId] = useState(String(rows[0]?.id || ""));
  useEffect(() => {
    if (!rows.some((entry) => String(entry.id) === selectedId))
      setSelectedId(String(rows[0]?.id || ""));
  }, [rows, selectedId]);
  const selected =
    rows.find((entry) => String(entry.id) === selectedId) || null;
  if (!rows.length)
    return (
      <DeskEmpty
        title="No Canvas courses match"
        detail="Change the course scope to see other enrolments."
      />
    );
  return (
    <div className="grid min-h-0 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)] xl:flex-1">
      <ol className="min-h-0 border-b lg:overflow-y-auto lg:border-r lg:border-b-0">
        {rows.map((entry) => (
          <li key={entry.id}>
            <button
              onClick={() => setSelectedId(String(entry.id))}
              aria-pressed={String(entry.id) === selectedId}
              className={`relative flex w-full items-center gap-3 border-b px-4 py-4 text-left transition-colors ${String(entry.id) === selectedId ? "bg-primary/[0.055]" : "hover:bg-muted/55"}`}
            >
              {String(entry.id) === selectedId && (
                <span className="bg-primary absolute inset-y-0 left-0 w-[3px]" />
              )}
              <SourceMark className="size-9" />
              <span className="min-w-0 flex-1">
                <strong
                  className={`text-primary block text-xs font-semibold tracking-[0.04em] ${NUMERALS}`}
                >
                  {entry.courseCode || "Canvas"}
                </strong>
                <span className="mt-1 line-clamp-2 block text-sm font-semibold">
                  {entry.displayName || entry.name}
                </span>
                <small className="text-muted-foreground mt-1 block text-xs">
                  {entry.editionCount > 1
                    ? `${entry.editionCount} editions · ${entry.term?.name || "latest term unstated"}`
                    : entry.term?.name || "Term not stated"}
                </small>
              </span>
              <ChevronRightIcon className="text-muted-foreground size-4" />
            </button>
          </li>
        ))}
      </ol>
      <section className="min-w-0 lg:overflow-y-auto">
        {selected && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 sm:px-7">
              <div className="flex items-start gap-3">
                <SourceMark className="size-10" />
                <div>
                  <p
                    className={`text-primary text-sm font-semibold ${NUMERALS}`}
                  >
                    {selected.courseCode || "Canvas"}
                  </p>
                  <h2 className="font-heading mt-1 text-2xl font-semibold tracking-[-0.025em]">
                    {selected.displayName || selected.name}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {selected.editionCount > 1
                      ? `${selected.editionCount} Canvas editions · latest ${selected.term?.name || "term unstated"}`
                      : selected.term?.name || "Term not stated"}
                  </p>
                </div>
              </div>
              <OpenCanvas
                href={
                  selected.courseUrl ||
                  `${hub.origin}/courses/${selected.canvasId || selected.id}`
                }
                label="Open course"
              />
            </header>
            <div className="mx-auto max-w-[70ch] px-5 py-7 sm:px-7">
              <dl className="grid overflow-hidden rounded-lg border sm:grid-cols-3">
                <Fact
                  label="Announcements"
                  value={selected.announcementCount ?? "Unavailable"}
                  detail={
                    selected.announcementCount == null
                      ? "Canvas result is partial"
                      : "in this window"
                  }
                  icon={MegaphoneIcon}
                />
                <Fact
                  label="Open work"
                  value={selected.openCount ?? "Unavailable"}
                  detail={
                    selected.openCount == null
                      ? "Canvas result is partial"
                      : "Canvas assignments"
                  }
                  icon={Clock3Icon}
                  bordered
                />
                <Fact
                  label="Current grade"
                  value={
                    selected.grade === undefined
                      ? "Unavailable"
                      : selected.grade?.currentScore != null
                      ? `${selected.grade.currentScore}%`
                      : selected.grade?.currentGrade || "Not shown"
                  }
                  detail={
                    selected.grade === undefined
                      ? "Canvas did not return grades"
                      : "as reported by Canvas"
                  }
                  icon={BookOpenIcon}
                  bordered
                />
              </dl>
              <p className="text-muted-foreground mt-5 text-sm leading-6">
                This desk combines the updates and assignment state Canvas
                returned for this course. Open the course in Canvas for
                discussions, grading details and institution-specific tools.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Fact({ label, value, detail, icon: Icon, bordered = false }: any) {
  return (
    <div
      className={`p-4 ${bordered ? "border-t sm:border-t-0 sm:border-l" : ""}`}
    >
      <Icon className="text-muted-foreground size-4" />
      <dt className="text-muted-foreground mt-3 text-xs font-semibold tracking-[0.06em] uppercase">
        {label}
      </dt>
      <dd className={`mt-1 text-xl font-semibold ${NUMERALS}`}>{value}</dd>
      <dd className="text-muted-foreground mt-0.5 text-xs">{detail}</dd>
    </div>
  );
}

function DeskEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-72 items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{detail}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

export default function UpdatesPage() {
  const [prefs, setPrefs] = useState(() => readPreferences());
  const [tab, setTab] = useState("announcements");
  const [hub, setHub] = useState<Hub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [course, setCourse] = useState("all");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [canvasUrl, setCanvasUrl] = useState(
    "https://canvas.maastrichtuniversity.nl",
  );
  const [activeOrigin, setActiveOrigin] = useState("");
  const [token, setToken] = useState("");
  const [collectMaterial, setCollectMaterial] = useState(false);
  const [sharingMode, setSharingMode] = useState<"private" | "community">(
    "private",
  );
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [since] = useState(() => readSeenAt());
  const seenRecorded = useRef(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (
      ["announcements", "assignments", "materials", "courses"].includes(
        requested || "",
      )
    )
      setTab(requested as string);
  }, []);
  useEffect(() => {
    let live = true;
    setRefreshing(true);
    setError(null);
    json<{ connections: { origin: string }[] }>(
      "/api/account/integrations/canvas",
    )
      .then((account) => {
        const origin =
          account.connections[0]?.origin || connectionOrigin(canvasUrl) || "";
        if (live) {
          setActiveOrigin(origin);
          if (account.connections[0]?.origin) setCanvasUrl(origin);
        }
        return json<Hub>(
          hubPath({ scope: prefs.scope, days: prefs.days, origin }),
        );
      })
      .then((value) => {
        if (live) {
          setHub(value);
          if (canRecordAnnouncementVisit(value) && !seenRecorded.current) {
            markSeen(value.fetchedAt || new Date().toISOString());
            seenRecorded.current = true;
          }
        }
      })
      .catch((cause: Error) => {
        if (live) setError(cause.message);
      })
      .finally(() => {
        if (live) setRefreshing(false);
      });
    return () => {
      live = false;
    };
  }, [prefs.scope, prefs.days]);
  useEffect(() => {
    writePreferences(prefs);
  }, [prefs]);

  const announcements = useMemo(
    () =>
      filterAnnouncements(hub?.announcements || [], {
        courseId: course,
        query,
        unreadOnly,
        since,
        sort: prefs.announcementSort,
      }),
    [hub, course, query, unreadOnly, since, prefs.announcementSort],
  );
  const assignments = useMemo(
    () =>
      filterAssignments(hub?.assignments || [], {
        courseId: course,
        query,
        state: prefs.assignmentState,
        sort: prefs.assignmentSort,
      }),
    [hub, course, query, prefs.assignmentState, prefs.assignmentSort],
  );
  const courses = courseRows(hub, prefs.scope);
  const failedParts = new Set(
    (hub?.problems || []).map((problem) => problem.part),
  );
  const announcementsPartial =
    Boolean(hub?.truncated) || failedParts.has("announcements");
  const assignmentsPartial =
    Boolean(hub?.truncated) || failedParts.has("assignments");
  const selectedAnnouncement =
    announcements.find((item) => item.id === selectedAnnouncementId) ||
    announcements[0] ||
    null;
  const selectedAssignment =
    assignments.find((item) => item.id === selectedAssignmentId) ||
    assignments[0] ||
    null;

  async function refresh() {
    setRefreshing(true);
    try {
      const origin =
        hub?.origin || activeOrigin || connectionOrigin(canvasUrl) || "";
      const value = await json<Hub>(
        hubPath({
          scope: prefs.scope,
          days: prefs.days,
          origin,
          refresh: true,
        }),
      );
      setHub(value);
      if (canRecordAnnouncementVisit(value) && !seenRecorded.current) {
        markSeen(value.fetchedAt || new Date().toISOString());
        seenRecorded.current = true;
      }
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  async function connectCanvas(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const origin = connectionOrigin(canvasUrl);
    if (!origin) {
      setConnectionError(
        "Enter a secure Canvas address beginning with https://.",
      );
      return;
    }
    if (!token.trim()) {
      setConnectionError(
        "Paste the Personal Access Token you created in Canvas.",
      );
      return;
    }
    setConnecting(true);
    setConnectionError(null);
    try {
      await json("/api/account/integrations/canvas", {
        method: "PUT",
        body: JSON.stringify({ canvasUrl: origin, accessToken: token }),
      });
      if (collectMaterial)
        await json("/api/account/integrations/canvas/corpus", {
          method: "PUT",
          body: JSON.stringify({
            canvasUrl: origin,
            collectionEnabled: true,
            sharingMode,
          }),
        });
      setToken("");
      setActiveOrigin(origin);
      setCanvasUrl(origin);
      const value = await json<Hub>(
        hubPath({
          scope: prefs.scope,
          days: prefs.days,
          origin,
          refresh: true,
        }),
      );
      setHub(value);
      if (canRecordAnnouncementVisit(value) && !seenRecorded.current) {
        markSeen(value.fetchedAt || new Date().toISOString());
        seenRecorded.current = true;
      }
    } catch (cause) {
      setConnectionError((cause as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  const canvasSettingsHref = `${connectionOrigin(canvasUrl) || "https://canvas.maastrichtuniversity.nl"}/profile/settings`;

  if (!hub && !error)
    return (
      <div className="mx-auto w-full max-w-[1280px] p-5 sm:p-8">
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="mt-6 h-[34rem] w-full rounded-xl" />
      </div>
    );

  return (
    <div
      data-impeccable-contract={DESIGN_CONTRACT}
      className="flex min-h-0 w-full flex-col xl:h-dvh xl:overflow-hidden"
    >
      <header className="shrink-0 border-b bg-background">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-8 lg:py-7">
          <div>
            <h1 className="font-heading text-[32px] leading-[1.05] font-semibold tracking-[-0.035em]">
              Updates
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {hub?.origin
                ? new URL(hub.origin).host
                : "Announcements, assignments and course material"}
              {hub?.fetchedAt ? ` · refreshed ${when(hub.fetchedAt)}` : ""}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={refreshing || hub?.connected === false}
          >
            <RefreshCwIcon
              className={refreshing ? "animate-spin" : ""}
              data-icon="inline-start"
            />
            {refreshing ? "Refreshing…" : "Refresh Canvas"}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1280px] min-h-0 flex-1 flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 xl:overflow-hidden">
        {error && (
          <Alert>
            <AlertTitle>Canvas updates could not be loaded</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {hub?.problems?.length ? (
          <Alert>
            <AlertTitle>Some Canvas sources did not answer</AlertTitle>
            <AlertDescription>
              {hub.problems
                .map((item) => `${item.part}: ${item.error}`)
                .join(" · ")}
            </AlertDescription>
          </Alert>
        ) : null}

        {hub && !hub.connected ? (
          <section className="grid overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-h-[35rem] items-center p-6 sm:p-10 lg:p-12">
              <div className="w-full max-w-xl">
                <SourceMark className="size-12" />
                <h2 className="font-heading mt-7 text-[32px] leading-tight font-semibold tracking-[-0.03em]">
                  Bring your course changes into one calm desk.
                </h2>
                <p className="text-muted-foreground mt-4 max-w-[56ch] text-base leading-7">
                  Connect Canvas to review announcements, assignment deadlines,
                  submission states and published course material without losing
                  your place.
                </p>
                <form
                  onSubmit={connectCanvas}
                  className="mt-7 grid gap-4 sm:grid-cols-2"
                >
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-sm font-semibold">
                      Canvas address
                    </span>
                    <Input
                      type="url"
                      value={canvasUrl}
                      onChange={(event) => setCanvasUrl(event.target.value)}
                      disabled={connecting}
                      autoComplete="url"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-sm font-semibold">
                      Personal Access Token
                    </span>
                    <Input
                      type="password"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      disabled={connecting}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Paste your Canvas token"
                      required
                    />
                  </label>
                  <label className="bg-muted/35 flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 sm:col-span-2">
                    <Checkbox
                      checked={collectMaterial}
                      onCheckedChange={(value) =>
                        setCollectMaterial(Boolean(value))
                      }
                      disabled={connecting}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="block text-sm font-semibold">
                        Also index my course material
                      </strong>
                      <span className="text-muted-foreground mt-1 block text-xs leading-5">
                        Optional. This separate permission lets Wicker detect
                        requirements and priorities from syllabi, slides and
                        modules. You can change it later in Account.
                      </span>
                    </span>
                  </label>
                  {collectMaterial && (
                    <fieldset className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                      <legend className="sr-only">
                        Who may use indexed course material
                      </legend>
                      {(
                        [
                          [
                            "private",
                            "Keep it private",
                            "Only your Wicker workspace can retrieve it.",
                          ],
                          [
                            "community",
                            "Share with students",
                            "Eligible students may reuse it after a rights review.",
                          ],
                        ] as const
                      ).map(([value, title, detail]) => (
                        <label
                          key={value}
                          className={`cursor-pointer rounded-lg border p-3.5 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring ${sharingMode === value ? "border-primary bg-primary/5" : "hover:border-input hover:bg-muted/25"}`}
                        >
                          <span className="flex items-center gap-2.5">
                            <input
                              type="radio"
                              name="material-sharing"
                              value={value}
                              checked={sharingMode === value}
                              onChange={() => setSharingMode(value)}
                              disabled={connecting}
                              className="accent-primary"
                            />
                            <strong className="text-sm font-semibold">
                              {title}
                            </strong>
                          </span>
                          <span className="text-muted-foreground mt-1.5 block pl-6 text-xs leading-5">
                            {detail}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 sm:col-span-2">
                    <p className="text-muted-foreground max-w-[34ch] text-xs leading-5">
                      The token is encrypted immediately and never shown again.
                      Never paste your password or one-time code.
                    </p>
                    <Button type="submit" disabled={connecting}>
                      {connecting ? "Connecting…" : "Connect Canvas"}
                      {!connecting && (
                        <ChevronRightIcon data-icon="inline-end" />
                      )}
                    </Button>
                  </div>
                  {connectionError && (
                    <p
                      role="alert"
                      className="text-destructive text-sm font-medium sm:col-span-2"
                    >
                      {connectionError}
                    </p>
                  )}
                </form>
              </div>
            </div>
            <aside className="flex flex-col bg-[#20263b] text-white">
              <div className="flex-1 p-7 sm:p-9">
                <h3 className="text-lg font-semibold">
                  Included after connection
                </h3>
                <ol className="mt-7 space-y-6">
                {[
                  [
                    MegaphoneIcon,
                    "Announcements",
                    "Course messages in a focused reading pane.",
                  ],
                  [
                    CalendarClockIcon,
                    "Assignments",
                    "Due dates and the submission state Canvas reports.",
                  ],
                  [
                    Layers3Icon,
                    "Course material",
                    "Modules, files and published syllabus content.",
                  ],
                ].map(([Icon, title, detail]: any) => (
                  <li key={title} className="flex gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/8">
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <strong className="block text-sm font-semibold">
                        {title}
                      </strong>
                      <span className="mt-1 block text-sm leading-6 text-white/62">
                        {detail}
                      </span>
                    </span>
                  </li>
                ))}
                </ol>
              </div>
              <p className="border-t border-white/12 px-7 py-5 text-xs leading-5 text-white/55 sm:px-9">
                Need a token? Create one in{" "}
                <a
                  className="font-semibold text-white underline underline-offset-2"
                  href={canvasSettingsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Canvas settings
                </a>
                . After connecting, manage or disconnect it from Account.
              </p>
            </aside>
          </section>
        ) : hub ? (
          <>
            <Briefing hub={hub} since={since} />
            <Tabs
              value={tab}
              onValueChange={(value) => {
                setTab(value);
                history.replaceState(null, "", `/app/updates?tab=${value}`);
              }}
              className="min-h-0 gap-0 xl:flex xl:flex-1 xl:flex-col"
            >
              <TabsList
                variant="line"
                className="w-full shrink-0 justify-start overflow-x-auto border-b"
              >
                <TabsTrigger value="announcements">
                  Announcements{" "}
                  <span className={NUMERALS}>
                    {failedParts.has("announcements")
                      ? "Partial"
                      : hub.truncated
                        ? `${hub.announcements.length}+`
                        : hub.announcements.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="assignments">
                  Assignments{" "}
                  <span className={NUMERALS}>
                    {failedParts.has("assignments")
                      ? "Partial"
                      : hub.truncated
                        ? `${hub.assignments.length}+`
                        : hub.assignments.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="materials">Materials</TabsTrigger>
                <TabsTrigger value="courses">
                  Courses <span className={NUMERALS}>{courses.length}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="announcements"
                className="mt-4 min-h-0 xl:flex xl:flex-1 xl:flex-col"
              >
                <DispatchShell>
                  <Toolbar
                    courses={hub.courses}
                    course={course}
                    setCourse={setCourse}
                    query={query}
                    setQuery={setQuery}
                    sort={prefs.announcementSort}
                    setSort={(announcementSort: string) =>
                      setPrefs({ ...prefs, announcementSort })
                    }
                    sorts={ANNOUNCEMENT_SORTS}
                  >
                    <Select
                      value={prefs.days}
                      onValueChange={(days) => {
                        if (days) setPrefs({ ...prefs, days });
                      }}
                    >
                      <SelectTrigger
                        className="w-[142px] bg-background"
                        aria-label="Date window"
                      >
                        <SelectValue>
                          {UPDATE_WINDOWS.find(
                            ([id]) => id === prefs.days,
                          )?.[1] || "Date window"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {UPDATE_WINDOWS.map(([id, text]) => (
                          <SelectItem key={id} value={id}>
                            {text}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                      <Checkbox
                        checked={unreadOnly}
                        onCheckedChange={(value) =>
                          setUnreadOnly(Boolean(value))
                        }
                      />
                      New only
                    </label>
                  </Toolbar>
                  <AnnouncementDesk
                    rows={announcements}
                    selected={selectedAnnouncement}
                    onSelect={setSelectedAnnouncementId}
                    since={since}
                    partial={announcementsPartial}
                  />
                </DispatchShell>
              </TabsContent>

              <TabsContent
                value="assignments"
                className="mt-4 min-h-0 xl:flex xl:flex-1 xl:flex-col"
              >
                <DispatchShell>
                  <Toolbar
                    courses={hub.courses}
                    course={course}
                    setCourse={setCourse}
                    query={query}
                    setQuery={setQuery}
                    sort={prefs.assignmentSort}
                    setSort={(assignmentSort: string) =>
                      setPrefs({ ...prefs, assignmentSort })
                    }
                    sorts={ASSIGNMENT_SORTS}
                  >
                    <ToggleGroup
                      value={[prefs.assignmentState]}
                      onValueChange={(values) => {
                        const assignmentState = values.at(-1);
                        if (assignmentState)
                          setPrefs({ ...prefs, assignmentState });
                      }}
                    >
                      {STATES.map((state) => (
                        <ToggleGroupItem key={state.id} value={state.id}>
                          {state.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Toolbar>
                  <AssignmentDesk
                    rows={assignments}
                    selected={selectedAssignment}
                    onSelect={setSelectedAssignmentId}
                    partial={assignmentsPartial}
                  />
                </DispatchShell>
              </TabsContent>

              <TabsContent
                value="materials"
                className="mt-4 min-h-0 xl:flex xl:flex-1 xl:flex-col"
              >
                <DispatchShell>
                  <MaterialsDesk hub={hub} />
                </DispatchShell>
              </TabsContent>

              <TabsContent
                value="courses"
                className="mt-4 min-h-0 xl:flex xl:flex-1 xl:flex-col"
              >
                <DispatchShell>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
                    <ToggleGroup
                      value={[prefs.scope]}
                      onValueChange={(values) => {
                        const scope = values.at(-1);
                        if (scope === "current" || scope === "all")
                          setPrefs({ ...prefs, scope });
                      }}
                    >
                      <ToggleGroupItem value="current">
                        This period
                      </ToggleGroupItem>
                      <ToggleGroupItem value="all">All courses</ToggleGroupItem>
                    </ToggleGroup>
                    <span
                      className={`text-muted-foreground text-sm ${NUMERALS}`}
                    >
                      {courses.length} courses
                    </span>
                  </div>
                  <CoursesDesk rows={courses} hub={hub} />
                </DispatchShell>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </main>
    </div>
  );
}
