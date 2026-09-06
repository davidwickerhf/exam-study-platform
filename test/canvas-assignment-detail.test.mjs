import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchCanvasAssignmentDetail } from '../lib/canvas-assignment-detail.mjs'
import { withRequestContext } from '../lib/request-context.mjs'

test('assignment detail fetches only one assignment and the signed-in student feedback, preserving the full brief', async () => {
  const paths = []
  const fetchImpl = async url => {
    paths.push(new URL(url).pathname + new URL(url).search)
    return new Response(JSON.stringify(String(url).includes('/submissions/self') ? { submitted_at: '2026-09-05T12:00:00Z', workflow_state: 'graded', score: 8, grade: '8', attempt: 1, submission_comments: [{ id: 1, author_name: 'TA', comment: 'Explain the method.', created_at: '2026-09-06' }], rubric_assessment: { c: { points: 8, comments: 'Well supported' } } } : { id: 34, name: 'Paper choice', description: `<p>${'Full instructions. '.repeat(100)}</p><script>bad()</script>`, points_possible: 10, due_at: '2026-09-11', rubric: [{ id: 'c', description: 'Evidence', points: 10 }], submission_types: ['online_upload'] }), { headers: { 'content-type': 'application/json' } })
  }
  await withRequestContext({ userId: 'assignment-detail-test' }, async () => {
    const result = await fetchCanvasAssignmentDetail({ origin: 'https://canvas.maastrichtuniversity.nl', token: 'fixture', courseId: '12', assignmentId: '34', fetchImpl })
    assert.equal(paths.length, 2)
    assert.ok(paths.every(path => path.startsWith('/api/v1/courses/12/assignments/34')))
    assert.match(paths[1], /submissions\/self/)
    assert.equal(result.assignment.status, 'graded')
    assert.ok(result.assignment.descriptionHtml.length > 400)
    assert.doesNotMatch(result.assignment.descriptionHtml, /<script/)
    assert.equal(result.assignment.comments[0].text, 'Explain the method.')
    assert.equal(result.assignment.rubric[0].score, 8)
    assert.equal(result.assignment.rubric[0].feedback, 'Well supported')
  })
  await assert.rejects(fetchCanvasAssignmentDetail({ origin: 'https://canvas.example', token: 'fixture', courseId: '../all', assignmentId: '34', fetchImpl }), /Invalid/)
})
test('unavailable feedback is not presented as an empty comment history', async () => {
  await withRequestContext({ userId: 'assignment-feedback-failure-test' }, async () => {
    const result = await fetchCanvasAssignmentDetail({ origin: 'https://canvas.maastrichtuniversity.nl', token: 'fixture-2', courseId: '12', assignmentId: '35', fetchImpl: async url => String(url).includes('submissions/self') ? new Response('{}', { status: 403 }) : new Response(JSON.stringify({ id: 35, name: 'Task', description: 'Brief' })) })
    assert.equal(result.assignment.feedbackAvailable, false)
    assert.equal(result.problems.length, 1)
    assert.equal(result.assignment.title, 'Task')
  })
})
