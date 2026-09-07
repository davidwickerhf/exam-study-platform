"use client";
import { cachedWorkspaceJson } from "@/hooks/use-workspace-data";

/**
 * Planning, at editing density.
 *
 * The academic ledger is read first: every record is a ruled row, and a row
 * expands in place to reveal its editor. Only one editor is open at a time,
 * destructive actions live inside it as quiet text links, and creation forms
 * are collapsed composers opened from the page header — so the register is
 * never buried under permanently visible forms.
 *
 * Nothing in this file rebuilds the workspace object. Every write names the
 * record it means through `applyWorkspaceEdit`, and the one save path carries
 * the revision it read: if the plan moved somewhere else, the edit is held and
 * offered back with the latest record rather than silently lost.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CalendarDaysIcon, CheckCircle2Icon, Clock3Icon, FileCheck2Icon, GraduationCapIcon, LockIcon, PlusIcon, RotateCcwIcon, SearchIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanningPlanner } from "@/components/workspace/planning-planner";
import { PlanningElectives } from "@/components/workspace/planning-electives";
import { PlanningSettings } from "@/components/workspace/planning-settings";
import { gateResolved, objectiveFor, type PlannerGate, type PlannerWorkspace, plannerSummary, planningDestinations } from "@/lib/workspace/planner.mjs";
import {
  type AcademicEvent,
  type Attempt,
  type Course,
  type Gate,
  type Workspace,
  type WorkspaceEdit,
  ATTEMPT_STATUS,
  EVENT_TYPES,
  PROGRAMME_REQUIREMENTS,
  STATUS_LABEL,
  STATUS_MARK,
  applyWorkspaceEdit,
  bestAttempt,
  byYear,
  courseStatus,
  earnedEcts,
  planningTab,
  plannedEcts,
} from "@/lib/workspace/academics.mjs";

const NUMERALS = "font-data tabular-nums";
const COLUMN =
  "text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase";
const ABSENT = "text-muted-foreground/70";
/** A quiet text link: the only shape a destructive action takes inside an editor. */
const QUIET =
  "text-muted-foreground hover:text-foreground rounded-sm text-[13.5px] font-medium underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50";

type Commit = (patch: WorkspaceEdit) => void;

// ── Fields ───────────────────────────────────────────────────────────────
// Every control in an editor says what it is. A column of bare inputs reading
// "4", "6", "Year 1" is not a form; it is a puzzle.

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label className="text-[12px] leading-[1.4] font-semibold" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && (
        <small className="text-muted-foreground text-[11px] leading-[1.4]">
          {hint}
        </small>
      )}
    </div>
  );
}

function TextField({
  label,
  id,
  hint,
  className,
  ...props
}: {
  label: string;
  id: string;
  hint?: string;
  className?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <Field label={label} htmlFor={id} hint={hint} className={className}>
      <Input id={id} {...props} />
    </Field>
  );
}

