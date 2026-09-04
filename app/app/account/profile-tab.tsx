"use client";

import { useMemo } from "react";
import { ActivityIcon, DatabaseIcon, GraduationCapIcon, ShieldCheckIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useJson } from "@/components/workspace/use-json";
import {
  type AccountSummary,
  type Activity,
  ACTIVITY_LABEL,
  approximateBytes,
  currentCourseFigure,
  formatCount,
  programmeFacts,
} from "@/lib/workspace/account.mjs";
import { AccountDataControls } from "./account-data-controls";
import { Failed, HostedProfileActions, NUMERALS, RULE, relative } from "./shared";

type CourseRow = { id: string; archived: boolean };
type SrDue = { totalCards: number; dueCount: number };
type CalendarFeed = { currentCourses?: { code?: string }[]; academicContext?: { period?: string } | null };
type AcademicWorkspace = { workspace?: { profile?: { programme?: string; university?: string } } | null };

function initials(firstName?: string | null, lastName?: string | null, email?: string | null) {
  const letters = [firstName, lastName].filter(Boolean).map((part) => String(part).trim()[0]).join("");
  return (letters || email?.[0] || "S").slice(0, 2).toUpperCase();
}

function Heatmap({ activity }: { activity: Activity }) {
  const peak = Math.max(1, ...activity.series.map((day) => day.total));
  return (
    <div className="grid shrink-0 grid-flow-col grid-rows-7 gap-1" role="img" aria-label={`${activity.activeDays} active days in the last ${activity.days} days`}>
      {activity.series.map((day) => {
        const ratio = day.total / peak;
        const shade = !day.total ? "bg-muted" : ratio > 0.72 ? "bg-primary" : ratio > 0.38 ? "bg-primary/60" : "bg-primary/25";
        return <span key={day.date} title={`${day.date}: ${day.total} action${day.total === 1 ? "" : "s"}`} className={`size-3.5 rounded-[3px] ${shade}`} />;
      })}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return <div className="min-w-0"><p className={RULE}>{label}</p><strong className={`mt-2 block text-2xl font-semibold tracking-tight ${NUMERALS}`}>{value}</strong><p className="text-muted-foreground mt-1 truncate text-xs">{detail}</p></div>;
}

export function ProfileTab({ summary, summaryError, reload }: { summary: AccountSummary | null; summaryError: string | null; reload: () => void }) {
  const activity = useJson<Activity>("/api/activity?days=28");
  const library = useJson<{ courses: CourseRow[] }>("/api/courses");
  const cards = useJson<SrDue>("/api/sr/due");
  const calendar = useJson<CalendarFeed>("/api/calendar/events");
  const academics = useJson<AcademicWorkspace>("/api/academics");

  const account = summary?.account;
  const name = [account?.firstName, account?.lastName].filter(Boolean).join(" ") || "Student";
  const programme = useMemo(() => programmeFacts(summary, academics.data?.workspace), [summary, academics.data]);
  const current = currentCourseFigure(calendar.data);
  const libraryActive = library.data ? library.data.courses.filter((course) => !course.archived).length : null;
  const latest = activity.data?.recent.slice(0, 4) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {summaryError && <Failed what="Your profile could not be read" message={summaryError} />}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="bg-primary text-primary-foreground grid size-14 shrink-0 place-items-center rounded-lg text-lg font-semibold">{initials(account?.firstName, account?.lastName, account?.email)}</span>
            <div className="min-w-0">
              <h2 className="font-heading truncate text-2xl font-semibold tracking-tight">{name}</h2>
              <p className="text-muted-foreground mt-0.5 truncate text-sm">{account?.email || (account?.mode === "local" ? "Local development account" : "Reading account…")}</p>
            </div>
          </div>
          {account?.mode === "clerk" && <HostedProfileActions />}
        </div>

        <div className="grid gap-x-8 gap-y-5 border-t px-5 py-5 sm:grid-cols-3 sm:px-6">
          <div className="flex items-start gap-3">
            <GraduationCapIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="min-w-0"><p className={RULE}>Study programme</p><p className="mt-1 text-sm font-semibold">{programme.programme || (programme.empty ? "Not set yet" : "All programmes")}</p><p className="text-muted-foreground mt-0.5 text-xs">{programme.institution || programme.membership}</p></div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="min-w-0"><p className={RULE}>Sign-in</p><p className="mt-1 text-sm font-semibold">{account?.mode === "clerk" ? "Managed by Clerk" : "Local account"}</p><p className="text-muted-foreground mt-0.5 text-xs">{account?.mode === "clerk" ? "University email verified" : "No hosted identity"}</p></div>
          </div>
          <div className="flex items-start gap-3">
            <DatabaseIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div className="min-w-0"><p className={RULE}>Private storage</p><p className="mt-1 text-sm font-semibold">{account?.storage === "neon" ? "Encrypted cloud record" : "Local record"}</p><p className={`text-muted-foreground mt-0.5 truncate text-xs ${NUMERALS}`} title={account?.id}>{account?.id ? `ID ${account.id}` : "Reading identity…"}</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,.75fr)]">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="px-5 py-4 sm:px-6"><h2 className="font-heading text-xl font-semibold tracking-tight">Study snapshot</h2><p className="text-muted-foreground mt-1 text-sm">A compact view of the record attached to this profile.</p></div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 border-t px-5 py-5 sm:grid-cols-4 sm:px-6">
            <Stat label="Current courses" value={current?.count ?? "—"} detail={current?.period || "Academic record"} />
            <Stat label="Flashcards" value={cards.data?.totalCards ?? "—"} detail={cards.data ? `${cards.data.dueCount} due now` : "Reading cards"} />
            <Stat label="Active days" value={activity.data?.activeDays ?? "—"} detail="Last 28 days" />
            <Stat label="Stored records" value={summary ? formatCount(summary.totals.documents) : "—"} detail={summary ? approximateBytes(summary.totals.bytes) || "Private record" : "Reading storage"} />
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-xs sm:px-6"><span>{library.error ? "Course library unavailable" : `${libraryActive ?? "—"} maintained courses available`}</span><a className="text-primary font-semibold hover:underline" href="/app/courses">Open Course Desk</a></div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-start justify-between gap-4 px-5 py-4"><div><h2 className="font-heading text-xl font-semibold tracking-tight">Recent activity</h2><p className="text-muted-foreground mt-1 text-sm">Your last four weeks.</p></div>{activity.data && <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{activity.data.activeDays} active days</span>}</div>
          <div className="border-t px-5 py-5">{activity.error ? <p className="text-destructive text-sm">Activity could not be loaded.</p> : !activity.data ? <Skeleton className="h-24 w-full" /> : <div className="flex min-h-28 items-center justify-between gap-6"><Heatmap activity={activity.data} /><div className="grid min-w-[7rem] gap-4"><div><p className={RULE}>Study streak</p><strong className={`mt-1 block text-xl font-semibold ${NUMERALS}`}>{activity.data.streak}d</strong></div><div><p className={RULE}>Actions</p><strong className={`mt-1 block text-xl font-semibold ${NUMERALS}`}>{activity.data.series.reduce((sum, day) => sum + day.total, 0)}</strong></div></div></div>}</div>
          <div className="border-t">
            {latest.length ? latest.map((event, index) => <div key={`${event.at}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 border-b px-5 py-2.5 text-xs last:border-b-0"><span className="min-w-0 truncate font-medium">{event.label || ACTIVITY_LABEL[event.type] || event.type}</span><time className={`text-muted-foreground ${NUMERALS}`}>{relative(event.at)}</time></div>) : <div className="flex items-start gap-3 px-5 py-4"><ActivityIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" /><p className="text-muted-foreground text-xs leading-relaxed">Your first practice answer, review or reading session will appear here.</p></div>}
          </div>
        </section>
      </div>

      <AccountDataControls account={account} reload={reload} />

      <p className="text-muted-foreground px-1 text-xs leading-relaxed">For access, correction, restriction or objection requests not covered above, email <a className="text-primary font-semibold hover:underline" href="mailto:privacy@study.wicker.life">privacy@study.wicker.life</a>. <a className="text-primary font-semibold hover:underline" href="/privacy">Read the privacy notice</a>.</p>
    </div>
  );
}
