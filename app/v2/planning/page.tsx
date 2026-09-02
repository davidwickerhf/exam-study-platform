'use client'

/**
 * Planning, migrated.
 *
 * Three of its six tabs are here: the overview, the course ledger and
 * progress. Documents and Planner are write-heavy — file intake with an AI
 * change-set the student ticks through, and scenario modelling — and Settings
 * carries account-level actions; migrating those badly would be worse than
 * leaving them, so they still open the vanilla route and say so rather than
 * appearing broken.
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRightIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type Course,
  type Workspace,
  STATUS_LABEL,
  byYear,
  courseStatus,
  earnedEcts,
  plannedEcts,
  weightedGpa
} from '@/lib/v2/academics.mjs'

const NUMERALS = 'font-data tabular-nums'

function Figure({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <span className="flex flex-col gap-1">
      <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.11em] uppercase">{label}</span>
      <strong className={`text-2xl font-semibold tracking-tight ${NUMERALS}`}>
        {value}
        {unit && <small className="text-muted-foreground ml-1 text-sm font-medium">{unit}</small>}
      </strong>
    </span>
  )
}

function Ledger({ courses }: { courses: Course[] }) {
  const years = useMemo(() => byYear(courses), [courses])
  if (!courses.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No courses yet</EmptyTitle>
          <EmptyDescription>Set a programme and this fills with its curriculum.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
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
                <th className="w-[6rem] py-2 pr-4 text-left font-semibold">Code</th>
                <th className="py-2 pr-6 text-left font-semibold">Course</th>
                <th className="w-[7rem] py-2 pr-4 text-left font-semibold">Period</th>
                <th className="w-[4rem] py-2 pr-6 text-right font-semibold">ECTS</th>
                <th className="w-[7rem] py-2 text-left font-semibold">Requirement</th>
                <th className="w-[8rem] py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {year.courses.map((course) => {
                const status = courseStatus(course)
                return (
                  <tr key={course.id} className="hover:bg-card border-b">
                    <td className={`py-2 pr-4 text-sm font-semibold ${NUMERALS}`}>{course.code}</td>
                    <td className="py-2 pr-6 text-[15px] font-medium">{course.name}</td>
                    <td className={`text-muted-foreground py-2 pr-4 text-sm ${NUMERALS}`}>{course.period}</td>
                    <td className={`py-2 pr-6 text-right text-sm ${NUMERALS}`}>{course.ects}</td>
                    <td className="text-muted-foreground py-2 text-sm capitalize">{course.programmeRequirement}</td>
                    <td className="py-2">
                      {/* State is a mark, not a fill: only a fail is emphasised. */}
                      {status === 'not-recorded' ? (
                        <span className="text-muted-foreground text-sm">{STATUS_LABEL[status]}</span>
                      ) : (
                        <Badge variant={status === 'failed' ? 'default' : 'secondary'}>{STATUS_LABEL[status]}</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}

function NotMigrated({ tab, label }: { tab: string; label: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{label} has not moved yet</EmptyTitle>
        <EmptyDescription>
          It still runs in the previous workspace, unchanged. This tab will replace it rather than duplicate it.
        </EmptyDescription>
      </EmptyHeader>
      <a href={`/app#/planning/${tab}`} className="text-primary inline-flex items-center gap-1.5 text-sm font-semibold">
        Open {label} <ArrowUpRightIcon className="size-4" />
      </a>
    </Empty>
  )
}

export default function PlanningPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/academics', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`Your record returned ${response.status}`))))
      .then((data) => { if (live) setWorkspace(data.workspace) })
      .catch((cause: Error) => { if (live) setError(cause.message) })
    return () => { live = false }
  }, [])

  const courses = workspace?.courses ?? []
  const earned = earnedEcts(courses)
  const planned = plannedEcts(courses)
  const gpa = weightedGpa(courses)
  const passed = courses.filter((course) => courseStatus(course) === 'passed').length

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1180px] p-8">
        <Empty><EmptyHeader><EmptyTitle>Your record could not be read</EmptyTitle><EmptyDescription>{error}</EmptyDescription></EmptyHeader></Empty>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        {workspace ? (
          <>
            <h1 className="font-heading text-5xl leading-none tracking-tighter">{workspace.profile.programme}</h1>
            <p className={`text-muted-foreground text-sm ${NUMERALS}`}>
              {[workspace.profile.university, workspace.profile.academicYear].filter(Boolean).join(' · ')}
            </p>
          </>
        ) : (
          <><Skeleton className="h-12 w-96" /><Skeleton className="h-4 w-64" /></>
        )}
      </header>

      <Tabs defaultValue="overview" className="gap-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6">
          <div className="flex max-w-[640px] items-center gap-5">
            <Progress value={planned ? Math.min(100, (earned / planned) * 100) : 0} className="h-1.5" />
            <p className="whitespace-nowrap">
              <strong className={`text-3xl font-semibold tracking-tight ${NUMERALS}`}>{earned}</strong>
              <small className="text-muted-foreground ml-1.5 text-sm font-medium">of {planned} ECTS</small>
            </p>
          </div>
          <div className="flex flex-wrap gap-10">
            <Figure label="Courses passed" value={passed} unit={`/ ${courses.length}`} />
            {gpa !== null && <Figure label="Weighted GPA" value={gpa} />}
            {workspace?.programmeTemplate && <Figure label="Study year" value={workspace.programmeTemplate.currentStudyYear || '—'} />}
          </div>
        </TabsContent>

        <TabsContent value="courses">
          {workspace ? <Ledger courses={courses} /> : <Skeleton className="h-64 w-full" />}
        </TabsContent>

        <TabsContent value="progress" className="flex flex-col gap-6">
          {workspace ? (
            byYear(courses).map((year) => {
              const yearEarned = earnedEcts(year.courses)
              return (
                <section key={year.level} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <h3 className="text-sm font-semibold">{year.level}</h3>
                    <span className={`text-muted-foreground text-sm ${NUMERALS}`}>{yearEarned} / {year.ects} ECTS</span>
                  </div>
                  <Progress value={year.ects ? (yearEarned / year.ects) * 100 : 0} className="h-1.5" />
                </section>
              )
            })
          ) : <Skeleton className="h-32 w-full" />}
        </TabsContent>

        <TabsContent value="documents"><NotMigrated tab="documents" label="Documents" /></TabsContent>
        <TabsContent value="planner"><NotMigrated tab="planner" label="Planner" /></TabsContent>
        <TabsContent value="settings"><NotMigrated tab="settings" label="Settings" /></TabsContent>
      </Tabs>
    </div>
  )
}
