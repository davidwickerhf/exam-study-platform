import { STUDY_GENERATION_LIMITS as generationLimits } from './study-generation-limits.mjs'
import { nextPedagogicalReview } from './study-pedagogical-review.mjs'
import { nextFactualReview } from './study-factual-review.mjs'
import { evidencePrompt, lessonPrompt, reviewPrompt, teachingSchema, teachingResponseSchema, pedagogicalResponseSchema, reviewSchema } from './study-version-content.mjs'
import { teachingPlanSchema, teachingPlanPrompt, pedagogyReviewSchema, pedagogyPrompt, pedagogyReviewIssues } from './study-pedagogy.mjs'
import { corruptEvaluationChapter } from './study-quality-fixture.mjs'
import { iotPedagogyFixture } from './study-pedagogy-fixtures.mjs'

export function evaluationStep(row) {
  const {course, snapshot, topic, generated, stage} = row
  const context = evidencePrompt(course, snapshot.sources, snapshot.chunks)
  if (stage === 0) return { schema: teachingPlanSchema, prompt: teachingPlanPrompt(context, topic), tokens: generationLimits.planTokens, kind: 'plan' }
  if (stage === 1) return { schema: teachingSchema, prompt: lessonPrompt(course, snapshot.sources, snapshot.chunks, topic, row.teachingPlan), tokens: generationLimits.chapterTokens, kind: 'lesson', responseSchema:teachingResponseSchema(row.teachingPlan,snapshot.chunks.map(c=>c.id)) }
  if (stage === 2 || stage === 4) {
    const chapter=stage===4 ? row.corrupted || {...corruptEvaluationChapter(generated),id:topic.id} : {...generated,id:topic.id}
    const factual=nextFactualReview(course,snapshot.sources,snapshot.chunks,chapter)
    if(!factual)throw new Error('This factual evaluation has already completed.')
    return {...factual,kind:stage===2?'evidence':'corruption',factual,chapter}
  }
  const fixture = stage >= 5 ? iotPedagogyFixture({ shallow: stage === 6 }) : null
  const chapter = fixture ? row.pedagogyFixtures?.[stage] || fixture.chapter : {...generated, id: topic.id}
  const pedagogical = nextPedagogicalReview(fixture ? evidencePrompt(fixture.course, fixture.sources, fixture.chunks) : context, chapter)
  return {...pedagogical,pedagogical,kind:stage===3?'pedagogy':stage===5?'iot-teaching':'iot-shallow',chapter}
}
export function pedagogicalEvaluationCheck(step, review) {
  const issues = pedagogyReviewIssues(step.chapter, review)
  // A refusal, malformed review or missing objective is not a successful
  // negative control. Require an explicit diagnosis for every shallow case.
  const rejectsShallow = step.chapter.teachingPlan.objectives.every(objective => {
    const rows = review.objectives.filter(row => row.objectiveId === objective.id)
    return rows.length === 1 && !rows[0].adequate && rows[0].missingReasoning.length > 0
      && step.chapter.sections.some(s => s.id === rows[0].explanation.sectionId && s.text.includes(rows[0].explanation.quote))
  })
  return { name: step.kind === 'pedagogy' ? 'Independent pedagogical review' : step.kind === 'iot-teaching' ? 'IoT worked teaching prepares its assessments' : 'Reviewer rejects five shallow but factually correct IoT lessons',
    passed: step.kind === 'iot-shallow' ? rejectsShallow : !issues.some(i => i.severity === 'error'), issues, review }
}
