"use client";

/**
 * THESIS: Courses is the whole degree in motion, not a shelf of disconnected cards.
 * OWN-WORLD: The warm study desk, ruled registers, indigo signals and one dark
 * working plane continue the dashboard language without copying its itinerary.
 * STORY: See the degree runway, work the active-course register, then inspect
 * exam order, source coverage and the groups that narrow the register.
 * FIRST VIEWPORT: Programme position, current period and current courses are
 * visible without scrolling on a typical laptop.
 * FORM: Degree Runway x Active Desk, fused from options 1 and 2; seed 9c3a16b0.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 * finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArchiveIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  Clock3Icon,
  Layers3Icon,
  SearchIcon,
  SlidersHorizontalIcon,
  XCircleIcon,
} from "lucide-react";
import { CanvasMark } from "@/components/brand/canvas-mark";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { OnboardingResume } from "@/components/workspace/onboarding-resume";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AcademicCourse,
  type StudyCourse,
  courseProgress,
  readChapters,
} from "@/lib/workspace/courses.mjs";
import {
  type Catalogue,
  type CorpusCourse,
  type LedgerCourse,
  type ProgrammeTemplate,
  courseLedger,
  courseMaterialCoverage,
  currentCodeSet,
  currentSourceCoverage,
  degreeRunwayYears,
  filterLedger,
  ledgerStatus,
  periodLabel,
  rowDestination,
  sortLedger,
} from "@/lib/workspace/course-ledger.mjs";
import { localIsoDate } from "@/lib/workspace/home.mjs";

const NUMERALS = "font-data tabular-nums";
const DESIGN_CONTRACT = "courses-degree-runway-9c3a16b0";
const COURSE_RAIL_STORAGE_KEY = "wicker:courses-context-width-v1";
const COURSE_RAIL_DEFAULT = 288;
const COURSE_RAIL_MIN = 256;
const COURSE_RAIL_MAX = 400;
const COURSE_DESK_MIN = 660;
const COURSE_SPLITTER_WIDTH = 20;
type CurrentCourse = {
  code: string;
  name?: string;
  courseId?: string | null;
  reasons?: string[];
  outsidePlan?: boolean;
};
type SourcePhase = "loading" | "ready" | "error";
type CourseSource = "academics" | "canvas" | "catalogue" | "calendar";
type ExamFact = {
  code: string;
  name: string;
  date: string;
  days: number;
  type: string | null;
};

const SORTS: [string, string][] = [
  ["period", "Period / next exam"],
  ["year", "Study year"],
  ["code", "Course code"],
  ["name", "Course name"],
];

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
    new Date(`${date}T00:00:00`),
  );
const yearNumber = (value: string | null | undefined) =>
  Number(String(value || "").match(/\d+/)?.[0] || 0);
const combinedPhase = (...phases: SourcePhase[]): SourcePhase =>
  phases.includes("error")
    ? "error"
    : phases.every((phase) => phase === "ready")
      ? "ready"
      : "loading";

function examFacts(
  academic: AcademicCourse[],
  ledger: LedgerCourse[],
  today: string,
): ExamFact[] {
  const names = new Map(
    ledger.map((entry) => [entry.code.toUpperCase(), entry.name]),
  );
  return academic
    .flatMap((course) => {
      const attempts = (course.attempts || [])
        .filter(
          (attempt) =>
            attempt.examDate && attempt.examDate.slice(0, 10) >= today,
        )
        .sort((left, right) =>
          String(left.examDate).localeCompare(String(right.examDate)),
        );
      if (!attempts.length) return [];
      const date = String(attempts[0].examDate).slice(0, 10);
      const days = Math.round(
        (new Date(`${date}T00:00:00Z`).getTime() -
          new Date(`${today}T00:00:00Z`).getTime()) /
          86_400_000,
      );
      return [
        {
          code: course.code,
          name:
            names.get(course.code.toUpperCase()) || course.name || course.code,
          date,
          days,
          type: attempts[0].type || null,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.code.localeCompare(right.code),
    );
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<StudyCourse[] | null>(null);
  const [academic, setAcademic] = useState<AcademicCourse[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [corpus, setCorpus] = useState<CorpusCourse[]>([]);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [programmeTemplate, setProgrammeTemplate] =
    useState<ProgrammeTemplate>(null);
  const [currentPeriod, setCurrentPeriod] = useState<string | null>(null);
  const [currentCourses, setCurrentCourses] = useState<CurrentCourse[]>([]);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("current");
  const [sort, setSort] = useState("period");
  const [source, setSource] = useState("all");
  const [studyYear, setStudyYear] = useState("all");
  const [railWidth, setRailWidth] = useState(COURSE_RAIL_DEFAULT);
  const [railLimit, setRailLimit] = useState(COURSE_RAIL_MAX);
  const [canSplitRail, setCanSplitRail] = useState(false);
  const [resizingRail, setResizingRail] = useState(false);
  const [sourcePhase, setSourcePhase] = useState<
    Record<CourseSource, SourcePhase>
  >({
    academics: "loading",
    canvas: "loading",
    catalogue: "loading",
    calendar: "loading",
  });
  const [error, setError] = useState<string | null>(null);
  const splitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    const settle = (source: CourseSource, phase: SourcePhase) => {
      if (live) setSourcePhase((current) => ({ ...current, [source]: phase }));
    };
    setRead(
      readChapters(typeof window === "undefined" ? null : window.localStorage),
    );
    const json = (path: string) =>
      fetch(path, { headers: { accept: "application/json" } }).then(
        (response) =>
          response.ok
            ? response.json()
            : Promise.reject(new Error(`${path} returned ${response.status}`)),
      );
    json("/api/state")
      .then((data) => {
        if (live) setCourses(data.courses ?? []);
      })
      .catch((cause: Error) => {
        if (live) setError(cause.message);
      });
    json("/api/academics")
      .then((data) => {
        if (live) {
          setAcademic(data.workspace?.courses ?? []);
          setProgrammeTemplate(data.workspace?.programmeTemplate ?? null);
          settle("academics", "ready");
        }
      })
      .catch(() => settle("academics", "error"));
    json("/api/account/integrations/canvas/corpus")
      .then((data) => {
        if (live) {
          setCorpus(data.status?.courses ?? []);
          settle("canvas", "ready");
        }
      })
      .catch(() => settle("canvas", "error"));
    json("/api/onboarding/programmes")
      .then((data) => {
        if (live) {
          setCatalogue(data);
          settle("catalogue", "ready");
        }
      })
      .catch(() => settle("catalogue", "error"));
    json("/api/calendar/events")
      .then((data) => {
        if (live) {
          setCurrentPeriod(data.academicContext?.period ?? null);
          setCurrentCourses(data.currentCourses ?? []);
          settle("calendar", "ready");
        }
      })
      .catch(() => settle("calendar", "error"));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!courses || !splitRef.current) return;
    const available = splitRef.current.getBoundingClientRect().width;
    const splitFits =
      available >= COURSE_DESK_MIN + COURSE_SPLITTER_WIDTH + COURSE_RAIL_MIN;
    setCanSplitRail(splitFits);
    if (!splitFits) return;
    const maximum = Math.min(
      COURSE_RAIL_MAX,
      available - COURSE_DESK_MIN - COURSE_SPLITTER_WIDTH,
    );
    setRailLimit(maximum);
    try {
      const storedValue = window.localStorage.getItem(COURSE_RAIL_STORAGE_KEY);
      const stored = storedValue == null ? Number.NaN : Number(storedValue);
      if (Number.isFinite(stored))
        setRailWidth(Math.max(COURSE_RAIL_MIN, Math.min(maximum, stored)));
    } catch {
      // A refused preference must not cost the student the course register.
    }
  }, [courses]);

  useEffect(() => {
    const container = splitRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const available = container.getBoundingClientRect().width;
      const splitFits =
        available >= COURSE_DESK_MIN + COURSE_SPLITTER_WIDTH + COURSE_RAIL_MIN;
      setCanSplitRail(splitFits);
      if (!splitFits) return;
      const maximum = Math.min(
        COURSE_RAIL_MAX,
        available - COURSE_DESK_MIN - COURSE_SPLITTER_WIDTH,
      );
      setRailLimit(maximum);
      setRailWidth((current) => Math.min(current, maximum));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [courses]);

  const today = localIsoDate();
  const currentLabel =
    sourcePhase.calendar === "ready" && currentPeriod
      ? `Current · ${currentPeriod}`
      : "Current courses";
  const scopes: [string, string][] = [
    ["current", currentLabel],
    ["future", "Not yet recorded"],
    ["passed", "Passed"],
    ["failed", "Failed / retake"],
    ["all", "All courses"],
    ["archived", "Archived"],
  ];
  const ledger = useMemo(
    () =>
      courseLedger({
        editorial: courses,
        academic,
        corpus,
        catalogue,
        programmeTemplate,
        currentCourses,
        today,
      }),
    [
      courses,
      academic,
      corpus,
      catalogue,
      programmeTemplate,
      currentCourses,
      today,
    ],
  );
  const currentCodes = useMemo(
    () =>
      sourcePhase.calendar === "ready"
        ? currentCodeSet(currentCourses)
        : new Set<string>(),
    [currentCourses, sourcePhase.calendar],
  );
  const studyYears = useMemo(
    () =>
      [
        ...new Set(
          ledger
            .map((entry) => entry.academic?.yearLevel)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(
        (left, right) =>
          yearNumber(left) - yearNumber(right) || left.localeCompare(right),
      ),
    [ledger],
  );
  const visible = useMemo(() => {
    if (
      (["current", "future"].includes(scope) &&
        sourcePhase.calendar !== "ready") ||
      (["future", "passed", "failed"].includes(scope) &&
        sourcePhase.academics !== "ready") ||
      (source === "canvas" && sourcePhase.canvas !== "ready") ||
      (source === "record" && sourcePhase.academics !== "ready") ||
      (studyYear !== "all" &&
        combinedPhase(sourcePhase.academics, sourcePhase.catalogue) !== "ready")
    )
      return [];
    const scoped = filterLedger(ledger, {
      query,
      scope,
      currentCourses,
    }).filter((entry) => {
      if (source === "library" && !entry.editorial) return false;
      if (source === "canvas" && !entry.corpus) return false;
      if (source === "record" && !entry.academic) return false;
      if (studyYear !== "all" && entry.academic?.yearLevel !== studyYear)
        return false;
      return true;
    });
    return sortLedger(scoped, { sort, academic, today });
  }, [
    ledger,
    query,
    scope,
    sort,
    source,
    studyYear,
    academic,
    today,
    currentCourses,
    sourcePhase,
  ]);
  const exams = useMemo(
    () => examFacts(academic, ledger, today),
    [academic, ledger, today],
  );
  const programme =
    catalogue?.programmes?.find(
      (entry) => entry.id === programmeTemplate?.programmeId,
    ) || null;
  const runwayPhase = combinedPhase(
    sourcePhase.academics,
    sourcePhase.catalogue,
  );
  const programmeName =
    runwayPhase === "loading"
      ? "Reading your programme…"
      : runwayPhase === "error"
        ? "Programme source unavailable"
        : programme
          ? [programme.degree, programme.name].filter(Boolean).join(" ")
          : "Your programme";
  const programmeVersion =
    programme?.versions?.find(
      (entry) => entry.id === programmeTemplate?.versionId,
    ) ||
    programme?.versions?.[0] ||
    null;
  const years = useMemo(() => {
    return degreeRunwayYears({
      programme,
      version: programmeVersion,
      programmeTemplate,
      academic,
      currentCodes,
    });
  }, [programme, programmeVersion, currentCodes, programmeTemplate, academic]);
  const counts = useMemo(() => {
    const facts: Record<string, number | null> = Object.fromEntries(
      scopes.map(([value]) => [
        value,
        filterLedger(ledger, { scope: value, currentCourses }).length,
      ]),
    );
    if (sourcePhase.calendar !== "ready") {
      facts.current = null;
      facts.future = null;
    }
    if (sourcePhase.academics !== "ready") {
      facts.future = null;
      facts.passed = null;
      facts.failed = null;
    }
    return facts;
  }, [ledger, currentCourses, scopes, sourcePhase]);
  const coverageFacts = useMemo(
    () => currentSourceCoverage({ ledger, currentCourses, academic }),
    [ledger, currentCourses, academic],
  );
  const coverageMeta = {
    record: {
      icon: BookOpenIcon,
      label: "Study record",
      detail: "Enrolment and attempts",
    },
    canvas: {
      icon: CanvasMark,
      label: "Canvas",
      detail: "Institution course material",
      brand: true,
    },
    library: {
      icon: Layers3Icon,
      label: "Maintained library",
      detail: "Approved study material",
    },
  };
  const coverage = coverageFacts.map((entry) => {
    const ownPhase =
      entry.id === "record"
        ? sourcePhase.academics
        : entry.id === "canvas"
          ? sourcePhase.canvas
          : "ready";
    const phase = combinedPhase(sourcePhase.calendar, ownPhase);
    return {
      ...entry,
      ...coverageMeta[entry.id],
      phase,
      percent: phase === "ready" ? entry.percent : null,
      detail:
        phase === "loading"
          ? "Checking source coverage…"
          : phase === "error"
            ? "Source unavailable"
            : coverageMeta[entry.id].detail,
    };
  });
  const currentYear = years.find((year) => year.current);
  const narrowed =
    scope !== "all" ||
    source !== "all" ||
    studyYear !== "all" ||
    Boolean(query.trim());
  const scopeName =
    scopes.find(([value]) => value === scope)?.[1] ?? "All courses";
  const registerPhase =
    ["current", "future"].includes(scope) && sourcePhase.calendar !== "ready"
      ? sourcePhase.calendar
      : ["future", "passed", "failed"].includes(scope) &&
          sourcePhase.academics !== "ready"
        ? sourcePhase.academics
        : source === "canvas" && sourcePhase.canvas !== "ready"
          ? sourcePhase.canvas
          : source === "record" && sourcePhase.academics !== "ready"
            ? sourcePhase.academics
            : "ready";
  const sourcesPending = Object.values(sourcePhase).includes("loading");
  const sourcesUnavailable = Object.values(sourcePhase).includes("error");

  const commitRailWidth = (next: number) => {
    const width = Math.round(
      Math.max(COURSE_RAIL_MIN, Math.min(railLimit, next)),
    );
    setRailWidth(width);
    try {
      window.localStorage.setItem(COURSE_RAIL_STORAGE_KEY, String(width));
    } catch {
      // Resizing remains useful even when the browser refuses persistence.
    }
  };

  const beginRailResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!splitRef.current || !canSplitRail) return;
    event.currentTarget.focus();
    event.preventDefault();
    let latest = railWidth;
    const previousCursor = document.body.style.cursor;
    const previousSelection = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setResizingRail(true);

    const move = (pointerEvent: PointerEvent) => {
      const rect = splitRef.current?.getBoundingClientRect();
      if (!rect) return;
      const maximum = Math.min(
        COURSE_RAIL_MAX,
        rect.width - COURSE_DESK_MIN - COURSE_SPLITTER_WIDTH,
      );
      setRailLimit(maximum);
      latest = Math.round(
        Math.max(
          COURSE_RAIL_MIN,
          Math.min(maximum, rect.right - pointerEvent.clientX),
        ),
      );
      setRailWidth(latest);
    };
    const finish = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelection;
      try {
        window.localStorage.setItem(COURSE_RAIL_STORAGE_KEY, String(latest));
      } catch {
        // Keep the in-memory size for this visit.
      }
      setResizingRail(false);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
  };

  const resizeRailByKeyboard = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") commitRailWidth(COURSE_RAIL_MIN);
    else if (event.key === "End") commitRailWidth(railLimit);
    else commitRailWidth(railWidth + (event.key === "ArrowLeft" ? 16 : -16));
  };

  if (error)
    return (
      <div className="mx-auto w-full max-w-[1280px] p-5 sm:p-8">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Courses could not be read</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );

  const row = (entry: LedgerCourse) => {
    const course = entry.editorial;
    const progress = course ? courseProgress(course, read) : null;
    const measuredMaterial = courseMaterialCoverage(entry);
    const material =
      sourcePhase.canvas === "ready"
        ? measuredMaterial
        : {
            ...measuredMaterial,
            percent: null,
            detail:
              sourcePhase.canvas === "loading"
                ? "Checking material…"
                : "Canvas unavailable",
          };
    const exam =
      exams.find(
        (fact) => fact.code.toUpperCase() === entry.code.toUpperCase(),
      ) || null;
    const target = rowDestination(entry);
    const status = ledgerStatus(entry, currentCodes);
    const action =
      target.kind === "study"
        ? "Open course"
        : target.kind === "canvas"
          ? "Open Canvas"
          : target.kind === "calendar"
            ? "Open calendar"
            : "Request material";
    return (
      <li key={entry.key}>
        <Link
          href={target.href}
          aria-label={`${entry.code} ${entry.name}: ${action}`}
          className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b px-5 py-5 transition-colors last:border-b-0 hover:bg-muted/55 lg:grid-cols-[minmax(12rem,1fr)_6.5rem_7rem_6.5rem_7.5rem] lg:px-6"
        >
          <span className="min-w-0">
            <strong
              className={`text-primary block text-sm font-semibold tracking-[0.04em] ${NUMERALS}`}
            >
              {entry.code}
            </strong>
            <strong className="mt-1 block text-sm leading-snug font-semibold tracking-[-0.01em]">
              {entry.name}
            </strong>
            <span className="mt-2 flex flex-wrap items-center gap-2">
              {status.current && (
                <span className="bg-primary/10 text-primary rounded-[6px] px-2 py-0.5 text-xs font-semibold">
                  Current
                </span>
              )}
              <small className="text-muted-foreground text-xs lg:hidden">
                {periodLabel(entry.academic?.period || entry.corpus?.period) ||
                  "Unplaced"}{" "}
                · {material.detail}
              </small>
            </span>
          </span>

          <span className="hidden flex-col gap-2 lg:flex">
            <strong className={`text-sm font-semibold ${NUMERALS}`}>
              {progress?.total
                ? `${progress.done} of ${progress.total}`
                : "No chapters"}
            </strong>
            <CoverageBar percent={progress?.total ? progress.percent : null} />
            {progress?.total ? (
              <small className={`text-muted-foreground text-xs ${NUMERALS}`}>
                {progress.percent}% read
              </small>
            ) : null}
          </span>

          <span className="hidden flex-col gap-2 lg:flex">
            <strong className={`text-sm font-semibold ${NUMERALS}`}>
              {material.percent == null ? "—" : `${material.percent}%`}
            </strong>
            <CoverageBar percent={material.percent} />
            <small className="text-muted-foreground text-xs">
              {material.detail}
            </small>
          </span>

          <span className="hidden flex-col gap-0.5 lg:flex">
            {sourcePhase.academics === "loading" ? (
              <>
                <span className="text-sm font-medium">Checking…</span>
                <small className="text-muted-foreground text-xs">
                  Reading exam record
                </small>
              </>
            ) : sourcePhase.academics === "error" ? (
              <>
                <span className="text-sm font-medium">Unavailable</span>
                <small className="text-muted-foreground text-xs">
                  Exam record could not be read
                </small>
              </>
            ) : exam ? (
              <>
                <span className={`text-sm font-semibold ${NUMERALS}`}>
                  {dateLabel(exam.date)}
                </span>
                <small className="text-muted-foreground text-xs">
                  {periodLabel(
                    entry.academic?.period || entry.corpus?.period,
                  ) ||
                    exam.type ||
                    "Scheduled"}
                </small>
                <small className={`text-muted-foreground text-xs ${NUMERALS}`}>
                  {exam.days} days
                </small>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">No date</span>
                <small className="text-muted-foreground text-xs">
                  {periodLabel(
                    entry.academic?.period || entry.corpus?.period,
                  ) || "Unplaced"}
                </small>
              </>
            )}
          </span>

          <span className="text-primary flex items-center justify-end gap-1.5 text-right text-xs font-semibold">
            <span>{action}</span>
            <ChevronRightIcon className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </li>
    );
  };

  return (
    <main data-impeccable-contract={DESIGN_CONTRACT} className="w-full">
      <header data-tour="courses" className="bg-background border-b">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-1 px-4 py-5 sm:px-6 sm:flex-row sm:items-end sm:justify-between lg:px-8 lg:py-7">
          <div>
            <h1 className="font-heading text-[2rem] leading-none font-semibold tracking-[-0.035em]">
              Courses
            </h1>
            <p className="text-muted-foreground mt-2 max-w-[68ch] text-sm">
              Your active work and the degree it belongs to, reconciled across
              your programme, record, Canvas and maintained course material.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-5 sm:mt-0">
            <Link
              href="/app/planning?tab=courses#electives"
              className="text-primary inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Update electives <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              href="/app/planning"
              className="text-primary inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Open study plan <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {!courses || (!ledger.length && sourcesPending) ? (
          <LoadingDesk />
        ) : !ledger.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {sourcesUnavailable ? "No known courses" : "No courses yet"}
              </EmptyTitle>
              <EmptyDescription>
                {sourcesUnavailable
                  ? "One or more course sources could not be read. Reconnect them in setup or try again."
                  : "Finish setup to connect your programme and choose the courses you are taking."}
              </EmptyDescription>
            </EmptyHeader>
            <OnboardingResume />
          </Empty>
        ) : (
          <>
            <section
              className="bg-foreground text-card overflow-hidden rounded-xl shadow-[var(--shadow-sheet)]"
              aria-labelledby="degree-runway-title"
            >
              <div className="flex flex-col gap-5 border-b border-white/15 px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8">
                <div>
                  <h2
                    id="degree-runway-title"
                    className="font-heading text-[clamp(1.65rem,3vw,2.3rem)] leading-[1.05] font-semibold tracking-[-0.03em]"
                  >
                    Degree runway
                  </h2>
                  <p className="mt-1 text-sm text-white/68">
                    {programmeName}
                    {runwayPhase === "ready" && programmeVersion?.label
                      ? ` · ${programmeVersion.label}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-7 text-sm sm:text-right">
                  {runwayPhase === "ready" && programme?.totalEcts ? (
                    <RunwayFact
                      label="Degree"
                      value={`${programme.totalEcts} ECTS`}
                    />
                  ) : null}
                  <RunwayFact
                    label="Position"
                    value={
                      combinedPhase(
                        sourcePhase.academics,
                        sourcePhase.calendar,
                      ) === "loading"
                        ? "Checking…"
                        : combinedPhase(
                              sourcePhase.academics,
                              sourcePhase.calendar,
                            ) === "error"
                          ? "Unavailable"
                          : [programmeTemplate?.currentStudyYear, currentPeriod]
                              .filter(Boolean)
                              .join(" · ") || "Not set"
                    }
                  />
                </div>
              </div>
              {runwayPhase === "loading" ? (
                <div className="px-6 py-6 text-sm text-white/68 sm:px-8">
                  Reading programme years and course placement…
                </div>
              ) : runwayPhase === "error" ? (
                <div className="px-6 py-6 text-sm text-white/68 sm:px-8">
                  Programme placement is unavailable. The course register
                  remains usable.
                </div>
              ) : years.length ? (
                <div
                  className="grid divide-y divide-white/15 sm:grid-cols-[repeat(var(--year-count),minmax(0,1fr))] sm:divide-x sm:divide-y-0"
                  style={
                    { "--year-count": years.length } as React.CSSProperties
                  }
                >
                  {years.map((year) => {
                    const earnedPercent = year.targetEcts
                      ? Math.min(100, Math.round((year.earnedEcts / year.targetEcts) * 100))
                      : 0;
                    const mappedPercent = year.targetEcts
                      ? Math.min(100, Math.round((year.mappedEcts / year.targetEcts) * 100))
                      : 0;
                    return (
                      <div
                        key={year.label}
                        className={`relative px-6 py-5 sm:px-8 ${year.current ? "bg-white/[0.07]" : ""}`}
                      >
                        {year.current && (
                          <span className="bg-primary absolute inset-x-0 top-0 h-1" />
                        )}
                        <div className="flex items-baseline justify-between gap-4">
                          <h3 className="text-base font-semibold">
                            {year.label}
                          </h3>
                          <span className={`text-xs text-white/58 ${NUMERALS}`}>
                            {year.earnedEcts}/{year.targetEcts} ECTS earned
                          </span>
                        </div>
                        <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/12">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-white/24"
                            style={{ width: `${mappedPercent}%` }}
                          />
                          <div
                            className="bg-primary absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${earnedPercent}%` }}
                          />
                        </div>
                        <p className="mt-3 min-h-5 text-xs text-white/62">
                          {year.openChoiceEcts
                            ? `${year.mappedEcts} ECTS mapped · ${year.openChoiceEcts} ECTS still to choose`
                            : year.overplannedEcts
                              ? `${year.mappedEcts} ECTS mapped · ${year.overplannedEcts} above the year target`
                              : year.current && year.running
                                ? `${year.running} ${year.running === 1 ? "course" : "courses"} active${currentPeriod ? ` in ${currentPeriod}` : ""} · full ${year.targetEcts} ECTS mapped`
                                : `Full ${year.targetEcts} ECTS mapped`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-6 py-6 text-sm text-white/68 sm:px-8">
                  Connect a maintained programme to build the full degree
                  runway.
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-white/15 px-6 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <p className="text-white/66">
                  {runwayPhase === "loading"
                    ? "Checking degree progress…"
                    : runwayPhase === "error"
                      ? "Degree progress could not be read."
                      : currentYear
                        ? currentYear.openChoiceEcts
                          ? `${currentYear.openChoiceEcts} ECTS of ${currentYear.label} still need an elective choice.`
                          : `${Math.max(0, currentYear.targetEcts - currentYear.earnedEcts)} ECTS remain to be earned in ${currentYear.label}.`
                        : "Set your study year to mark your position."}
                </p>
                {sourcePhase.academics === "loading" ? (
                  <p className="text-white/66">Checking exam record…</p>
                ) : sourcePhase.academics === "error" ? (
                  <p className="text-white/66">Exam record unavailable.</p>
                ) : exams[0] ? (
                  <p className={`font-semibold ${NUMERALS}`}>
                    Next exam · {exams[0].code} · {dateLabel(exams[0].date)} ·{" "}
                    {exams[0].days}d
                  </p>
                ) : (
                  <p className="text-white/66">
                    No future exam date is recorded.
                  </p>
                )}
              </div>
            </section>

            <div
              ref={splitRef}
              className={`grid items-start gap-5 ${canSplitRail ? "xl:grid-cols-[minmax(0,1fr)_1.25rem_var(--courses-context-width)] xl:gap-0" : ""}`}
              style={
                {
                  "--courses-context-width": `${railWidth}px`,
                } as React.CSSProperties
              }
            >
              <section
                className="bg-card overflow-hidden rounded-xl border"
                aria-labelledby="course-register-title"
              >
                <div className="flex flex-col gap-4 border-b px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2
                      id="course-register-title"
                      className="text-lg font-semibold tracking-tight"
                    >
                      {scope === "current" ? "Current courses" : scopeName}
                    </h2>
                    <p
                      className="text-muted-foreground mt-1 text-sm"
                      aria-live="polite"
                    >
                      {registerPhase === "loading"
                        ? "Checking the sources for this view…"
                        : registerPhase === "error"
                          ? "The source for this view is unavailable"
                          : `${visible.length} ${visible.length === 1 ? "course" : "courses"} in this view`}
                    </p>
                  </div>
                  {narrowed && (
                    <button
                      type="button"
                      onClick={() => {
                        setScope("all");
                        setSource("all");
                        setStudyYear("all");
                        setQuery("");
                      }}
                      className="text-primary self-start text-sm font-semibold underline decoration-primary/35 underline-offset-4 lg:self-auto"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="grid gap-3 border-b bg-muted/35 px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(10rem,1fr)_7.75rem_7.75rem_7.5rem_2.5rem]">
                  <label className="relative sm:col-span-2 lg:col-span-1">
                    <span className="sr-only">Search courses</span>
                    <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search courses"
                      className="bg-card pl-9"
                    />
                  </label>
                  <Select
                    items={scopes.map(([value, label]) => ({ value, label }))}
                    value={scope}
                    onValueChange={(value) => setScope(String(value))}
                  >
                    <SelectTrigger
                      className="bg-card w-full"
                      aria-label="Filter by status"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {scopes.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select
                    items={[
                      { value: "all", label: "All sources" },
                      { value: "record", label: "Study record" },
                      { value: "canvas", label: "Canvas" },
                      { value: "library", label: "Study library" },
                    ]}
                    value={source}
                    onValueChange={(value) => setSource(String(value))}
                  >
                    <SelectTrigger
                      className="bg-card w-full"
                      aria-label="Filter by source"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All sources</SelectItem>
                        <SelectItem value="record">Study record</SelectItem>
                        <SelectItem value="canvas">Canvas</SelectItem>
                        <SelectItem value="library">Study library</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select
                    items={[
                      { value: "all", label: "All years" },
                      ...studyYears.map((year) => ({
                        value: year,
                        label: year,
                      })),
                    ]}
                    value={studyYear}
                    onValueChange={(value) => setStudyYear(String(value))}
                  >
                    <SelectTrigger
                      className="bg-card w-full"
                      aria-label="Filter by study year"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">All years</SelectItem>
                        {studyYears.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() =>
                      setSort(
                        SORTS[
                          (SORTS.findIndex(([value]) => value === sort) + 1) %
                            SORTS.length
                        ][0],
                      )
                    }
                    aria-label={`Change sort. Currently ${SORTS.find(([value]) => value === sort)?.[1]}`}
                    title={`Sort: ${SORTS.find(([value]) => value === sort)?.[1]}`}
                    className="bg-card hover:bg-muted flex size-10 items-center justify-center rounded-[6px] border transition-colors"
                  >
                    <SlidersHorizontalIcon className="text-muted-foreground size-4" />
                  </button>
                </div>
                <div className="text-muted-foreground hidden grid-cols-[minmax(12rem,1fr)_6.5rem_7rem_6.5rem_7.5rem] gap-x-4 border-b px-6 py-2.5 text-xs font-semibold tracking-[0.11em] uppercase lg:grid">
                  <span>Course</span>
                  <span>Chapters read</span>
                  <span>Material coverage</span>
                  <span>Next exam</span>
                  <span>Action</span>
                </div>
                {visible.length ? (
                  <ul>{visible.map(row)}</ul>
                ) : registerPhase !== "ready" ? (
                  <Empty className="min-h-64">
                    <EmptyHeader>
                      <EmptyTitle>
                        {registerPhase === "loading"
                          ? "Checking course context"
                          : "Course context unavailable"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {registerPhase === "loading"
                          ? "This view will appear when its sources have been read."
                          : "Choose All courses to keep working with the sources that are available."}
                      </EmptyDescription>
                    </EmptyHeader>
                    {registerPhase === "error" && (
                      <button
                        type="button"
                        onClick={() => {
                          setScope("all");
                          setSource("all");
                          setStudyYear("all");
                        }}
                        className="text-primary text-sm font-semibold underline underline-offset-4"
                      >
                        Show known courses
                      </button>
                    )}
                  </Empty>
                ) : (
                  <Empty className="min-h-64">
                    <EmptyHeader>
                      <EmptyTitle>
                        No courses in {scopeName.toLowerCase()}
                      </EmptyTitle>
                      <EmptyDescription>
                        {query.trim()
                          ? `Nothing matches “${query.trim()}” in this group.`
                          : "Choose another course group to see the rest of the register."}
                      </EmptyDescription>
                    </EmptyHeader>
                    <button
                      type="button"
                      onClick={() => {
                        setScope("all");
                        setSource("all");
                        setStudyYear("all");
                        setQuery("");
                      }}
                      className="text-primary text-sm font-semibold underline underline-offset-4"
                    >
                      Show all {ledger.length} courses
                    </button>
                  </Empty>
                )}
                <div className="text-muted-foreground border-t px-5 py-4 text-xs sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-6">
                  <p>
                    Showing{" "}
                    <span
                      className={`text-foreground font-semibold ${NUMERALS}`}
                    >
                      {visible.length}
                    </span>{" "}
                    of <span className={NUMERALS}>{ledger.length}</span>{" "}
                    {Object.values(sourcePhase).includes("error")
                      ? "known courses"
                      : "courses"}
                  </p>
                  <p className="mt-1 sm:mt-0">
                    {sourcePhase.canvas === "ready"
                      ? "Material coverage = Canvas + maintained library channels available."
                      : sourcePhase.canvas === "loading"
                        ? "Canvas material coverage is being checked."
                        : "Canvas material coverage is unavailable."}
                  </p>
                </div>
              </section>

              {canSplitRail ? (
                <button
                  type="button"
                  role="separator"
                  aria-label="Resize course context panel"
                  aria-orientation="vertical"
                  aria-valuemin={COURSE_RAIL_MIN}
                  aria-valuemax={railLimit}
                  aria-valuenow={railWidth}
                  aria-valuetext={`${railWidth} pixels`}
                  title="Drag to resize the course sidebar. Double-click to reset."
                  onPointerDown={beginRailResize}
                  onKeyDown={resizeRailByKeyboard}
                  onDoubleClick={() => commitRailWidth(COURSE_RAIL_DEFAULT)}
                  className={`group relative hidden min-h-full cursor-col-resize touch-none select-none justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:flex ${resizingRail ? "text-primary" : "text-border"}`}
                >
                  <span
                    className="absolute inset-y-0 left-1/2 w-px bg-current transition-colors group-hover:text-primary/55"
                    aria-hidden="true"
                  />
                  <span
                    className="bg-card text-muted-foreground sticky top-[calc(50vh-24px)] my-32 flex h-12 w-3 items-center justify-center rounded-full border shadow-sm transition-colors group-hover:border-primary/45 group-hover:text-primary"
                    aria-hidden="true"
                  >
                    <span className="h-5 w-px border-x border-current" />
                  </span>
                </button>
              ) : null}

              <aside
                className={`flex min-w-0 flex-col gap-4 ${canSplitRail ? "xl:sticky xl:top-6" : ""}`}
                aria-label="Course context"
              >
                <RailWidget
                  title="Exam order"
                  actionHref="/app/calendar"
                  actionLabel="View all"
                >
                  {sourcePhase.academics === "loading" ? (
                    <p className="text-muted-foreground px-5 py-5 text-sm">
                      Checking exam dates…
                    </p>
                  ) : sourcePhase.academics === "error" ? (
                    <p className="text-muted-foreground px-5 py-5 text-sm">
                      Exam dates are unavailable.
                    </p>
                  ) : exams.length ? (
                    <ol>
                      {exams.slice(0, 3).map((exam, index) => (
                        <li
                          key={`${exam.code}-${exam.date}`}
                          className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b px-5 py-4 last:border-b-0"
                        >
                          <span
                            className={`bg-primary/8 text-primary flex size-10 items-center justify-center rounded-[8px] text-base font-semibold ${NUMERALS}`}
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0">
                            <strong
                              className={`block truncate text-sm font-semibold ${NUMERALS}`}
                            >
                              {exam.code} {exam.name}
                            </strong>
                            <small
                              className={`text-muted-foreground mt-1 block text-xs ${NUMERALS}`}
                            >
                              {dateLabel(exam.date)}
                            </small>
                          </span>
                          <strong className={`text-sm ${NUMERALS}`}>
                            {exam.days}d
                          </strong>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-muted-foreground px-5 py-5 text-sm">
                      No future exam dates are recorded.
                    </p>
                  )}
                </RailWidget>
                <RailWidget
                  title="Source coverage"
                  actionHref="/app/setup"
                  actionLabel="Manage"
                >
                  {coverage.map((entry) => (
                    <CoverageSourceRow key={entry.label} {...entry} />
                  ))}
                </RailWidget>
                <RailWidget title="Course groups">
                  <div className="py-1">
                    {scopes
                      .filter(([value]) => value !== "all")
                      .map(([value, label], index) => (
                        <GroupRow
                          key={value}
                          icon={
                            [
                              BookOpenIcon,
                              Clock3Icon,
                              CheckCircle2Icon,
                              XCircleIcon,
                              ArchiveIcon,
                            ][index]
                          }
                          label={label}
                          count={counts[value] ?? null}
                          active={scope === value}
                          onClick={() => setScope(value)}
                        />
                      ))}
                  </div>
                </RailWidget>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function RunwayFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <small className="text-[10.5px] font-semibold tracking-[0.12em] text-white/48 uppercase">
        {label}
      </small>
      <strong className={`font-semibold ${NUMERALS}`}>{value}</strong>
    </span>
  );
}

function CoverageBar({ percent }: { percent: number | null }) {
  return (
    <span
      className="bg-muted block h-1 w-full overflow-hidden rounded-full"
      aria-hidden="true"
    >
      {percent != null && (
        <span
          className="bg-primary block h-full rounded-full"
          style={{ width: `${percent}%` }}
        />
      )}
    </span>
  );
}

function RailWidget({
  title,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card overflow-hidden rounded-xl border">
      <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {actionHref && (
          <Link
            href={actionHref}
            className="text-primary text-xs font-semibold"
          >
            {actionLabel}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function CoverageSourceRow({
  icon: Icon,
  label,
  detail,
  covered,
  total,
  percent,
  phase,
  brand = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  covered: number;
  total: number;
  percent: number | null;
  phase: SourcePhase;
  brand?: boolean;
}) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 border-b px-5 py-4 last:border-b-0">
      <span className="bg-muted flex size-10 items-center justify-center rounded-[8px]">
        <Icon
          className={
            brand
              ? "size-[18px] text-[#E72429]"
              : "text-muted-foreground size-4"
          }
        />
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline justify-between gap-3">
          <strong className="truncate text-sm font-semibold">{label}</strong>
          <strong className={`text-sm ${NUMERALS}`}>
            {percent == null ? "—" : `${percent}%`}
          </strong>
        </span>
        <span className="mt-1 grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3">
          <small className="text-muted-foreground truncate text-xs">
            {detail}
          </small>
          <CoverageBar percent={percent} />
        </span>
        <span className="sr-only">
          {phase === "ready"
            ? `${covered} of ${total} current courses covered`
            : phase === "loading"
              ? "Coverage is being checked"
              : "Coverage is unavailable"}
        </span>
      </span>
    </div>
  );
}

function GroupRow({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: typeof BookOpenIcon;
  label: string;
  count: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`grid w-full grid-cols-[2rem_minmax(0,1fr)_auto_1rem] items-center gap-3 border-b px-5 py-3 text-left text-sm transition-colors last:border-b-0 ${active ? "bg-primary/8 text-primary font-semibold" : "hover:bg-muted/60"}`}
    >
      <Icon
        className={`size-4 ${active ? "text-primary" : "text-muted-foreground"}`}
      />
      <span>{label}</span>
      <span className={NUMERALS}>{count == null ? "—" : count}</span>
      <ChevronRightIcon className="text-muted-foreground size-4" />
    </button>
  );
}

function LoadingDesk() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading courses">
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-[34rem] w-full rounded-xl" />
        <Skeleton className="h-[30rem] w-full rounded-xl" />
      </div>
    </div>
  );
}
