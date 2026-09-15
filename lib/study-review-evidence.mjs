import { evidencePrompt } from './study-version-content.mjs'

// Keep complete available source context, objective prerequisites, linked follow-ups and
// scope amendments. Never summarize or truncate the evidence to fit a packet.
export function focusedReviewEvidence(evidence,chapter,items) {
 const refs=new Set(),objectives=new Set();let ambiguous=false
 function collect(value){
  if(!value || typeof value!=='object')return
  if(Array.isArray(value)){value.forEach(collect);return}
  for(const id of value.sourceIds || [])refs.add(id)
  for(const id of value.objectiveIds || [])objectives.add(id)
  Object.values(value).forEach(collect)
 }
 collect(items)
 const known=new Set(chapter.teachingPlan?.objectives.map(o=>o.id) || [])
 if([...objectives].some(id=>!known.has(id)))ambiguous=true
 for(const objective of chapter.teachingPlan?.objectives || [])if(objectives.has(objective.id))collect(objective)
 for(const section of chapter.sections || [])if(section.objectiveIds?.some(id=>objectives.has(id)))collect(section)
 const followups=new Set()
 function links(v){if(!v||typeof v!=='object')return;if(v.followUpKey)followups.add(v.followUpKey);Object.values(v).forEach(links)}
 links(items);for(const q of chapter.questions || [])if(followups.has(q.key))collect(q)
 if(!refs.size || ambiguous || [...refs].some(id=>!evidence.some(c=>c.id===id)))return evidence
 const sourceKeys=new Set(evidence.filter(c=>refs.has(c.id)).map(c=>c.sourceKey))
 return evidence.filter(c=>c.scopeContext || sourceKeys.has(c.sourceKey))
}
export function focusedReviewPrompt(course,sources,evidence,chapter,items) {
 const chunks=focusedReviewEvidence(evidence,chapter,items),keys=new Set(chunks.map(c=>c.sourceKey))
 return evidencePrompt(course,sources.filter(s=>keys.has(s.key)),chunks)
}
