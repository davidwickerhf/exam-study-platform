import {z} from 'zod/v3'
import {outlineSchema,outlineCandidates,resolveOutlineGroups,outlinePrompt,digest,StudyVersionError} from './study-version-content.mjs'
import {createStudyVersion,ownStudyVersion,mutateStudyVersion,saveStudyRevision,listCourseBundleChildren} from './study-version-store.mjs'

// PUBLICATION FENCE. Children are materialized in two phases. stageCourseBundle
// writes each child document and its immutable revision while the child stays
// invisible (courseBundleParent.state='staged', active:false, no
// activeRevisionId), so it cannot be listed, opened or claimed. The parent then
// records the publication decision inside its own lease-checked commit
// (bundlePublication={revisionId,state:'publishing'}); only afterwards does
// publishCourseBundle flip visibility. Every child write re-reads the parent and
// requires either the worker's live lease token for the parent's current draft,
// or a parent publication already naming this exact revision (the idempotent
// repair path), so a stale or superseded worker can neither create nor repoint a
// child. Identities are derived from (parent version, guide) and (parent
// revision, guide), so a crash anywhere plus a retry converges on the same child
// ids, the same immutable child revision and a single active revision each.
//
// SNAPSHOT SHARING. A child does not copy the parent's source snapshot. It
// stores a scoped view: {ref:{versionId,revisionId}} pointing at the parent's
// immutable revision, the parent's sourceHash verbatim (so sourceHash refresh
// guards and history entries keep comparing at course level), the source records
// actually cited by that guide (full Canvas/editorial access provenance: key,
// sha256, assetId, editionId, bindingId, edition), and the cited chunk ids.
// study-version-store hydrates chunks from the referenced parent revision on
// read, so every existing reader still sees a complete snapshot object.
export const courseBundleOutlineSchema=z.object({
 guides:z.array(z.object({id:z.string().regex(/^[a-z0-9-]{1,70}$/),title:z.string().min(1).max(180),topics:outlineSchema.shape.topics})).min(2).max(12),
 gaps:outlineSchema.shape.gaps
})
const conceptKey=value=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
// Administrative-only material maps to topics:[] by contract. Planning guides for
// it would request invented teaching, so refuse before spending an outline call.
export function assertTeachableBundle(maps){
 if(!maps.some(map=>map.topics?.length))throw new StudyVersionError('The selected material contains no teachable topics; it is course administration only. Select lecture, reading or exercise material before planning a whole-course bundle.',422)
}
export function courseBundlePrompt(course,maps,previous,capacity){
 return outlinePrompt(course,maps,previous?.topics||[],capacity)+`\nWHOLE-COURSE GUIDE BUNDLE. Plan all selected course material ONCE and divide it into distinct study guides, each containing coherent chapters. Do not make a single giant guide, repeat the course introduction in every guide, or create guides merely for different source years. Assign each substantive concept one primary teaching home. Brief prerequisites can be recalled elsewhere without duplicating their objectives, examples, practice banks and flashcards. Merge repeated descriptions of the same concept across maps into that home. Keep full supporting evidence by grouping their topicRefs together. Current-edition scope governs assessment; preserve useful historical explanation as provisional and never turn historical administration into current requirements. Guide and chapter ceilings are capacity limits, not targets: do not fill them. Use the smallest coherent course curriculum that preserves the mapped concepts. Retain existing guide IDs and chapter IDs when their responsibilities are unchanged. Previous guides: ${JSON.stringify(previous?.guides||[])}. Return {guides:[{id,title,topics:[{id,title,topicRefs}]}],gaps:[]}; assign every mapped ref exactly once across the WHOLE bundle, not once per guide. At most 40 chapters in total before evidence-capacity splitting.`
}
export function resolveCourseBundle(result,maps){
 const groups=result.guides.flatMap(guide=>guide.topics.map(topic=>({...topic,guideId:guide.id})))
 if(groups.length>40)throw new StudyVersionError('The course plan exceeds 40 chapters. Consolidate related concepts before authoring.',422)
 if(new Set(result.guides.map(g=>g.id)).size!==result.guides.length || new Set(groups.map(t=>t.id)).size!==groups.length)throw new StudyVersionError('Course guide and chapter IDs must be unique.',422)
 const resolved=resolveOutlineGroups({topics:groups,gaps:result.gaps},maps)
 const owners=new Map(),candidates=new Map(outlineCandidates(maps).map(item=>[item.ref,item]))
 for(const group of groups)for(const ref of group.topicRefs){
  const key=conceptKey(candidates.get(ref).title),owner=owners.get(key)
  if(owner && owner!==group.guideId)throw new StudyVersionError(`The concept “${candidates.get(ref).title}” has multiple guide owners. Group its repeated evidence in one guide.`,422)
  owners.set(key,group.guideId)
 }
 return {...resolved,guides:result.guides.map(({id,title})=>({id,title})),topics:resolved.topics.map((topic,index)=>({...topic,guideId:groups[index].guideId}))}
}
function derivedId(prefix,value){const h=digest(value).slice(0,32);return `${prefix}-${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`}
// Collect every evidence id a guide actually cites: assigned topic evidence plus
// any sourceId/sourceIds carried by its teaching blocks, questions, cards and
// visuals. Citation provenance must survive snapshot scoping.
function citedEvidence(node,into){
 if(Array.isArray(node)){for(const item of node)citedEvidence(item,into);return into}
 if(!node || typeof node!=='object')return into
 for(const [key,value] of Object.entries(node)){
  if(key==='sourceIds' && Array.isArray(value))for(const id of value){if(typeof id==='string')into.add(id)}
  else if(key==='sourceId' && typeof value==='string')into.add(value)
  else citedEvidence(value,into)
 }
 return into
}
function scopedSnapshot(snapshot,revision,topics,chapters){
 const cited=citedEvidence([topics,chapters],new Set())
 const chunks=snapshot.chunks.filter(c=>cited.has(c.id)),keys=new Set(chunks.map(c=>c.sourceKey))
 return {ref:{versionId:revision.versionId,revisionId:revision.id},sourceHash:snapshot.sourceHash,
  sources:snapshot.sources.filter(s=>keys.has(s.key)),sourceIds:chunks.map(c=>c.id),chunks:[],excluded:[]}
}
// The fence itself. A worker may write child documents only while it still owns
// the parent's draft lease, or when the parent has already published exactly this
// revision and the write is a converging repair.
async function assertBundleFence(version,revision,fence){
 const parent=await ownStudyVersion(version.id,{includeStaged:true})
 if(parent.bundlePublication?.revisionId===revision.id)return parent
 const draft=parent.draft
 if(!fence?.token || draft?.id!==fence.draftId || draft.lease?.token!==fence.token || !(draft.lease.expiresAt>Date.now()))
  throw new StudyVersionError('Generation stopped or its worker lease expired. The course guides were not republished.',409)
 return parent
}
function bundleGuidePlan(version,revision){
 if(!revision.guides?.length || revision.chapters.some(c=>c.review!=='passed'))throw new StudyVersionError('Only a checked course plan can publish its guides.',409)
 const assigned=new Set(revision.topics.map(topic=>topic.id))
 if(assigned.size!==revision.topics.length || revision.chapters.length!==assigned.size || revision.chapters.some(chapter=>!assigned.has(chapter.id)) || revision.topics.some(topic=>!revision.guides.some(guide=>guide.id===topic.guideId)))throw new StudyVersionError('The course plan does not assign every checked chapter to a guide.',409)
 return revision.guides.map(guide=>{
  const topics=revision.topics.filter(t=>t.guideId===guide.id),ids=new Set(topics.map(t=>t.id))
  const chapters=revision.chapters.filter(c=>ids.has(c.id))
  if(!chapters.length || chapters.length!==topics.length)throw new StudyVersionError('A course guide is missing checked chapters.',409)
  return {guide,topics,chapters,id:derivedId('sv',[version.id,guide.id]),revisionId:derivedId('rev',[revision.id,guide.id])}
 })
}

