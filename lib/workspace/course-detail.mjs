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

/** Query every source code that curriculum reconciliation joined into this row. */
export function courseMaterialCodes(entry) {
  return [...new Set([entry?.code, entry?.editorial?.code, entry?.academic?.code, entry?.corpus?.courseCode,
    ...(entry?.academic?.attempts || []).map(attempt => attempt.courseCode),
    ...(entry?.corpus?.editions || []).map(edition => edition.courseCode),
  ].map(code).filter(Boolean))].sort()
}

/** A catalogue placement is not a personal record that can accept a request. */
export function courseRequestRecord(entry, academic = []) {
  return academic.find(record => record.id === entry?.academic?.id)
    || academic.find(record => courseMaterialCodes(entry).includes(code(record.code))) || null
}
