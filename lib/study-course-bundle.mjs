import {z} from 'zod/v3'
import {outlineSchema,outlineCandidates,resolveOutlineGroups,outlinePrompt,digest,StudyVersionError} from './study-version-content.mjs'
import {createStudyVersion,ownStudyVersion,mutateStudyVersion,saveStudyRevision} from './study-version-store.mjs'

export const courseBundleOutlineSchema=z.object({
 guides:z.array(z.object({id:z.string().regex(/^[a-z0-9-]{1,70}$/),title:z.string().min(1).max(180),topics:outlineSchema.shape.topics})).min(2).max(12),
 gaps:outlineSchema.shape.gaps
})
const conceptKey=value=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
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

// All chapters have passed before this is invoked. Derived documents have stable
// identities and immutable revisions, so retrying an interrupted publication is
// idempotent. The source snapshot and old readable revisions remain preserved.
export async function materializeCourseBundle(version,revision){
 if(!version.courseBundle)return []
 if(!revision.guides?.length || revision.chapters.some(c=>c.review!=='passed'))throw new StudyVersionError('Only a checked course plan can publish its guides.',409)
 const assigned=new Set(revision.topics.map(topic=>topic.id))
 if(assigned.size!==revision.topics.length || revision.chapters.length!==assigned.size || revision.chapters.some(chapter=>!assigned.has(chapter.id)) || revision.topics.some(topic=>!revision.guides.some(guide=>guide.id===topic.guideId)))throw new StudyVersionError('The course plan does not assign every checked chapter to a guide.',409)
 const children=[]
 for(const guide of revision.guides){
  const topics=revision.topics.filter(t=>t.guideId===guide.id),ids=new Set(topics.map(t=>t.id))
  const chapters=revision.chapters.filter(c=>ids.has(c.id))
  if(!chapters.length || chapters.length!==topics.length)throw new StudyVersionError('A course guide is missing checked chapters.',409)
  const id=derivedId('sv',[version.id,guide.id]),revisionId=derivedId('rev',[revision.id,guide.id])
  const existing=await ownStudyVersion(id).catch(error=>{if(error.status===404)return null;throw error})
  if(existing && existing.courseBundleParent?.versionId!==version.id)throw new StudyVersionError('The derived guide identity belongs to another run.',409)
  const child=existing || await createStudyVersion(version.course,version.programmeId,revision.snapshot,{id,title:guide.title,execution:revision.generation.execution,billing:revision.billing,courseBundleParent:{versionId:version.id,guideId:guide.id}})
  const draft={...revision,guides:undefined,correctionPolicy:version.draft.correctionPolicy,automaticRepairs:version.draft.automaticRepairs,manualRepairs:version.draft.manualRepairs,correctionHistory:version.draft.correctionHistory,id:revisionId,topics,chapters,maps:[],execution:revision.generation.execution,localContractId:revision.generation.contractId,reused:chapters.filter(c=>c.reused).length}
  const saved=await saveStudyRevision(child,draft)
  await mutateStudyVersion(id,next=>{
   next.title=guide.title;next.activeRevisionId=saved.id;next.courseBundleParent.active=true
   if(!next.history.some(item=>item.id===saved.id))next.history.unshift({id:saved.id,createdAt:saved.createdAt,chapters:chapters.length,sourceHash:revision.snapshot.sourceHash})
   next.draft={id:saved.id,status:'complete',stage:'finish',execution:revision.generation.execution,billing:revision.billing,finishedAt:saved.createdAt}
  })
  children.push({id,guideId:guide.id,title:guide.title,revisionId:saved.id,chapters:chapters.length})
 }
 for(const old of version.bundleGuides || [])if(!children.some(child=>child.id===old.id)){
  await mutateStudyVersion(old.id,next=>{if(next.courseBundleParent?.versionId===version.id)next.courseBundleParent.active=false})
 }
 return children
}
