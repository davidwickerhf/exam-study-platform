import { randomUUID } from 'node:crypto'
import { readDocument, compareAndSwapDocument, DocumentConflictError } from './user-store.mjs'
import { digest, mapPrompt, mapSchema, studyResponseSchema, assertEvidence, evidenceBatches, evidencePrompt } from './study-version-content.mjs'
import { canonicalReviewValue } from './study-review-dependencies.mjs'

// Account isolation is provided by user-store; programme and edition are also
// part of the identity. Local-authored maps never become hosted-trusted maps.
const namespace='study-course-plans'
const hash=value=>digest(canonicalReviewValue(value))
const byId=items=>[...items].sort((a,b)=>String(a.id || a.key).localeCompare(String(b.id || b.key)))
const keyFor=version=>hash([version.programmeId,version.course.courseCode,version.course.academicYear,version.course.period || ''])
const scopeSource=(source,course)=>(!source.academicYear || source.academicYear===course.academicYear) && (source.announcement || /announcement|syllabus|course.?manual|course.?overview|reading.?list/i.test(source.title))
const sourceView=({key,title,kind,academicYear,period,sha256,editionId,bindingId,announcement})=>({key,title,kind,academicYear,period,sha256,editionId,bindingId,announcement})
function contextFor(version,work) {
 const keys=new Set(work.snapshot.sources.filter(s=>scopeSource(s,version.course)).map(s=>s.key))
 return hash({course:version.course,execution:work.execution || 'hosted',moduleScope:work.moduleReadiness?.scope || null,
  scope:byId(work.snapshot.chunks.filter(c=>keys.has(c.sourceKey))),scopeSources:byId(work.snapshot.sources.filter(s=>keys.has(s.key)).map(sourceView)),
  rules:[mapPrompt.toString(),evidencePrompt(version.course,[],[])],schema:studyResponseSchema(mapSchema)})
}
function batchIdentity(snapshot,batch) {
 const keys=new Set(batch.map(c=>c.sourceKey))
 return hash({chunks:byId(batch),sources:byId(snapshot.sources.filter(s=>keys.has(s.key)).map(sourceView))})
}
export async function readCoursePlan(version) {return readDocument(namespace,keyFor(version),null)}
async function changePlan(version,change) {
 for(let i=0;i<5;i++){
  const old=await readCoursePlan(version),next=structuredClone(old || {course:version.course,maps:{},guides:{}})
  change(next);next.revision=randomUUID();next.updatedAt=new Date().toISOString()
  try{await compareAndSwapDocument(namespace,keyFor(version),next,old?.revision || null);return next}catch(e){if(!(e instanceof DocumentConflictError)||i===4)throw e}
 }
}
export async function courseMappingBatches(version,work) {
 // Saved in-progress runs keep their original boundaries and completed maps.
 if(work.mappingBatches)return work.mappingBatches.map(ids=>ids.map(id=>work.snapshot.chunks.find(c=>c.id===id)))
 if(work.maps.length)return evidenceBatches(work.snapshot.chunks)
 const saved=await readCoursePlan(version),used=new Set(),batches=[],context=contextFor(version,work)
 for(const entry of Object.values(saved?.maps || {}).sort((a,b)=>b.evidenceIds.length-a.evidenceIds.length || a.key.localeCompare(b.key))){
  if(entry.context!==context || entry.evidenceIds.some(id=>used.has(id)))continue
  const batch=entry.evidenceIds.map(id=>work.snapshot.chunks.find(c=>c.id===id))
  if(batch.some(c=>!c) || batchIdentity(work.snapshot,batch)!==entry.identity)continue
  // Corrupt cached records never bypass normal map and citation validation.
  try{assertEvidence(mapSchema.parse(entry.result),batch)}catch{continue}
  batches.push(batch);batch.forEach(c=>used.add(c.id))
 }
 batches.push(...evidenceBatches(work.snapshot.chunks.filter(c=>!used.has(c.id))))
 work.mappingBatches=batches.map(batch=>batch.map(c=>c.id))
 return batches
}
// At most two halvings of one mapping batch after a provider output limit. This
// changes batching only: accepted maps and their citations stay untouched, and
// the persisted batch list makes a resumed run repeat the same boundaries. No
// model, effort or output cap is raised automatically.
export const MAPPING_OUTPUT_RECOVERY_LIMIT=2
export function splitMappingBatch(work,index) {
 const ids=work.mappingBatches?.[index]
 if(!ids || ids.length<2)return false
 const level=work.mappingRecoveries?.[hash(ids)] || 0
 if(level>=MAPPING_OUTPUT_RECOVERY_LIMIT)return false
 const half=Math.ceil(ids.length/2),parts=[ids.slice(0,half),ids.slice(half)]
 work.mappingBatches=[...work.mappingBatches.slice(0,index),...parts,...work.mappingBatches.slice(index+1)]
 work.mappingRecoveries={...work.mappingRecoveries,...Object.fromEntries(parts.map(part=>[hash(part),level+1]))}
 return true
}
export async function reusableCourseMap(version,work,batch) {
 const identity=batchIdentity(work.snapshot,batch),context=contextFor(version,work),entry=(await readCoursePlan(version))?.maps?.[hash([context,identity])]
 if(!entry)return null
 try{return assertEvidence(mapSchema.parse(entry.result),batch)}catch{return null}
}
export async function saveCourseMap(version,work,batch,result) {
 const clean=assertEvidence(mapSchema.parse(result),batch),identity=batchIdentity(work.snapshot,batch),context=contextFor(version,work),key=hash([context,identity])
 await changePlan(version,plan=>{
  plan.maps[key]={key,identity,context,evidenceIds:batch.map(c=>c.id),result:clean,originVersionId:version.id,execution:work.execution || 'hosted'}
 })
}
const conceptKey=title=>String(title).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
export function planningProjection(work) {
 const chapters=work.topics || [],complete=new Set((work.chapters || []).filter(c=>c.review==='passed').map(c=>c.id))
 const pending=chapters.filter(t=>!complete.has(t.id)),seen=new Map(),duplicateConcepts=[]
 for(const topic of chapters)for(const concept of new Set(topic.concepts || [topic.title])){
  const key=conceptKey(concept);if(!key)continue
  const prior=seen.get(key)
  if(prior && prior!==topic.id)duplicateConcepts.push({concept,chapterIds:[prior,topic.id]});else seen.set(key,topic.id)
 }
 return {plannedChapters:chapters.length,remainingChapters:pending.length,uniqueNamedConcepts:seen.size,duplicateConcepts,
  baselineReviewTasks:pending.length*4,baselineAuthorTasks:pending.reduce((n,t)=>n+(work.teachingPlans?.[t.id]?1:2),0),
  estimatedUsd:null,basis:'First-pass baseline: blind solving, answer comparison, content and teaching review per unchecked chapter. Saved checks may reduce it; payload splits and corrections add tasks. No measured model-price forecast yet.'}
}
export async function registerCourseOutline(version,work) {
 const projection=planningProjection(work)
 const plan=await changePlan(version,plan=>{plan.guides[version.id]={versionId:version.id,revisionId:work.id,title:version.title,execution:work.execution || 'hosted',sourceHash:work.snapshot.sourceHash,
  topics:work.topics.map(({id,title,concepts,sourceIds})=>({id,title,concepts:concepts || [title],sourceIds})),projection}})
 const others=Object.values(plan.guides).filter(g=>g.versionId!==version.id && g.execution===(work.execution || 'hosted'))
 const overlappingGuides=others.flatMap(g=>{
  const keys=new Set(g.topics.flatMap(t=>t.concepts.map(conceptKey)))
  const concepts=[...new Set(work.topics.flatMap(t=>t.concepts || [t.title]).filter(c=>keys.has(conceptKey(c))))]
  return concepts.length?[{versionId:g.versionId,title:g.title,concepts}]:[]
 })
 work.planning={...projection,reusedSourceMaps:work.reusedSourceMaps || 0,overlappingGuides}
 return work.planning
}


