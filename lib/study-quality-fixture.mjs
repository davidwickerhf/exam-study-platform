// Fixed reference evidence for opt-in live evaluations; never production course material.
export const evaluationCourse = {
  courseCode: 'EVAL101',
  courseName: 'Probability',
  academicYear: '2026-2027',
  period: '1'
}
export const evaluationSources = [
  {
    key: 'current',
    title: 'Current probability lecture',
    kind: 'canvas',
    academicYear: '2026-2027',
    period: '1'
  },
  {
    key: 'old',
    title: 'Historical course notes',
    kind: 'notes',
    academicYear: '2025-2026',
    period: '1'
  }
]
export const evaluationChunks = [
  {
    id: 'e-current',
    sourceKey: 'current',
    page: 1,
    text: 'For two events A and B, P(A union B) = P(A) + P(B) - P(A intersection B). For disjoint events the intersection has probability zero. Independence instead means P(A intersection B) = P(A)P(B). Complement probability is 1-P(A). With a fair six-sided die each face has probability 1/6. Current exam duration is 120 minutes; it is closed book.'
  },
  {
    id: 'e-old',
    sourceKey: 'old',
    page: 2,
    text: 'In 2025-2026 the exam duration was 90 minutes and notes were permitted. Historical illustration: for a fair die, even outcomes are 2,4,6 so their probability is 3/6.'
  }
]
export const evaluationTopic = {
  id: 'probability',
  title: 'Combining events and checking assumptions',
  sourceIds: evaluationChunks.map((c) => c.id)
}