function ChoiceField({
  label,
  id,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  id: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Field label={label} htmlFor={id} className={className}>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(String(next ?? value))}
      >
        <SelectTrigger id={id} className="h-10 w-full">
          <SelectValue>
            {(current) =>
              options.find(([id]) => id === current)?.[1] ?? options[0]?.[1]
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map(([id, copy]) => (
              <SelectItem key={id} value={id}>
                {copy}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

// ── Shared frames ────────────────────────────────────────────────────────

function SectionHead({
  title,
  note,
  meter,
  contained = false,
}: {
  title: string;
  note?: string;
  meter?: React.ReactNode;
  contained?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b ${contained ? "px-5 py-4 sm:px-6" : "pb-2"}`}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && (
          <p className="text-muted-foreground max-w-[74ch] text-[13.5px]">
            {note}
          </p>
        )}
      </div>
      {meter && (
        <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
          {meter}
        </span>
      )}
    </div>
  );
}

function ViewIntro({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5 border-b pb-6">
      <div className="max-w-[70ch]">
        <h2 className="font-heading text-[32px] leading-tight font-semibold tracking-[-0.03em] text-balance">
          {title}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}

function degreeTarget(workspace: Workspace) {
  const recorded = plannedEcts(workspace.courses ?? []);
  const degreeGate = [...(workspace.gates ?? [])]
    .filter((gate) => gate.type === "total-credits" && Number(gate.target) > 0)
    .sort((left, right) => Number(right.target) - Number(left.target))[0];
  return Math.max(recorded, Number(degreeGate?.target) || 0);
}

function expectedGpa(workspace: Workspace) {
  const planner = workspace as unknown as PlannerWorkspace;
  let weight = 0;
  let total = 0;
  let scenarioGrades = 0;
  for (const course of workspace.courses ?? []) {
    const objective = objectiveFor(planner, course.id);
    const recorded = bestAttempt(course)?.grade;
    const grade = objective.expectedGrade ?? recorded;
    if (!Number.isFinite(grade)) continue;
    weight += Number(course.ects) || 0;
    total += Number(grade) * (Number(course.ects) || 0);
    if (objective.expectedGrade !== undefined) scenarioGrades += 1;
  }
  return { value: weight ? Math.round((total / weight) * 10) / 10 : null, scenarioGrades };
}

function DegreePosition({ workspace }: { workspace: Workspace }) {
  const courses = workspace.courses ?? [];
  const earned = earnedEcts(courses);
  const total = degreeTarget(workspace);
  const passed = courses.filter((course) => courseStatus(course) === "passed").length;
  const scenario = plannerSummary(workspace as unknown as PlannerWorkspace);
  const attendance = (workspace.planning?.attendanceRecords ?? []) as { status?: string }[];
  const missed = attendance.filter((item) => item.status === "missed").length;
  const attended = attendance.filter((item) => item.status === "attended").length;
  const attendanceRate = attended + missed ? Math.round(attended / (attended + missed) * 100) : null;
  const expected = expectedGpa(workspace);
  const projected = Math.min(100, scenario.projectedCredits / Math.max(total, 1) * 100);
  const completed = Math.min(100, earned / Math.max(total, 1) * 100);
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(130px,0.5fr))]">
        <div className="px-5 py-5 sm:px-6">
          <span className={COLUMN}>Degree completion</span>
          <div className="mt-2 flex items-end justify-between gap-6">
            <strong className={`font-heading text-4xl tracking-[-0.04em] ${NUMERALS}`}>{earned} <small className="text-muted-foreground text-base font-medium">/ {total || "—"} ECTS</small></strong>
            <span className="text-primary text-xs font-semibold">{total ? Math.round(completed) : 0}% complete</span>
          </div>
          <span className="bg-muted relative mt-4 block h-1.5 overflow-hidden rounded-full"><span className="bg-primary/25 absolute inset-y-0 left-0" style={{ width: `${projected}%` }} /><span className="bg-primary absolute inset-y-0 left-0" style={{ width: `${completed}%` }} /></span>
          <div className="text-muted-foreground mt-2 flex justify-between gap-3 text-xs"><span>{earned} earned</span><span>{Math.max(0, scenario.projectedCredits - earned)} planned</span></div>
        </div>
        {[
          { label: "Passed", value: `${passed}`, note: `${courses.length} courses recorded` },
          { label: "Attendance", value: attendanceRate === null ? "—" : `${attendanceRate}%`, note: attendance.length ? `${missed} missed · ${attendance.length} marked` : "No attendance marked" },
          { label: "Expected GPA", value: expected.value ?? "—", note: expected.scenarioGrades ? `${expected.scenarioGrades} scenario grades` : "No scenario grades set" },
        ].map((item) => <div key={item.label} className="border-t px-5 py-5 lg:border-t-0 lg:border-l"><span className={COLUMN}>{item.label}</span><strong className={`mt-3 block text-2xl ${NUMERALS}`}>{item.value}</strong><span className="text-muted-foreground mt-1 block text-xs">{item.note}</span></div>)}
      </div>
    </section>
  );
}

function shortDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function DecisionDesk({ workspace }: { workspace: Workspace }) {
  const planner = workspace as unknown as PlannerWorkspace;
  const rows: { icon: typeof CalendarDaysIcon; label: string; detail: string; meta: string; href: string; attention?: boolean }[] = [];
  const openCourses = plannerSummary(planner).openCourses;
  const currentYear = workspace.programmeTemplate?.currentStudyYear;
  const currentCourses = currentYear ? openCourses.filter((course) => course.yearLevel === currentYear) : openCourses;
  const failed = openCourses.find((course) => courseStatus(course as Course) === "failed");
  const course = failed ?? currentCourses.find((item) => !objectiveFor(planner, item.id).targetSession && !/year|thesis|project/i.test(String(item.period ?? item.name)));
  if (course) {
    const destination = planningDestinations(planner, course.id).destinations.find((item) => item.allowed && item.role !== "carry" && item.role !== "continuous");
    rows.push({
      icon: CalendarDaysIcon,
      label: failed ? `Choose the ${course.code || course.name} retake` : `Choose a sitting for ${course.code || course.name}`,
      detail: destination ? `${destination.label} · ${destination.role === "resit" ? "resit sitting" : "primary sitting"}` : `${course.period || "Teaching period not recorded"} · no dated exam window connected`,
      meta: shortDate(destination?.startsAt) || "Plan",
      href: "/app/planning?tab=planner",
      attention: true,
    });
  }
  const openGate = (workspace.gates ?? []).find((gate) => !gateResolved(gate as unknown as PlannerGate, planner));
  if (openGate) rows.push({ icon: Clock3Icon, label: openGate.label, detail: openGate.type === "course" ? "A named course requirement is still open" : `${openGate.target} ECTS required`, meta: "Open", href: `/app/planning?tab=overview&focus=${encodeURIComponent(openGate.id)}` });
  const upcoming = [...(workspace.events ?? [])].filter((event) => event.date && event.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  if (upcoming) rows.push({ icon: FileCheck2Icon, label: upcoming.title, detail: upcoming.type === "registration" ? "Registration action recorded in your plan" : "Upcoming academic date", meta: shortDate(upcoming.date) || "Review", href: "/app/calendar" });
  if (rows.length < 3 && !(workspace.planning?.academicPeriods as unknown[] | undefined)?.length) rows.push({ icon: CalendarDaysIcon, label: "Connect the academic calendar", detail: "Add verified exam windows, resits, and registration periods", meta: "Source", href: "/app/documents" });

  return <section className="overflow-hidden rounded-xl border bg-card">
    <header className="flex items-baseline justify-between gap-4 px-5 py-4 sm:px-6"><div><span className={COLUMN}>Needs a decision</span><h2 className="font-heading mt-1 text-xl font-semibold tracking-[-0.025em]">What can change the route</h2></div><span className={`text-muted-foreground text-xs ${NUMERALS}`}>{rows.length} open</span></header>
    {rows.length ? <div className="border-t">{rows.slice(0, 3).map((item) => <Link key={`${item.label}-${item.href}`} href={item.href} className="group grid min-h-[78px] grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-t px-5 py-3 first:border-t-0 hover:bg-muted/25 sm:px-6"><span className={`grid size-9 place-items-center rounded-[8px] ${item.attention ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><item.icon className="size-4" /></span><span><strong className="block text-sm">{item.label}</strong><span className="text-muted-foreground mt-1 block text-xs">{item.detail}</span></span><span className="flex items-center gap-2 text-xs font-semibold"><span className={`text-muted-foreground ${NUMERALS}`}>{item.meta}</span><ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span></Link>)}</div> : <p className="text-muted-foreground border-t px-5 py-5 text-sm sm:px-6">Nothing needs a planning decision right now.</p>}
  </section>;
}

function YearProgress({ courses }: { courses: Course[] }) {
  const years = byYear(courses);
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <SectionHead title="Progress by study year" note="Recorded credits only. Scenario grades stay on the Session Board." contained />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3">
        {years.map((year, index) => {
          const value = earnedEcts(year.courses);
          const percentage = year.ects ? Math.min(100, value / year.ects * 100) : 0;
          return <div key={year.level} className={`min-h-32 px-5 py-4 sm:px-6 ${index ? "border-t sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-t xl:border-t-0" : ""}`}>
            <div className="flex items-baseline justify-between gap-3"><h3 className="text-sm font-semibold">{year.level}</h3><span className={`text-muted-foreground text-xs ${NUMERALS}`}>{value}/{year.ects} ECTS</span></div>
            <div className="bg-muted mt-5 h-1.5 overflow-hidden rounded-full"><span className="bg-primary block h-full" style={{ width: `${percentage}%` }} /></div>
            <p className="text-muted-foreground mt-3 text-xs">{year.courses.filter((course) => courseStatus(course) === "passed").length} of {year.courses.length} courses passed</p>
          </div>;
        })}
      </div>
    </section>
  );
}

/** A collapsed composer, opened from the page header. */
function Composer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="bg-muted flex flex-col gap-3 rounded-sm p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold tracking-[0.11em] uppercase">
          {title}
        </h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      {children}
    </section>
  );
}

