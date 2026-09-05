/** Use independently supported rules while keeping disputed source passages out. */
export function supportedCourseAssessment(course) {
  const assessment = course?.courseProfile?.assessment
  if (assessment?.status === 'confirmed') return assessment
  if (assessment?.status !== 'needs-review') return null
  const conflicts = assessment.conflicts || course.priorityScan?.conflicts || []
  // An unscoped failure cannot establish which claims are safe to use.
  if (!conflicts.length || conflicts.some(conflict => !conflict.chunkIds?.length)) return null
  const disputed = new Set(conflicts.flatMap(conflict => conflict.chunkIds).map(Number))
  const supported = item => item.evidence?.length && item.evidence.every(ref => !disputed.has(Number(ref.chunkId)))
  const attendanceEvidence = (assessment.attendanceEvidence || []).filter(supported)
  const components = (assessment.components || []).filter(supported)
  if (!attendanceEvidence.length && !components.length) return null
  return { ...assessment, status: 'confirmed', components, attendanceEvidence,
    attendanceRules: attendanceEvidence.map(rule => `${rule.text} [${rule.activity}]`),
    overallPassRules: [], resitRules: [] }
}
