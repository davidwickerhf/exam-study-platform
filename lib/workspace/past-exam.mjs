export function coursePapers(course) {
  if (Array.isArray(course?.mockExams) && course.mockExams.length) return course.mockExams
  return course?.mockExamPdf ? [{ id: 'default', label: 'Mock exam', pdf: course.mockExamPdf, ...(course.mockExamSolutionsPdf ? { solutionsPdf: course.mockExamSolutionsPdf } : {}) }] : []
}

export function pastExamGradeRequest(questionId, attempt) {
  return { questionId: String(questionId), attempt: String(attempt ?? '').trim() }
}

export function paperAssetHref(courseId, examId, path) {
  return `/api/practice-exam-asset/${encodeURIComponent(courseId)}/${encodeURIComponent(examId || 'default')}/${String(path ?? '').split('/').map(encodeURIComponent).join('/')}`
}

export function paperPdfHref(courseId, examId, solutions = false) {
  return `/api/pdf/${encodeURIComponent(courseId)}/${encodeURIComponent(examId || 'default')}${solutions ? '/solutions' : ''}`
}
