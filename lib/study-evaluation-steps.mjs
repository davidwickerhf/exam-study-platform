import { evidencePrompt, lessonPrompt, reviewPrompt, teachingSchema, teachingResponseSchema, pedagogicalResponseSchema, reviewSchema } from './study-version-content.mjs'
import { teachingPlanSchema, teachingPlanPrompt, pedagogyReviewSchema, pedagogyPrompt, pedagogyReviewIssues } from './study-pedagogy.mjs'
import { corruptEvaluationChapter } from './study-quality-fixture.mjs'
import { iotPedagogyFixture } from './study-pedagogy-fixtures.mjs'

export function evaluationStep(row) {
  const {course, snapshot, topic, generated, stage} = row
  const context = evidencePrompt(course, snapshot.sources, snapshot.chunks)
  if (stage === 0) return { schema: teachingPlanSchema, prompt: teachingPlanPrompt(context, topic), tokens: 12000, kind: 'plan' }
  if (stage === 1) return { schema: teachingSchema, prompt: lessonPrompt(course, snapshot.sources, snapshot.chunks, topic, row.teachingPlan), tokens: 20000, kind: 'lesson', responseSchema:teachingResponseSchema(row.teachingPlan,snapshot.chunks.map(c=>c.id)) }
  if (stage === 2 || stage === 4) return { schema: reviewSchema, prompt: reviewPrompt(course, snapshot.sources, snapshot.chunks, { ...(stage === 4 ? corruptEvaluationChapter(generated) : generated), id: topic.id }), tokens: 10000, kind: stage === 2 ? 'evidence' : 'corruption' }
  const fixture = stage >= 5 ? iotPedagogyFixture({ shallow: stage === 6 }) : null
  const chapter = fixture?.chapter || {...generated, id: topic.id}
  return { schema: pedagogyReviewSchema, responseSchema: pedagogicalResponseSchema(chapter), prompt: pedagogyPrompt(fixture ? evidencePrompt(fixture.course, fixture.sources, fixture.chunks) : context, chapter), tokens: 10000, kind: stage === 3 ? 'pedagogy' : stage === 5 ? 'iot-teaching' : 'iot-shallow', chapter }
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
