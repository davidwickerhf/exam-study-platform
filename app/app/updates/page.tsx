"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLinkIcon,
  FileIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
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
  courseRows,
  filterAnnouncements,
  filterAssignments,
  isNewAnnouncement,
  parsePreferences,
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
type Hub = {
  connected: boolean;
  origin?: string;
  fetchedAt?: string;
  truncated?: boolean;
  selectedCourseIds?: string[];
  courses: Course[];
  announcements: Announcement[];
  assignments: Assignment[];
  grades?: any[];
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
const NUM = "font-data tabular-nums";
const label = (item: any) =>
  item.courseCode ||
  item.courseName ||
  item.displayName ||
  item.name ||
  "Canvas";
const when = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(value))
    : "Undated";
async function json<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { accept: "application/json" },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.error || `${path} returned ${response.status}`);
  return body;
}

function Filters({
  courses,
  course,
  setCourse,
  query,
  setQuery,
  sort,
  setSort,
  sorts,
}: any) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b pb-4">
      <Select
        value={course}
        onValueChange={(value) => setCourse(value ?? "all")}
      >
        <SelectTrigger className="w-[190px]" aria-label="Course">
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
      <div className="relative min-w-[220px] flex-1">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
          placeholder="Search Canvas"
        />
      </div>
      <Select value={sort} onValueChange={setSort}>
        <SelectTrigger className="w-[170px]" aria-label="Sort">
          <SelectValue />
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