// Phase one. Writes every child and its immutable revision while they stay
// invisible. Safe to repeat: identities and revision digests are derived.
export async function stageCourseBundle(version,revision,fence){
 if(!version.courseBundle)return null
 const plan=bundleGuidePlan(version,revision),staged=[]
 for(const entry of plan){
  await assertBundleFence(version,revision,fence)
  const {guide,topics,chapters,id,revisionId}=entry
  const existing=await ownStudyVersion(id,{includeStaged:true}).catch(error=>{if(error.status===404)return null;throw error})
  if(existing && existing.courseBundleParent?.versionId!==version.id)throw new StudyVersionError('The derived guide identity belongs to another run.',409)
  const snapshot=scopedSnapshot(revision.snapshot,revision,topics,chapters)
  const child=existing || await createStudyVersion(version.course,version.programmeId,snapshot,{id,title:guide.title,execution:revision.generation.execution,billing:revision.billing,courseBundleParent:{versionId:version.id,guideId:guide.id,state:'staged',active:false}})
  const draft={...revision,guides:undefined,correctionPolicy:version.draft.correctionPolicy,automaticRepairs:version.draft.automaticRepairs,manualRepairs:version.draft.manualRepairs,correctionHistory:version.draft.correctionHistory,id:revisionId,snapshot,topics,chapters,maps:[],execution:revision.generation.execution,localContractId:revision.generation.contractId,reused:chapters.filter(c=>c.reused).length}
  const saved=await saveStudyRevision(child,draft)
  // Never touch an already published child here: it must keep serving its
  // current revision until this publication is fenced and flipped.
  if(existing?.activeRevisionId!==saved.id && existing?.courseBundleParent?.stagedRevisionId!==saved.id){
   await assertBundleFence(version,revision,fence)
   await mutateStudyVersion(id,next=>{
    if(next.courseBundleParent?.versionId!==version.id)throw new StudyVersionError('The derived guide identity belongs to another run.',409)
    next.courseBundleParent={...next.courseBundleParent,guideId:guide.id,stagedRevisionId:saved.id,stagedTitle:guide.title,stagedParentRevisionId:revision.id}
   })
  }
  staged.push({id,guideId:guide.id,title:guide.title,revisionId:saved.id,chapters:chapters.length,createdAt:saved.createdAt,sourceHash:revision.snapshot.sourceHash,snapshot})
 }
 return {revisionId:revision.id,guides:staged.map(({id,guideId,title,revisionId,chapters})=>({id,guideId,title,revisionId,chapters})),staged}
}

