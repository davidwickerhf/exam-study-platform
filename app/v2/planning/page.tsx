"use client";

/**
 * Planning, migrated.
 *
 * All six tabs are here. Documents preserves the consent boundary around
 * proposed record changes; Planner saves only scenario assumptions; Settings
 * keeps programme records separate while switching, importing, or deleting.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanningDocuments } from "@/components/v2/planning-documents";
import { PlanningPlanner } from "@/components/v2/planning-planner";
import { PlanningSettings } from "@/components/v2/planning-settings";
import {
  type Course,
  type Workspace,
  STATUS_LABEL,
  byYear,
  attemptRecord,
  courseRecord,
  courseStatus,
  earnedEcts,
  eventRecord,
  gateRecord,
  planningTab,
  plannedEcts,
  weightedGpa,
} from "@/lib/v2/academics.mjs";

const NUMERALS = "font-data tabular-nums";

function Figure({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <span className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">
        {label}
      </span>
      <strong className={`text-2xl font-semibold tracking-tight ${NUMERALS}`}>
        {value}
        {unit && (
          <small className="text-muted-foreground ml-1 text-sm font-medium">
            {unit}
          </small>
        )}
      </strong>
    </span>
  );
}

function Ledger({ courses }: { courses: Course[] }) {
  const years = useMemo(() => byYear(courses), [courses]);
  if (!courses.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No courses yet</EmptyTitle>
          <EmptyDescription>
            Set a programme and this fills with its curriculum.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {years.map((year) => (
        <section key={year.level} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between border-b pb-2">
            <h3 className="text-sm font-semibold">{year.level}</h3>
            <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
              {year.courses.length} courses · {year.ects} ECTS
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">
                <th className="w-[6rem] py-2 pr-4 text-left font-semibold">
                  Code
                </th>
                <th className="py-2 pr-6 text-left font-semibold">Course</th>
                <th className="w-[7rem] py-2 pr-4 text-left font-semibold">
                  Period
                </th>
                <th className="w-[4rem] py-2 pr-6 text-right font-semibold">
                  ECTS
                </th>
                <th className="w-[7rem] py-2 text-left font-semibold">
                  Requirement
                </th>
                <th className="w-[8rem] py-2 text-left font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {year.courses.map((course) => {
                const status = courseStatus(course);
                return (
                  <tr key={course.id} className="hover:bg-card border-b">
                    <td
                      className={`py-2 pr-4 text-sm font-semibold ${NUMERALS}`}
                    >
                      {course.code}
                    </td>
                    <td className="py-2 pr-6 text-[15px] font-medium">
                      <Link
                        className="hover:text-primary underline-offset-4 hover:underline"
                        href={`/v2/course-request/${encodeURIComponent(course.id)}`}
                      >
                        {course.name}
                      </Link>
                    </td>
                    <td
                      className={`text-muted-foreground py-2 pr-4 text-sm ${NUMERALS}`}
                    >
                      {course.period}
                    </td>
                    <td className={`py-2 pr-6 text-right text-sm ${NUMERALS}`}>
                      {course.ects}
                    </td>
                    <td className="text-muted-foreground py-2 text-sm capitalize">
                      {course.programmeRequirement}
                    </td>
                    <td className="py-2">
                      {/* State is a mark, not a fill: only a fail is emphasised. */}
                      {status === "not-recorded" ? (
                        <span className="text-muted-foreground text-sm">
                          {STATUS_LABEL[status]}
                        </span>
                      ) : (
                        <Badge
                          variant={
                            status === "failed" ? "default" : "secondary"
                          }
                        >
                          {STATUS_LABEL[status]}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function ProfileEditor({
  workspace,
  save,
  busy,
}: {
  workspace: Workspace;
  save: (next: Workspace) => void;
  busy: boolean;
}) {
  return (
    <form
      className="bg-card grid gap-3 rounded-sm border p-4 sm:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        save({
          ...workspace,
          profile: {
            ...workspace.profile,
            university: String(data.get("university") ?? ""),
            programme: String(data.get("programme") ?? ""),
            academicYear: String(data.get("academicYear") ?? ""),
          },
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="plan-university">University</Label>
        <Input
          id="plan-university"
          name="university"
          defaultValue={workspace.profile.university}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="plan-programme">Programme</Label>
        <Input
          id="plan-programme"
          name="programme"
          defaultValue={workspace.profile.programme}
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="plan-year">Academic year</Label>
        <Input
          id="plan-year"
          name="academicYear"
          defaultValue={workspace.profile.academicYear}
        />
        <Button className="mt-2" type="submit" disabled={busy}>
          Save details
        </Button>
      </div>
    </form>
  );
}

function CourseEditors({
  workspace,
  save,
  busy,
  focus,
}: {
  workspace: Workspace;
  save: (next: Workspace) => void;
  busy: boolean;
  focus?: string | null;
}) {
  const [selected, setSelected] = useState(workspace.courses.some((course) => course.id === focus) ? focus! : workspace.courses[0]?.id ?? "");
  const course = workspace.courses.find((item) => item.id === selected);
  const create = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const record = courseRecord(data, `course-${Date.now()}`);
    if (!record.name) return;
    save({ ...workspace, courses: [...workspace.courses, record] });
  };
  const update = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!course) return;
    const record = courseRecord(
      {
        ...course,
        ...Object.fromEntries(new FormData(event.currentTarget)),
        attempts: course.attempts,
      },
      course.id,
    );
    save({
      ...workspace,
      courses: workspace.courses.map((item) =>
        item.id === course.id ? record : item,
      ),
    });
  };
  const addAttempt = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!course) return;
    const attempt = attemptRecord(
      Object.fromEntries(new FormData(event.currentTarget)),
      `attempt-${Date.now()}`,
    );
    save({
      ...workspace,
      courses: workspace.courses.map((item) =>
        item.id === course.id
          ? { ...item, attempts: [...item.attempts, attempt] }
          : item,
      ),
    });
  };
  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={create}
        className="bg-card grid gap-3 rounded-sm border p-4 sm:grid-cols-4"
      >
        <Input name="code" placeholder="Code" maxLength={40} />
        <Input name="name" placeholder="New course" required maxLength={200} />
        <Input
          name="ects"
          type="number"
          step="0.5"
          min="0"
          placeholder="ECTS"
        />
        <Button type="submit" variant="outline" disabled={busy}>
          <PlusIcon data-icon="inline-start" />
          Add course
        </Button>
      </form>
      {workspace.courses.length > 0 && (
        <>
          <Select
            value={selected}
            onValueChange={(value) => setSelected(value ?? "")}
          >
            <SelectTrigger className="max-w-md">
              <SelectValue>
                {(value) =>
                  workspace.courses.find((item) => item.id === value)?.name ??
                  "Edit course"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {workspace.courses.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {course && (
            <div className="grid gap-6 lg:grid-cols-2">
              <form
                onSubmit={update}
                className="flex flex-col gap-3 border p-4"
              >
                <h3 className="font-semibold">Course record</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    name="code"
                    defaultValue={course.code}
                    placeholder="Code"
                  />
                  <Input
                    name="name"
                    defaultValue={course.name}
                    placeholder="Name"
                    required
                  />
                  <Input
                    name="ects"
                    type="number"
                    step="0.5"
                    defaultValue={course.ects}
                  />
                  <Input
                    name="passMark"
                    type="number"
                    step="0.1"
                    defaultValue={course.passMark ?? 5.5}
                  />
                  <Input
                    name="yearLevel"
                    defaultValue={course.yearLevel ?? ""}
                    placeholder="Year 1"
                  />
                  <Input
                    name="period"
                    defaultValue={course.period ?? ""}
                    placeholder="Period 1"
                  />
                </div>
                <Input
                  name="programmeRequirement"
                  defaultValue={course.programmeRequirement}
                  placeholder="required"
                />
                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm("Delete this course and its attempts?")
                      )
                        save({
                          ...workspace,
                          courses: workspace.courses.filter(
                            (item) => item.id !== course.id,
                          ),
                        });
                    }}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Delete
                  </Button>
                  <Button type="submit" disabled={busy}>
                    Save course
                  </Button>
                </div>
              </form>
              <div className="flex flex-col gap-3 border p-4">
                <h3 className="font-semibold">Attempts</h3>
                <ul className="flex flex-col">
                  {course.attempts.map((attempt, index) => (
                    <li
                      key={attempt.id ?? index}
                      className="flex items-center justify-between border-b py-2 text-sm"
                    >
                      <span className={NUMERALS}>
                        {attempt.examDate ?? "No date"} ·{" "}
                        {attempt.type ?? "attempt"} · {attempt.grade ?? "—"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          save({
                            ...workspace,
                            courses: workspace.courses.map((item) =>
                              item.id === course.id
                                ? {
                                    ...item,
                                    attempts: item.attempts.filter(
                                      (_, attemptIndex) =>
                                        attemptIndex !== index,
                                    ),
                                  }
                                : item,
                            ),
                          })
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </li>
                  ))}
                </ul>
                <form onSubmit={addAttempt} className="grid grid-cols-2 gap-2">
                  <Input name="examDate" type="date" />
                  <Input
                    name="grade"
                    type="number"
                    step="0.1"
                    placeholder="Grade"
                  />
                  <Input name="academicYear" placeholder="2026–2027" />
                  <select
                    name="status"
                    className="border bg-transparent px-2 text-sm"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                    <option value="no-show">No-show</option>
                  </select>
                  <Button
                    type="submit"
                    variant="outline"
                    className="col-span-2"
                    disabled={busy}
                  >
                    Add attempt
                  </Button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Requirements({
  workspace,
  save,
  busy,
}: {
  workspace: Workspace;
  save: (next: Workspace) => void;
  busy: boolean;
}) {
  const gates = workspace.gates ?? [];
  return (
    <section className="flex flex-col gap-3">
      <div className="border-b pb-2">
        <h2 className="text-sm font-semibold">
          Credit and progression requirements
        </h2>
      </div>
      <ul>
        {gates.map((gate) => (
          <li
            id={`planning-${gate.id}`}
            key={gate.id}
            className="flex items-center justify-between border-b py-3"
          >
            <span>
              <strong className="text-sm">{gate.label}</strong>
              <small className={`text-muted-foreground ml-3 ${NUMERALS}`}>
                {gate.target} ECTS
              </small>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                save({
                  ...workspace,
                  gates: gates.filter((item) => item.id !== gate.id),
                })
              }
            >
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="bg-card grid gap-3 rounded-sm border p-4 sm:grid-cols-[1fr_8rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const record = gateRecord(
            Object.fromEntries(new FormData(event.currentTarget)),
            `gate-${Date.now()}`,
          );
          if (record.label) save({ ...workspace, gates: [...gates, record] });
        }}
      >
        <Input
          name="label"
          placeholder="Requirement, e.g. Propedeuse"
          required
        />
        <Input name="target" type="number" min="0" placeholder="ECTS" />
        <Button type="submit" variant="outline" disabled={busy}>
          Add requirement
        </Button>
      </form>
    </section>
  );
}

function Events({
  workspace,
  save,
  busy,
}: {
  workspace: Workspace;
  save: (next: Workspace) => void;
  busy: boolean;
}) {
  const events = workspace.events ?? [];
  return (
    <section className="flex flex-col gap-3">
      <div className="border-b pb-2">
        <h2 className="text-sm font-semibold">Personal academic events</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Dates saved here also appear in the unified Calendar.
        </p>
      </div>
      <ul>
        {[...events]
          .sort((a, b) =>
            String(a.date ?? "").localeCompare(String(b.date ?? "")),
          )
          .map((item) => (
            <li
              id={`planning-${item.id}`}
              key={item.id}
              className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 border-b py-3"
            >
              <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
                {item.date ?? "No date"}
              </span>
              <span className="text-sm font-medium">{item.title}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  save({
                    ...workspace,
                    events: events.filter((event) => event.id !== item.id),
                  })
                }
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
      </ul>
      <form
        className="bg-card grid gap-3 rounded-sm border p-4 sm:grid-cols-[1fr_10rem_8rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const record = eventRecord(
            Object.fromEntries(new FormData(event.currentTarget)),
            `event-${Date.now()}`,
          );
          if (record.title) save({ ...workspace, events: [...events, record] });
        }}
      >
        <Input name="title" placeholder="Event title" required />
        <Input name="date" type="date" />
        <select name="type" className="border bg-transparent px-2 text-sm">
          <option value="deadline">Deadline</option>
          <option value="registration">Registration</option>
          <option value="ceremony">Ceremony</option>
          <option value="other">Other</option>
        </select>
        <Button type="submit" variant="outline" disabled={busy}>
          Add event
        </Button>
      </form>
    </section>
  );
}

export default function PlanningPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("overview");
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const requested = new URLSearchParams(window.location.search).get("tab");
    setFocus(new URLSearchParams(window.location.search).get("focus"));
    setTab(planningTab(requested));
    fetch("/api/academics", { headers: { accept: "application/json" } })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(
              new Error(`Your record returned ${response.status}`),
            ),
      )
      .then((data: { workspace: Workspace }) => {
        if (live) setWorkspace(data.workspace);
      })
      .catch((cause: Error) => {
        if (live) setError(cause.message);
      });
    return () => {
      live = false;
    };
  }, []);

  const courses = workspace?.courses ?? [];
  const earned = earnedEcts(courses);
  const planned = plannedEcts(courses);
  const gpa = weightedGpa(courses);
  const passed = courses.filter(
    (course) => courseStatus(course) === "passed",
  ).length;

  useEffect(() => {
    if (!workspace || !focus) return;
    if (workspace.events?.some((item) => item.id === focus)) setTab("overview");
    else if (workspace.gates?.some((item) => item.id === focus)) setTab("progress");
    else if (workspace.courses.some((item) => item.id === focus)) setTab("courses");
    requestAnimationFrame(() => document.getElementById(`planning-${focus}`)?.scrollIntoView({ block: "center" }));
  }, [workspace, focus]);

  const save = async (next: Workspace) => {
    if (!workspace || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/academics", {
        method: "PUT",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspace: next,
          expectedRevision: workspace.revision,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.error || `Your record returned ${response.status}`,
        );
      setWorkspace(data.workspace);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Your record could not be read</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        {workspace ? (
          <>
            <h1 className="font-heading text-5xl leading-none tracking-tighter">
              {workspace.profile.programme}
            </h1>
            <p className={`text-muted-foreground text-sm ${NUMERALS}`}>
              {[workspace.profile.university, workspace.profile.academicYear]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </>
        ) : (
          <>
            <Skeleton className="h-12 w-96" />
            <Skeleton className="h-4 w-64" />
          </>
        )}
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          history.replaceState(null, "", `/v2/planning?tab=${value}`);
        }}
        className="gap-6"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6">
          {workspace && (
            <ProfileEditor
              workspace={workspace}
              save={(next) => void save(next)}
              busy={saving}
            />
          )}
          <div className="flex max-w-[640px] items-center gap-5">
            <Progress
              value={planned ? Math.min(100, (earned / planned) * 100) : 0}
              className="h-1.5"
            />
            <p className="whitespace-nowrap">
              <strong
                className={`text-3xl font-semibold tracking-tight ${NUMERALS}`}
              >
                {earned}
              </strong>
              <small className="text-muted-foreground ml-1.5 text-sm font-medium">
                of {planned} ECTS
              </small>
            </p>
          </div>
          <div className="flex flex-wrap gap-10">
            <Figure
              label="Courses passed"
              value={passed}
              unit={`/ ${courses.length}`}
            />
            {gpa !== null && <Figure label="Weighted GPA" value={gpa} />}
            {workspace?.programmeTemplate && (
              <Figure
                label="Study year"
                value={workspace.programmeTemplate.currentStudyYear || "—"}
              />
            )}
          </div>
          {workspace && (
            <Events
              workspace={workspace}
              save={(next) => void save(next)}
              busy={saving}
            />
          )}
        </TabsContent>

        <TabsContent value="courses">
          {workspace ? (
            <div className="flex flex-col gap-8">
              <CourseEditors
                workspace={workspace}
                save={(next) => void save(next)}
                busy={saving}
                focus={focus}
              />
              <Ledger courses={courses} />
            </div>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </TabsContent>

        <TabsContent value="progress" className="flex flex-col gap-6">
          {workspace ? (
            <>
              <Requirements
                workspace={workspace}
                save={(next) => void save(next)}
                busy={saving}
              />
              {byYear(courses).map((year) => {
                const yearEarned = earnedEcts(year.courses);
                return (
                  <section key={year.level} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between border-b pb-2">
                      <h3 className="text-sm font-semibold">{year.level}</h3>
                      <span
                        className={`text-muted-foreground text-sm ${NUMERALS}`}
                      >
                        {yearEarned} / {year.ects} ECTS
                      </span>
                    </div>
                    <Progress
                      value={year.ects ? (yearEarned / year.ects) * 100 : 0}
                      className="h-1.5"
                    />
                  </section>
                );
              })}
            </>
          ) : (
            <Skeleton className="h-32 w-full" />
          )}
        </TabsContent>

        <TabsContent value="documents">
          {workspace ? (
            <PlanningDocuments
              workspace={workspace}
              onWorkspace={(state) => setWorkspace(state.workspace)}
            />
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </TabsContent>
        <TabsContent value="planner">
          <PlanningPlanner />
        </TabsContent>
        <TabsContent value="settings">
          <PlanningSettings
            onChanged={(state) => setWorkspace(state.workspace)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
