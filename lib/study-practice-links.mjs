import { z } from 'zod/v3'
import { studyResponseSchema, parseStudyJson, StudyVersionError } from './study-version-content.mjs'

export function invalidPracticeLinks(chapter) {
  const questions=new Map(chapter.questions.map(q=>[q.key,q]))
  return chapter.questions.flatMap(q=>(q.misconceptions||[]).flatMap((m,index)=>{
    const candidates=chapter.questions.filter(other=>other.key!==q.key && other.objectiveIds.some(id=>q.objectiveIds.includes(id)))
    return candidates.some(other=>other.key===m.followUpKey) ? [] : [{key:`${q.key}:${index}`,questionKey:q.key,index,candidates:candidates.map(q=>q.key)}]
  }))
}
export function practiceLinkStep(chapter) {
  const invalid=invalidPracticeLinks(chapter)
  if(!invalid.length)return null
  if(invalid.some(row=>!row.candidates.length))throw new StudyVersionError('Add a related practice question before linking misconception follow-ups.',422)
  const schema=z.object({links:z.object(Object.fromEntries(invalid.map(row=>[row.key,z.object({followUpKey:z.enum(row.candidates),changedCondition:z.string().min(1).max(800)}).strict()]))).strict()}).strict()
  return {schema,responseSchema:studyResponseSchema(schema),invalid,prompt:`REPAIR PRACTICE LINKS. Select a different question that tests the same objective and changes a meaningful condition in response to each diagnosed mistake. The schema lists only valid targets. Explain the changed condition; do not claim a number-only variation is transfer. Do not rewrite teaching, answers, keys or objectives. These links will also undergo pedagogical review.\nReview payload: ${JSON.stringify({invalid,questions:chapter.questions.map(({key,question,objectiveIds,practiceStage,misconceptions})=>({key,question,objectiveIds,practiceStage,misconceptions}))})}`}
}
export function applyPracticeLinks(chapter,step,raw) {
  const result=parseStudyJson(raw,step.schema)
  for(const row of step.invalid){
    const target=chapter.questions.find(q=>q.key===row.questionKey)?.misconceptions[row.index]
    if(!target)throw new StudyVersionError('Practice changed while repairing its links.',409)
    target.followUpKey=result.links[row.key].followUpKey
  }
  chapter.practiceLinkReview=result.links
}
