import { reconcileCourses } from './course-ledger.mjs'

const code = (value) => String(value || '').trim().toUpperCase()

/** Use the same curriculum reconciliation as the register, including recodes. */
export function courseDetail(courseId, sources = {}) {
  const rows = reconcileCourses(sources)
  const direct = rows.find((row) => row.editorial?.id === courseId || row.academic?.id === courseId || code(row.code) === code(courseId) || code(row.key) === code(courseId))
  if (direct) return direct
  const original = sources.academic?.find((course) => course.id === courseId)
  return original ? rows.find((row) => row.academic?.attempts?.some((attempt) => code(attempt.courseCode) === code(original.code))) ?? null : null
}

/** Keep every distinct sitting; grades and historical course facts are never inferred. */
export function courseAttemptHistory(course) {
  return (course?.attempts || []).map((attempt, index) => ({ ...attempt, key: `${attempt.id || 'attempt'}-${index}`, recordedIndex: index }))
    .sort((a, b) => {
      const year = (attempt) => String(attempt.academicYear || '').replace(/[–—/]/g, '-')
      return year(b).localeCompare(year(a)) || String(b.examDate || '').localeCompare(String(a.examDate || '')) || b.recordedIndex - a.recordedIndex
    })
}

export function courseDetailTab(search = '', hash = '') {
  const tab = new URLSearchParams(search).get('tab')
  if (['study', 'history', 'materials', 'attendance', 'about'].includes(tab)) return tab
  return ({ '#attendance': 'attendance', '#course-material': 'materials', '#attempts': 'history' })[hash] || 'study'
}
