'use client'
import { useEffect, useState } from 'react'
import { ArrowLeftIcon, FileTextIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { StudySourceInspector } from './study-source-inspector'
import {
  StudyPracticeWorkspace,
  type PracticeRecord,
} from './study-practice-workspace'
import {
  StudyAiPreferenceSummary,
  useStudyAiPreferences,
} from './study-ai-preferences'
import {
  studyRequest,
  type StudyRevision,
  type StudySource,
} from '@/lib/workspace/study-versions'
type SetInfo = {
  id: string
  versionId: string
  revisionId: string
  topicId: string
  title: string
  questionCount: number
  questionSourceKey: string
  status: string
  academicYear: string
}
type Fit = {
  id: string
  setId: string
  sourceKeys: string[]
  status: string
  error?: string
  createdAt: string
  result?: {
    questions: {
      questionId: string
      label?: string
      question?: string
      topicFit: string
      formatFit: string
      reason: string
      evidence: {
        sourceId: string
        quote: string
        page?: number
        title?: string
      }[]
    }[]
  }
}
type Bank = {
  papers: (StudySource & { paperKind: string })[]
  syllabi: StudySource[]
  sets: SetInfo[]
  reviews: Fit[]
}
const title = (s: string) =>
  s
    .replace(/^\d+\s*/, '')
    .replace(/--file-\d+/, '')
    .replace(/_/g, ' ')
    .replace(/\.pdf$/i, '')
export function StudyPaperBank({ revision }: { revision: StudyRevision }) {
  const [bank, setBank] = useState<Bank | null>(null),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [year, setYear] = useState('all'),
    [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<SetInfo | null>(null),
    [session, setSession] = useState<StudyRevision | null>(null),
    [paper, setPaper] = useState<StudySource | null>(null),
    [solution, setSolution] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [busy, setBusy] = useState(false)
  const [fitSet, setFitSet] = useState<SetInfo | null>(null),
    [syllabi, setSyllabi] = useState<string[]>([])
  const { preferences } = useStudyAiPreferences(),
    base = `/api/study-versions/${revision.versionId}`
  async function load() {
    setBank(await studyRequest<Bank>(`${base}/paper-bank`))
  }
  useEffect(() => {
    let live = true
    void studyRequest<Bank>(`${base}/paper-bank`)
      .then((r) => live && setBank(r))
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [base])
  async function openSet(s: SetInfo) {
    setSelected(s)
    setSession(null)
    setError('')
    try {
      const r = await studyRequest<{ revision: StudyRevision }>(
        `/api/study-versions/${s.versionId}?revision=${s.revisionId}`,
      )
      setSession(r.revision)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  async function finish(record: PracticeRecord & { versionId: string }) {
    let r = record
    if (r.status === 'failed')
      r = await studyRequest<PracticeRecord & { versionId: string }>(
        `/api/study-versions/${r.versionId}/practice-step`,
        { id: r.id, retry: true },
      )
    for (let i = 0; i < 5 && r.status === 'pending'; i++)
      r = await studyRequest<PracticeRecord & { versionId: string }>(
        `/api/study-versions/${r.versionId}/practice-step`,
        { id: r.id },
      )
    return r
  }
  async function resume(s: SetInfo) {
    setBusy(true)
    setError('')
    try {
      const response = await studyRequest<{
        records: (PracticeRecord & { versionId: string })[]
      }>(`/api/study-versions/${s.versionId}/practice?setId=${s.id}`)
      const saved = response.records.find((r) => r.id === s.id)
      if (!saved) throw new Error('Saved paper preparation is unavailable.')
      const result = await finish(saved)
      await load()
      if (result.status === 'failed')
        setError(result.error || 'Paper preparation could not finish.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function prepare() {
    if (!paper) return
    setBusy(true)
    setError('')
    try {
      let r = await studyRequest<PracticeRecord & { versionId: string }>(
        `${base}/practice`,
        {
          revisionId: revision.id,
          mode: 'extract',
          questionSourceKey: paper.key,
          solutionSourceKey: solution,
          includeHistorical: true,
          fromPage: from,
          toPage: to,
          ...preferences,
        },
      )
      setPaper(null)
      await load()
      r = await finish(r)
      await load()
      if (r.status === 'failed')
        setError(
          r.error ||
            'Paper preparation needs attention. You can still view the original.',
        )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function checkFit() {
    if (!fitSet) return
    setBusy(true)
    setError('')
    try {
      const fit = await studyRequest<Fit>(`${base}/paper-fit`, {
        setId: fitSet.id,
        sourceKeys: syllabi,
        ...preferences,
      })
      await load()
      if (fit.status === 'failed')
        setError(fit.error || 'The syllabus check could not finish.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (selected)
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => {
            setSelected(null)
            setSession(null)
          }}
        >
          <ArrowLeftIcon />
          All past papers
        </Button>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {session ? (
          <StudyPracticeWorkspace
            key={selected.id}
            revision={session}
            fixedSetId={selected.id}
          />
        ) : (
          <p role="status" className="py-12 text-muted-foreground">
            Opening saved questions…
          </p>
        )}
      </div>
    )
  const visible =
    bank?.papers.filter(
      (p) =>
        (showAll || p.paperKind !== 'solutions') &&
        (year === 'all' || p.academicYear === year) &&
        `${p.title} ${p.academicYear}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || []
  const review = bank?.reviews
    .filter(
      (r) =>
        r.setId === fitSet?.id &&
        r.sourceKeys?.length === syllabi.length &&
        r.sourceKeys.every((key) => syllabi.includes(key)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return (
    <section className="space-y-6" aria-label="Past paper library">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Past papers</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Original exam papers and exercise sheets for{' '}
            {revision.course.courseCode}, across all available years. Keep
            useful questions for your next attempt.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {bank
            ? `${bank.papers.filter((p) => p.paperKind !== 'solutions').length} ${bank.papers.filter((p) => p.paperKind !== 'solutions').length === 1 ? 'document' : 'documents'}`
            : 'Loading library…'}
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <SearchIcon className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Search past papers"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a paper or exercise sheet"
            className="pl-9"
          />
        </div>
        <select
          aria-label="Paper year"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="all">All years</option>
          {[...new Set(bank?.papers.map((p) => p.academicYear) || [])]
            .sort()
            .reverse()
            .map((y) => (
              <option key={y}>{y}</option>
            ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          Include solution files
        </label>
      </div>
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          Preparing and checking your paper. Each finished step is saved.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {!bank ? (
        <div role="status" className="space-y-3 py-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : visible.length ? (
        <div className="divide-y rounded-lg border bg-card">
          {visible.map((p) => {
            const sets = bank.sets.filter((s) => s.questionSourceKey === p.key),
              ready = sets.find((s) => s.status === 'complete'),
              pending = sets.find((s) => s.status !== 'complete')
            return (
              <article
                key={p.key}
                className="flex flex-wrap items-center gap-4 px-4 py-5 sm:px-6"
              >
                <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-48 flex-1">
                  <h3 className="text-sm font-semibold leading-6">
                    {title(p.title)}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.academicYear} ·{' '}
                    {p.paperKind === 'solutions'
                      ? 'Solutions'
                      : p.paperKind === 'exercises'
                        ? 'Exercise sheet'
                        : 'Paper'}
                    {ready
                      ? ` · ${ready.questionCount} ${ready.questionCount === 1 ? 'question' : 'questions'}`
                      : pending
                        ? ` · ${pending.status === 'failed' ? 'Preparation needs attention' : 'Preparation saved'}`
                        : ''}
                  </p>
                  {ready && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {bank.reviews.some(
                        (r) => r.setId === ready.id && r.status === 'complete',
                      )
                        ? 'Syllabus check available'
                        : 'Current syllabus fit not checked'}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {p.url || p.assetId ? (
                    <StudySourceInspector
                      source={p}
                      chunks={[]}
                      label={
                        p.paperKind === 'solutions'
                          ? 'View solutions'
                          : 'View paper'
                      }
                    />
                  ) : (
                    <span className="px-2 text-xs text-muted-foreground">
                      Original file unavailable
                    </span>
                  )}
                  {p.paperKind !== 'solutions' &&
                    (ready ? (
                      <>
                        <Button size="sm" onClick={() => void openSet(ready)}>
                          Practise
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setFitSet(ready)
                            setSyllabi(
                              bank.syllabi.map((s) => s.key).slice(0, 1),
                            )
                          }}
                        >
                          Syllabus fit
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (pending) {
                            void resume(pending)
                            return
                          }
                          setPaper(p)
                          setSolution('')
                          setFrom('')
                          setTo('')
                        }}
                      >
                        {pending ? 'Resume questions' : 'Prepare questions'}
                      </Button>
                    ))}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="border-y py-12 text-center">
          <h3 className="font-medium">
            {search || year !== 'all'
              ? 'No papers match these filters'
              : 'No past papers found yet'}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {search || year !== 'all'
              ? 'Try another year or search.'
              : 'Sync course materials containing an exam or exercise PDF. Generated questions remain in chapter Practice.'}
          </p>
        </div>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        Paper years describe the original document. Older questions are
        retained; current syllabus coverage and assessment format are checked
        separately. Access follows the original material’s permissions.
      </p>
      <Sheet open={!!paper} onOpenChange={(v) => !busy && !v && setPaper(null)}>
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Prepare paper questions</SheetTitle>
            <SheetDescription>{paper && title(paper.title)}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5">
            <p className="text-sm leading-6 text-muted-foreground">
              Preserve the original wording, question numbers and marks.
              Prepared questions stay in your course bank across years.
            </p>
            <label className="block space-y-2 text-sm">
              Solution file (optional)
              <select
                aria-label="Paper solution file"
                className="w-full rounded-md border bg-background p-2"
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
              >
                <option value="">No supplied solutions</option>
                {bank?.papers
                  .filter((p) => p.key !== paper?.key)
                  .map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.academicYear} · {title(p.title)}
                    </option>
                  ))}
              </select>
            </label>
            <details>
              <summary className="cursor-pointer text-sm">
                Extract a page range
              </summary>
              <div className="mt-3 flex gap-3">
                <Input
                  aria-label="First paper page"
                  type="number"
                  min={1}
                  placeholder="First page"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <Input
                  aria-label="Last paper page"
                  type="number"
                  min={1}
                  placeholder="Last page"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </details>
            <StudyAiPreferenceSummary preferences={preferences} />
            <p className="text-xs text-muted-foreground">
              Uses your saved AI preferences. Identical preparations are reused.
              Without a solution key, original answers are not invented.
            </p>
            {error && <p role="alert">{error}</p>}
          </div>
          <footer className="border-t p-5">
            <Button
              className="w-full"
              disabled={busy || !preferences}
              onClick={() => void prepare()}
            >
              {busy ? 'Preparing…' : 'Prepare questions'}
            </Button>
          </footer>
        </SheetContent>
      </Sheet>
      <Sheet
        open={!!fitSet}
        onOpenChange={(v) => !busy && !v && setFitSet(null)}
      >
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Fit with this year’s syllabus</SheetTitle>
            <SheetDescription>
              {revision.course.academicYear} · {fitSet?.title}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-6">
            <p className="text-sm leading-6 text-muted-foreground">
              An AI comparison, not an exam prediction. Missing topics remain
              uncertain. Only explicit current evidence can support an
              exclusion.
            </p>
            {bank?.syllabi.length ? (
              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-medium">
                  Current syllabus and assessment sources
                </legend>
                {bank.syllabi.map((s) => (
                  <label key={s.key} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={syllabi.includes(s.key)}
                      onChange={(e) =>
                        setSyllabi((old) =>
                          e.target.checked
                            ? [...old, s.key]
                            : old.filter((k) => k !== s.key),
                        )
                      }
                    />
                    {title(s.title)}
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="rounded-md border p-4 text-sm">
                No current syllabus or assessment document is available.
                Questions remain unclassified until one is synced or uploaded.
              </p>
            )}
            <StudyAiPreferenceSummary preferences={preferences} />
            <Button
              disabled={busy || !syllabi.length || !preferences}
              onClick={() => void checkFit()}
            >
              {busy
                ? 'Checking…'
                : review?.status === 'complete'
                  ? 'Check selected evidence'
                  : 'Check syllabus fit'}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {review?.result?.questions.map((q, i) => (
              <article key={q.questionId} className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold">
                  Question {q.label || i + 1}
                </h3>
                <p className="text-sm leading-6">{q.question}</p>
                <p className="text-xs">
                  Topic: {q.topicFit} · Format: {q.formatFit}
                </p>
                <p className="text-sm leading-6">{q.reason}</p>
                {q.evidence.map((e, j) => (
                  <blockquote
                    key={j}
                    className="border-l-2 pl-3 text-xs leading-5 text-muted-foreground"
                  >
                    {e.quote}
                    <footer className="mt-1">
                      {e.title} {e.page ? `· Page ${e.page}` : ''}
                    </footer>
                  </blockquote>
                ))}
              </article>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