export function checkPlanningBudget(version,work) {
 // Admission uses the existing explicitly configurable task allowance, not an
 // invented dollar forecast. Revisions/partially reviewed runs keep their cache.
 if((work.execution || 'hosted')!=='local' || work.refreshFrom || work.chapters.length || work.repair || !work.planning)return null
 const used=(version.localReceipts || []).filter(r=>['reviewer','independent-solver'].includes(r.task?.role)).length
 const available=(version.localReviewTaskBudget ?? 128)-used
 return work.planning.baselineReviewTasks>available
  ? `This outline plans ${work.planning.plannedChapters} chapters and at least ${work.planning.baselineReviewTasks} first-pass review tasks, exceeding the ${Math.max(0,available)} tasks remaining. The outline is saved. Reduce its source scope or explicitly adjust the review-task budget before drafting.`
  : null
}

export async function coursePlanSummary(version,visibleVersionIds) {
 const plan=await readCoursePlan(version);if(!plan)return null
 const guides=Object.values(plan.guides).filter(g=>visibleVersionIds.includes(g.versionId)),concepts=new Map()
 for(const guide of guides)for(const topic of guide.topics)for(const title of topic.concepts){
  const key=conceptKey(title),entry=concepts.get(key) || {concept:title,assignments:[]}
  if(!entry.assignments.some(a=>a.versionId===guide.versionId && a.chapterId===topic.id))entry.assignments.push({versionId:guide.versionId,chapterId:topic.id})
  concepts.set(key,entry)
 }
 return {course:plan.course,indexedMapBatches:Object.keys(plan.maps).length,guides:guides.map(g=>({versionId:g.versionId,title:g.title,revisionId:g.revisionId,projection:g.projection})),
  concepts:[...concepts.values()],potentialDuplicateResponsibilities:[...concepts.values()].filter(c=>c.assignments.length>1),
  baselineReviewTasks:guides.reduce((n,g)=>n+g.projection.baselineReviewTasks,0),estimatedUsd:null,
  limitation:'A shared index of mapped evidence and registered outlines, not a completed or semantically deduplicated whole-course curriculum. Concept-name overlaps need scope review; no material is discarded automatically.'}
}
