// Compare independent, derived document rows. Never use the merged workspace
// as proof that two source documents agree.
const year = (value) => String(value || '').replace(/[–—/]/g, '-')
const code = (value) => String(value || '').toUpperCase().replace(/\s/g, '')
const name = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\bai\b/g, 'artificial intelligence').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const outcome = (value) => value === 'exempt' ? 'passed' : value === 'no-show' ? 'failed' : value
const resultKey = (row) => [code(row.code) || name(row.name), year(row.academicYear), row.examDate || '', row.period || row.periodCode || '', row.grade ?? '', outcome(row.status), row.creditsTotal, row.creditsEarned].join('|')

export function documentRows(draft) {
  return (draft?.courses || []).flatMap((course) => (course.attempts || []).map((attempt) => ({
    code: course.code, name: course.name, academicYear: attempt.academicYear,
    period: attempt.period || course.period || '', examDate: attempt.examDate, grade: attempt.grade, status: attempt.status,
    creditsTotal: attempt.ects ?? course.ects,
    creditsEarned: attempt.creditsEarned ?? (attempt.status === 'passed' ? attempt.ects ?? course.ects : 0)
  })))
}

export function documentCredits(rows = []) {
  const earned = new Map()
  for (const row of rows) {
    if (outcome(row.status) !== 'passed') continue
    const key = code(row.code) || name(row.name)
    // A repeat pass earns the course once. Conflicting credits are separately
    // flagged; use the earliest recorded award, not the current catalogue.
    const held = earned.get(key)
    if (!held || String(row.examDate || year(row.academicYear)) < String(held.examDate || year(held.academicYear))) earned.set(key, row)
  }
  return Number([...earned.values()].reduce((sum, row) => sum + (row.creditsEarned ?? row.creditsTotal ?? 0), 0).toFixed(2))
}

export function validateDocumentRows(rows, { expectedRows = null, declaredCredits = null, supported = true } = {}) {
  const issues = []
  if (!supported) issues.push('This document layout needs a manual review; automatic extraction is not independently verified.')
  if (!rows.length) issues.push('No result rows could be read.')
  if (expectedRows !== null && expectedRows !== rows.length) issues.push(`${expectedRows} course rows were detected, but ${rows.length} were read. Upload a complete text-based export; no partial record has been saved.`)
  const seen = new Set()
  const sittings = new Map()
  for (const row of rows) {
    const label = `${row.code || row.name} (${row.academicYear || 'year missing'})`
    if (!row.name || !/^\d{4}-\d{4}$/.test(year(row.academicYear)) || Number(year(row.academicYear).slice(5)) !== Number(year(row.academicYear).slice(0, 4)) + 1) issues.push(`${label}: course identity or academic year is incomplete.`)
    if (row.examDate && (!/^\d{4}-\d{2}-\d{2}$/.test(row.examDate) || !Number.isFinite(Date.parse(row.examDate)) || new Date(row.examDate).toISOString().slice(0, 10) !== row.examDate)) issues.push(`${label}: invalid result date.`)
    if (!Number.isFinite(row.creditsTotal) || row.creditsTotal < 0 || !Number.isFinite(row.creditsEarned) || row.creditsEarned < 0 || row.creditsEarned > row.creditsTotal) issues.push(`${label}: invalid earned or available credits.`)
    if (row.grade != null && (!Number.isFinite(row.grade) || supported && (row.grade < 0 || row.grade > 10))) issues.push(`${label}: grade is outside the documented scale.`)
    if (supported && (outcome(row.status) === 'passed' && (row.grade != null && row.grade < 5.5 || row.creditsTotal > 0 && row.creditsEarned === 0)
      || ['failed', 'no-show', 'upcoming'].includes(row.status) && row.creditsEarned > 0
      || outcome(row.status) === 'failed' && row.grade != null && row.grade >= 5.5)) issues.push(`${label}: result, grade and earned credits disagree.`)
    const key = resultKey(row)
    if (seen.has(key)) issues.push(`${label}: a result row is repeated; check the source before importing.`)
    seen.add(key)
    const sitting = [code(row.code) || name(row.name), row.examDate || [year(row.academicYear), row.period || row.periodCode || '', row.grade ?? '', outcome(row.status)].join('|')].join('|')
    if (sittings.has(sitting) && sittings.get(sitting) !== key) issues.push(`${label}: conflicting rows describe the same result. Check the printed grade and credit award.`)
    sittings.set(sitting, key)
  }
  const earnedCredits = documentCredits(rows)
  if (declaredCredits !== null && Math.abs(earnedCredits - declaredCredits) > 0.001) issues.push(`The document states ${declaredCredits} earned ECTS, but its unique passed courses add up to ${earnedCredits}.`)
  return { status: issues.length ? 'attention' : 'read', rowCount: rows.length, earnedCredits, declaredCredits, issues: [...new Set(issues)], supported }
}

