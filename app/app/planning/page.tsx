"use client";

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
import { LockIcon, PlusIcon, RotateCcwIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
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
import { PlanningSettings } from "@/components/workspace/planning-settings";
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
  byYear,
  courseStatus,
  earnedEcts,
  planningTab,
  plannedEcts,
  weightedGpa,
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
}: {
  title: string;
  note?: string;
  meter?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b pb-2">
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
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5 border-b pb-6">
      <div className="max-w-[70ch]">
        <span className={COLUMN}>{eyebrow}</span>
        <h2 className="font-heading mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-balance">
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

/** A planning summary: one ruled strip of measures, never a row of cards. */
function Strip({
  cells,
}: {
  cells: { label: string; value: string | number; unit?: string; detail?: string }[];
}) {
  return (
    <dl className="grid grid-cols-2 border-y sm:grid-cols-4">
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          className={`flex flex-col gap-1 py-3 pr-4 ${index % 2 ? "border-l pl-4" : ""} sm:border-l sm:pl-4 sm:first:border-l-0 sm:first:pl-0`}
        >
          <dt className={COLUMN}>{cell.label}</dt>
          <dd
            className={`text-2xl leading-none font-semibold tracking-tight ${NUMERALS}`}
          >
            {cell.value}
            {cell.unit && (
              <small className="text-muted-foreground ml-1 text-sm font-medium">
                {cell.unit}
              </small>
            )}
          </dd>
          {cell.detail && (
            <span className="text-muted-foreground text-[11px]">
              {cell.detail}
            </span>
          )}
        </div>
      ))}
    </dl>
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
      {destructive ? (
        <button
          type="button"
          className={QUIET}
          disabled={busy}
          onClick={() => {
            if (window.confirm(destructive.confirm)) destructive.onConfirm();
          }}
        >
          {destructive.label}
        </button>
      ) : (
        <span />
      )}
      <span className="flex items-center gap-3">
        <button type="button" className={QUIET} onClick={onCancel}>
          Cancel
        </button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : saveLabel}
        </Button>
      </span>
    </div>
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
  open,
  onOpen,
  commit,
  busy,
}: {
  courses: Course[];
  open: string | null;
  onOpen: (id: string | null) => void;
  commit: Commit;
  busy: boolean;
}) {
  const years = useMemo(() => byYear(courses), [courses]);
  if (!courses.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No courses yet</EmptyTitle>
          <EmptyDescription>
            Add a course from the page header, or read a transcript in Documents
            and this register fills with your own curriculum.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {years.map((year) => (
        <section key={year.level} className="flex flex-col gap-1">
          <SectionHead
            title={year.level}
            meter={`${year.courses.length} courses · ${year.ects} ECTS`}
          />
          <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr className={COLUMN}>
                  <th className="w-[6.5rem] py-2 pr-4 text-left font-semibold">
                    Code
                  </th>
                  <th className="py-2 pr-6 text-left font-semibold">Course</th>
                  <th className="w-[7rem] py-2 pr-4 text-left font-semibold">
                    Period
                  </th>
                  <th className="w-[4.5rem] py-2 pr-6 text-right font-semibold">
                    ECTS
                  </th>
                  <th className="w-[7rem] py-2 pr-4 text-left font-semibold">
                    Requirement
                  </th>
                  <th className="w-[8rem] py-2 text-left font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {year.courses.map((course) => {
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
                        <td
                          className={`py-2 pr-4 text-sm font-semibold ${NUMERALS}`}
                        >
                          {course.code || <span className={ABSENT}>—</span>}
                        </td>
                        <td className="py-2 pr-6 text-[15px] font-medium">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={`course-editor-${course.id}`}
                            onClick={() => onOpen(expanded ? null : course.id)}
                            className="rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          >
                            {course.name}
                          </button>
                        </td>
                        <td
                          className={`text-muted-foreground py-2 pr-4 text-sm ${NUMERALS}`}
                        >
                          {course.period || <span className={ABSENT}>—</span>}
                        </td>
                        <td
                          className={`py-2 pr-6 text-right text-sm ${NUMERALS}`}
                        >
                          {course.ects}
                        </td>
                        <td className="text-muted-foreground py-2 pr-4 text-sm capitalize">
                          {course.programmeRequirement || (
                            <span className={ABSENT}>—</span>
                          )}
                        </td>
                        <td className="py-2">
                          <StatusCell course={course} />
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b">
                          <td colSpan={6} className="p-0">
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
        </section>
      ))}
    </div>
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
    <section className="flex flex-col gap-1">
      <SectionHead
        title="Programme record"
        note="These facts are private to your account and describe your own cohort, not the shared course catalogue."
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
                className={`flex min-h-11 items-center justify-between gap-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${expanded ? "" : "hover:bg-card"}`}
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
    <section className="flex flex-col gap-1">
      <SectionHead
        title="Personal academic events"
        note="Dates saved here also appear in the unified Calendar."
        meter={events.length ? `${events.length} recorded` : undefined}
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
                  className={`grid min-h-11 grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${expanded ? "" : "hover:bg-card"}`}
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
        <p className="text-muted-foreground py-3 text-[13.5px]">
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
  commit,
  busy,
}: {
  workspace: Workspace;
  open: string | null;
  onOpen: (id: string | null) => void;
  commit: Commit;
  busy: boolean;
}) {
  const gates = workspace.gates ?? [];
  return (
    <section className="flex flex-col gap-1">
      <SectionHead
        title="Credit and progression requirements"
        note="Targets you must clear in your own programme. They are yours, not the shared catalogue's."
      />
      {gates.length ? (
        <ul className="flex flex-col">
          {gates.map((gate: Gate) => {
            const expanded = open === gate.id;
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
                  className={`flex min-h-11 items-center justify-between gap-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${expanded ? "" : "hover:bg-card"}`}
                >
                  <span className="text-[15px] font-medium">{gate.label}</span>
                  <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
                    {gate.target} ECTS
                  </span>
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
        <p className="text-muted-foreground py-3 text-[13.5px]">
          No requirements recorded. Add one from the page header — a propedeuse
          or a year target — and the planner will route towards it.
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
  ["progress", "Progress"],
  ["planner", "Planner"],
  ["settings", "Settings"],
];

/** Which composer each tab offers from the page header. */
const HEADER_ACTION: Record<string, string> = {
  overview: "Add event",
  courses: "Add course",
  progress: "Add requirement",
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

  const read = useCallback(async () => {
    const response = await fetch("/api/academics", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Your record returned ${response.status}`);
    const data = (await response.json()) as { workspace: Workspace };
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
  const earned = earnedEcts(courses);
  const planned = plannedEcts(courses);
  const gpa = weightedGpa(courses);
  const passed = courses.filter(
    (course) => courseStatus(course) === "passed",
  ).length;

  // A deep link opens the record it names, once. Re-running on every save
  // would drag the student back to the row they had moved on from.
  useEffect(() => {
    if (!workspace || !focus || focused.current) return;
    focused.current = true;
    if (workspace.events?.some((item) => item.id === focus)) setTab("overview");
    else if (workspace.gates?.some((item) => item.id === focus))
      setTab("progress");
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
    read()
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
          {workspace && (
            <span className={`text-muted-foreground text-sm ${NUMERALS}`}>
              {earned} / {planned} ECTS
            </span>
          )}
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
        <TabsList
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

        <TabsContent value="overview" className="flex flex-col gap-8">
          {workspace ? (
            <>
              <ViewIntro
                eyebrow="Academic overview"
                title="The degree at a glance"
                description="Read the recorded position first, then move into the exam plan, programme facts, or dates that need a decision."
                action={<Button size="sm" onClick={() => { setTab("planner"); history.replaceState(null, "", "/app/planning?tab=planner"); }}>Open exam planner</Button>}
              />
              {composer === "overview" && (
                <EventComposer
                  commit={commit}
                  busy={saving}
                  onClose={() => setComposer(null)}
                />
              )}
              <Strip
                cells={[
                  {
                    label: "Credits earned",
                    value: earned,
                    unit: `/ ${planned}`,
                    detail: "From your own passed attempts",
                  },
                  {
                    label: "Courses passed",
                    value: passed,
                    unit: `/ ${courses.length}`,
                  },
                  { label: "Weighted GPA", value: gpa ?? "—" },
                  {
                    label: "Study year",
                    value:
                      workspace.programmeTemplate?.currentStudyYear || "—",
                  },
                ]}
              />
              <FactsRegister
                workspace={workspace}
                open={editing}
                onOpen={setEditing}
                commit={commit}
                busy={saving}
              />
              <EventsRegister
                workspace={workspace}
                open={editing}
                onOpen={setEditing}
                commit={commit}
                busy={saving}
              />
            </>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </TabsContent>

        <TabsContent value="courses" className="flex flex-col gap-6">
          {workspace ? (
            <>
              <ViewIntro
                eyebrow="Curriculum"
                title="Courses and electives"
                description="Review every course by study year. Requirement labels distinguish core, choice, and elective space without mixing exam planning into the curriculum record."
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
                open={editing}
                onOpen={setEditing}
                commit={commit}
                busy={saving}
              />
            </>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </TabsContent>

        <TabsContent value="progress" className="flex flex-col gap-8">
          {workspace ? (
            <>
              <ViewIntro
                eyebrow="Progress"
                title="What is complete, safe, and still exposed"
                description="Recorded results stay separate from the assumptions in your current exam plan. Requirements below remain grounded in the programme record."
              />
              {composer === "progress" && (
                <GateComposer
                  commit={commit}
                  busy={saving}
                  onClose={() => setComposer(null)}
                />
              )}
              <RequirementsRegister
                workspace={workspace}
                open={editing}
                onOpen={setEditing}
                commit={commit}
                busy={saving}
              />
              <section className="flex flex-col gap-1">
                <SectionHead
                  title="Credits by study year"
                  meter={`${earned} / ${planned} ECTS overall`}
                />
                <ul className="flex flex-col">
                  {byYear(courses).map((year) => {
                    const yearEarned = earnedEcts(year.courses);
                    return (
                      <li
                        key={year.level}
                        className="flex flex-col gap-2 border-b py-3"
                      >
                        <div className="flex items-baseline justify-between gap-4">
                          <h3 className="text-sm font-semibold">
                            {year.level}
                          </h3>
                          <span
                            className={`text-muted-foreground text-sm ${NUMERALS}`}
                          >
                            {yearEarned} / {year.ects} ECTS
                          </span>
                        </div>
                        <Progress
                          value={
                            year.ects ? (yearEarned / year.ects) * 100 : 0
                          }
                          className="h-1.5"
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          ) : (
            <Skeleton className="h-32 w-full" />
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
