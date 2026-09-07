import { randomUUID } from 'node:crypto'
import { sql } from './db.mjs'
import { currentUserId } from './request-context.mjs'
import { activeProgrammeId } from './programme-scope.mjs'
import { readDocument, listDocuments, compareAndSwapDocument, DocumentConflictError } from './user-store.mjs'
import { discoverStudyDocuments, asStudyOwner } from './study-version-store.mjs'
import { queueWorkerAllowsUser, previewWorkerUsers } from './queue-runtime.mjs'
import { studyCourse, listStudySources, readStudySourceSnapshot } from './study-version-sources.mjs'
import { coursePracticeHost } from './study-course-practice.mjs'
import { paperKind } from './study-paper-bank.mjs'
import { createStudyPractice, stepStudyPractice, ownedPractice } from './study-practice.mjs'
import { digest, StudyVersionError } from './study-version-content.mjs'
import { resolveStudyBilling } from './study-ai-budget.mjs'

export const PAPER_JOBS = 'study-paper-jobs'
const uuid = value => digest(value).slice(0, 32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
export function paperJobRecord(owner, programmeId, course, source) {
  if (!['paper', 'exercises'].includes(paperKind(source))) return null
  return { id: `pap-${uuid([owner, programmeId, course.courseCode, source.key, source.sha256])}`, programmeId,
    course, sourceKey: source.key, sha256: source.sha256, title: source.title,
    revision: randomUUID(), status: 'queued', sections: [], completedSections: 0,
    createdAt: new Date().toISOString(), runAfter: 0, queueDeliveryUntil: 0, lease: null }
}
export async function enqueuePaper(course, source, programmeId = null) {
  const record = paperJobRecord(currentUserId(), programmeId || await activeProgrammeId(), course, source)
  if (!record) return null
  try { return await compareAndSwapDocument(PAPER_JOBS, record.id, record, null) }
  catch (e) { if (!(e instanceof DocumentConflictError)) throw e; return readDocument(PAPER_JOBS, record.id, null) }
}
// Called inside the ingestion transaction: delivery cannot be lost between
// publishing the source and marking the resource complete.
export async function indexedPaperJob(owner, binding, sourcePath, sha256) {
  const title=sourcePath.split('/').at(-1)
  if (!queueWorkerAllowsUser(owner) || !['paper','exercises'].includes(paperKind({title}))) return null
  return asStudyOwner(owner, async () => paperJobRecord(owner, await activeProgrammeId(), studyCourse({
    courseCode: binding.course_code, courseName: binding.course_name || binding.course_code,
    academicYear: binding.academic_year || 'undated', period: binding.period,
  }), { key: `canvas-${digest([binding.id, sourcePath]).slice(0, 32)}`, title, sha256 }))
}
export async function queueCoursePapers(course, { sourceOptions = {} } = {}) {
  if (!queueWorkerAllowsUser(currentUserId())) throw new StudyVersionError('Background processing is not configured for this account.', 503)
  const sources = await listStudySources(course, sourceOptions), programme = await activeProgrammeId()
  const jobs = []
  for (const source of sources) {
    const job = await enqueuePaper(course, source, programme)
    if (job) jobs.push(job)
  }
  return jobs
}
export function paperJobSummary(job) {
  return { id: job.id, sourceKey: job.sourceKey, sha256: job.sha256, status: job.status,
    completedSections: job.completedSections, totalSections: job.sections.length,
    setId: job.setId || null, error: job.error || null }
}
export async function retryPaperJob(id) {
  const old = await readDocument(PAPER_JOBS, id, null)
  if (!old || old.programmeId !== await activeProgrammeId()) throw new StudyVersionError('Paper processing not found.', 404)
  if (old.status !== 'paused') return old
  const next = { ...old, revision: randomUUID(), status: 'queued', error: null, billing: null, retry: true, runAfter: 0, queueDeliveryUntil: 0 }
  return compareAndSwapDocument(PAPER_JOBS, id, next, old.revision)
}
// Whole pages stay intact. One-page overlap retains questions crossing a
// boundary; exact duplicate questions are removed when the sections are joined.
export function paperSections(chunks) {
  const pages = [...new Set(chunks.map(c => c.page))]
  if (pages.some(p => !Number.isInteger(p) || p < 1)) {
    if (chunks.reduce((n,c)=>n+c.text.length,0)>40000) throw new StudyVersionError('This paper needs page numbers before it can be processed automatically.')
    return [{ from: 1, to: 10000 }]
  }
  pages.sort((a,b)=>a-b)
  const sizes = new Map(pages.map(p=>[p,chunks.filter(c=>c.page===p).reduce((n,c)=>n+c.text.length,0)]))
  if ([...sizes.values()].some(n=>n>40000)) throw new StudyVersionError('A page is too large for automatic extraction. Review its extracted text.')
  const sections = []
  for (let start=0; start<pages.length;) {
    let end=start, size=sizes.get(pages[start])
    while (end+1<pages.length && end-start<5 && size+sizes.get(pages[end+1])<=40000) { end++; size+=sizes.get(pages[end]) }
    sections.push({ from: pages[start], to: pages[end] })
    if (end===pages.length-1) break
    start=end>start ? end : end+1
  }
  return sections
}
export function combinePaperSections(records) {
  const questions=[], seen=new Map(), warnings=new Set()
  for (const r of records) {
    for (const w of r.result.warnings || []) warnings.add(w)
    for (const q of r.result.questions) {
      const key=digest([q.page,q.label,q.question.replace(/\s+/g,' ').trim(),q.sharedContext.replace(/\s+/g,' ').trim()])
      const existing=seen.get(key)
      if (existing) {
        if (JSON.stringify([existing.options,existing.answer,existing.correctOptions,existing.marks])!==JSON.stringify([q.options,q.answer,q.correctOptions,q.marks]))
          throw new StudyVersionError('Overlapping sections disagree about an answer or question. Review extraction before practising.')
        existing.sourceIds=[...new Set([...existing.sourceIds,...q.sourceIds])]
        existing.answerSourceIds=[...new Set([...existing.answerSourceIds,...q.answerSourceIds])]
      } else { const item={...q,id:`q-${questions.length+1}`}; seen.set(key,item);questions.push(item) }
    }
  }
  return { questions, warnings:[...warnings] }
}
export async function processPaperJob(id, { sourceOptions = {}, platform = {}, generate } = {}) {
  let job = await readDocument(PAPER_JOBS, id, null)
  if (!job || !['queued','running'].includes(job.status)) return { again:false }
  if (job.lease?.until>Date.now()) return { again:true,delay:30 }
  const token=randomUUID(), oldRevision=job.revision
  job={...job,revision:randomUUID(),status:'running',queueDeliveryUntil:0,lease:{token,until:Date.now()+300000}}
  try { await compareAndSwapDocument(PAPER_JOBS,id,job,oldRevision) }
  catch(e) { if(e instanceof DocumentConflictError) return {again:true,delay:15};throw e }
  try {
    const available=await listStudySources(job.course,sourceOptions)
    if(!available.some(s=>s.key===job.sourceKey && s.sha256===job.sha256)) throw new StudyVersionError('The original changed or access was removed. Sync again to process the current paper.',409)
    if (!job.snapshot) {
      job.snapshot=await readStudySourceSnapshot(job.course,[job.sourceKey],{...sourceOptions,includeHistorical:true})
      job.sections=paperSections(job.snapshot.chunks)
      const host=await coursePracticeHost(job.course,job.programmeId)
      job.versionId=host.id;job.revisionId=host.activeRevisionId
    }
    job.billing ||= await resolveStudyBilling({},platform)
    const section=job.sections[job.completedSections]
    if(section) {
      if (!section.id) {
        const record=await createStudyPractice(job.versionId,{mode:'extract',questionSourceKey:job.sourceKey,includeHistorical:true,
          revisionId:job.revisionId,fromPage:section.from,toPage:section.to}, {sourceOptions,billing:job.billing,billingJobKey:job.id})
        section.id=record.id;section.versionId=record.versionId
      }
      const saved=await ownedPractice(section.id,section.versionId,{sourceOptions})
      // A settings change can unblock a paused job, but never silently switches payer.
      if(job.retry && saved.status==='failed') await compareAndSwapDocument('study-practice',saved.id,{...saved,revision:randomUUID(),billing:job.billing,billingJobKey:job.id},saved.revision)
      const next=await stepStudyPractice(section.versionId,section.id,{sourceOptions,generate,retry:job.retry===true})
      job.retry=false
      if(next.status==='failed') throw new StudyVersionError(next.error || 'Question extraction needs attention.')
      if(next.status==='complete') job.completedSections++
    }
    if(job.completedSections===job.sections.length) {
      const records=[]
      for(const part of job.sections) records.push(await ownedPractice(part.id,part.versionId,{sourceOptions}))
      const result={title:job.title.replace(/\.pdf$/i,''),...combinePaperSections(records)}
      const setId=`sp-${uuid([job.id,'complete-paper'])}`
      const set={...records[0],id:setId,revision:randomUUID(),versionId:job.versionId,revisionId:job.revisionId,
        status:'complete',stage:'complete',snapshot:job.snapshot,result,autoPaperJobId:job.id,createdAt:new Date().toISOString(),lease:null}
      // The source may have been revoked while the model was running.
      const current=await listStudySources(job.course,sourceOptions)
      if(!current.some(s=>s.key===job.sourceKey && s.sha256===job.sha256)) throw new StudyVersionError('The original changed during processing. Sync again.',409)
      try {await compareAndSwapDocument('study-practice',setId,set,null)} catch(e){if(!(e instanceof DocumentConflictError))throw e}
      job.setId=setId;job.status='complete'
    }
  } catch(e) { job.status='paused';job.error=e.status ? e.message : 'Paper processing could not finish. Finished sections are saved; retry when ready.' }
  const latest=await readDocument(PAPER_JOBS,id,null)
  if(latest?.lease?.token!==token) return {again:false}
  job={...job,revision:randomUUID(),lease:null,updatedAt:new Date().toISOString()}
  await compareAndSwapDocument(PAPER_JOBS,id,job,latest.revision)
  return {again:job.status==='running',delay:0}
}
export async function resolvePaperJob(id) {
  const rows=sql ? await sql`SELECT user_id AS owner,document_key AS key,value FROM user_documents WHERE namespace=${PAPER_JOBS} AND document_key=${id} LIMIT 1`
    : (await discoverStudyDocuments(PAPER_JOBS)).filter(r=>r.key===id)
  return rows[0] || null
}
export async function claimPaperDispatch() {
  const now=Date.now()
  const rows=sql ? await sql`SELECT user_id AS owner,document_key AS key,value FROM user_documents WHERE namespace=${PAPER_JOBS}
    AND value->>'status' IN ('queued','running') AND coalesce((value->>'queueDeliveryUntil')::numeric,0)<=${now}
    AND coalesce((value->'lease'->>'until')::numeric,0)<=${now}
    AND (${process.env.VERCEL_ENV !== 'preview'} OR user_id=ANY(${previewWorkerUsers()}::text[])) ORDER BY updated_at LIMIT 10`
    : await discoverStudyDocuments(PAPER_JOBS)
  const ids=[]
  for(const row of rows) {
    if(!queueWorkerAllowsUser(row.owner))continue
    try { await asStudyOwner(row.owner,async()=>{
      const j=await readDocument(PAPER_JOBS,row.key,null)
      if(!j || !['queued','running'].includes(j.status) || j.queueDeliveryUntil>now || j.lease?.until>now) return
      await compareAndSwapDocument(PAPER_JOBS,j.id,{...j,revision:randomUUID(),queueDeliveryUntil:now+300000},j.revision)
      ids.push(j.id)
    }) } catch(e) {if(!(e instanceof DocumentConflictError))throw e}
    if(ids.length>=10)break
  }
  return ids
}