function Materials({ hub }: { hub: Hub }) {
  const scoped = hub.courses.filter((course) =>
    hub.selectedCourseIds?.includes(String(course.id)),
  );
  const [courseId, setCourseId] = useState(String(scoped[0]?.id || "")),
    [data, setData] = useState<Modules | null>(null),
    [error, setError] = useState<string | null>(null),
    [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!courseId) return;
    let live = true;
    setData(null);
    json<Modules>(
      `/api/integrations/canvas/courses/${encodeURIComponent(courseId)}/modules?canvasUrl=${encodeURIComponent(hub.origin || "")}`,
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
  }, [courseId, hub.origin]);
  if (!scoped.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No courses in scope</EmptyTitle>
          <EmptyDescription>
            Switch to all courses to browse concluded material.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-1">
        {scoped.map((course) => (
          <Button
            key={course.id}
            variant={String(course.id) === courseId ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setCourseId(String(course.id))}
          >
            {label(course)}
          </Button>
        ))}
      </aside>
      <div className="flex min-w-0 flex-col gap-4">
        {error ? (
          <Alert>
            <AlertTitle>Course material could not be read</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <header className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {data.course?.name ||
                    label(scoped.find((x) => String(x.id) === courseId) || {})}
                </h2>
                <p className={`text-muted-foreground text-sm ${NUM}`}>
                  {data.modules.length} modules ·{" "}
                  {data.modules.reduce((n, m) => n + m.items.length, 0)} items
                </p>
              </div>
              <a
                className="text-primary text-sm font-semibold"
                href={`${hub.origin}/courses/${courseId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Canvas
              </a>
            </header>
            {data.syllabus?.substantive && (
              <section className="bg-paper text-paper-ink rounded-sm p-5">
                <h3 className="mb-2 font-semibold">Course requirements</h3>
                <div
                  className="text-sm [&_a]:underline [&_p]:mb-2"
                  dangerouslySetInnerHTML={{ __html: data.syllabus.html || "" }}
                />
              </section>
            )}
            <ol>
              {data.modules.map((module) => (
                <li key={module.id} className="border-b">
                  <button
                    className="flex w-full justify-between py-3 text-left font-semibold"
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
                    <span className={NUM}>{module.items.length}</span>
                  </button>
                  {open.has(module.id) && (
                    <ul>
                      {module.items.map((item, index) => (
                        <li
                          key={item.id || index}
                          className="flex items-center gap-3 border-t py-2 pl-3"
                        >
                          <FileIcon className="text-muted-foreground size-4" />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {item.title}{" "}
                            <small className="text-muted-foreground">
                              · {item.type}
                            </small>
                          </span>
                          {item.type === "File" && item.contentId ? (
                            <a
                              className="text-primary text-sm font-semibold"
                              href={`/api/integrations/canvas/courses/${courseId}/files/${item.contentId}/download?canvasUrl=${encodeURIComponent(hub.origin || "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open
                            </a>
                          ) : (
                            item.url && (
                              <a
                                className="text-primary text-sm font-semibold"
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Open
                              </a>
                            )
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

export default function UpdatesPage() {
  const [prefs, setPrefs] = useState(() =>
      parsePreferences(
        typeof window === "undefined"
          ? null
          : localStorage.getItem("updates-prefs"),
      ),
    ),
    [tab, setTab] = useState("announcements"),
    [hub, setHub] = useState<Hub | null>(null),
    [error, setError] = useState<string | null>(null),
    [refreshing, setRefreshing] = useState(false);
  const [course, setCourse] = useState("all"),
    [query, setQuery] = useState(""),
    [unreadOnly, setUnreadOnly] = useState(false),
    [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [since] = useState(() =>
      typeof window === "undefined"
        ? ""
        : localStorage.getItem("updates-seen-at") || "",
    );
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
    json<Hub>(
      `/api/integrations/canvas/hub?scope=${prefs.scope}&days=${prefs.days}`,
    )
      .then((value) => {
        if (live) setHub(value);
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
    localStorage.setItem("updates-prefs", JSON.stringify(prefs));
  }, [prefs]);
  useEffect(() => {
    localStorage.setItem("updates-seen-at", new Date().toISOString());
  }, []);
  async function refresh() {
    setRefreshing(true);
    try {
      setHub(
        await json<Hub>(
          `/api/integrations/canvas/hub?scope=${prefs.scope}&days=${prefs.days}&refresh=1`,
        ),
      );
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
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
  if (!hub && !error)
    return (
      <div className="mx-auto w-full max-w-[1180px] p-5 sm:p-8">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-6 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="font-heading text-5xl leading-none tracking-tight">
            Updates
          </h1>
          <p className="text-muted-foreground text-sm">
            {hub?.origin ? new URL(hub.origin).host : "Canvas"}
            {hub?.fetchedAt ? ` · refreshed ${when(hub.fetchedAt)}` : ""}
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing}>
          <RefreshCwIcon data-icon="inline-start" />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </header>
      {error && (
        <Alert>
          <AlertTitle>Canvas updates could not be loaded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {hub?.problems?.length ? (
        <Alert>
          <AlertTitle>Some of Canvas did not answer</AlertTitle>
          <AlertDescription>
            {hub.problems.map((x) => `${x.part}: ${x.error}`).join(" · ")}
          </AlertDescription>
        </Alert>
      ) : null}
      {hub && !hub.connected ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Canvas is not connected</EmptyTitle>
            <EmptyDescription>
              Add a Personal Access Token under Account → Connections.
            </EmptyDescription>
          </EmptyHeader>
          <a
            href="/app/account?tab=connections"
            className="text-primary font-semibold"
          >
            Connect Canvas
          </a>
        </Empty>
      ) : (
        hub && (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value);
              history.replaceState(null, "", `/app/updates?tab=${value}`);
            }}
            className="gap-6"
          >
            <TabsList variant="line">
              <TabsTrigger value="announcements">
                Announcements{" "}
                <span className={NUM}>{hub.announcements.length}</span>
              </TabsTrigger>
              <TabsTrigger value="assignments">
                Assignments{" "}
                <span className={NUM}>{hub.assignments.length}</span>
              </TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="courses">
                Courses <span className={NUM}>{courses.length}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="announcements" className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <ToggleGroup
                  value={[prefs.scope]}
                  onValueChange={(values) => {
                    const scope = values.at(-1);
                    if (scope === "current" || scope === "all")
                      setPrefs({ ...prefs, scope });
                  }}
                >
                  <ToggleGroupItem value="current">This period</ToggleGroupItem>
                  <ToggleGroupItem value="all">All</ToggleGroupItem>
                </ToggleGroup>
                <Select
                  value={prefs.days}
                  onValueChange={(days) => {
                    if (days) setPrefs({ ...prefs, days });
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UPDATE_WINDOWS.map(([id, text]) => (
                      <SelectItem key={id} value={id}>
                        {text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={unreadOnly}
                    onCheckedChange={(value) => setUnreadOnly(Boolean(value))}
                  />
                  Unread only
                </label>
              </div>
              <Filters
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
              />
              {!announcements.length ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No announcements match</EmptyTitle>
                    <EmptyDescription>
                      Widen the window or current filters.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ol>
                  {announcements.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 border-b py-4"
                    >
                      <div className="flex items-center gap-2">
                        <strong className={NUM}>{label(item)}</strong>
                        {isNewAnnouncement(item, since) && <Badge>New</Badge>}
                        <time
                          className={`text-muted-foreground ml-auto text-sm ${NUM}`}
                        >
                          {when(item.postedAt)}
                        </time>
                      </div>
                      <h2 className="text-lg font-semibold">{item.title}</h2>
                      {item.author && (
                        <p className="text-muted-foreground text-sm">
                          {item.author}
                        </p>
                      )}
                      {expanded.has(item.id) ? (
                        <div
                          className="max-w-[74ch] text-sm [&_a]:text-primary [&_a]:underline [&_p]:mb-2"
                          dangerouslySetInnerHTML={{ __html: item.html || "" }}
                        />
                      ) : (
                        <p className="text-muted-foreground max-w-[74ch] text-sm">
                          {item.excerpt || "This announcement has no text."}
                        </p>
                      )}
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpanded((current) => {
                              const next = new Set(current);
                              next.has(item.id)
                                ? next.delete(item.id)
                                : next.add(item.id);
                              return next;
                            })
                          }
                        >
                          {expanded.has(item.id) ? "Show less" : "Read in full"}
                        </Button>
                        {item.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            render={
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                          >
                            <ExternalLinkIcon data-icon="inline-start" />
                            Canvas
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
            <TabsContent value="assignments" className="flex flex-col gap-4">
              <ToggleGroup
                value={[prefs.assignmentState]}
                onValueChange={(values) => {
                  const assignmentState = values.at(-1);
                  if (assignmentState) setPrefs({ ...prefs, assignmentState });
                }}
              >
                {STATES.map((state) => (
                  <ToggleGroupItem key={state.id} value={state.id}>
                    {state.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Filters
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
              />
              {BUCKETS.map((bucket) => {
                const rows = assignments.filter(
                  (item) => bucketOf(item as any) === bucket.id,
                );
                return rows.length ? (
                  <section key={bucket.id}>
                    <div className="flex justify-between border-b pb-2">
                      <h2 className="font-semibold">{bucket.label}</h2>
                      <span className={NUM}>{rows.length}</span>
                    </div>
                    <ol>
                      {rows.map((item) => (
                        <li
                          key={item.id}
                          className="grid grid-cols-[7rem_minmax(0,1fr)_auto] gap-4 border-b py-3"
                        >
                          <strong className={NUM}>{label(item)}</strong>
                          <span>
                            <strong>{assignmentTitle(item as any)}</strong>
                            <small
                              className={`text-muted-foreground block ${NUM}`}
                            >
                              {when(item.dueAt)}
                              {item.pointsPossible != null
                                ? ` · ${item.pointsPossible} points`
                                : ""}
                            </small>
                          </span>
                          <span>
                            <Badge variant="secondary">
                              {STATUS_LABEL[
                                item.status as keyof typeof STATUS_LABEL
                              ] || item.status}
                            </Badge>
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLinkIcon className="ml-2 inline size-4" />
                              </a>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null;
              })}
            </TabsContent>
            <TabsContent value="materials">
              <Materials hub={hub} />
            </TabsContent>
            <TabsContent value="courses">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                      <th className="py-2">Course</th>
                      <th>Term</th>
                      <th className="text-right">News</th>
                      <th className="text-right">Open</th>
                      <th className="text-right">Grade</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((entry: any) => (
                      <tr key={entry.id} className="border-b">
                        <td className="py-3">
                          <strong className={NUM}>
                            {entry.courseCode || "Canvas"}
                          </strong>
                          <small className="text-muted-foreground block">
                            {entry.displayName || entry.name}
                          </small>
                        </td>
                        <td>{entry.term?.name || "—"}</td>
                        <td className={`text-right ${NUM}`}>
                          {entry.announcementCount}
                        </td>
                        <td className={`text-right ${NUM}`}>
                          {entry.openCount}
                        </td>
                        <td className={`text-right ${NUM}`}>
                          {entry.grade?.currentScore != null
                            ? `${entry.grade.currentScore}%`
                            : entry.grade?.currentGrade || "—"}
                        </td>
                        <td>
                          <a
                            className="text-primary"
                            href={entry.courseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Canvas
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        )
      )}
    </div>
  );
}
