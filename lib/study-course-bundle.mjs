import {z} from 'zod/v3'
import {outlineSchema,outlineCandidates,resolveOutlineGroups,outlinePrompt,outlineRejection,conceptKey,digest,StudyVersionError,GUIDE_TOPIC_LIMIT,GUIDE_CHAPTER_LIMIT,MAX_BUNDLE_GUIDES} from './study-version-content.mjs'
import {scopePolicyPrompt,validateScopeRoles,assertExclusionsNotTaught,scopeExclusionGaps} from './study-course-scope-policy.mjs'
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
//
// CHAPTER CEILINGS ARE PER GUIDE. Each child of a bundle is an ordinary study
// guide, so it carries the ordinary guide limits: at most GUIDE_TOPIC_LIMIT
// planned chapters before the server's evidence-capacity split and at most
// GUIDE_CHAPTER_LIMIT after it. The whole-course total is therefore bounded by
// guides x limit within the schema's 2-MAX_BUNDLE_GUIDES guide cap, never by a
// single guide's ceiling.
//
// SCOPE ROLES (study-course-scope-policy.mjs). A chapter is core teaching or the
// guide's one compact supporting (practical/reference) chapter; a core chapter
// may carry supporting refs it needs. Excluded refs are cited scope decisions.
// Optional in zod so older saved proposals stay byte-identical; the response schema still requires them.
const bundleTopic=outlineSchema.shape.topics.element.extend({
 role:z.enum(['core','supporting']).optional(),
 supportingRefs:z.array(z.string().min(1).max(40)).max(1000).optional()
})
export const courseBundleOutlineSchema=z.object({
 guides:z.array(z.object({id:z.string().regex(/^[a-z0-9-]{1,70}$/),title:z.string().min(1).max(180),topics:z.array(bundleTopic).min(1).max(24)})).min(2).max(MAX_BUNDLE_GUIDES),
 excluded:z.array(z.object({topicRefs:z.array(z.string().min(1).max(40)).min(1).max(1000),reason:z.string().max(600),scopeSourceIds:z.array(z.string().min(1).max(200)).max(20)})).max(400).optional(),
 gaps:outlineSchema.shape.gaps
})
// Administrative-only material maps to topics:[] by contract. Planning guides for
// it would request invented teaching, so refuse before spending an outline call.
export function assertTeachableBundle(maps){
 if(!maps.some(map=>map.topics?.length))throw new StudyVersionError('The selected material contains no teachable topics; it is course administration only. Select lecture, reading or exercise material before planning a whole-course bundle.',422)
}
export function courseBundlePrompt(course,maps,previous,capacity,policy){
 return outlinePrompt(course,maps,previous?.topics||[],capacity,{compact:Boolean(policy)})+`\nWHOLE-COURSE GUIDE BUNDLE. Plan all selected course material ONCE and divide it into distinct study guides, each containing coherent chapters. Do not make a single giant guide, repeat the course introduction in every guide, or create guides merely for different source years. Assign each substantive concept one primary teaching home. Brief prerequisites can be recalled elsewhere without duplicating their objectives, examples, practice banks and flashcards. Merge repeated descriptions of the same concept across maps into that home. Keep full supporting evidence by grouping their topicRefs together. Current-edition scope governs assessment; preserve useful historical explanation as provisional and never turn historical administration into current requirements. Guide and chapter ceilings are capacity limits, not targets: do not fill them. Use the smallest coherent course curriculum that preserves the mapped concepts. Retain existing guide IDs and chapter IDs when their responsibilities are unchanged. Previous guides: ${JSON.stringify(previous?.guides||[])}. Return ${policy?'{guides:[{id,title,topics:[{id,title,role,topicRefs,supportingRefs}]}],excluded:[{topicRefs,reason,scopeSourceIds}],gaps:[]}; assign every mapped ref exactly once across the WHOLE bundle (in one chapter\'s topicRefs or supportingRefs, or in excluded), not once per guide.':'{guides:[{id,title,topics:[{id,title,topicRefs}]}],gaps:[]}; assign every mapped ref exactly once across the WHOLE bundle, not once per guide.'}`+bundleChapterBudget(capacity,policy)+(policy?scopePolicyPrompt(policy):'')
}
// Tell the model the real per-chapter evidence allowance and the per-guide
// ceilings, so it can plan chapters that fit instead of discovering the split
// after the call is paid for. Part-splitting is the fallback, not the plan.
export function bundleChapterBudget(capacity,policy){
 const perChapter=capacity?.availableChapterCharacters ?? Math.max(0,(capacity?.chapterEvidenceCharacters||0)-(capacity?.scopeCharacters||0))
 const teaching=capacity?.teachingCharacters ?? 0
 const minimumChapters=capacity?.minimumChapters ?? (perChapter?Math.ceil(teaching/perChapter):0)
 const minimumGuides=capacity?.minimumGuides ?? Math.min(MAX_BUNDLE_GUIDES,Math.max(2,Math.ceil(minimumChapters/GUIDE_CHAPTER_LIMIT)))
 if(policy)return `\nEVIDENCE CAPACITY: one chapter can carry at most ${perChapter} characters of core teaching evidence, because the ${capacity?.scopeCharacters||0} characters of shared course scope are included in every chapter's packet. The automatic scope policy below lists exact core evidence size per mapped concept. Core evidence beyond that allowance is split by the server into “· Part 2”, “· Part 3” chapters that count against the budget; plan within capacity rather than relying on that split. The core evidence alone needs at least ${policy.capacityMinimumChapters} chapters, so choose at least ${Math.min(MAX_BUNDLE_GUIDES,Math.max(2,Math.ceil(policy.capacityMinimumChapters/policy.guideChapterMax)))} guides. Server hard ceilings (${GUIDE_TOPIC_LIMIT} planned and ${GUIDE_CHAPTER_LIMIT} split chapters per guide) still apply but are far above the automatic budget below; they are never targets.`
 return `\nCHAPTER BUDGET (per guide, not per course). Every guide you return is an ordinary study guide and carries the ordinary guide ceilings: plan at most ${GUIDE_TOPIC_LIMIT} chapters IN EACH GUIDE, and after the server's evidence-capacity split each guide must still hold at most ${GUIDE_CHAPTER_LIMIT} chapters. There is no whole-course chapter ceiling beyond guides x ${GUIDE_CHAPTER_LIMIT} within the 2-${MAX_BUNDLE_GUIDES} guide range. EVIDENCE CAPACITY: one chapter can carry at most ${perChapter} characters of teaching evidence, because the ${capacity?.scopeCharacters||0} characters of shared course scope are included in every chapter's packet. The capacity object above lists each evidence passage's exact size in evidenceSizes and the shared scope ids in scopeEvidenceIds: add up the sizes of the refs you group and keep each chapter under that allowance. A chapter whose grouped evidence exceeds it is split by the server into “· Part 2”, “· Part 3” chapters, and every part counts against its guide's ${GUIDE_CHAPTER_LIMIT}-chapter ceiling; plan within capacity rather than relying on that split. This selection holds ${teaching} characters of teaching evidence, so it needs at least ${minimumChapters} chapters and therefore at least ${minimumGuides} guides. Choose enough guides to hold the chapters this evidence actually requires; do not compress the course into two overfull guides.`
}
export function resolveCourseBundle(result,maps,policy){
 // Supporting refs travel with their chapter; roles are re-applied after resolution.
 const groups=result.guides.flatMap(guide=>guide.topics.map(({supportingRefs=[],role,...topic})=>({...topic,topicRefs:[...topic.topicRefs,...supportingRefs],guideId:guide.id,role:role||'core',coreRefs:topic.topicRefs.length})))
 const planned=new Map()
 for(const group of groups)planned.set(group.guideId,(planned.get(group.guideId)||0)+1)
 const overfull=[...planned].filter(([,count])=>count>GUIDE_TOPIC_LIMIT)
 if(overfull.length)throw outlineRejection(`${overfull.length===1?'A course guide plans':'Course guides plan'} more than ${GUIDE_TOPIC_LIMIT} chapters. Chapter limits apply per guide: move chapters into another guide or consolidate related concepts.`,
  overfull.map(([guideId,count])=>({kind:'too-many-chapters',guideId,count,limit:GUIDE_TOPIC_LIMIT,excess:count-GUIDE_TOPIC_LIMIT,
   detail:`Guide “${guideId}” plans ${count} chapters; at most ${GUIDE_TOPIC_LIMIT} are allowed per guide before evidence-capacity splitting, ${count-GUIDE_TOPIC_LIMIT} too many. Move its extra chapters into another guide (the bundle may hold up to ${MAX_BUNDLE_GUIDES} guides) or consolidate related concepts, without dropping any mapped ref.`})),422)
 const repeatedGuides=result.guides.map(g=>g.id).filter((id,index,all)=>all.indexOf(id)!==index)
 const repeatedChapters=groups.map(t=>t.id).filter((id,index,all)=>all.indexOf(id)!==index)
 if(repeatedGuides.length || repeatedChapters.length)throw outlineRejection('Course guide and chapter IDs must be unique.',
  [...new Set(repeatedGuides)].map(id=>({kind:'duplicate-guide-id',guideId:id,detail:`Guide id “${id}” is used more than once. Give every guide a distinct id.`}))
   .concat([...new Set(repeatedChapters)].map(id=>({kind:'duplicate-chapter-id',chapterId:id,detail:`Chapter id “${id}” is used more than once across the bundle. Chapter ids must be unique in the whole plan, not only within a guide.`}))),422)
 const excluded=policy?validateScopeRoles(result,maps,policy):[]
 const resolved=resolveOutlineGroups({topics:groups,gaps:result.gaps},maps,{covered:new Set(excluded.map(item=>item.ref))})
 const owners=new Map(),candidates=new Map(outlineCandidates(maps).map(item=>[item.ref,item]))
 for(const group of groups)for(const ref of group.topicRefs){
  const key=conceptKey(candidates.get(ref).title),owner=owners.get(key)
  if(owner && owner!==group.guideId)throw outlineRejection(`The concept “${candidates.get(ref).title}” has multiple guide owners. Group its repeated evidence in one guide.`,
   [{kind:'duplicate-owner',ref,title:candidates.get(ref).title,guideId:group.guideId,taughtIn:owner,
     detail:`The concept “${candidates.get(ref).title}” is taught in guide “${owner}” but ${ref} was also assigned to guide “${group.guideId}”. Move every ref for that concept into one guide.`}],422)
  owners.set(key,group.guideId)
 }
 if(!policy)return {...resolved,guides:result.guides.map(({id,title})=>({id,title})),topics:resolved.topics.map((topic,index)=>({...topic,guideId:groups[index].guideId}))}
 assertExclusionsNotTaught(excluded,owners)
 return {...resolved,gaps:[...resolved.gaps,...scopeExclusionGaps(excluded)],excluded,guides:result.guides.map(({id,title})=>({id,title})),
  topics:resolved.topics.map((topic,index)=>{
   const {guideId,role,coreRefs}=groups[index]
   // Auto-placed concepts (appended after the proposal's refs) inherit the chapter role.
   return {...topic,guideId,role,conceptEvidence:topic.conceptEvidence.map((concept,i)=>i<groups[index].topicRefs.length?{...concept,role:role==='supporting'||i>=coreRefs?'supporting':'core'}:concept)}
  })}
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
