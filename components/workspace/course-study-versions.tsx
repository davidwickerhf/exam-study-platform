'use client'
import './study-library.css'
import { CourseGuideAutomation } from './course-guide-automation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRightIcon, PlusIcon, BookOpenIcon, TargetIcon, FolderOpenIcon, CheckIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import type { CourseTab } from '@/lib/workspace/course-detail.mjs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { StudySourceForm } from './study-source-form'
import {
  studyRequest,
  generationLabel,
  type StudyVersion,
  type StudyPublication
} from '@/lib/workspace/study-versions'

export function CourseStudyVersions({
  courseCode,
  courseName,
  academicYear,
  period,
  onNavigate,
  onShowAllYears
}: {
  courseCode: string
  courseName: string
  academicYear: string
  period: string
  onShowAllYears: () => void
  onNavigate: (tab: CourseTab) => void
}) {
  const router = useRouter(),
    [versions, setVersions] = useState<(StudyVersion & {chapterPreviews?: {id:string;title:string;read?:boolean;questions?:number}[]})[] | null>(null),
    [shared, setShared] = useState<StudyPublication[]>([]),
    [error, setError] = useState(''),
    [creating, setCreating] = useState(false),
    [loadRevision, setLoadRevision] = useState(0)
  useEffect(() => {
    let active = true
    setVersions(null)
    setError('')
    setShared([])
    setCreating(false)
    studyRequest<{ versions: (StudyVersion & {chapterPreviews?: {id:string;title:string;read?:boolean;questions?:number}[]})[] }>(
      `/api/study-versions?courseCode=${encodeURIComponent(courseCode)}`
    )
      .then((r) => active && setVersions(r.versions))
      .catch((e) => active && setError(e.message))
    studyRequest<{ publications: StudyPublication[] }>(
      `/api/study-versions/shared?courseCode=${encodeURIComponent(courseCode)}`
    )
      .then((r) => active && setShared(r.publications))
      .catch(() => {})
    return () => { active = false }
  }, [courseCode, loadRevision])
  const selected = versions?.filter(v => academicYear === 'all' || v.course.academicYear === academicYear) || []
  const [search, setSearch] = useState('')
  const guides = selected.filter(v => `${v.title} ${v.chapterPreviews?.map(c=>c.title).join(' ') || ''}`.toLowerCase().includes(search.toLowerCase()))
  return <section aria-label="Your study guides">
    <header className="course-section-heading">
      <div><h2>Study guides</h2><p>Understand the course, one chapter at a time.</p></div>
      <Button variant="outline" size="sm" onClick={() => setCreating(true)}><PlusIcon/>Create study guide</Button>
    </header>
    {error ? <Alert variant="destructive"><AlertDescription>{error}<Button variant="outline" size="sm" className="mt-3" onClick={()=>setLoadRevision(n=>n+1)}>Try again</Button></AlertDescription></Alert>
      : versions === null ? <div role="status" aria-label="Loading study guides" className="space-y-4"><Skeleton className="h-16"/><Skeleton className="h-48"/></div>
      : selected.length ? <div className="study-library">
        <div className="study-library-toolbar"><p className="text-sm text-muted-foreground">{selected.length} {selected.length === 1 ? 'guide' : 'guides'} · {academicYear === 'all' ? 'All academic years' : academicYear}</p><input className="study-library-search" type="search" aria-label="Find a study guide" placeholder="Find a guide or chapter…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="study-library-grid">{guides.map(guide => {
          const chapters = guide.chapterPreviews || []
          const read = chapters.filter(c=>c.read).length
          const next = chapters.find(c=>!c.read) || chapters[0]
          const url = `/app/study/${guide.id}`
          return <article key={guide.id} className="study-library-guide">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpenIcon className="size-4"/><span>{guide.course.academicYear}</span><span className="ml-auto">{chapters.length} chapters</span></div>
            <h3 className="mt-4 text-lg font-semibold leading-6 text-balance"><Link href={url}>{guide.title}</Link></h3>
            {chapters.length ? <>
              <div className="my-5"><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>{read === chapters.length ? 'All chapters marked read' : read ? 'Keep going' : 'Ready when you are'}</span><span>{read} / {chapters.length} read</span></div><progress className="study-reader-progress" aria-label={`Reading progress for ${guide.title}`} value={read} max={chapters.length}/></div>
              <Link className={buttonVariants({size:'sm',className:'w-full justify-between'})} href={`${url}?chapter=${encodeURIComponent(next.id)}`}>{read === chapters.length ? 'Review guide' : read ? 'Continue studying' : 'Start studying'}<ArrowRightIcon/></Link>
              <details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-xs font-medium">Explore chapters</summary><ol className="mt-2 divide-y">{chapters.map((chapter,index)=><li key={chapter.id}><Link className="flex items-start gap-3 py-3 text-sm hover:text-primary" href={`${url}?chapter=${encodeURIComponent(chapter.id)}`}><span className="text-xs tabular-nums text-muted-foreground">{chapter.read ? <CheckIcon className="size-3.5" aria-label="Read"/> : String(index+1).padStart(2,'0')}</span><span>{chapter.title}</span></Link></li>)}</ol></details>
            </> : <div className="mt-5"><p className="mb-4 text-sm text-muted-foreground">{generationLabel(guide.draft)}</p><Link href={url} className={buttonVariants({size:'sm',variant:'outline'})}>View progress<ArrowRightIcon/></Link></div>}
          </article>
        })}</div>
        {!guides.length && <p role="status" className="py-8 text-sm text-muted-foreground">No guides match your search.</p>}
      </div> : <div className="course-band border-t py-10">
        <BookOpenIcon className="mb-4 size-7 text-muted-foreground"/>
        <h3 className="text-lg font-semibold">{versions?.length ? 'No guide for this academic year' : 'Your course starts with its materials'}</h3>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Create a guide from your slides, readings and notes. Each chapter includes explanations, a summary and practice.</p>
        <div className="mt-5 flex flex-wrap gap-3"><Button size="sm" onClick={()=>setCreating(true)}>{versions?.length ? 'Create study guide' : 'Create your first guide'}<ArrowRightIcon/></Button>{versions?.length ? <Button size="sm" variant="ghost" onClick={onShowAllYears}>Show all years</Button> : <Button size="sm" variant="ghost" onClick={()=>onNavigate('materials')}>Browse materials</Button>}</div>
      </div>}
    {academicYear!=='all'&&<CourseGuideAutomation course={{courseCode,courseName,academicYear,period}} onSaved={()=>setLoadRevision(n=>n+1)}/>}
    <div className="course-next-actions course-band">
      <button onClick={()=>onNavigate('exercises')}><TargetIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground"/><span><strong>Put it into practice</strong><small>Work through questions from every chapter.</small></span><ArrowRightIcon className="ml-auto mt-0.5 size-4 shrink-0 text-muted-foreground"/></button>
      <button onClick={()=>onNavigate('materials')}><FolderOpenIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground"/><span><strong>Go to the source</strong><small>Open the original slides, readings and notes.</small></span><ArrowRightIcon className="ml-auto mt-0.5 size-4 shrink-0 text-muted-foreground"/></button>
    </div>
    {!!shared.length && <section className="mt-8 border-t pt-6"><h3 className="text-base font-semibold">Shared by students</h3><p className="mt-1 text-xs text-muted-foreground">Community guides have not been editorially reviewed.</p><ul className="mt-4 divide-y">{shared.map(p=><li key={p.id}><Link href={`/app/study/shared/${p.id}`} className="flex items-center justify-between gap-4 py-4"><span><strong className="text-sm font-medium">{p.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{p.attribution} · {p.course.academicYear} · {p.chapters} chapters</span></span><ArrowRightIcon className="size-4"/></Link></li>)}</ul></section>}
    <Sheet open={creating} onOpenChange={setCreating}><SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"><SheetHeader className="border-b p-6"><SheetTitle>Create study guide</SheetTitle><SheetDescription>Choose the sources and scope for your guide.</SheetDescription></SheetHeader><div className="min-h-0 overflow-y-auto px-6 pb-6"><StudySourceForm course={{courseCode,courseName,academicYear,period}} onDone={id=>router.push(`/app/study/${id}`)} onCancel={()=>setCreating(false)}/></div></SheetContent></Sheet>
  </section>
}
