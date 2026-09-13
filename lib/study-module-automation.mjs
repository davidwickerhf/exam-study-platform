import { STUDY_GENERATION_LIMITS as generationLimits } from './study-generation-limits.mjs'
import { recurringEnabled, automaticGuideAllowed } from './study-recurring-policy.mjs'
import { refreshStudyVersion } from './study-version-pipeline.mjs'
import { randomUUID } from 'node:crypto'
import { z } from 'zod/v3'
import { sql } from './db.mjs'
import { readDocument, listDocuments, compareAndSwapDocument, DocumentConflictError } from './user-store.mjs'
import { currentAuth, currentUserId } from './request-context.mjs'
import { activeProgrammeId } from './programme-scope.mjs'
import { digest, StudyVersionError } from './study-version-content.mjs'
import { studyCourse, listStudySources, readStudySourceSnapshot } from './study-version-sources.mjs'
import { createStudyVersion, ownStudyVersion, studyRevision, discoverStudyDocuments, asStudyOwner } from './study-version-store.mjs'
import { resolveStudyBilling } from './study-ai-budget.mjs'
import { inferModuleCandidate, historicalModuleSuggestions } from './study-module-readiness.mjs'
import { queueWorkerAllowsUser } from './queue-runtime.mjs'
export const MODULE_SETTINGS = 'study-module-settings'
export const MODULE_INVENTORIES = 'canvas-module-inventories'
const keyFor = course => digest([course.courseCode,course.academicYear,course.period])
const settingsSchema = z.object({enabled:z.boolean(),execution:z.enum(['hosted','local']),rule:z.enum(['auto','weekly','topic','textbook']),historicalMode:z.enum(['none','suggest','supplement']).default('suggest'),
  supportingSourceKeys:z.array(z.string().min(1).max(150)).max(30),
  billing:z.object({source:z.enum(['platform','personal']),quality:z.enum(['standard','enhanced','sol','astra']),maxJobUsd:z.number().min(0.05).max(10)})})