// Phase two. Runs only after the parent durably recorded this publication under
// its lease. Idempotent per child; superseded guides are archived, never deleted.
export async function publishCourseBundle(version,revision,bundle,fence){
 if(!bundle)return []
 const keep=new Set(bundle.staged.map(child=>child.id))
 for(const child of bundle.staged){
  await assertBundleFence(version,revision,fence)
  await mutateStudyVersion(child.id,next=>{
   if(next.courseBundleParent?.versionId!==version.id)throw new StudyVersionError('The derived guide identity belongs to another run.',409)
   next.title=child.title
   next.activeRevisionId=child.revisionId
   next.courseBundleParent={versionId:version.id,guideId:child.guideId,state:'published',active:true,parentRevisionId:revision.id}
   if(!next.history.some(item=>item.id===child.revisionId))next.history.unshift({id:child.revisionId,createdAt:child.createdAt,chapters:child.chapters,sourceHash:child.sourceHash})
   next.draft={id:child.revisionId,status:'complete',stage:'finish',execution:revision.generation.execution,billing:revision.billing,finishedAt:child.createdAt,snapshot:child.snapshot}
  })
 }
 for(const old of await listCourseBundleChildren(version.id))if(!keep.has(old.id) && old.courseBundleParent?.state!=='archived'){
  await assertBundleFence(version,revision,fence)
  await mutateStudyVersion(old.id,next=>{
   if(next.courseBundleParent?.versionId!==version.id)return
   next.courseBundleParent={...next.courseBundleParent,state:'archived',active:false,archivedAt:new Date().toISOString()}
  })
 }
 return bundle.guides
}

// Convenience for callers outside the pipeline (and for converging repairs): the
// whole publication, fenced end to end.
export async function materializeCourseBundle(version,revision,fence){
 const bundle=await stageCourseBundle(version,revision,fence)
 if(!bundle)return {guides:[],staged:[]}
 await publishCourseBundle(version,revision,bundle,fence)
 return bundle
}
