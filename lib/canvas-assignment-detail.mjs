import { createCanvasApi, sanitizeCanvasHtml } from './canvas-course-import.mjs'
import { assignmentRecord } from './canvas-hub.mjs'
import { cachedCanvasResponse } from './canvas-shared-cache.mjs'

export async function fetchCanvasAssignmentDetail({ origin, token, courseId, assignmentId, force = false, fetchImpl = fetch }) {
  if (!/^\d{1,12}$/.test(String(courseId)) || !/^\d{1,12}$/.test(String(assignmentId))) throw new Error('Invalid Canvas assignment.')
  return cachedCanvasResponse({ origin, token, courseIds: [String(courseId)], parts: [`assignment:${assignmentId}`], force }, async () => {
    const api = createCanvasApi({ origin, accessToken: token, fetchImpl })
    const path = `/api/v1/courses/${courseId}/assignments/${assignmentId}`
    const [assignment, submission] = await Promise.all([
      api.getJson(`${path}?include[]=submission`),
      api.getJson(`${path}/submissions/self?include[]=submission_comments&include[]=rubric_assessment`).then(value => ({ value }), () => ({ value: null }))
    ])
    const row = { ...assignment, submission: submission.value || assignment.submission }
    return {
      assignment: { ...assignmentRecord(row, { courseId, origin }), descriptionHtml: sanitizeCanvasHtml(assignment.description || ''),
        comments: (submission.value?.submission_comments || []).map(comment => ({ id: String(comment.id), author: String(comment.author_name || 'Course team'), at: comment.created_at || null, text: String(comment.comment || ''), attachments: (comment.attachments || []).map(file => ({ name: String(file.display_name || file.filename || 'Attachment') })) })),
        rubric: (assignment.rubric || []).map(item => ({ id: String(item.id), description: String(item.description || ''), detail: String(item.long_description || ''), points: item.points, score: submission.value?.rubric_assessment?.[item.id]?.points ?? null, feedback: String(submission.value?.rubric_assessment?.[item.id]?.comments || '') })),
        submissionAttempts: submission.value?.attempt ?? null,
        feedbackAvailable: submission.value !== null
      }, problems: submission.value ? [] : [{ part: 'submission', error: 'Submission feedback could not be loaded. The assignment brief is available.' }]
    }
  })
}