function EditorFrame({
  id,
  labelledBy,
  children,
}: {
  id: string;
  labelledBy?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      aria-labelledby={labelledBy}
      className="bg-muted/60 flex flex-col gap-4 px-3 py-4 sm:px-4"
    >
      {children}
    </div>
  );
}

function EditorActions({
  busy,
  saveLabel = "Save",
  onCancel,
  destructive,
}: {
  busy: boolean;
  saveLabel?: string;
  onCancel: () => void;
  destructive?: { label: string; confirm: string; onConfirm: () => void };
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        {destructive ? (
          <button type="button" className={QUIET} disabled={busy} onClick={() => setConfirmOpen(true)}>
            {destructive.label}
          </button>
        ) : <span />}
        <span className="flex items-center gap-3">
          <button type="button" className={QUIET} onClick={onCancel}>Cancel</button>
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : saveLabel}</Button>
        </span>
      </div>
      {destructive && <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={destructive.confirm}
        description="This removes the record and its related history from this academic plan. This action cannot be undone."
        confirmLabel={destructive.label}
        destructive
        busy={busy}
        onConfirm={() => { setConfirmOpen(false); destructive.onConfirm(); }}
      />}
    </>
  );
}

// ── Courses ──────────────────────────────────────────────────────────────

function StatusCell({ course }: { course: Course }) {
  const status = courseStatus(course);
  if (status === "not-recorded")
    return (
      <span className={`${ABSENT} ${NUMERALS}`} title="No result recorded">
        —<span className="sr-only">No result recorded</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <span aria-hidden className={`${NUMERALS} text-muted-foreground`}>
        {STATUS_MARK[status]}
      </span>
      {STATUS_LABEL[status]}
    </span>
  );
}

