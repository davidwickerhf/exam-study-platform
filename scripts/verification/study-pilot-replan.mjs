import {ownStudyVersion,mutateStudyVersion} from '../../lib/study-version-store.mjs'
import {normalizeStudyOutline,studyOutlineCapacity} from '../../lib/study-version-pipeline.mjs'
import {outlinePrompt,outlineSchema,studyResponseSchema,parseStudyJson,resolveOutlineGroups,inputHash} from '../../lib/study-version-content.mjs'

// Isolated experiment only: retain every authored chapter and its review state.
// The current mapped concepts are regrouped; no source extraction is repeated.
export async function replanPilotRemainder(id,generate){
 if(process.env.DATABASE_URL)throw Error('Pilot replanning requires isolated local storage.')
 let version=await ownStudyVersion(id),draft=version.draft
 if(draft.pilotReplan?.applied)return draft.pilotReplan
 const retainedIds=new Set(draft.chapters.map(chapter=>chapter.id))
 const retained=draft.topics.filter(topic=>retainedIds.has(topic.id))
 const remaining=draft.topics.filter(topic=>!retainedIds.has(topic.id))
 if(!remaining.length)return {applied:false,reason:'No unstarted chapters.'}
 const maps=[{topics:remaining,gaps:draft.gaps||[]}]
 const schema=studyResponseSchema(outlineSchema)
 let attempts=draft.pilotReplan?.attempts||[]
 const normalize=candidate=>{
  const result=resolveOutlineGroups(candidate,maps)
  const proposal=normalizeStudyOutline(result,draft.snapshot,remaining,version.course)
  if(proposal.topics.some(topic=>retainedIds.has(topic.id)))throw Error('The proposal reused an authored chapter ID.')
  if(proposal.topics.length>remaining.length)throw Error('The proposal increased the number of unstarted chapters.')
  const before=new Set(remaining.flatMap(t=>t.sourceIds)),after=new Set(proposal.topics.flatMap(t=>t.sourceIds))
  if([...before].some(id=>!after.has(id)))throw Error('The proposal omitted previously mapped evidence.')
  return proposal
 }
 const apply=(next,proposal)=>{
   const record=next.draft.pilotReplan
   record.applied=true;record.beforeChapters=draft.topics.length;record.afterChapters=retained.length+proposal.topics.length
   record.retainedChapterIds=[...retainedIds];record.previousTopics=structuredClone(draft.topics)
   record.previousTeachingPlans=structuredClone(draft.teachingPlans||{})
   const topics=[...retained,...proposal.topics]
   next.draft.topics=topics
   next.draft.teachingPlans=Object.fromEntries(Object.entries(draft.teachingPlans||{}).filter(([id])=>{
    if(retainedIds.has(id))return true
    const old=draft.topics.find(t=>t.id===id),current=topics.find(t=>t.id===id)
    return old&&current&&inputHash(old,draft.snapshot.chunks)===inputHash(current,draft.snapshot.chunks)
   }))
   next.draft.stage=next.draft.chapters.some(chapter=>chapter.review!=='passed')?'review':'chapters'
   next.draft.status='local-ready';delete next.draft.localRequest
 }
 // A deterministic validator fix can make a saved proposal usable. Revalidate
 // that exact proposal before paying for another response; retain its history.
 if(attempts.at(-1)?.candidate){
  let proposal
  try{proposal=normalize(attempts.at(-1).candidate)}catch{}
  if(proposal){
   version=await mutateStudyVersion(id,next=>{apply(next,proposal);next.draft.pilotReplan.revalidatedFromSavedProposal=true})
   return version.draft.pilotReplan
  }
 }
 while(attempts.length<2){
  // Reserve the attempt before calling the provider; interruptions cannot reset
  // this separate two-attempt planning allowance.
  await mutateStudyVersion(id,next=>{
   next.draft.pilotReplan={...next.draft.pilotReplan,attempts:[...attempts,{startedAt:new Date().toISOString()}]}
  })
  const capacity=studyOutlineCapacity(draft.snapshot,version.course)
  const prompt=outlinePrompt(version.course,maps,remaining,capacity)+`\nISOLATED CONTINUATION: Preserve every mapped concept. Already authored chapters are retained separately and must not be recreated or assigned their IDs: ${JSON.stringify(retained.map(({id,title})=>({id,title})))}. Keep the remaining chapters coherent and avoid repeating the retained chapters' teaching. Earlier grouping feedback: ${JSON.stringify(attempts)}.`
  let proposal,error,candidate
  try{
   const raw=await generate(prompt,{responseSchema:schema,maxOutputTokens:8000,providerTimeoutMs:600000,stage:'draft',usageMetadata:{phase:'outline-optimization'}})
   candidate=parseStudyJson(raw,outlineSchema)
   proposal=normalize(candidate)
  }catch(failure){error=failure.message}
  version=await mutateStudyVersion(id,next=>{
   const record=next.draft.pilotReplan
   record.attempts[record.attempts.length-1]={...record.attempts.at(-1),error:error||null,...(candidate?{candidate}:{})}
   if(error)return
   apply(next,proposal)
  })
  if(!error)return version.draft.pilotReplan
  attempts=version.draft.pilotReplan.attempts
 }
 throw Error(`Outline optimization paused after two attempts: ${attempts.at(-1)?.error||'interrupted attempt'}. Original chapters and maps are preserved.`)
}
