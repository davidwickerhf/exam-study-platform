/** Use independently supported rules while keeping disputed source passages out. */
export function supportedCourseAssessment(course) {
  const assessment = course?.courseProfile?.assessment
  if (assessment?.status === 'confirmed') return assessment
  if (assessment?.status !== 'needs-review') return null
  const conflicts = assessment.conflicts || course.priorityScan?.conflicts || []
  const operational = conflict => /^(Priority scan allowance reached|Priority AI provider unavailable|Automatic priority extraction needs another pass|Priority evidence needs review)$/.test(conflict.title || '')
  const semantic = conflicts.filter(conflict=>!operational(conflict))
  const literalSupported = item => item.verification==='literal' && item.evidence?.length && semantic.every(conflict=>conflict.chunkIds?.length && item.evidence.every(ref=>!conflict.chunkIds.map(Number).includes(Number(ref.chunkId))))
  // An unscoped failure cannot establish which model claims are safe to use.
  if (!conflicts.length) return null
  const disputed = new Set(conflicts.flatMap(conflict => conflict.chunkIds).map(Number))
  const supported = item => !conflicts.some(conflict=>!conflict.chunkIds?.length) && item.evidence?.length && item.evidence.every(ref => !disputed.has(Number(ref.chunkId)))
  const attendanceEvidence = (assessment.attendanceEvidence || []).filter(item=>literalSupported(item)||supported(item))
  const components = (assessment.components || []).filter(supported)
  if (!attendanceEvidence.length && !components.length) return null
  return { ...assessment, status: 'confirmed', components, attendanceEvidence,
    attendanceRules: attendanceEvidence.map(rule => `${rule.text} [${rule.activity}]`),
    overallPassRules: [], resitRules: [] }
}