function AttemptsPanel({
  course,
  commit,
  busy,
}: {
  course: Course;
  commit: Commit;
  busy: boolean;
}) {
  const blank = { examDate: "", grade: "", academicYear: "", status: "upcoming" };
  const [draft, setDraft] = useState(blank);
  const attempts = course.attempts ?? [];
  return (
    <section className="flex flex-col gap-3">
      <h3 className={COLUMN}>Attempts</h3>
      {attempts.length ? (
        <ul className="flex flex-col">
          {attempts.map((attempt: Attempt, index: number) => (
            <li
              key={attempt.id ?? index}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b py-2 last:border-b-0"
            >
              <span className={`text-sm ${NUMERALS}`}>
                {attempt.examDate ? (
                  attempt.examDate
                ) : (
                  <span className={ABSENT}>No date</span>
                )}
                <span className="text-muted-foreground">
                  {" · "}
                  {ATTEMPT_STATUS.find(([id]) => id === attempt.status)?.[1] ??
                    attempt.status ??
                    "Upcoming"}
                  {attempt.academicYear ? ` · ${attempt.academicYear}` : ""}
                </span>
                {" · "}
                {attempt.grade ?? <span className={ABSENT}>no grade</span>}
              </span>
              <button
                type="button"
                className={QUIET}
                disabled={busy}
                onClick={() =>
                  commit({
                    type: "attempt:remove",
                    courseId: course.id,
                    attemptId: attempt.id,
                    index,
                  })
                }
              >
                Remove attempt
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-[13.5px]">
          No sitting has been recorded for this course yet.
        </p>
      )}
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          commit({ type: "attempt:add", courseId: course.id, input: draft });
          setDraft(blank);
        }}
      >
        <TextField
          label="Exam date"
          id={`attempt-date-${course.id}`}
          type="date"
          value={draft.examDate}
          onChange={(event) =>
            setDraft({ ...draft, examDate: event.target.value })
          }
        />
        <TextField
          label="Grade"
          id={`attempt-grade-${course.id}`}
          type="number"
          step="0.1"
          min="0"
          inputMode="decimal"
          placeholder="—"
          value={draft.grade}
          onChange={(event) => setDraft({ ...draft, grade: event.target.value })}
        />
        <TextField
          label="Academic year"
          id={`attempt-year-${course.id}`}
          maxLength={30}
          placeholder="2026–2027"
          value={draft.academicYear}
          onChange={(event) =>
            setDraft({ ...draft, academicYear: event.target.value })
          }
        />
        <ChoiceField
          label="Status"
          id={`attempt-status-${course.id}`}
          value={draft.status}
          options={ATTEMPT_STATUS}
          onChange={(status) => setDraft({ ...draft, status })}
        />
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" size="sm" variant="secondary" disabled={busy}>
            <PlusIcon data-icon="inline-start" />
            Add attempt
          </Button>
        </div>
      </form>
    </section>
  );
}

function CourseEditor({
  course,
  commit,
  busy,
  onClose,
}: {
  course: Course;
  commit: Commit;
  busy: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({
    code: course.code ?? "",
    name: course.name ?? "",
    ects: String(course.ects ?? ""),
    passMark: String(course.passMark ?? 5.5),
    yearLevel: course.yearLevel ?? "",
    period: course.period ?? "",
    programmeRequirement: course.programmeRequirement || "required",
  });
  return (
    <EditorFrame id={`course-editor-${course.id}`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          commit({ type: "course:update", id: course.id, input: draft });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Course code"
            id={`course-code-${course.id}`}
            maxLength={40}
            placeholder="BCS1000"
            value={draft.code}
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          />
          <TextField
            label="Course name"
            id={`course-name-${course.id}`}
            required
            maxLength={200}
            className="lg:col-span-2"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <TextField
            label="Credits (ECTS)"
            id={`course-ects-${course.id}`}
            type="number"
            step="0.5"
            min="0"
            inputMode="decimal"
            value={draft.ects}
            onChange={(event) => setDraft({ ...draft, ects: event.target.value })}
          />
          <TextField
            label="Pass mark"
            id={`course-pass-${course.id}`}
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            hint="The grade this course counts as a pass."
            value={draft.passMark}
            onChange={(event) =>
              setDraft({ ...draft, passMark: event.target.value })
            }
          />
          <TextField
            label="Study year"
            id={`course-year-${course.id}`}
            maxLength={40}
            placeholder="Year 1"
            value={draft.yearLevel}
            onChange={(event) =>
              setDraft({ ...draft, yearLevel: event.target.value })
            }
          />
          <TextField
            label="Teaching period"
            id={`course-period-${course.id}`}
            maxLength={40}
            placeholder="Period 1"
            value={draft.period}
            onChange={(event) =>
              setDraft({ ...draft, period: event.target.value })
            }
          />
          <ChoiceField
            label="Programme requirement"
            id={`course-requirement-${course.id}`}
            value={draft.programmeRequirement}
            options={PROGRAMME_REQUIREMENTS}
            onChange={(programmeRequirement) =>
              setDraft({ ...draft, programmeRequirement })
            }
          />
        </div>
        <EditorActions
          busy={busy}
          saveLabel="Save course"
          onCancel={onClose}
          destructive={{
            label: "Delete this course",
            confirm: `Delete ${course.name} and every attempt recorded against it?`,
            onConfirm: () => commit({ type: "course:remove", id: course.id }),
          }}
        />
      </form>
      <AttemptsPanel course={course} commit={commit} busy={busy} />
      <p className="text-[13.5px]">
        <Link
          className="text-primary font-semibold underline-offset-4 hover:underline"
          href={`/app/course-request/${encodeURIComponent(course.id)}`}
        >
          Request study material for this course
        </Link>
      </p>
    </EditorFrame>
  );
}

function CourseRegister({
  courses,
  hasProgramme,
  open,
  onOpen,
  onAdd,
  commit,
  busy,
}: {
  courses: Course[];
  hasProgramme: boolean;
  open: string | null;
  onOpen: (id: string | null) => void;
  onAdd: () => void;
  commit: Commit;
  busy: boolean;
}) {
  const years = useMemo(() => byYear(courses), [courses]);
  const [selectedYear, setSelectedYear] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  useEffect(() => {
    const focusedYear = open ? years.find((year) => year.courses.some((course) => course.id === open))?.level : null;
    if (focusedYear && focusedYear !== selectedYear) setSelectedYear(focusedYear);
    else if (!years.some((year) => year.level === selectedYear)) setSelectedYear(years[0]?.level || "");
  }, [open, selectedYear, years]);
  if (!courses.length) {
    return (
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <div className="flex flex-col items-start px-6 py-9 sm:px-9 sm:py-11">
            <span className="bg-primary/[0.07] text-primary flex size-11 items-center justify-center rounded-lg">
              <GraduationCapIcon className="size-5" />
            </span>
            <span className={`${COLUMN} mt-6`}>Curriculum setup</span>
            <h2 className="font-heading mt-2 max-w-xl text-[26px] leading-tight font-semibold tracking-[-0.03em]">
              {hasProgramme
                ? "Add the first course to your programme"
                : "Start with your programme"}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-[58ch] text-sm leading-relaxed">
              {hasProgramme
                ? "Import your transcript to build the record automatically, or add a course yourself. You can revise every detail later."
                : "Choose your degree and curriculum year to load its courses, periods and elective rules. You can change this later without losing recorded attempts."}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {hasProgramme ? (
                <Button onClick={onAdd}>
                  <PlusIcon data-icon="inline-start" />
                  Add first course
                </Button>
              ) : (
                <Button nativeButton={false} render={<Link href="/app/setup?checklist=1&step=programme" />}>
                  Choose programme
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              )}
              <Button nativeButton={false} render={<Link href="/app/documents" />} variant="outline">
                <FileCheck2Icon data-icon="inline-start" />
                Import transcript
              </Button>
            </div>
          </div>

          <aside className="border-t lg:border-t-0 lg:border-l" aria-label="What programme setup unlocks">
            <div className="px-6 py-4">
              <span className={COLUMN}>What this builds</span>
            </div>
            {[
              ["01", "Course record", "Required courses, credits and electives by study year."],
              ["02", "Valid exam options", "Primary sittings and resits placed in the right periods."],
              ["03", "Degree progress", "A live view of what is complete, planned and still open."],
            ].map(([number, title, copy]) => (
              <div key={number} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-t px-6 py-4">
                <span className={`text-primary text-xs font-semibold ${NUMERALS}`}>{number}</span>
                <span>
                  <strong className="block text-sm font-semibold">{title}</strong>
                  <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">{copy}</span>
                </span>
              </div>
            ))}
          </aside>
        </div>
        {!hasProgramme && (
          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4 text-sm sm:px-9">
            <span>Already know what belongs in your plan?</span>
            <button type="button" onClick={onAdd} className="text-foreground inline-flex items-center gap-1.5 font-semibold underline decoration-border-strong underline-offset-4 hover:text-primary">
              Add a course manually
              <ArrowRightIcon className="size-3.5" />
            </button>
          </div>
        )}
      </section>
    );
  }
  const year = years.find((item) => item.level === selectedYear) || years[0];
  const yearPassed = year.courses.filter((course) => courseStatus(course) === "passed").length;
  const visible = year.courses.filter((course) => {
    const matchesQuery = !query.trim() || `${course.code} ${course.name}`.toLowerCase().includes(query.trim().toLowerCase());
    const state = courseStatus(course);
    return matchesQuery && (status === "all" || status === state || (status === "open" && state !== "passed"));
  });
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex min-h-[88px] items-stretch border-b">
        <div className="flex min-w-56 flex-1 flex-col justify-center px-5 py-4 sm:px-6"><h2 className="font-heading text-xl font-semibold tracking-[-0.025em]">{year.level} courses</h2><p className="text-muted-foreground mt-1 text-sm">{year.courses.length} courses in this study year · {yearPassed} passed</p></div>
        <nav className="flex min-w-0 overflow-x-auto" aria-label="Course years">
          {years.map((item) => <button key={item.level} type="button" onClick={() => { setSelectedYear(item.level); onOpen(null); }} className={`relative min-w-36 border-l px-4 text-left ${year.level === item.level ? "bg-primary/[0.035]" : "hover:bg-muted/35"}`}><span className={`${COLUMN} ${year.level === item.level ? "text-primary" : ""}`}>{item.level}</span><span className={`text-muted-foreground mt-1 block text-xs ${NUMERALS}`}>{earnedEcts(item.courses)}/{item.ects} ECTS</span>{year.level === item.level && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}</button>)}
        </nav>
      </header>
      <div className="grid gap-3 border-b bg-muted/35 px-5 py-4 sm:grid-cols-[minmax(12rem,1fr)_11rem] sm:px-6">
        <label className="relative"><span className="sr-only">Search this study year</span><SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" /><Input className="bg-card pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses" /></label>
        <Select value={status} onValueChange={(value) => setStatus(String(value))}><SelectTrigger className="bg-card w-full" aria-label="Filter by course status"><SelectValue>{(value) => ({ all: "All statuses", open: "Still open", passed: "Passed", failed: "Failed / retake", registered: "Registered" })[String(value)]}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All statuses</SelectItem><SelectItem value="open">Still open</SelectItem><SelectItem value="passed">Passed</SelectItem><SelectItem value="failed">Failed / retake</SelectItem><SelectItem value="registered">Registered</SelectItem></SelectGroup></SelectContent></Select>
      </div>
      <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse">
              <thead>
                <tr className={`${COLUMN} border-b`}>
                  <th className="px-5 py-3 text-left font-semibold sm:px-6">Course</th>
                  <th className="w-[7rem] px-3 py-3 text-left font-semibold">
                    Period
                  </th>
                  <th className="w-[4.5rem] px-3 py-3 text-right font-semibold">
                    ECTS
                  </th>
                  <th className="w-[8rem] px-3 py-3 text-left font-semibold">
                    Requirement
                  </th>
                  <th className="w-[8rem] px-5 py-3 text-left font-semibold sm:pr-6">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((course) => {
                  const expanded = open === course.id;
                  return (
                    <Fragment key={course.id}>
                      <tr
                        id={`planning-${course.id}`}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest("a,button"))
                            return;
                          onOpen(expanded ? null : course.id);
                        }}
                        className={`cursor-pointer border-b transition-colors ${expanded ? "bg-muted/60" : "hover:bg-card"}`}
                      >
                        <td className="px-5 py-4 sm:px-6">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={`course-editor-${course.id}`}
                            onClick={() => onOpen(expanded ? null : course.id)}
                            className="group/course rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            <span className={`text-primary block text-xs font-semibold tracking-[0.04em] ${NUMERALS}`}>{course.code || "No code"}</span>
                            <span className="mt-1 block text-[15px] font-semibold group-hover/course:underline">{course.name}</span>
                            <span className="text-muted-foreground mt-2 inline-flex items-center gap-1.5 text-xs">
                              <StatusCell course={course} />
                            </span>
                          </button>
                        </td>
                        <td
                          className={`text-muted-foreground px-3 py-3 text-sm ${NUMERALS}`}
                        >
                          {course.period || <span className={ABSENT}>—</span>}
                        </td>
                        <td
                          className={`px-3 py-3 text-right text-sm ${NUMERALS}`}
                        >
                          {course.ects}
                        </td>
                        <td className="text-muted-foreground px-3 py-3 text-sm capitalize">
                          {course.programmeRequirement || (
                            <span className={ABSENT}>—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 sm:pr-6">
                          <button type="button" aria-expanded={expanded} onClick={() => onOpen(expanded ? null : course.id)} className="text-primary inline-flex items-center gap-2 text-sm font-semibold">{expanded ? "Close record" : "Edit record"}<ArrowRightIcon className={`size-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} /></button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b">
                          <td colSpan={5} className="p-0">
                            <CourseEditor
                              course={course}
                              commit={commit}
                              busy={busy}
                              onClose={() => onOpen(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
      </div>
      {!visible.length && <p className="text-muted-foreground px-5 py-8 text-center text-sm sm:px-6">No courses match these filters.</p>}
      <footer className="text-muted-foreground flex items-center justify-between gap-4 border-t px-5 py-3 text-xs sm:px-6"><span>Showing {visible.length} of {year.courses.length} courses</span><span className={NUMERALS}>{earnedEcts(year.courses)}/{year.ects} ECTS earned</span></footer>
    </section>
  );
}

function CourseComposer({
  commit,
  busy,
  onClose,
}: {
  commit: Commit;
  busy: boolean;
  onClose: () => void;
}) {
  const blank = { code: "", name: "", ects: "", yearLevel: "", period: "" };
  const [draft, setDraft] = useState(blank);
  return (
    <Composer title="Add course" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) return;
          commit({ type: "course:add", input: draft });
          setDraft(blank);
          onClose();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <TextField
            label="Course code"
            id="new-course-code"
            maxLength={40}
            placeholder="BCS1000"
            value={draft.code}
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          />
          <TextField
            label="Course name"
            id="new-course-name"
            required
            maxLength={200}
            className="lg:col-span-2"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <TextField
            label="Credits (ECTS)"
            id="new-course-ects"
            type="number"
            step="0.5"
            min="0"
            inputMode="decimal"
            value={draft.ects}
            onChange={(event) => setDraft({ ...draft, ects: event.target.value })}
          />
          <TextField
            label="Study year"
            id="new-course-year"
            maxLength={40}
            placeholder="Year 1"
            value={draft.yearLevel}
            onChange={(event) =>
              setDraft({ ...draft, yearLevel: event.target.value })
            }
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy || !draft.name.trim()}>
            {busy ? "Saving…" : "Add course"}
          </Button>
          <button type="button" className={QUIET} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Composer>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────

const PROFILE_FACTS: {
  field: "university" | "programme" | "academicYear";
  label: string;
  hint: string;
  required?: boolean;
}[] = [
  {
    field: "university",
    label: "University",
    hint: "Name the institution this record belongs to.",
  },
  {
    field: "programme",
    label: "Programme",
    hint: "The degree this plan tracks.",
    required: true,
  },
  {
    field: "academicYear",
    label: "Academic year",
    hint: "Add your cohort year — it orders exams and periods.",
  },
];

function FactsRegister({
  workspace,
  open,
  onOpen,
  commit,
  busy,
}: {
  workspace: Workspace;
  open: string | null;
  onOpen: (id: string | null) => void;
  commit: Commit;
  busy: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <SectionHead
        title="Programme record"
        note="These facts are private to your account and describe your own cohort, not the shared course catalogue."
        contained
      />
      <ul className="flex flex-col">
        {PROFILE_FACTS.map((fact) => {
          const value = String(
            workspace.profile[fact.field] ?? "",
          ).trim();
          const expanded = open === fact.field;
          return (
            <li key={fact.field} className="flex flex-col border-b">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`fact-editor-${fact.field}`}
                onClick={() => onOpen(expanded ? null : fact.field)}
                className={`flex min-h-14 items-center justify-between gap-4 px-5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-6 ${expanded ? "bg-muted/35" : "hover:bg-muted/25"}`}
              >
                <span className="text-[12px] font-semibold">{fact.label}</span>
                {value ? (
                  <span className={`text-[15px] ${NUMERALS}`}>{value}</span>
                ) : (
                  <span className={`text-[13.5px] ${ABSENT}`}>{fact.hint}</span>
                )}
              </button>
              {expanded && (
                <FactEditor
                  fact={fact}
                  value={value}
                  busy={busy}
                  commit={commit}
                  onClose={() => onOpen(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FactEditor({
  fact,
  value,
  busy,
  commit,
  onClose,
}: {
  fact: (typeof PROFILE_FACTS)[number];
  value: string;
  busy: boolean;
  commit: Commit;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <EditorFrame id={`fact-editor-${fact.field}`}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          commit({ type: "profile", values: { [fact.field]: draft } });
          onClose();
        }}
      >
        <TextField
          label={fact.label}
          id={`fact-input-${fact.field}`}
          className="max-w-[28rem]"
          required={fact.required}
          maxLength={fact.field === "academicYear" ? 30 : 200}
          hint={fact.hint}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        {/* The action sits with the field it saves, not adrift at the far right. */}
        <span className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving…" : "Save details"}
          </Button>
          <button type="button" className={QUIET} onClick={onClose}>
            Cancel
          </button>
        </span>
      </form>
    </EditorFrame>
  );
}

function EventsRegister({
  workspace,
  open,
  onOpen,
  commit,
  busy,
}: {
  workspace: Workspace;
  open: string | null;
  onOpen: (id: string | null) => void;
  commit: Commit;
  busy: boolean;
}) {
  const events = [...(workspace.events ?? [])].sort((left, right) =>
    String(left.date ?? "").localeCompare(String(right.date ?? "")),
  );
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <SectionHead
        title="Personal academic events"
        note="Dates saved here also appear in the unified Calendar."
        meter={events.length ? `${events.length} recorded` : undefined}
        contained
      />
      {events.length ? (
        <ul className="flex flex-col">
          {events.map((item: AcademicEvent) => {
            const expanded = open === item.id;
            return (
              <li
                key={item.id}
                id={`planning-${item.id}`}
                className="flex flex-col border-b"
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`event-editor-${item.id}`}
                  onClick={() => onOpen(expanded ? null : item.id)}
                  className={`grid min-h-14 grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-6 ${expanded ? "bg-muted/35" : "hover:bg-muted/25"}`}
                >
                  <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
                    {item.date ?? <span className={ABSENT}>—</span>}
                  </span>
                  <span className="truncate text-[15px] font-medium">
                    {item.title}
                  </span>
                  <span className={`${COLUMN} justify-self-end`}>
                    {EVENT_TYPES.find(([id]) => id === item.type)?.[1] ??
                      item.type}
                  </span>
                </button>
                {expanded && (
                  <EventEditor
                    event={item}
                    busy={busy}
                    commit={commit}
                    onClose={() => onOpen(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground px-5 py-5 text-[13.5px] sm:px-6">
          No personal dates recorded. Add one from the page header, or read an
          exam schedule in Documents.
        </p>
      )}
    </section>
  );
}

function EventEditor({
  event: item,
  busy,
  commit,
  onClose,
}: {
  event: AcademicEvent;
  busy: boolean;
  commit: Commit;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({
    title: item.title ?? "",
    date: item.date ?? "",
    type: item.type || "other",
    notes: item.notes ?? "",
  });
  return (
    <EditorFrame id={`event-editor-${item.id}`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(submitted) => {
          submitted.preventDefault();
          commit({ type: "event:update", id: item.id, input: draft });
          onClose();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="Title"
            id={`event-title-${item.id}`}
            required
            maxLength={200}
            className="lg:col-span-2"
            value={draft.title}
            onChange={(field) => setDraft({ ...draft, title: field.target.value })}
          />
          <TextField
            label="Date"
            id={`event-date-${item.id}`}
            type="date"
            value={draft.date}
            onChange={(field) => setDraft({ ...draft, date: field.target.value })}
          />
          <ChoiceField
            label="Type"
            id={`event-type-${item.id}`}
            value={draft.type}
            options={EVENT_TYPES}
            onChange={(type) => setDraft({ ...draft, type })}
          />
          <TextField
            label="Notes"
            id={`event-notes-${item.id}`}
            maxLength={2000}
            className="sm:col-span-2 lg:col-span-4"
            value={draft.notes}
            onChange={(field) => setDraft({ ...draft, notes: field.target.value })}
          />
        </div>
        <EditorActions
          busy={busy}
          saveLabel="Save event"
          onCancel={onClose}
          destructive={{
            label: "Remove this event",
            confirm: `Remove “${item.title}” from your plan?`,
            onConfirm: () => commit({ type: "event:remove", id: item.id }),
          }}
        />
      </form>
    </EditorFrame>
  );
}

function EventComposer({
  commit,
  busy,
  onClose,
}: {
  commit: Commit;
  busy: boolean;
  onClose: () => void;
}) {
  const blank = { title: "", date: "", type: "deadline" };
  const [draft, setDraft] = useState(blank);
  return (
    <Composer title="Add academic event" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.title.trim()) return;
          commit({ type: "event:add", input: draft });
          setDraft(blank);
          onClose();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="Title"
            id="new-event-title"
            required
            maxLength={200}
            className="lg:col-span-2"
            placeholder="Resit registration closes"
            value={draft.title}
            onChange={(field) => setDraft({ ...draft, title: field.target.value })}
          />
          <TextField
            label="Date"
            id="new-event-date"
            type="date"
            value={draft.date}
            onChange={(field) => setDraft({ ...draft, date: field.target.value })}
          />
          <ChoiceField
            label="Type"
            id="new-event-type"
            value={draft.type}
            options={EVENT_TYPES}
            onChange={(type) => setDraft({ ...draft, type })}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy || !draft.title.trim()}>
            {busy ? "Saving…" : "Add event"}
          </Button>
          <button type="button" className={QUIET} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Composer>
  );
}

// ── Progress ─────────────────────────────────────────────────────────────

function RequirementsRegister({
  workspace,
  open,
  onOpen,
  onAdd,
  commit,
  busy,
}: {
  workspace: Workspace;
  open: string | null;
  onOpen: (id: string | null) => void;
  onAdd?: () => void;
  commit: Commit;
  busy: boolean;
}) {
  const gates = workspace.gates ?? [];
  const progressFor = (gate: Gate) => {
    if (gate.type === "course") {
      const target = workspace.courses.find((course) => course.id === gate.courseId);
      const complete = target ? courseStatus(target) === "passed" : false;
      return { value: complete ? 1 : 0, target: 1, copy: complete ? "Complete" : "Course still open" };
    }
    const eligible = gate.type === "credit-level" || gate.type === "all-level" ? workspace.courses.filter((course) => course.yearLevel === gate.level) : workspace.courses;
    if (gate.type === "all-level") {
      const complete = eligible.filter((course) => courseStatus(course) === "passed").length;
      return { value: complete, target: eligible.length, copy: `${complete} of ${eligible.length} courses` };
    }
    const value = earnedEcts(eligible);
    return { value, target: Number(gate.target) || 0, copy: `${value} of ${Number(gate.target) || 0} ECTS` };
  };
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex min-h-[77px] items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <div><span className={COLUMN}>Requirements</span><h2 className="font-heading mt-1 text-xl font-semibold tracking-[-0.025em]">What the route must satisfy</h2></div>
        {onAdd && <Button variant="ghost" size="sm" onClick={onAdd}><PlusIcon data-icon="inline-start" />Add</Button>}
      </header>
      {gates.length ? (
        <ul className="flex flex-col">
          {gates.map((gate: Gate) => {
            const expanded = open === gate.id;
            const progress = progressFor(gate);
            const percentage = progress.target ? Math.min(100, progress.value / progress.target * 100) : 0;
            return (
              <li
                key={gate.id}
                id={`planning-${gate.id}`}
                className="flex flex-col border-b"
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`gate-editor-${gate.id}`}
                  onClick={() => onOpen(expanded ? null : gate.id)}
                  className={`grid min-h-[76px] grid-cols-[minmax(0,1fr)_minmax(120px,0.55fr)_auto] items-center gap-5 px-5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-6 ${expanded ? "bg-muted/35" : "hover:bg-muted/25"}`}
                >
                  <span><strong className="block text-sm font-semibold">{gate.label}</strong><span className="text-muted-foreground mt-1 block text-xs">{progress.copy}</span></span>
                  <span className="min-w-0"><span className="bg-muted block h-1.5 overflow-hidden rounded-full"><span className="bg-primary block h-full" style={{ width: `${percentage}%` }} /></span></span>
                  {percentage >= 100 ? <CheckCircle2Icon className="size-4 text-primary" /> : <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{Math.round(percentage)}%</span>}
                </button>
                {expanded && (
                  <GateEditor
                    gate={gate}
                    busy={busy}
                    commit={commit}
                    onClose={() => onOpen(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground border-t px-5 py-5 text-[13.5px] sm:px-6">
          No programme requirements are recorded yet. Add a propedeuse, year target, or named course requirement so the planner can test the route.
        </p>
      )}
    </section>
  );
}

function GateEditor({
  gate,
  busy,
  commit,
  onClose,
}: {
  gate: Gate;
  busy: boolean;
  commit: Commit;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({
    label: gate.label ?? "",
    target: String(gate.target ?? ""),
  });
  return (
    <EditorFrame id={`gate-editor-${gate.id}`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          commit({ type: "gate:update", id: gate.id, input: draft });
          onClose();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <TextField
            label="Requirement"
            id={`gate-label-${gate.id}`}
            required
            maxLength={200}
            value={draft.label}
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          />
          <TextField
            label="Target (ECTS)"
            id={`gate-target-${gate.id}`}
            type="number"
            min="0"
            inputMode="numeric"
            value={draft.target}
            onChange={(event) =>
              setDraft({ ...draft, target: event.target.value })
            }
          />
        </div>
        <EditorActions
          busy={busy}
          saveLabel="Save requirement"
          onCancel={onClose}
          destructive={{
            label: "Remove this requirement",
            confirm: `Remove “${gate.label}” from your plan?`,
            onConfirm: () => commit({ type: "gate:remove", id: gate.id }),
          }}
        />
      </form>
    </EditorFrame>
  );
}

function GateComposer({
  commit,
  busy,
  onClose,
}: {
  commit: Commit;
  busy: boolean;
  onClose: () => void;
}) {
  const blank = { label: "", target: "" };
  const [draft, setDraft] = useState(blank);
  return (
    <Composer title="Add requirement" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.label.trim()) return;
          commit({ type: "gate:add", input: draft });
          setDraft(blank);
          onClose();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <TextField
            label="Requirement"
            id="new-gate-label"
            required
            maxLength={200}
            placeholder="Propedeuse"
            value={draft.label}
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          />
          <TextField
            label="Target (ECTS)"
            id="new-gate-target"
            type="number"
            min="0"
            inputMode="numeric"
            value={draft.target}
            onChange={(event) =>
              setDraft({ ...draft, target: event.target.value })
            }
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy || !draft.label.trim()}>
            {busy ? "Saving…" : "Add requirement"}
          </Button>
          <button type="button" className={QUIET} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Composer>
  );
}

// ── The destination ──────────────────────────────────────────────────────

const TABS: [string, string][] = [
  ["overview", "Overview"],
  ["courses", "Courses"],
  ["planner", "Planner"],
  ["settings", "Settings"],
];

/** Which composer each tab offers from the page header. */
const HEADER_ACTION: Record<string, string> = {
  courses: "Add course",
};

export default function PlanningPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{
    message: string;
    conflict: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [tab, setTab] = useState("planner");
  const [focus, setFocus] = useState<string | null>(null);
  const [composer, setComposer] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const focused = useRef(false);

  const read = useCallback(async (force = false) => {
    const data = await cachedWorkspaceJson<{ workspace: Workspace }>("/api/academics", force);
    return data.workspace;
  }, []);

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "documents") {
      window.location.replace("/app/documents");
      return () => { live = false; };
    }
    setFocus(params.get("focus"));
    setTab(planningTab(params.get("tab")));
    read()
      .then((next) => {
        if (live) setWorkspace(next);
      })
      .catch((cause: Error) => {
        if (live) setError(cause.message);
      });
    return () => {
      live = false;
    };
  }, [read]);

  const courses = workspace?.courses ?? [];

  // A deep link opens the record it names, once. Re-running on every save
  // would drag the student back to the row they had moved on from.
  useEffect(() => {
    if (!workspace || !focus || focused.current) return;
    focused.current = true;
    if (workspace.events?.some((item) => item.id === focus)) setTab("overview");
    else if (workspace.gates?.some((item) => item.id === focus))
      setTab("overview");
    else if (workspace.courses.some((item) => item.id === focus))
      setTab("courses");
    setEditing(focus);
    requestAnimationFrame(() =>
      document
        .getElementById(`planning-${focus}`)
        ?.scrollIntoView({ block: "center" }),
    );
  }, [workspace, focus]);

  /**
   * One save path. The edit is named, applied here, and written under the
   * revision it was read at; a conflict is reported with the record intact so
   * the student can reload and try again rather than lose what they typed.
   */
  const commit = useCallback(
    (patch: WorkspaceEdit) => {
      if (!workspace || saving) return;
      const next = applyWorkspaceEdit(workspace, patch);
      // An edit that changes nothing is not written: an unchanged PUT still
      // burns the revision and would fail another tab's next save for nothing.
      if (!next) return;
      setSaving(true);
      setSaveError(null);
      void (async () => {
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
            throw Object.assign(
              new Error(
                data?.error || `Your record returned ${response.status}`,
              ),
              { conflict: response.status === 409 },
            );
          setWorkspace(data.workspace);
        } catch (cause) {
          setSaveError({
            message: (cause as Error).message,
            conflict: (cause as { conflict?: boolean }).conflict === true,
          });
        } finally {
          setSaving(false);
        }
      })();
    },
    [workspace, saving],
  );

  const reload = useCallback(() => {
    setReloading(true);
    read(true)
      .then((next) => {
        setWorkspace(next);
        setSaveError(null);
      })
      .catch((cause: Error) =>
        setSaveError({ message: cause.message, conflict: false }),
      )
      .finally(() => setReloading(false));
  }, [read]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-5 sm:p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Your record could not be read</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <Button variant="secondary" onClick={reload} disabled={reloading}>
            <RotateCcwIcon data-icon="inline-start" />
            {reloading ? "Reading…" : "Try again"}
          </Button>
        </Empty>
      </div>
    );
  }

  const action = HEADER_ACTION[tab];

  return (
    <div className={`flex w-full flex-col gap-5 p-5 sm:p-8 ${tab === "planner" ? "h-dvh min-h-[720px] overflow-hidden" : "mx-auto min-h-dvh max-w-[1240px]"}`}>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          {workspace ? (
            <>
              <h1 className="font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">Planning</h1>
              <p
                className={`text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm ${NUMERALS}`}
              >
                <LockIcon aria-hidden className="size-3.5 shrink-0" />
                <span>
                  {workspace.profile.programme || "Academic programme"}
                  {[
                    workspace.profile.academicYear,
                    workspace.profile.university,
                  ]
                    .filter(Boolean)
                    .map((part) => ` · ${part}`)
                    .join("")}
                </span>
              </p>
            </>
          ) : (
            <>
              <Skeleton className="h-8 w-72 sm:w-96" />
              <Skeleton className="h-4 w-56" />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {workspace && action && (
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={composer === tab}
              onClick={() => setComposer(composer === tab ? null : tab)}
            >
              <PlusIcon data-icon="inline-start" />
              {action}
            </Button>
          )}
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setComposer(null);
          setEditing(null);
          history.replaceState(null, "", `/app/planning?tab=${value}`);
        }}
        className="min-h-0 flex-1 gap-5"
      >
        <TabsList data-tour="planning-modes" data-tour-ready={Boolean(workspace)}
          variant="line"
          className="h-10 w-full max-w-full justify-start gap-6 overflow-x-auto rounded-none border-b p-0"
        >
          {TABS.map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-10 flex-none px-0 text-[13.5px] after:bg-primary group-data-horizontal/tabs:after:-bottom-px"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {saveError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-t py-3"
          >
            <span className="flex min-w-0 items-start gap-2 text-[13.5px]">
              <TriangleAlertIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                {saveError.conflict
                  ? "This programme changed somewhere else, so your edit was not written. Reload the latest record and make it again."
                  : `Your edit could not be saved: ${saveError.message}`}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={reloading}
                onClick={reload}
              >
                <RotateCcwIcon data-icon="inline-start" />
                {reloading ? "Reloading…" : "Reload latest"}
              </Button>
              <button
                type="button"
                className={QUIET}
                onClick={() => setSaveError(null)}
              >
                Dismiss
              </button>
            </span>
          </div>
        )}

        <TabsContent value="overview" className="flex flex-col gap-8 pb-10">
          {workspace ? (
            <>
              <ViewIntro
                title="Your academic position"
                description="The recorded degree status, decisions that can change it, and the requirements your current plan must still clear."
                action={<Button size="sm" onClick={() => { setTab("planner"); history.replaceState(null, "", "/app/planning?tab=planner"); }}>Open Session Board<ArrowRightIcon data-icon="inline-end" /></Button>}
              />
              {composer === "overview:gate" && <GateComposer commit={commit} busy={saving} onClose={() => setComposer(null)} />}
              <DegreePosition workspace={workspace} />
              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <DecisionDesk workspace={workspace} />
                <RequirementsRegister workspace={workspace} open={editing} onOpen={setEditing} onAdd={() => setComposer(composer === "overview:gate" ? null : "overview:gate")} commit={commit} busy={saving} />
              </div>
              <YearProgress courses={courses} />
            </>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </TabsContent>

        <TabsContent value="courses" className="flex flex-col gap-6">
          {workspace ? (
            <>
              <ViewIntro
                title="Courses in your plan"
                description="Review the curriculum by study year, keep attempts accurate, and choose the electives that feed your Session Board. Study materials and source coverage stay in the Course Desk."
                action={courses.length || workspace.profile.programme?.trim() ? <Button nativeButton={false} render={<Link href="/app/courses" />} variant="outline" size="sm">Open Course Desk<ArrowRightIcon data-icon="inline-end" /></Button> : undefined}
              />
              {composer === "courses" && (
                <CourseComposer
                  commit={commit}
                  busy={saving}
                  onClose={() => setComposer(null)}
                />
              )}
              <CourseRegister
                courses={courses}
                hasProgramme={Boolean(workspace.profile.programme?.trim())}
                open={editing}
                onOpen={setEditing}
                onAdd={() => setComposer("courses")}
                commit={commit}
                busy={saving}
              />
              {workspace.profile.programme?.trim() && (
                <PlanningElectives
                  onSaved={reload}
                  onAddCourse={() => setComposer("courses")}
                />
              )}
            </>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </TabsContent>

        <TabsContent value="planner" className="min-h-0 flex-1">
          <PlanningPlanner />
        </TabsContent>
        <TabsContent value="settings" className="mx-auto w-full max-w-[1180px]">
          <PlanningSettings
            onChanged={(state) => setWorkspace(state.workspace)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