const defaults = {enabled:false,execution:'local',rule:'auto',historicalMode:'suggest',supportingSourceKeys:[],billing:{source:'platform',quality:'standard',maxJobUsd:generationLimits.defaultJobUsd}}
export async function moduleGuideStatus(course, {sourceOptions={}}={}) {
  const settings = await readDocument(MODULE_SETTINGS,keyFor(course),null)
  const programmeId = await activeProgrammeId()
  const own = settings?.programmeId === programmeId ? settings : null
  const sources = await listStudySources(course, sourceOptions)
  const modules=[]
  for (const module of own?.modules || []) {
    const version = module.versionId ? await ownStudyVersion(module.versionId).catch(()=>null) : null
    const decision=version?.draft?.moduleReadiness || (version?.activeRevisionId ? (await studyRevision(version))?.moduleReadiness : null)
    modules.push({...module, generationStatus:version && !await automaticGuideAllowed(version.automation,version.draft.execution)?'paused':version?.draft?.status, error:version?.draft?.error || module.error,
      decision, url:version?`/app/study/${version.id}`:null})
  }
  return {settings:own?.settings || defaults, checkedAt:own?.checkedAt || null, error:own?.error || null, modules,
    sources:sources.map(s=>({key:s.key,title:s.title,historical:s.historical,academicYear:s.academicYear})),
    limitation:'Readiness is inferred from available materials, not student mastery. Local work waits for your connected agent. Textbook references require readable chapter content.'}
}
export async function saveModuleGuideSettings(course, input, options={}) {
  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) throw new StudyVersionError('Choose valid automatic guide settings and a per-revision budget ($0.05–$10).')
  const settings=parsed.data
  if (currentAuth().mode==='api-key' && settings.execution!=='local') throw new StudyVersionError('Enable hosted automatic generation from the course page.',403)
  const available=await listStudySources(course,options.sourceOptions)
  if(settings.supportingSourceKeys.some(key=>!available.some(s=>s.key===key))) throw new StudyVersionError('A supporting reading is no longer available. Reload sources.',409)
  if(settings.enabled && settings.execution==='hosted') await resolveStudyBilling(settings.billing,options.platform)
  const key=keyFor(course),old=await readDocument(MODULE_SETTINGS,key,null),programmeId=await activeProgrammeId()
  const next={...(old?.programmeId===programmeId?old:{}),course,programmeId,settings,revision:randomUUID(),checkedAt:null,leaseUntil:0}
  await compareAndSwapDocument(MODULE_SETTINGS,key,next,old?.revision??null)
  // Existing jobs keep their chosen payer and execution mode. Pausing prevents
  // their next call through automaticGuideAllowed; re-enabling resumes them.
  await reconcileModuleGuides(key,options)
  return moduleGuideStatus(course,options)
}
const versionId = value => {const h=digest(value).slice(0,32);return `sv-${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`}
export async function reconcileModuleGuides(key, {sourceOptions={},platform={},now=Date.now()}={}) {
  let row=await readDocument(MODULE_SETTINGS,key,null)
  if(!await recurringEnabled('guides') || !row?.settings.enabled || row.programmeId!==await activeProgrammeId() || row.leaseUntil>now) return
  const inventories=(await listDocuments(MODULE_INVENTORIES)).map(r=>r.value).filter(i=>i.course.courseCode===row.course.courseCode && i.course.academicYear===row.course.academicYear && String(i.course.period||'')===row.course.period)
  const sourceList=await listStudySources(row.course,sourceOptions)
  const inventoryHash=digest([inventories,sourceList.map(s=>[s.key,s.sha256])])
  if(row.checkedAt && !row.pendingWork && now-new Date(row.checkedAt).getTime()<24*3600000 && inventoryHash===row.inventoryHash)return
  const claimed={...row,revision:randomUUID(),leaseUntil:now+300000}
  try {await compareAndSwapDocument(MODULE_SETTINGS,key,claimed,row.revision)} catch(e){if(e instanceof DocumentConflictError)return;throw e}
  row=structuredClone(claimed)
  try {
    const sources=sourceList
    const modules=[]
    let prepared=0
    row.pendingWork=false
    const permitted=sql?await sql`SELECT a.binding_id FROM canvas_corpus_access a JOIN canvas_course_bindings b ON b.id=a.binding_id JOIN canvas_corpus_permissions p ON p.user_id=a.user_id AND p.origin=b.origin WHERE a.user_id=${currentUserId()} AND NOT a.sync_paused AND a.auto_refresh AND p.collection_enabled AND p.refresh_enabled AND p.study_status='studying'`:null
    for(const inventory of inventories) {
      if(permitted && !permitted.some(p=>p.binding_id===inventory.bindingId))continue
      // Never infer from a revoked or inaccessible course collection.
      const editionSources=sources.filter(s=>(s.bindingId===inventory.bindingId && (s.announcement || !inventory.sourcePaths || inventory.sourcePaths.includes(s.sourcePath))) || row.settings.supportingSourceKeys.includes(s.key))
      if(!editionSources.some(s=>s.bindingId===inventory.bindingId))continue
      for(const module of inventory.modules) {
        const identity=`${inventory.bindingId}:${module.id}`
        const prior=row.modules?.find(m=>m.identity===identity)
        const suggestions=row.settings.historicalMode==='none'?[]:historicalModuleSuggestions(module,sources,row.course.academicYear)
        const supplemental=row.settings.historicalMode==='supplement'?suggestions.filter(s=>s.academicYear===suggestions[0]?.academicYear):[]
        const candidate={bindingId:inventory.bindingId,historicalSuggestions:suggestions.map(s=>({key:s.key,title:s.title,academicYear:s.academicYear})),appliedSignature:prior?.appliedSignature,...inferModuleCandidate(module,inventory.modules,[...editionSources,...supplemental],prior,{...row.settings,now,supportingSourceKeys:[...row.settings.supportingSourceKeys,...supplemental.map(s=>s.key)]}),identity}
        candidate.collectionGaps=inventory.skipped || []
        if(prior?.versionId) candidate.versionId=prior.versionId
        if(candidate.status==='candidate' && (!prior?.versionId || prior.appliedSignature!==candidate.signature)) {
          const existingId=prior?.versionId || versionId([currentUserId(),row.programmeId,key,identity])
          const active=await ownStudyVersion(existingId).catch(()=>null)
          if(active && ['queued','running','local-ready','local-running','waiting-local','stopped'].includes(active.draft?.status)) {
            candidate.versionId=active.id;candidate.status='queued';candidate.appliedSignature=prior?.appliedSignature
            row.pendingWork ||= active.draft.status!=='stopped'
            candidate.error='Source update pending. Finish or stop the current generation, then refresh its sources.'
            modules.push(candidate);continue
          }
          if(prepared>=2){row.pendingWork=true;modules.push(candidate);continue}
          prepared++
          try {
            const snapshot=await readStudySourceSnapshot(row.course,candidate.sourceKeys,{...sourceOptions,includeHistorical:true})
            if(snapshot.excluded.length) throw new StudyVersionError('Some selected materials have no readable text. Finish extraction before generating.')
            // Recheck settings after I/O. A concurrent opt-out cannot enqueue.
            const current=await readDocument(MODULE_SETTINGS,key,null)
            if(current?.revision!==claimed.revision)return
            const billing=row.settings.execution==='local'?{source:'local',model:'local-agent',provider:'local'}:await resolveStudyBilling(row.settings.billing,platform)
            const id=prior?.versionId || versionId([currentUserId(),row.programmeId,key,identity])
            const existing=await ownStudyVersion(id).catch(()=>null)
            if(existing && existing.draft?.snapshot?.sourceHash!==snapshot.sourceHash && !['queued','running','local-ready','local-running','waiting-local','stopped'].includes(existing.draft?.status)) {
              await refreshStudyVersion(id,{sourceKeys:candidate.sourceKeys},{...sourceOptions,includeHistorical:true,billing,execution:row.settings.execution,moduleCandidate:candidate})
            }
            const version=existing || await createStudyVersion(row.course,row.programmeId,snapshot,{id,title:`${module.name} · automatic guide`,billing,execution:row.settings.execution,automation:{settingsKey:key,candidate}})
            candidate.versionId=version.id;candidate.status='queued';candidate.appliedSignature=candidate.signature
            if(existing && existing.draft?.snapshot?.sourceHash!==snapshot.sourceHash && ['queued','running','local-ready','local-running','waiting-local','stopped'].includes(existing.draft?.status)) { candidate.appliedSignature=prior?.appliedSignature;row.pendingWork ||= existing.draft.status!=='stopped';candidate.error='Source update pending. Finish or stop the current generation, then refresh its sources.' }
          } catch(e) {candidate.status='needs-attention';candidate.error=e.status?e.message:'Automatic guide preparation could not finish. It will be checked again.'}
        }
        if(candidate.versionId && !candidate.error)candidate.status='queued'
        modules.push(candidate)
      }
    }
    row.events=[{at:new Date(now).toISOString(),message:`Checked ${modules.length} modules: ${modules.filter(m=>m.versionId).length} have guide runs; ${modules.filter(m=>m.status==='gathering').length} are gathering evidence.`,details:modules.map(m=>({title:m.title,status:m.status,reasons:m.blockers,error:m.error}))},...(row.events||[])].slice(0,50)
    row.modules=modules;row.error=inventories.length?null:'Waiting for the next complete Canvas material refresh to discover module boundaries.'
  } catch(e) {row.error=e.status?e.message:'Module readiness could not be checked. The next refresh will retry.'}
  row.checkedAt=new Date(now).toISOString();row.inventoryHash=inventoryHash;row.leaseUntil=0;row.revision=randomUUID()
  try {await compareAndSwapDocument(MODULE_SETTINGS,key,row,claimed.revision)} catch(e){if(!(e instanceof DocumentConflictError))throw e}
}
export async function scheduleModuleGuides(options={}) {
  // Read-only policy selection; existing Canvas consent and refresh pause win.
  const rows=sql?await sql`SELECT d.user_id AS owner,d.document_key AS key,d.value FROM user_documents d
    WHERE namespace=${MODULE_SETTINGS} AND value->'settings'->>'enabled'='true'
      AND NOT EXISTS(SELECT 1 FROM user_documents policy WHERE policy.user_id=d.user_id AND policy.namespace='study-recurring-pipelines' AND policy.document_key='settings' AND policy.value->'settings'->>'guides'='false')
      AND EXISTS(SELECT 1 FROM canvas_corpus_permissions p WHERE p.user_id=d.user_id AND p.collection_enabled AND p.refresh_enabled AND p.study_status='studying')
      AND (d.value->>'pendingWork'='true' OR d.value->>'checkedAt' IS NULL OR (d.value->>'checkedAt')::timestamptz<now()-interval '24 hours'
        OR EXISTS(SELECT 1 FROM user_documents changed WHERE changed.user_id=d.user_id AND changed.namespace='canvas-module-inventories' AND changed.updated_at>(d.value->>'checkedAt')::timestamptz)
        OR EXISTS(SELECT 1 FROM canvas_source_snapshots notice WHERE notice.contributor_user_id=d.user_id AND notice.resource_type='announcements' AND notice.last_seen_at>(d.value->>'checkedAt')::timestamptz))
    ORDER BY d.updated_at LIMIT 10`:await discoverStudyDocuments(MODULE_SETTINGS)
  const until=Date.now()+30000
  for(const row of rows) {
    if(Date.now()>=until)break
    if(queueWorkerAllowsUser(row.owner))try {await asStudyOwner(row.owner,()=>reconcileModuleGuides(row.key,options))}catch{console.warn('Module readiness deferred for one account; other queues remain available.')}
  }
}
export async function localGenerationQueue() {
  const programme=await activeProgrammeId(),versions=[]
  for(const {value:v} of await listDocuments('study-versions')) {
    if(v.programmeId===programme && v.draft?.execution==='local' && ['local-ready','local-running','waiting-local'].includes(v.draft.status) && await automaticGuideAllowed(v.automation,'local'))
      versions.push({id:v.id,title:v.title,course:v.course,status:v.draft.status,stage:v.draft.stage,url:`/app/study/${v.id}`})
  }
  return {versions}
}
