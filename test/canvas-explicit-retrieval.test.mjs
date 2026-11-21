import test from 'node:test'
import assert from 'node:assert/strict'
import { canvasPageMediaLinks, inspectCanvasMaterial, parseCourseMaterialLink } from '../lib/canvas-explicit-retrieval.mjs'

const origin = 'https://canvas.example.edu'
const courseId = '30647'

test('material links remain on the connected course and host', () => {
  assert.deepEqual(parseCourseMaterialLink(`${origin}/courses/30647/files/42`, origin, courseId), {kind:'file',id:'42',source:`${origin}/courses/30647/files/42`})
  assert.equal(parseCourseMaterialLink(`${origin}/courses/30647/modules/5/items/9`, origin, courseId).id, '9')
  assert.throws(() => parseCourseMaterialLink(`${origin}/courses/999/files/42`, origin, courseId), /course file/)
  assert.throws(() => parseCourseMaterialLink('https://other.example.edu/courses/30647/files/42', origin, courseId), /connected Canvas host/)
  assert.throws(() => parseCourseMaterialLink('http://canvas.example.edu/courses/30647/files/42', origin, courseId), /connected Canvas host/)
})

test('page inspection lists course files with exact metadata without downloading bytes', async () => {
  const paths = []
  const fetchImpl = async (url) => {
    paths.push(new URL(url).pathname)
    const path = new URL(url).pathname
    if (path.endsWith('/pages/vr-demos')) return Response.json({body:'<a href="/courses/30647/files/42">Drawers</a>'})
    if (path.endsWith('/files/42')) return Response.json({id:42,display_name:'Drawers demo.mp4',content_type:'video/mp4',size:1024,updated_at:'2026-09-21T10:00:00Z',url:'https://files.example.edu/42'})
    return new Response('', {status:404})
  }
  const result = await inspectCanvasMaterial({origin,courseId,link:`${origin}/courses/30647/pages/vr-demos`,accessToken:'test-token',fetchImpl})
  assert.equal(result.files[0].title, 'Drawers demo.mp4')
  assert.equal(result.files[0].type, 'video/mp4')
  assert.equal(result.files[0].size, 1024)
  assert.equal(result.files[0].source, `${origin}/courses/30647/files/42`)
  assert.deepEqual(paths, ['/api/v1/courses/30647/pages/vr-demos','/api/v1/courses/30647/files/42'])
})

test('Studio embed returns a direct Canvas action and never fetches an external host', async () => {
  const result = await inspectCanvasMaterial({origin,courseId,link:`${origin}/courses/30647/pages/vr-demos`,accessToken:'test-token',fetchImpl:async () => Response.json({body:'<iframe src="https://studio.example.edu/media/abc"></iframe>'})})
  assert.equal(result.status, 'external')
  assert.equal(result.type, 'Canvas Studio')
  assert.equal(result.actionUrl, `${origin}/courses/30647/pages/vr-demos`)
})

test('direct course media links get an actionable limitation without a transfer', async () => {
  const link = `${origin}/courses/30647/external_tools/retrieve?display=borderless`
  const result = await inspectCanvasMaterial({origin,courseId,link,accessToken:'test-token',fetchImpl:async () => { throw new Error('must not fetch') }})
  assert.equal(result.status, 'external')
  assert.equal(result.actionUrl, `${origin}/courses/30647/external_tools/retrieve`)
  assert.match(result.reason, /Canvas Files API/)
})

test('page media extraction deduplicates file links', () => {
  assert.deepEqual(canvasPageMediaLinks('<a href="/courses/30647/files/42">a</a><a href="/files/42">b</a>', origin, courseId).fileIds,['42'])
})
