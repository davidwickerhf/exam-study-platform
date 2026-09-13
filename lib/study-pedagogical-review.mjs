import { STUDY_GENERATION_LIMITS as generationLimits } from './study-generation-limits.mjs'
import { digest, pedagogicalResponseSchema, parseStudyJson } from './study-version-content.mjs'
import { pedagogyPrompt, pedagogyReviewSchema } from './study-pedagogy.mjs'

const fingerprint = chapter => digest({reviewVersion:2,sections:chapter.sections,questions:chapter.questions,teachingPlan:chapter.teachingPlan,objectiveCoverage:chapter.objectiveCoverage})
export function nextPedagogicalReview(context, chapter) {
  const hash=fingerprint(chapter)
  const state=chapter.pedagogyAudit?.fingerprint===hash?structuredClone(chapter.pedagogyAudit):{fingerprint:hash,reviews:{}}
  const objective=chapter.teachingPlan.objectives.find(item=>!state.reviews[item.id])
  if(!objective)return null
  const slice={...chapter,teachingPlan:{...chapter.teachingPlan,objectives:[objective]},objectiveCoverage:chapter.objectiveCoverage.filter(item=>item.objectiveId===objective.id),questions:chapter.questions.filter(q=>q.objectiveIds.includes(objective.id))}
  const relatedKeys=new Set(slice.questions.flatMap(q=>(q.misconceptions||[]).map(m=>m.followUpKey)))
  slice.relatedQuestions=chapter.questions.filter(q=>relatedKeys.has(q.key) && !slice.questions.some(item=>item.key===q.key)).map(({answer,...question})=>question)
  delete slice.pedagogyAudit
  const responseSchema=pedagogicalResponseSchema(slice)
  responseSchema.properties.objectives.minItems=responseSchema.properties.objectives.maxItems=1
  responseSchema.properties.objectives.items.properties.objectiveId.enum=[objective.id]
  return {objectiveId:objective.id,state,chapter:slice,schema:pedagogyReviewSchema,responseSchema,tokens:generationLimits.reviewTokens,prompt:pedagogyPrompt(context+'\nReview only the selected objective and questions. Other sections and relatedQuestions provide prerequisite and linked-follow-up context. A follow-up listed in relatedQuestions exists; do not flag it as missing merely because it belongs to another objective.',slice)}
}
export function acceptPedagogicalReview(chapter,step,raw) {
  if(fingerprint(chapter)!==step.state.fingerprint)throw new Error('The lesson changed during pedagogical review.')
  const review=parseStudyJson(raw,pedagogyReviewSchema)
  if(review.objectives.length!==1 || review.objectives[0].objectiveId!==step.objectiveId)throw new Error('Review the requested teaching objective exactly once.')
  const state=structuredClone(step.state)
  state.reviews[step.objectiveId]=review
  chapter.pedagogyAudit=state
  const reviews=chapter.teachingPlan.objectives.map(o=>state.reviews[o.id])
  if(reviews.some(row=>!row))return null
  const combine=(field,passes)=>{
    const rows=new Map()
    for(const review of reviews)for(const row of review[field] || [])if(!rows.has(row.questionKey) || !passes(row))rows.set(row.questionKey,row)
    return [...rows.values()]
  }
  return {objectives:reviews.flatMap(r=>r.objectives),issues:reviews.flatMap(r=>r.issues),transferChecks:combine('transferChecks',row=>['new_context','reverse_inference','combined_mechanisms','diagnosis','boundary_change'].includes(row.variation)),followUpChecks:combine('followUpChecks',row=>row.useful)}
}
