"use client";

/**
 * Profile: who you are, what your record holds, and what you have done.
 *
 * Two figures on this tab used to describe something other than their label.
 * "Active courses" counted the maintained editorial library — every course
 * published on the server — so a first-year taking three read five, and
 * Account disagreed with Courses, Home and Planning about a number all four
 * call the same thing. The student's own count now comes from the same
 * server-resolved current-course list the rest of the product reads, and the
 * library keeps its own row under its own name.
 *
 * "Programme" had the matching problem in the other direction: it reported
 * membership of an editorial programme and said "Not linked to a programme
 * yet" to a student whose academic record names one. Both facts are shown, in
 * the order they matter.
 */

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useJson } from "@/components/workspace/use-json";
import {
  type AccountSummary,
  type Activity,
  ACTIVITY_LABEL,
  activityBars,
  approximateBytes,
  currentCourseFigure,
  formatCount,
  programmeFacts,
  weekTrend,
} from "@/lib/workspace/account.mjs";
import {
  Failed,
  Figure,
  HostedProfileActions,
  NUMERALS,
  RULE,
  Section,
  relative,
} from "./shared";

type CourseRow = { id: string; archived: boolean };
type SrDue = { totalCards: number; dueCount: number };
type CalendarFeed = {
  currentCourses?: { code?: string }[];
  academicContext?: { period?: string } | null;
};
type AcademicWorkspace = {
  workspace?: { profile?: { programme?: string; university?: string } } | null;
};

export function ProfileTab({
  summary,
  summaryError,
}: {
  summary: AccountSummary | null;
  summaryError: string | null;
}) {
  const activity = useJson<Activity>("/api/activity?days=28");
  const library = useJson<{ courses: CourseRow[] }>("/api/courses");
  const cards = useJson<SrDue>("/api/sr/due");
  const mistakes = useJson<{ length: number } | unknown[]>(
    "/api/mistakes?open=true",
  );
  const calendar = useJson<CalendarFeed>("/api/calendar/events");
  const academics = useJson<AcademicWorkspace>("/api/academics");

  const account = summary?.account;
  const openMistakes = Array.isArray(mistakes.data) ? mistakes.data.length : null;
  const libraryActive = library.data
    ? library.data.courses.filter((course) => !course.archived).length
    : null;
  const libraryArchived = library.data
    ? library.data.courses.filter((course) => course.archived).length
    : null;
  const current = currentCourseFigure(calendar.data);
  const programme = useMemo(
    () => programmeFacts(summary, academics.data?.workspace),
    [summary, academics.data],
  );
  const trend = weekTrend(activity.data);
  const bars = useMemo(
    () => activityBars(activity.data?.series ?? []),
    [activity.data],
  );

  const storedDetail = () => {
    if (!summary) return "Reading…";
    const size = approximateBytes(summary.totals.bytes);
    return [size, `updated ${relative(summary.totals.updatedAt) ?? "never"}`]
      .filter(Boolean)
      .join(" · ");
  };

  const identity: [string, React.ReactNode][] = [
    [
      "Email",
      account?.email ??
        (account?.mode === "local" ? "Local development account" : "—"),
    ],
    [
      "Programme",
      !summary || (!academics.data && !academics.error) ? (
        "…"
      ) : (
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-2">
            {programme.programme ??
              (programme.empty
                ? "Not recorded yet"
                : "All programmes (local development)")}
            {programme.memberships.some((entry) => entry.admin) && (
              <Badge variant="secondary">Programme admin</Badge>
            )}
          </span>
          <small className="text-muted-foreground text-xs">
            {programme.institution
              ? `${programme.institution} · ${programme.membership}`
              : programme.membership}
          </small>
        </span>
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
        <code className={`text-xs ${NUMERALS} [overflow-wrap:anywhere]`}>
          {account.id}
        </code>
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
              className="grid items-baseline gap-x-4 gap-y-1 border-b py-2 max-sm:grid-cols-1 sm:grid-cols-[9rem_minmax(0,1fr)]"
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
          {/* Your courses, from your record — not the size of the library. */}
          <Figure
            label="Current courses"
            value={current ? current.count : "—"}
            detail={
              calendar.error
                ? "Your record is unavailable"
                : (current?.period ?? "From your academic record")
            }
          />
          <Figure
            label="Library courses"
            value={libraryActive ?? "—"}
            detail={
              library.error
                ? "Library unavailable"
                : libraryArchived
                  ? `${libraryArchived} archived`
                  : "Maintained study material"
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
            detail={mistakes.error ? "Mistakes unavailable" : "Scored below 7/10"}
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
            detail={storedDetail()}
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
