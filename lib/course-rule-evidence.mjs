/** Use independently supported rules while keeping disputed source passages out. */
export function supportedCourseAssessment(course) {
  const assessment = course?.courseProfile?.assessment
  if (assessment?.status === 'confirmed') return assessment
  if (assessment?.status !== 'needs-review') return null
  const conflicts = assessment.conflicts || course.priorityScan?.conflicts || []
  const operational = conflict => /^(Priority scan allowance reached|Priority AI provider unavailable|Priority generation allowance reached|Automatic priority extraction needs another pass|Priority evidence needs review)$/.test(conflict.title || '')
  const semantic = conflicts.filter(conflict=>!operational(conflict))
  const literalSupported = item => item.verification==='literal' && item.evidence?.length && semantic.every(conflict=>conflict.chunkIds?.length && item.evidence.every(ref=>!conflict.chunkIds.map(Number).includes(Number(ref.chunkId))))
  // An unscoped failure cannot establish which model claims are safe to use.
  if (!conflicts.length) return null
  const disputed = new Set(conflicts.flatMap(conflict => conflict.chunkIds).map(Number))
  const supported = item => !conflicts.some(conflict=>!conflict.chunkIds?.length) && item.evidence?.length && item.evidence.every(ref => !disputed.has(Number(ref.chunkId)))
  const check = assessment.attendanceCheck
  const attendanceSupported = item => {
    if (!check || !['confirmed','needs-review'].includes(check.status) || !item.evidence?.length) return false
    const attendanceConflicts = check.conflicts || []
    if (check.status === 'needs-review' && !attendanceConflicts.length) return false
    return attendanceConflicts.every(conflict => conflict.chunkIds?.length && item.evidence.every(ref => !conflict.chunkIds.map(Number).includes(Number(ref.chunkId))))
  }
  const attendanceEvidence = (assessment.attendanceEvidence || []).filter(item=>literalSupported(item)||(check ? attendanceSupported(item) : supported(item)))
  const sessionMappings = (assessment.sessionMappings || []).filter(check ? attendanceSupported : supported)
  const components = (assessment.components || []).filter(supported)
  const actions = (assessment.actions || []).filter(supported)
  if (!attendanceEvidence.length && !sessionMappings.length && !components.length && !actions.length) return null
  return { ...assessment, status: 'confirmed', components, actions, attendanceEvidence, sessionMappings,
    attendanceRules: attendanceEvidence.map(rule => `${rule.text} [${rule.activity}]`),
    overallPassRules: [], resitRules: [] }
}
