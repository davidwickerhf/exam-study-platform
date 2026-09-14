import { STUDY_GENERATION_LIMITS as generationLimits } from './study-generation-limits.mjs'
import { digest, pedagogicalResponseSchema, parseStudyJson } from './study-version-content.mjs'
import { pedagogyPrompt, pedagogyReviewSchema } from './study-pedagogy.mjs'

const fingerprint = chapter => digest({reviewVersion:4,sections:chapter.sections,questions:chapter.questions,teachingPlan:chapter.teachingPlan,objectiveCoverage:chapter.objectiveCoverage})
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

  responseSchema.properties.objectives.minItems=responseSchema.properties.objectives.maxItems=1
  responseSchema.properties.objectives.items.properties.objectiveId.enum=[objective.id]
  return {objectiveId:objective.id,state,quoteReferences,chapter:slice,schema:pedagogyReviewSchema,responseSchema,tokens:generationLimits.pedagogicalReviewTokens,prompt:pedagogyPrompt(context+'\nReview only the selected objective and questions. Other sections and relatedQuestions provide prerequisite and linked-follow-up context. A follow-up listed in relatedQuestions exists; do not flag it as missing merely because it belongs to another objective.',slice,{quoteReferences})}
}
export function acceptPedagogicalReview(chapter,step,raw) {
  if(fingerprint(chapter)!==step.state.fingerprint)throw new Error('The lesson changed during pedagogical review.')
  const review=parseStudyJson(raw,pedagogyReviewSchema)
  for(const objective of review.objectives)for(const field of ['explanation','workedExample']){
    const value=objective[field]
    const reference=value && step.quoteReferences?.[value.quote]
    if(reference){
      if(value.sectionId!==reference.sectionId)throw new Error('The review excerpt belongs to a different section.')
      objective[field]={...reference}
    }
  }

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
