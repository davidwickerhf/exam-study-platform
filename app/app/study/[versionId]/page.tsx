'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeftIcon, RefreshCwIcon, ShareIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StudyBillingFields } from '@/components/workspace/study-billing-fields'
import { StudyProposal } from '@/components/workspace/study-proposal'
import { StudyReader } from '@/components/workspace/study-reader'
import { StudySourceForm } from '@/components/workspace/study-source-form'
import { StudySharingForm } from '@/components/workspace/study-sharing-form'
import { StudyPracticeExam } from '@/components/workspace/study-practice-exam'
import {
  studyRequest,
  generationLabel,
  type StudyVersionPayload
} from '@/lib/workspace/study-versions'

export default function StudentStudyPage() {
  const { versionId } = useParams<{ versionId: string }>(),
    [data, setData] = useState<StudyVersionPayload | null>(null),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(''),
    [refreshing, setRefreshing] = useState(false),
    [sharing, setSharing] = useState(false),
    [busy, setBusy] = useState(false)
  const [resume, setResume] = useState(false),
    [billingSource, setBillingSource] = useState('platform'),
    [cap, setCap] = useState('1'),
    [quality, setQuality] = useState('standard'),
    [recheck, setRecheck] = useState(false)
  async function load() {
    const result = await studyRequest<StudyVersionPayload>(
      `/api/study-versions/${versionId}${selected ? `?revision=${encodeURIComponent(selected)}` : ''}`
    )
    setData(result)
    setError('')
  }
  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    const poll = () =>
      studyRequest<StudyVersionPayload>(
        `/api/study-versions/${versionId}${selected ? `?revision=${encodeURIComponent(selected)}` : ''}`
      )
        .then((r) => active && setData(r))
        .catch((e) => active && setError(e.message))
    void poll()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void poll()
    }, 10000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [versionId, selected])
  async function control(action: string) {
    setBusy(true)
    try {
      await studyRequest(
        `/api/study-versions/${versionId}/${action}`,
        action === 'retry' ? { billingSource, maxJobUsd: Number(cap), quality, recheck } : {}
      )
      setResume(false)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (!data)
    return (
      <main className="mx-auto w-full max-w-6xl p-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-5">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-72 w-full" />
          </div>
        )}
      </main>
    )
  const { version, freshness } = data,
    revision = data.revision || data.partial,
    draft = version.draft,
    active = ['queued', 'running'].includes(draft?.status || '')
  const updated =
    freshness.changed.length +
    freshness.removed.length +
    freshness.newSources.length
  return (
    <main className="mx-auto flex w-full max-w-[1280px] min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4">
        <Link
          href={`/app/courses/${encodeURIComponent(version.course.courseCode)}?year=${encodeURIComponent(version.course.academicYear)}`}
          className="text-muted-foreground inline-flex items-center gap-2 text-xs hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to {version.course.courseCode}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">Private</Badge>
              <span className="text-muted-foreground text-xs">
                {version.course.courseCode} · {version.course.academicYear}
                {version.course.period ? ` · ${version.course.period}` : ''}
              </span>
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {version.title}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {version.course.courseName} · Personal generation, not editorially
              reviewed
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={active || Boolean(data.proposal)}
              onClick={() => {
                setRefreshing(!refreshing)
                setSharing(false)
              }}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Refresh sources
            </Button>
            {data.revision && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSharing(!sharing)
                  setRefreshing(false)
                }}
              >
                <ShareIcon data-icon="inline-start" />
                Share or contribute
              </Button>
            )}
          </div>
        </div>
      </header>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {draft && draft.status !== 'complete' && (
        <section
          className="flex flex-col gap-3 rounded-xl border bg-card p-5"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">
                {generationLabel(draft)}
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                You can leave this page. Finished steps are saved and ready
                chapters remain readable.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (active) void control('stop')
                else {
                  setBillingSource(version.billing?.source || 'platform')
                  setCap(String(version.billing?.maxJobUsd || 1))
                  setQuality(version.billing?.model === 'gpt-5.4' ? 'enhanced' : 'standard')
                  setRecheck(false)
                  setResume(!resume)
                }
              }}
            >
              {active ? 'Pause generation' : 'Resume generation'}
            </Button>
          </div>
          {draft.error && (
            <p className="text-destructive text-sm">{draft.error}</p>
          )}
          {draft.issues
            ?.filter((i) => i.severity === 'error')
            .map((i, index) => (
              <p key={index} className="text-muted-foreground text-sm">
                {i.detail}
              </p>
            ))}
          {!!draft.excluded?.length && (
            <p className="text-muted-foreground text-xs">
              No readable text: {draft.excluded.map((s) => s.title).join(', ')}.
            </p>
          )}
        </section>
      )}
      {data.proposal && data.revision && data.revision.id === version.activeRevisionId && <StudyProposal proposal={data.proposal} base={data.revision} onChanged={() => { setSelected(''); void load() }} />}
      {resume && (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Resume generation</h2>
          <StudyBillingFields
            quality={quality}
            setQuality={setQuality}
            source={billingSource}
            setSource={setBillingSource}
            cap={cap}
            setCap={setCap}
          />
          {draft?.canRecheck && <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={recheck} onChange={e => setRecheck(e.target.checked)} className="mt-1 size-4" /><span>Recheck the saved chapter without rewriting it<span className="mt-1 block text-xs text-muted-foreground">Useful when a finding appears mistaken. Runs only the paid evidence check; it does not correct content.</span></span></label>}
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void control('retry')}>
              Resume with this billing choice
            </Button>
            <Button variant="ghost" onClick={() => setResume(false)}>
              Cancel
            </Button>
          </div>
        </section>
      )}
      {updated > 0 && !refreshing && (
        <Alert>
          <AlertDescription>
            <span>
              Source updates are available: {freshness.newSources.length} new,{' '}
              {freshness.changed.length} changed, {freshness.removed.length}{' '}
              unavailable. This revision keeps its original evidence.
            </span>
            <Button
              variant="link"
              size="sm"
              disabled={active || Boolean(data.proposal)}
              onClick={() => setRefreshing(true)}
            >
              Review sources
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {refreshing && (
        <div className="rounded-xl border bg-card p-5">
          <StudySourceForm
            course={version.course}
            versionId={version.id}
            initialKeys={data.sourceKeys}
            onCancel={() => setRefreshing(false)}
            onDone={() => {
              setRefreshing(false)
              setSelected('')
              void load()
            }}
          />
        </div>
      )}
      {sharing && data.revision && (
        <StudySharingForm
          revision={data.revision}
          title={version.title}
          onClose={() => setSharing(false)}
        />
      )}
      {version.history.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span
            id="study-revision-label"
            className="text-muted-foreground text-xs"
          >
            Version history
          </span>
          <Select
            value={selected || version.activeRevisionId}
            onValueChange={(v) => v && setSelected(v)}
          >
            <SelectTrigger
              aria-labelledby="study-revision-label"
              className="w-full max-w-72"
            >
              <SelectValue>
                {(() => {
                  const r = version.history.find(
                    (r) => r.id === (selected || version.activeRevisionId)
                  )
                  return r
                    ? `${r.edit?.label || new Date(r.createdAt).toLocaleString()} · ${r.id === version.activeRevisionId ? 'Latest' : `${r.chapters} chapters`}`
                    : 'Choose a revision'
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {version.history.map((r, index) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.edit?.label || 'Generated revision'} · {new Date(r.createdAt).toLocaleString()} ·{' '}
                    {index === 0 ? 'Latest' : `${r.chapters} chapters`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {selected && selected !== version.activeRevisionId && <Button variant="outline" size="sm" disabled={busy || active || Boolean(data.proposal)} onClick={async () => {
            setBusy(true)
            try { await studyRequest(`/api/study-versions/${versionId}/restore`, { baseRevisionId: version.activeRevisionId, revisionId: selected }); setSelected('') }
            catch(e) { setError((e as Error).message) } finally { setBusy(false) }
          }}>Restore this revision</Button>}
        </div>
      )}
      {revision && (
        <Tabs defaultValue="study" className="min-w-0 gap-5">
          <TabsList
            variant="line"
            className="max-w-full justify-start overflow-x-auto"
          >
            <TabsTrigger value="study">Study</TabsTrigger>
            {data.revision && (
              <TabsTrigger value="exam">Practice exam</TabsTrigger>
            )}
            <TabsTrigger value="sources">Sources & generation</TabsTrigger>
          </TabsList>
          <TabsContent value="study">
            <StudyReader
              revision={revision}
              progress={data.progress}
              personal={Boolean(data.revision)}
              editable={Boolean(data.revision) && revision.id === version.activeRevisionId && !active && !data.proposal}
              onEdited={() => { setSelected(''); void load() }}
              onSaved={(progress) =>
                setData((old) =>
                  old
                    ? {
                        ...old,
                        progress: [
                          ...old.progress.filter(
                            (p) => p.topicId !== progress.topicId
                          ),
                          progress
                        ]
                      }
                    : old
                )
              }
            />
          </TabsContent>
          {data.revision && (
            <TabsContent value="exam">
              <StudyPracticeExam revision={data.revision} />
            </TabsContent>
          )}
          <TabsContent
            value="sources"
            className="flex flex-col gap-5 rounded-xl border bg-card p-5"
          >
            <div>
              <h2 className="font-semibold">How this version was made</h2>
              <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
                Selected source passages were mapped into topics, then used to
                write explanations, summaries, progressive questions and
                flashcards. A separate AI pass checked each chapter against its
                evidence. These checks can miss mistakes; this is not human
                editorial review. Collection and syllabus coverage may still be
                incomplete.
              </p>
            </div>
            <p className="text-muted-foreground text-xs">
              Source snapshot:{' '}
              {new Date(revision.snapshot.capturedAt).toLocaleString()} ·{' '}
              {revision.snapshot.sources.length} sources ·{' '}
              {revision.snapshot.chunks.length} passages
            </p>
            <ul className="divide-y rounded-lg border">
              {revision.snapshot.sources.map((s) => (
                <li
                  key={s.key}
                  className="flex flex-wrap justify-between gap-2 p-3 text-sm"
                >
                  <span>{s.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {s.kind === 'notes'
                      ? 'Student notes'
                      : s.kind === 'editorial'
                        ? 'Editorial guide'
                        : 'Course material'}{' '}
                    · {s.academicYear}
                  </span>
                </li>
              ))}
            </ul>
            {!!revision.gaps.length && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Coverage gaps and uncertainty
                </h3>
                <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 text-sm">
                  {revision.gaps.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
            {!!revision.snapshot.excluded?.length && (
              <p className="text-muted-foreground text-sm">
                Excluded sources:{' '}
                {revision.snapshot.excluded
                  .map((s) => `${s.title} (${s.reason})`)
                  .join('; ')}
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </main>
  )
}
