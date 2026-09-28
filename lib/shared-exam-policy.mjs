const EXAM_CONTEXT = /\b(exam(?:ination)?|past[ -]?(?:paper|exam|question)|mock|mid[ -]?term|resit|final[ -]?(?:paper|exam)|sample[ -]?(?:paper|exam)|question[ -]?paper)\b/i
const SOLUTION_CONTEXT = /\b(solution|solutions|answer[ -]?key|model[ -]?answer|marking[ -]?scheme|rubric)\b/i

export function examMaterialKind({ filename = '', sourcePath = '' } = {}) {
  if (!/\.pdf$/i.test(filename)) return null
  const name = filename.replace(/[_-]/g, ' ')
  const folder = sourcePath.slice(0, Math.max(0, sourcePath.lastIndexOf('/'))).replace(/[_/\\-]/g, ' ')
  const genericPaperName = /\b(questions?|paper|solutions?|answers?|answer[ -]?key|marking[ -]?scheme)\b/i.test(name)
  if (!EXAM_CONTEXT.test(name) && !(EXAM_CONTEXT.test(folder) && genericPaperName)) return null
  return SOLUTION_CONTEXT.test(name) ? 'solutions' : 'paper'
}

export function reviewedExamKind({ filename = '', sourcePath = '', kind = '' } = {}) {
  if (!/\.pdf$/i.test(filename)) return null
  return ['paper', 'solutions'].includes(kind) ? kind : examMaterialKind({ filename, sourcePath })
}

export function sharedExamCourseCode(value) {
  const code = String(value || '').trim().toUpperCase()
  return /^[A-Z0-9-]{2,30}$/.test(code) ? code : null
}

export function canOpenSharedExam(auth) {
  if (!auth?.authenticated || auth.mode === 'api-key') return false
  if (auth.mode === 'local' || auth.mode === 'local-test-user') return true
  if (!['clerk', 'local-login'].includes(auth.mode)) return false
  const domain = String(auth.email || '').trim().toLowerCase().split('@')[1]
  return ['student.maastrichtuniversity.nl', 'maastrichtuniversity.nl'].includes(domain) || auth.admin === true
}
