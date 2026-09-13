import { z } from 'zod'
import { digest, evidencePrompt } from './study-version-content.mjs'

export const moduleReadinessSchema = z.object({
  scope: z.array(z.object({topic:z.string().min(1).max(300),sourceIds:z.array(z.string()).min(1).max(20)})).max(20).default([]),
  ready: z.boolean(), organisation: z.enum(['weekly','topic','textbook','uncertain']),
  reason: z.string().min(1).max(2000),
  evidence: z.array(z.object({sourceId:z.string(),quote:z.string().min(1).max(1000)})).max(20),
  missingReadings: z.array(z.string().min(1).max(500)).max(20),
  unresolvedTopics: z.array(z.string().min(1).max(500)).max(20),
})
export function moduleReadinessPrompt(course, snapshot, candidate) {
  return `${evidencePrompt(course, snapshot.sources, snapshot.chunks)}\nASSESS MODULE READINESS before drafting any guide. Candidate: ${JSON.stringify(candidate)}. The inventory rule is an inference, not proof of completion. Determine whether the supplied readable materials establish a coherent, teachable scope for this module. Infer weekly, topic-based or textbook-led organisation from the course material; professors use different conventions. A later module or a quiet upload period alone does not prove completeness. Check assigned readings, learning objectives, placeholders, future releases and gaps. Return scope as the specific topics established by current-edition sources, citing those current sourceIds. Historical sources may fill explanatory gaps for those topics but cannot establish current exam scope, exclusions, assessment rules or extra topics. A complete old course does not make this year complete. If current-year scope cannot be established, leave ready=false and explain why. Treat incompatible textbook editions, changed definitions, incompatible APIs/algorithms and unmatched syllabus coverage as unresolved, not interchangeable. State which historical material can be used and in what role. Textbook-dependent teaching requires the actual relevant chapters/excerpts, not a title, bibliography, link or slide mentioning them. Supporting sources may be older textbook editions deliberately selected by the student; do not import old exam rules. Quote exact source passages supporting your decision. If required readings are missing, scope is unclear or core topics are unresolved, set ready=false and identify them. Do not broaden the syllabus or treat student progress/completion as evidence that all materials exist. This is readiness of material for teaching, never student mastery. Return only the structured decision.`
}
export function validateModuleReadiness(result, snapshot, course = null) {
  for (const evidence of result.evidence) {
    if (!snapshot.chunks.some(chunk => chunk.id === evidence.sourceId && chunk.text.includes(evidence.quote))) throw new Error('Module readiness evidence must quote an available source passage.')
  }
  if(result.ready && course) {
    const current=new Set(snapshot.sources.filter(s=>s.academicYear===course.academicYear).map(s=>s.key))
    if(!result.scope?.length || result.scope.some(t=>t.sourceIds.some(id=>!snapshot.chunks.some(c=>c.id===id && current.has(c.sourceKey))))) throw new Error('Current-edition evidence must establish every topic in the module scope.')
  }
  if (result.ready && (!result.evidence.length || result.missingReadings.length || result.unresolvedTopics.length || result.organisation === 'uncertain')) throw new Error('Module readiness cannot pass with missing readings or unresolved scope.')
  return result
}

// Cheap candidate selection precedes semantic review. It only says there is
// enough evidence to CHECK readiness, never that a professor has finished.
export function inferModuleCandidate(module, modules, sources, prior, {rule='auto',now=Date.now(),supportingSourceKeys=[]}={}) {
  const selected = sources.filter(s => (s.locations || []).some(l=>String(l.moduleId)===String(module.id)))
  const content = selected.filter(s=>!/link.index|syllabus|course.overview/i.test(s.title))
  const common = sources.filter(s=>s.announcement || !(s.locations||[]).some(l=>l.moduleId) && /syllabus|course.?manual|course.?overview|reading.?list/i.test(s.title)).map(s=>s.key)
  const signature = digest([module, selected.map(s=>[s.key,s.sha256]).sort(), [...common,...supportingSourceKeys].map(key=>[key,sources.find(s=>s.key===key)?.sha256]).sort()])
  const unchangedSince = prior?.signature === signature ? prior.unchangedSince : new Date(now).toISOString()
  const stable = now-new Date(unchangedSince).getTime() >= 48*3600000
  const weekly = /\bweek\s*\d+|\bwk\.?\s*\d+/i.test(module.name)
  const organisation = rule === 'auto' ? weekly ? 'weekly' : 'topic' : rule
  const reasons = [], blockers=[]
  if (!content.length) blockers.push('No readable module materials have been collected.')
  if (module.unlockAt && new Date(module.unlockAt).getTime()>now) blockers.push('The module release date is still in the future.')
  if (!stable && !prior?.versionId) blockers.push('Waiting for two days without material changes before checking readiness.')
  const next = modules.filter(m=>m.position>module.position).sort((a,b)=>a.position-b.position)[0]
  const successor = next && next.unlockAt && new Date(next.unlockAt).getTime()<=now
  const worked = content.some(s=>/exercis|practice|tutorial|problem|quiz|exam|worksheet|solution/i.test(s.title))
  const laterContent=next && sources.some(s=>s.locations?.some(l=>String(l.moduleId)===String(next.id)))
  if (organisation === 'weekly' && !successor && !worked && !laterContent && !prior?.versionId) blockers.push('No dated transition, following-week material or practice sheet supports this week’s boundary yet.')
  if (organisation !== 'weekly' && !worked && !successor && !supportingSourceKeys.length && !prior?.versionId) blockers.push('No practice material or dated transition supports a complete topic yet.')
  if (stable) reasons.push('Material identity and content have been stable across refreshes for at least two days.')
  if (successor) reasons.push(`The following module “${next.name}” has reached its release date.`)
  if(laterContent && !successor) reasons.push('A following module has material; its boundary still needs the source-based readiness review.')
  if (worked) reasons.push('The module includes practice or assessment material.')
  return { moduleId:String(module.id), title:module.name, organisation, signature, unchangedSince,
    status:blockers.length?'gathering':'candidate', reasons, blockers,
    sourceKeys:[...new Set([...selected.map(s=>s.key),...common,...supportingSourceKeys])] }
}

// Suggestions are intentionally conservative: generic week/file numbers are
// not proof of curricular equivalence. The semantic preflight still checks fit.
export function historicalModuleSuggestions(module, sources, academicYear) {
  const terms=value=>String(value).toLowerCase().replace(/[^a-z]+/g,' ').split(' ').filter(w=>w.length>2&&!['week','lecture','slides','module','chapter','course','pdf','the','and','notes','tutorial','exercises'].includes(w))
  const target=new Set(terms(module.name))
  if(!target.size)return []
  return sources.filter(s=>s.academicYear!==academicYear && s.academicYear!=='undated' && !s.announcement).filter(s=>{
    const labels=[s.title,...(s.locations||[]).map(l=>l.moduleName)]
    return labels.some(label=>{const words=new Set(terms(label));const match=[...target].filter(w=>words.has(w));return match.length>=Math.min(2,target.size) && match.length/target.size>=0.6 && (target.size>1 || [...target][0].length>=7)})
  }).sort((a,b)=>b.academicYear.localeCompare(a.academicYear)).slice(0,20)
}
