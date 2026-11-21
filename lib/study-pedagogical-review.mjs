import { focusedReviewPrompt } from './study-review-evidence.mjs'
import { dependencyHash, canonicalReviewValue, legacyDependencyHash, boundedReviewItems } from './study-review-dependencies.mjs'
import { STUDY_GENERATION_LIMITS as generationLimits } from './study-generation-limits.mjs'
import { digest, pedagogicalResponseSchema, parseStudyJson } from './study-version-content.mjs'
import { pedagogyPrompt, pedagogyReviewSchema, pedagogyReviewIssues } from './study-pedagogy.mjs'
import { applyReviewFocus, reviewFocusPrompt } from './study-review-rounds.mjs'

const fingerprint = chapter => digest(canonicalReviewValue({reviewVersion:6,sections:chapter.sections,questions:chapter.questions,teachingPlan:chapter.teachingPlan,objectiveCoverage:chapter.objectiveCoverage}))
// A verdict about one objective rests on that objective's own teaching: the
// sections listing it, the shared sections that carry no objectiveIds at all,
// and the sections its own coverage cites. Scoping the slice keeps the judged
// teaching, the quotable excerpt grammar and the dependency hash over exactly
// the same content, so a correction invalidates only the objectives whose
// teaching, practice, plan or evidence actually changed. Sections belonging to
// other objectives still travel as `otherSections` context; they are never
// quoted or judged, so they are deliberately outside the dependency.
export function objectiveSections(chapter, ids) {
  const cited=new Set(chapter.objectiveCoverage.filter(item=>ids.has(item.objectiveId)).flatMap(row=>[...(row.explanationSectionIds||[]),...(row.workedExampleSectionIds||[])]))
  return chapter.sections.filter(section=>!section.objectiveIds?.length || section.objectiveIds.some(id=>ids.has(id)) || cited.has(section.id))
}
function objectiveSlice(chapter, objectives, {scopeSections=false}={}) {
  const ids=new Set(objectives.map(o=>o.id))
  return {...chapter,...(scopeSections?{sections:objectiveSections(chapter,ids)}:{}),teachingPlan:{...chapter.teachingPlan,objectives},objectiveCoverage:chapter.objectiveCoverage.filter(item=>ids.has(item.objectiveId)),questions:chapter.questions.filter(q=>q.objectiveIds.some(id=>ids.has(id)))}
}
// A question-only correction cannot invalidate accepted, unchanged questions
// whose teaching and links are unchanged. Keep one previously accepted guided
// and independent anchor per objective so the reviewer can still judge the
// objective, plus every changed question and both sides of its diagnostic
// links. Passing transfer/follow-up rows omitted here are restored from the
// accepted baseline by applyReviewFocus.
export function focusedQuestionKeys(chapter,objectives) {
  const focus=chapter.reviewFocus, baseline=chapter.reviewBaseline
  if(!focus || !baseline || !focus.changed.length || focus.changed.some(key=>!key.startsWith('question:')))return null
  if(objectives.some(objective=>!baseline.objectiveChecks?.[objective.id]))return null
  const objectiveIds=new Set(objectives.map(row=>row.id))
  const selected=new Set(focus.changed.map(key=>key.slice('question:'.length)))
  for(const objective of objectives){
    const prior=baseline.objectiveChecks?.[objective.id]
    if(prior?.guidedQuestionKey)selected.add(prior.guidedQuestionKey)
    if(prior?.independentQuestionKey)selected.add(prior.independentQuestionKey)
  }
  let added=true
  while(added){
    added=false
    for(const q of chapter.questions){
      const linked=selected.has(q.key) || (q.misconceptions || []).some(row=>selected.has(row.followUpKey))
      if(linked && !selected.has(q.key)){selected.add(q.key);added=true}
      if(selected.has(q.key))for(const row of q.misconceptions || [])if(!selected.has(row.followUpKey)){selected.add(row.followUpKey);added=true}
    }
  }
  return new Set(chapter.questions.filter(q=>q.objectiveIds?.some(id=>objectiveIds.has(id)) && selected.has(q.key)).map(q=>q.key))
}
function scopedReview(chapter, objectiveId, review) {
  return {...structuredClone(review),issues:review.issues.filter(issue=>{
    const objective=chapter.teachingPlan.objectives.find(item=>item.id===issue.topicId)
    if(objective)return objective.id===objectiveId
    const item=chapter.questions.find(item=>item.key===issue.topicId) || chapter.sections.find(item=>item.id===issue.topicId)
    // Unknown/global locations remain shared. Never infer scope from prose.
    return !item?.objectiveIds?.length || item.objectiveIds.includes(objectiveId)
  })}
}
function stateFor(context,chapter) {
  const hash=fingerprint(chapter), saved=chapter.pedagogyAudit
  const values=Object.fromEntries(chapter.teachingPlan.objectives.map(o=>{
    const slice=objectiveSlice(chapter,[o],{scopeSections:true})
    const related=new Set(slice.questions.flatMap(q=>(q.misconceptions||[]).map(m=>m.followUpKey)))
    return [o.id,{context,rules:[pedagogyPrompt.toString(),pedagogyReviewIssues.toString()],schema:pedagogicalResponseSchema(slice),sections:slice.sections,questions:slice.questions,related:chapter.questions.filter(q=>related.has(q.key)),objective:o,coverage:slice.objectiveCoverage}]
  }))
  const dependencies=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,dependencyHash(value)]))
  const legacy=saved && !saved.dependencies && saved.fingerprint===hash
  return {fingerprint:hash,dependencies,reviews:Object.fromEntries(Object.entries(dependencies).filter(([id,hash])=>saved?.reviews[id]&&(legacy||saved.dependencies?.[id]===hash || saved.dependencies?.[id]===legacyDependencyHash(values[id]))).map(([id])=>[id,scopedReview(chapter,id,saved.reviews[id])]))}
}
export function preservePedagogicalReview(previous, chapter, context) {
  chapter.pedagogyAudit=stateFor(context,previous)
  for(const [key,value] of Object.entries(chapter.pedagogyAudit.reviews))if(value.objectives.some(o=>!o.adequate) || value.issues.some(i=>i.severity==='error') || value.followUpChecks.some(c=>!c.useful) || value.transferChecks.some(c=>['copied','numbers_only'].includes(c.variation)))delete chapter.pedagogyAudit.reviews[key]
  chapter.pedagogyAudit=stateFor(context,chapter)
}
export function combinedPedagogicalReview(chapter, state=chapter.pedagogyAudit) {
  const reviews=chapter.teachingPlan.objectives.map(o=>state?.reviews[o.id])
  if(reviews.some(row=>!row))return null
  const combine=(field,passes)=>{
    const rows=new Map()
    for(const review of reviews)for(const row of review[field] || [])if(!rows.has(row.questionKey) || !passes(row))rows.set(row.questionKey,row)
    return [...rows.values()]
  }
  return {objectives:[...new Map(reviews.flatMap(r=>r.objectives).map(o=>[o.objectiveId,o])).values()],issues:[...new Map(reviews.flatMap(r=>r.issues).map(i=>[JSON.stringify(i),i])).values()],transferChecks:combine('transferChecks',row=>['new_context','reverse_inference','combined_mechanisms','diagnosis','boundary_change'].includes(row.variation)),followUpChecks:combine('followUpChecks',row=>row.useful)}
}
export function nextPedagogicalReview(context, chapter, sourceContext=null) {
  const state=stateFor(context,chapter)
  const objectives=boundedReviewItems(chapter.teachingPlan.objectives.filter(item=>!state.reviews[item.id]),8,12000)
  if(!objectives.length){chapter.pedagogyAudit=state;return null}
  const slice=objectiveSlice(chapter,objectives,{scopeSections:true})
  const focusedKeys=focusedQuestionKeys(chapter,objectives)
  if(focusedKeys?.size)slice.questions=slice.questions.filter(q=>focusedKeys.has(q.key))
  // For a question-only correction, the selected objective's accepted
  // teaching is unchanged and already present in sections[]. Other objectives'
  // prose was context in the first review, not a dependency of this verdict.
  slice.otherSections=focusedKeys ? [] : chapter.sections.filter(section=>!slice.sections.some(item=>item.id===section.id))
  const relatedKeys=new Set(slice.questions.flatMap(q=>(q.misconceptions||[]).map(m=>m.followUpKey)))
  slice.relatedQuestions=chapter.questions.filter(q=>relatedKeys.has(q.key) && !slice.questions.some(item=>item.key===q.key)).map(({answer,...question})=>question)
  delete slice.pedagogyAudit
  const responseSchema=pedagogicalResponseSchema(slice)
  // Short references avoid repeatedly encoding long escaped mathematical quotes
  // in the output grammar. Resolve them back to exact substrings on acceptance.
  const quoteReferences={}
  const fields=responseSchema.properties.objectives.items.properties
  const choices=fields.explanation.anyOf.map(choice=>{
    const next=structuredClone(choice)
    next.properties.quote.enum=choice.properties.quote.enum.map(quote=>{
      const id=`excerpt-${Object.keys(quoteReferences).length+1}`
      quoteReferences[id]={sectionId:choice.properties.sectionId.enum[0],quote}
      return id
    })
    return next
  })
  fields.explanation={anyOf:choices}
  fields.workedExample={anyOf:[...structuredClone(choices),{type:'null'}]}

  responseSchema.properties.objectives.minItems=responseSchema.properties.objectives.maxItems=objectives.length
  responseSchema.properties.objectives.items.properties.objectiveId.enum=objectives.map(o=>o.id)
  return {objectiveId:objectives[0].id,objectiveIds:objectives.map(o=>o.id),state,quoteReferences,chapter:slice,schema:pedagogyReviewSchema,responseSchema,tokens:generationLimits.pedagogicalReviewTokens,prompt:pedagogyPrompt((sourceContext?focusedReviewPrompt(sourceContext.course,sourceContext.sources,sourceContext.evidence,chapter,{teachingPlan:slice.teachingPlan,sections:slice.sections,questions:slice.questions,relatedQuestions:slice.relatedQuestions}):context)+'\nReview all selected objectives and questions. otherSections and relatedQuestions provide prerequisite and linked-follow-up context: read them, but judge and quote only sections[]. Teaching a selected objective needs is taught if it appears in otherSections; do not report it as missing reasoning. A follow-up listed in relatedQuestions exists; do not flag it as missing merely because it belongs to another objective.'+reviewFocusPrompt(chapter,[...objectives.map(o=>`objective:${o.id}`),...slice.sections.map(s=>`section:${s.id}`),...slice.questions.map(q=>`question:${q.key}`)]),slice,{quoteReferences})}
}
export function acceptPedagogicalReview(chapter,step,raw) {
  if(fingerprint(chapter)!==step.state.fingerprint)throw new Error('The lesson changed during pedagogical review.')
  // After a correction, accepted unchanged content keeps its verdict.
  const review=applyReviewFocus(chapter,parseStudyJson(raw,pedagogyReviewSchema))
  for(const objective of review.objectives)for(const field of ['explanation','workedExample']){
    const value=objective[field]
    const reference=value && step.quoteReferences?.[value.quote]
    if(reference){
      if(value.sectionId!==reference.sectionId)throw new Error('The review excerpt belongs to a different section.')
      objective[field]={...reference}
    }
  }

  const ids=step.objectiveIds || [step.objectiveId]
  if(review.objectives.length!==ids.length || new Set(review.objectives.map(o=>o.objectiveId)).size!==ids.length || review.objectives.some(o=>!ids.includes(o.objectiveId)))throw new Error('Review every requested teaching objective exactly once.')
  const state=structuredClone(step.state)
  for(const id of ids) {
    const keys=new Set(chapter.questions.filter(q=>q.objectiveIds.includes(id)).map(q=>q.key))
    state.reviews[id]={...scopedReview(chapter,id,review),objectives:review.objectives.filter(o=>o.objectiveId===id),transferChecks:review.transferChecks.filter(row=>keys.has(row.questionKey)),followUpChecks:review.followUpChecks.filter(row=>keys.has(row.questionKey))}
  }
  chapter.pedagogyAudit=state
  return combinedPedagogicalReview(chapter,state)
}
