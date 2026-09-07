'use client'
import { useEffect, useState, useRef } from 'react'
import { ArrowLeftIcon, FileTextIcon, SearchIcon, LoaderCircleIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { paperSelection, paperReadiness } from '@/lib/workspace/paper-library.mjs'
import './paper-library.css'
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
  sourcePages: number[]
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
type PaperJob = { id: string; sourceKey: string; status: string; completedSections: number; totalSections: number; setId: string | null; error: string | null }
type Bank = {
  processing?: PaperJob[]
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
export function StudyPaperBank({
  revision,
  course: courseProp,
}: {
  revision?: StudyRevision
  course?: StudyRevision['course']
}) {
  const course = courseProp || revision!.course
  const courseMode = !revision
  const paperUrl = `/api/study-versions/course-papers?${new URLSearchParams(course).toString()}`
  const [bank, setBank] = useState<Bank | null>(null),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [year, setYear] = useState('all'),
    [showAll, setShowAll] = useState(false),
    [detailKey, setDetailKey] = useState<string | null>(null),
    [activityOpen, setActivityOpen] = useState(false)
  const autoStarted = useRef('')
  const [setChoices, setSetChoices] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<SetInfo | null>(null),
    [session, setSession] = useState<StudyRevision | null>(null),
    [paper, setPaper] = useState<StudySource | null>(null),
    [solution, setSolution] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [busy, setBusy] = useState(false),
    [operation, setOperation] = useState<'prepare' | 'resume' | null>(null)
  const [fitSet, setFitSet] = useState<SetInfo | null>(null),
    [syllabi, setSyllabi] = useState<string[]>([])
  const { preferences } = useStudyAiPreferences(),
    base = `/api/study-versions/${revision?.versionId}`
  async function load() {
    setBank(
      await studyRequest<Bank>(courseMode ? paperUrl : `${base}/paper-bank`),
    )
    setError('')
  }
  useEffect(() => {
    let live = true
    setError(''); setBank(null)
    void studyRequest<Bank>(courseMode ? paperUrl : `${base}/paper-bank`)
      .then((r) => live && setBank(r))
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [base, paperUrl, courseMode])
  // Backfill earlier imports once. New files are queued by ingestion itself;
  // closing this page never stops processing.
  useEffect(() => {
    if (!bank || autoStarted.current === paperUrl || !bank.papers.some(p=>p.paperKind!=='solutions' && /\.pdf$/i.test(p.title) && !bank.processing?.some(j=>j.sourceKey===p.key))) return
    autoStarted.current = paperUrl
    void studyRequest('/api/study-versions/course-papers', { ...course, action: 'auto-prepare' })
      .then(() => load()).catch(e => setError(e.message))
  }, [bank, paperUrl])
  const processing = bank?.processing?.some(j => ['queued','running'].includes(j.status))
  useEffect(() => {
    if (!processing) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load().catch(e=>setError(e.message))
    }, 8000)
    return () => window.clearInterval(timer)
  }, [processing, paperUrl])
  async function retryAuto(job: PaperJob) {
    setBusy(true);setError('')
    try { await studyRequest('/api/study-versions/course-papers', {...course,action:'retry-auto',jobId:job.id}); await load() }
    catch(e) {setError((e as Error).message)} finally {setBusy(false)}
  }
  async function openSet(s: SetInfo) {
    setDetailKey(null)
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
    setOperation('resume')
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
      setOperation(null)
    }
  }
  async function prepare() {
    if (!paper) return
    setBusy(true)
    setOperation('prepare')
    setError('')
    try {
      let r = await studyRequest<PracticeRecord & { versionId: string }>(
        courseMode ? '/api/study-versions/course-papers' : `${base}/practice`,
        {
          ...course,
          revisionId: revision?.id,
          mode: 'extract',
          questionSourceKey: paper.key,
          solutionSourceKey: solution,
          includeHistorical: true,
          fromPage: from,
          toPage: to,
          ...preferences,
        },
      )
      setDetailKey(paper.key)
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
      setOperation(null)
    }
  }
  async function checkFit() {
    if (!fitSet) return
    setBusy(true)
    setError('')
    try {
      const fit = await studyRequest<Fit>(
        courseMode ? '/api/study-versions/course-papers' : `${base}/paper-fit`,
        {
          ...course,
          action: 'fit',
          setId: fitSet.id,
          sourceKeys: syllabi,
          ...preferences,
        },
      )
      await load()
      if (fit.status === 'failed')
        setError(fit.error || 'The syllabus check could not finish.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      setOperation(null)
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
  const detail = bank?.papers.find(p => p.key === detailKey)
  const info = (p: StudySource) => paperSelection(bank?.sets || [], bank?.processing || [], p.key, setChoices[p.key])
  const choosePages = (p: StudySource) => { setDetailKey(null); setPaper(p); setSolution(''); setFrom(''); setTo('') }
  const backToPaper = () => { setDetailKey(paper?.key || fitSet?.questionSourceKey || null); setPaper(null); setFitSet(null); setError('') }
  const inspectFit = (set: SetInfo) => { setDetailKey(null); setFitSet(set); setSyllabi(bank?.syllabi.map(s=>s.key).slice(0,1) || []) }
  const attention = bank?.processing?.filter(j=>j.status==='paused') || []
  const activeJobs = bank?.processing?.filter(j=>['queued','running'].includes(j.status)) || []
  const groups = [['paper','Exam papers'],['exercises','Exercise sheets'],['solutions','Solution files']] as const
  const detailInfo = detail ? info(detail) : null
  const resetFilters = () => { setSearch(''); setYear('all'); setShowAll(false) }
  return (
    <section aria-label="Past paper library" className="paper-library">
      <header className="course-section-heading">
        <div><h2>Mock papers</h2><p>Choose an original paper, or practise its checked questions.</p></div>
        {!!bank && <Button variant="outline" size="sm" onClick={()=>setActivityOpen(true)}><span className={`size-1.5 rounded-full ${attention.length ? 'bg-amber-600' : activeJobs.length ? 'bg-primary' : 'bg-muted-foreground'}`}/>{attention.length ? `${attention.length} paused` : activeJobs.length ? `${activeJobs.length} preparing` : 'Preparation status'}</Button>}
      </header>
      <div className="paper-toolbar">
        <div className="relative min-w-0 flex-1"><SearchIcon className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input aria-label="Search past papers" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search papers" className="pl-9"/></div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Year<select aria-label="Paper year" className="h-10 rounded-md border bg-card px-3 text-sm text-foreground" value={year} onChange={e=>setYear(e.target.value)}><option value="all">All years</option>{[...new Set(bank?.papers.map(p=>p.academicYear) || [])].sort().reverse().map(y=><option key={y}>{y}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/>Solution files</label>
      </div>
      {error && !detail && <div role="alert" className="my-4 text-sm text-destructive">{error}<Button variant="outline" size="sm" className="ml-3" onClick={()=>{setError('');void load().catch(e=>setError(e.message))}}>Reload library</Button></div>}
      {!bank && !error ? <div role="status" aria-label="Loading papers" className="space-y-3 py-6">{[1,2,3].map(n=><div key={n} className="h-16 animate-pulse rounded bg-muted"/>)}</div> : bank && !visible.length ? <div className="py-12"><h3 className="text-lg font-semibold">{search || year!=='all' ? 'No papers match these filters' : 'No past papers found yet'}</h3><p className="mt-2 text-sm text-muted-foreground">{search || year!=='all' ? 'Clear the filters to see the full library.' : 'Papers and exercise sheets appear here after your course materials are collected.'}</p>{(search || year!=='all') && <Button className="mt-4" variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>}</div> : groups.map(([kind,label])=>{
        const papers=visible.filter(p=>kind==='paper' ? !['exercises','solutions'].includes(p.paperKind) : p.paperKind===kind).sort((a,b)=>b.academicYear.localeCompare(a.academicYear)||title(a.title).localeCompare(title(b.title)))
        return papers.length ? <section key={kind} aria-label={label} className="paper-group"><h3 className="paper-group-label">{label}<span>{papers.length}</span></h3>{papers.map(p=>{
          const {ready,job}=info(p)
          return <article key={p.key} className="paper-row">
            <FileTextIcon className="paper-row-icon"/>
            <div className="paper-row-copy"><h4><button className="paper-name" onClick={()=>{setDetailKey(p.key);setError('')}}>{title(p.title)}</button></h4><div className="paper-row-meta"><span>{p.academicYear}</span>{p.paperKind!=='solutions' && <span className={ready ? 'text-foreground' : ''}>{paperReadiness(ready,job)}</span>}</div></div>
            <div className="paper-row-actions">{p.url || p.assetId ? <StudySourceInspector focusDocument source={p} chunks={[]} label={p.paperKind==='solutions' ? 'View solutions' : 'View paper'}/> : <span className="text-xs text-muted-foreground">Original unavailable</span>}{ready && <Button size="sm" onClick={()=>void openSet(ready)}>{job?.setId===ready.id && job.status==='complete' ? 'Practise' : 'Practise section'}</Button>}<Button size="icon-sm" variant="ghost" aria-label={`Details for ${title(p.title)}`} onClick={()=>{setDetailKey(p.key);setError('')}}><ChevronRightIcon/></Button></div>
          </article>
        })}</section> : null
      })}
      <p className="mt-6 text-xs leading-5 text-muted-foreground">Originals stay available while questions are prepared. Older papers may cover a different syllabus.</p>
      <Sheet open={!!detail} onOpenChange={open=>!open&&!busy&&setDetailKey(null)}>
        <SheetContent className="paper-detail data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b p-6 pr-12"><SheetTitle>{detail && title(detail.title)}</SheetTitle><SheetDescription>{detail?.academicYear} · Original course material</SheetDescription></SheetHeader>
          {detail && detailInfo && <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {error && <p role="alert" className="my-4 text-sm text-destructive">{error}</p>}
            {busy && operation && <p role="status" className="flex items-center gap-2 pt-5 text-sm"><LoaderCircleIcon className="size-4 animate-spin"/>{operation==='prepare' ? 'Preparing questions…' : 'Resuming questions…'}</p>}
            <div className="flex flex-wrap items-center gap-2 py-5">{(detail.url || detail.assetId) && <StudySourceInspector focusDocument source={detail} chunks={[]} label="View paper" onOpen={()=>setDetailKey(null)}/>}{detailInfo.ready && <Button size="sm" disabled={busy} onClick={()=>void openSet(detailInfo.ready!)}>Practise</Button>}</div>
            <section className="border-t py-5"><h3 className="font-semibold">Practice questions</h3><p className="mt-2 text-sm text-muted-foreground">{paperReadiness(detailInfo.ready,detailInfo.job)}</p>
              {detailInfo.sets.length>0 && <div className="mt-4 space-y-3"><label className="block text-sm">Saved question set<select aria-label={`Prepared questions for ${title(detail.title)}`} className="mt-2 w-full rounded-md border bg-card p-2 text-sm" value={detailInfo.chosen?.id || ''} onChange={e=>setSetChoices(old=>({...old,[detail.key]:e.target.value}))}>{detailInfo.sets.map(s=><option key={s.id} value={s.id}>{s.sourcePages?.length ? `Pages ${s.sourcePages[0]}–${s.sourcePages.at(-1)} · ` : ''}{s.title} · {s.questionCount} questions · {s.status==='complete'?'Ready':s.status}</option>)}</select></label>{!!detailInfo.chosen?.sourcePages?.length && <p className="text-xs text-muted-foreground">Prepared source pages: {detailInfo.chosen.sourcePages[0]}–{detailInfo.chosen.sourcePages.at(-1)}. This set covers these pages only.</p>}</div>}
              {detail.paperKind!=='solutions' && <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>choosePages(detail)}>{detailInfo.sets.length ? 'Prepare another section' : 'Choose pages to prepare'}</Button>{detailInfo.chosen && detailInfo.chosen.status!=='complete' && <Button size="sm" variant="outline" disabled={busy} onClick={()=>void resume(detailInfo.chosen!)}>{busy && operation==='resume' ? 'Resuming…' : 'Resume questions'}</Button>}</div>}
            </section>
            {detailInfo.job && <section className="border-t py-5"><h3 className="font-semibold">Automatic preparation</h3><p className="mt-2 text-sm text-muted-foreground">{detailInfo.job.status==='paused' ? 'Preparation paused. Your original and any checked questions are still available.' : detailInfo.job.status==='complete' ? 'Preparation finished.' : `${detailInfo.job.completedSections} of ${detailInfo.job.totalSections || '…'} sections checked. You can leave this page.`}</p>{detailInfo.job.error && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Why it paused</summary><p className="mt-2 leading-5">{detailInfo.job.error}</p></details>}{detailInfo.job.status==='paused' && <Button className="mt-4" size="sm" variant="outline" disabled={busy} onClick={()=>void retryAuto(detailInfo.job!)}>{busy && !operation ? 'Retrying…' : 'Retry processing'}</Button>}</section>}
            {detailInfo.ready && <section className="border-t py-5"><h3 className="font-semibold">Current syllabus</h3><p className="mt-2 text-sm text-muted-foreground">Check whether these questions still match the topics and question formats in your course.</p><Button className="mt-4" size="sm" variant="outline" onClick={()=>inspectFit(detailInfo.ready!)}>Syllabus fit</Button></section>}
            <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">Preparation and syllabus checks use your saved AI preferences and spending limits.</p>
          </div>}
        </SheetContent>
      </Sheet>
      <Sheet open={activityOpen} onOpenChange={setActivityOpen}><SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg"><SheetHeader className="border-b p-6"><SheetTitle>Question preparation</SheetTitle><SheetDescription>Original papers are always available. Checked questions remain usable if a later step pauses.</SheetDescription></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{bank?.papers.filter(p=>p.paperKind!=='solutions').map(p=>{const {job,ready}=info(p);return <button key={p.key} className="flex w-full items-center gap-3 border-b py-4 text-left" onClick={()=>{setActivityOpen(false);setDetailKey(p.key);setError('')}}><span className="min-w-0 flex-1"><strong className="block text-sm font-medium">{title(p.title)}</strong><span className="mt-1 block text-xs text-muted-foreground">{p.academicYear} · {job?.status==='paused' ? 'Preparation paused' : paperReadiness(ready,job)}</span></span><ChevronRightIcon className="size-4 shrink-0"/></button>})}</div></SheetContent></Sheet>
      <Sheet open={!!paper} onOpenChange={(v) => !busy && !v && backToPaper()}>
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader>
            <Button variant="ghost" size="sm" className="w-fit -ml-2" disabled={busy} onClick={backToPaper}><ArrowLeftIcon/>Back to paper</Button>
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
        onOpenChange={(v) => !busy && !v && backToPaper()}
      >
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetHeader>
            <Button variant="ghost" size="sm" className="w-fit -ml-2" disabled={busy} onClick={backToPaper}><ArrowLeftIcon/>Back to paper</Button>
            <SheetTitle>Fit with this year’s syllabus</SheetTitle>
            <SheetDescription>
              {course.academicYear} · {fitSet?.title}
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
