'use client'

import Link from 'next/link'
import { ArrowUpRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { courseAttemptHistory } from '@/lib/workspace/course-detail.mjs'
import type { AcademicCourse } from '@/lib/workspace/courses.mjs'

const NUMERALS = 'font-data tabular-nums'
const RESULT: Record<string, string> = { passed: 'Passed', failed: 'Failed', 'no-show': 'No show', upcoming: 'Upcoming' }
const SITTING: Record<string, string> = { first: 'First sitting', resit: 'Resit', 'carry-over': 'Carry-over', other: 'Other sitting' }
const date = (value?: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : 'Not recorded'

export function CourseAttemptHistory({ course, loading, error, retry, compact = false, onExpand }: {
  course: AcademicCourse | null; loading: boolean; error: string | null; retry: () => void; compact?: boolean; onExpand?: () => void
}) {
  const attempts = courseAttemptHistory(course)
  return <section id={compact ? undefined : 'attempts'} className="overflow-hidden rounded-xl border bg-card" aria-label={compact ? 'Your attempt history preview' : 'Your attempt history'}>
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4 sm:px-6">
      <div><h2 className="text-base font-semibold">Attempt history</h2><p className="text-muted-foreground mt-1 text-xs">{compact ? 'Your recorded sittings, newest first.' : 'Every sitting stays in your record, including failed attempts and retakes.'}</p></div>
      {!loading && !error && <span className={`text-muted-foreground text-xs ${NUMERALS}`}>{attempts.length} {attempts.length === 1 ? 'sitting' : 'sittings'}</span>}
    </div>
    {loading ? <p role="status" className="text-muted-foreground px-5 py-6 text-sm">Reading your academic record…</p>
      : error ? <div role="alert" className="px-5 py-5"><p className="text-sm">Your attempt history could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={retry}>Try again</Button></div>
      : !attempts.length ? <div className="px-5 py-6"><p className="text-sm font-medium">No attempts recorded yet</p><p className="text-muted-foreground mt-1 text-xs leading-relaxed">Import your academic record or add a sitting in Planning to show your history here.</p><Link href="/app/planning?tab=courses" className="text-primary mt-3 inline-flex text-xs font-semibold">Open academic record <ArrowUpRightIcon className="ml-1 size-3.5" /></Link></div>
      : compact ? <ol className="divide-y">{attempts.slice(0, 3).map((attempt) => <li key={attempt.key} className="px-5 py-4 sm:px-6">
        <div className="flex items-baseline justify-between gap-3"><strong className={`text-sm ${NUMERALS}`}>{attempt.academicYear || 'Year not recorded'}</strong><span className={`text-xs font-semibold ${attempt.status === 'failed' || attempt.status === 'no-show' ? 'text-muted-foreground' : attempt.status === 'upcoming' ? 'text-primary' : ''}`}>{RESULT[attempt.status || ''] || 'Not recorded'}</span></div>
        <div className="text-muted-foreground mt-1 flex flex-wrap justify-between gap-2 text-xs"><span>{SITTING[attempt.type || ''] || 'Sitting'}</span><span className={NUMERALS}>{attempt.grade == null ? 'No grade recorded' : `Grade ${attempt.grade}`}</span></div>
      </li>)}</ol>
      : <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><caption className="sr-only">Academic attempts, most recent academic year first. A dash means the value was not recorded.</caption>
        <thead className="bg-muted/30 text-muted-foreground text-[10px] tracking-[0.08em] uppercase"><tr>{['Academic year', 'Sitting', 'Result', 'Grade', 'ECTS', 'Exam date'].map(label => <th key={label} scope="col" className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead>
        <tbody>{attempts.map(attempt => <tr key={attempt.key} className="border-t align-top">
          <th scope="row" className="px-5 py-4 font-normal"><strong className={`font-semibold ${NUMERALS}`}>{attempt.academicYear || 'Not recorded'}</strong>{(attempt.courseCode || attempt.period) && <span className="text-muted-foreground mt-1 block text-xs">{[attempt.courseCode, attempt.period].filter(Boolean).join(' · ')}</span>}{attempt.courseName && attempt.courseName !== course?.name && <span className="text-muted-foreground mt-1 block max-w-64 text-xs">{attempt.courseName}</span>}</th>
          <td className="px-5 py-4 text-xs">{SITTING[attempt.type || ''] || 'Not recorded'}</td>
          <td className="px-5 py-4 text-xs font-semibold">{RESULT[attempt.status || ''] || 'Not recorded'}</td>
          <td className={`px-5 py-4 ${NUMERALS}`}>{attempt.grade ?? '—'}</td><td className={`px-5 py-4 ${NUMERALS}`}>{attempt.ects ?? '—'}</td><td className={`px-5 py-4 text-xs whitespace-nowrap ${NUMERALS}`}>{date(attempt.examDate)}</td>
        </tr>)}</tbody></table></div>}
    {compact && attempts.length > 0 && !error && <button type="button" onClick={onExpand} className="text-primary flex min-h-11 w-full items-center justify-between border-t px-5 text-xs font-semibold hover:bg-muted/40 sm:px-6">View all attempts <ArrowUpRightIcon className="size-3.5" /></button>}
    {!compact && attempts.length > 0 && <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-xs"><p>Grades, credits and course codes reflect each recorded sitting.</p><Link href="/app/planning?tab=courses" className="text-primary font-semibold">Manage academic record</Link></div>}
  </section>
}