export function compareAcademicDocuments(record, transcript) {
  const recordRows = record?.rows || []
  const transcriptRows = transcript?.rows || []
  const checks = []
  const matched = new Set()
  for (const row of transcriptRows.filter((item) => item.status !== 'upcoming')) {
    const candidates = recordRows.filter((other) => other.status !== 'upcoming' && year(other.academicYear) === year(row.academicYear)
      && (row.code && other.code ? code(row.code) === code(other.code) : name(row.name) === name(other.name)))
    const identities = new Set(candidates.map((other) => code(other.code) || name(other.name)))
    const agreeing = candidates.filter((other) => outcome(other.status) === outcome(row.status) && other.grade === row.grade && other.creditsTotal === row.creditsTotal && other.creditsEarned === row.creditsEarned)
    const status = identities.size > 1 || agreeing.length > 1 || agreeing.length && agreeing.every((other) => matched.has(other)) ? 'ambiguous' : agreeing.length ? 'confirmed' : candidates.length ? 'conflict' : 'transcript-only'
    const confirmedRow = status === 'confirmed' ? agreeing.find((other) => !matched.has(other)) : null
    if (confirmedRow) matched.add(confirmedRow)
    checks.push({ status, course: row.code || row.name, name: row.name, academicYear: row.academicYear, transcript: row, record: confirmedRow ? [confirmedRow] : candidates })
  }
  for (const row of recordRows.filter((item) => item.status !== 'upcoming' && !matched.has(item))) {
    checks.push({ status: 'record-only', course: row.code || row.name, name: row.name, academicYear: row.academicYear, transcript: null, record: [row] })
  }
  const issues = [...(record?.validation?.issues || []), ...(transcript?.validation?.issues || [])]
  const counts = Object.fromEntries(['confirmed', 'conflict', 'ambiguous', 'record-only', 'transcript-only'].map((status) => [status, checks.filter((check) => check.status === status).length]))
  const both = Boolean(record && transcript)
  const recordCredits = record ? documentCredits(recordRows) : null
  const transcriptCredits = transcript ? documentCredits(transcriptRows) : null
  const confirmed = both && checks.length > 0 && checks.every((check) => check.status === 'confirmed') && !issues.length && recordCredits === transcriptCredits && record.validation?.supported && transcript.validation?.supported
  return { status: confirmed ? 'confirmed' : !both ? 'awaiting-document' : 'attention', recordCredits, transcriptCredits, counts, checks, issues,
    recordLabel: record?.sourceLabel || null, transcriptLabel: transcript?.sourceLabel || null,
    message: confirmed ? 'Recorded results and earned credits agree across both documents. Current enrolments are checked separately.' : !both ? 'Attach both the transcript and Academic Work overview to cross-check results. Existing imports without independent source rows need to be read again.' : 'Some results are not yet corroborated. Different document dates or omitted historical attempts can explain gaps; disagreements need review.' }
}
