import test from 'node:test'
import assert from 'node:assert/strict'
import { academicCourseInEdition, canvasEditionYear, courseCanvasShells, courseEditionCodes, courseEditions } from '../lib/workspace/course-editions.mjs'
const origin = 'https://canvas.example.edu'
const shells = ['2024-2025', '2025-2026', '2026-2027'].map((year, i) => ({ id: String(i + 1), origin, name: `AI (${year}-100-BCS2120)`, courseCode: `${year}-100-BCS2120` }))

test('finds every accessible academic year with exact course codes and safe date fallbacks', () => {
  const found = courseCanvasShells([...shells, { ...shells[0], id: 'bad', name: 'Other BCS21200', courseCode: 'BCS21200' }, shells[0]], ['BCS2120'])
  assert.deepEqual(found.map(s => s.academicYear), ['2024-2025', '2025-2026', '2026-2027'])
  assert.equal(canvasEditionYear({ term: { name: '2025–2026' } }), '2025-2026')
  assert.equal(canvasEditionYear({ startAt: '2026-02-10' }), '2025-2026')
  assert.equal(canvasEditionYear({}), '')
})

test('discovers old-code editions from curriculum history before they are scraped', () => {
  const catalogue = { programmes: [{ id: 'cs', versions: [{ id: 'new', courses: [{ code: 'BCS2140', name: 'Operating Systems' }] }, { id: 'old', courses: [{ code: 'BCS3420', name: 'Operating Systems' }] }] }] }
  const codes = courseEditionCodes({ code: 'BCS2140', name: 'Operating Systems' }, { catalogue, programmeTemplate: { programmeId: 'cs', versionId: 'new' } })
  assert.deepEqual(codes, ['BCS2140', 'BCS3420'])
  assert.equal(courseCanvasShells([{ id: 'old', origin, courseCode: 'BCS3420', name: 'OS 2024-2025' }], codes).length, 1)
})

test('year selection filters attempts without mutating or dropping the full history', () => {
  const course = { attempts: [{ academicYear: '2024–2025', grade: 4 }, { academicYear: '2025-2026', grade: 5 }, { academicYear: '2026-2027', grade: null }] }
  assert.equal(academicCourseInEdition(course, '2024-2025').attempts[0].grade, 4)
  assert.equal(academicCourseInEdition(course, 'all'), course)
  assert.equal(course.attempts.length, 3)
})

test('missing collection is evaluated for every shell, even alongside a completed shell in the same year', () => {
  const available = courseCanvasShells([...shells, { ...shells[0], id: 'second-shell' }], ['BCS2120'])
  const entry = { academic: { attempts: [{ academicYear: '2023-2024' }] }, corpus: { editions: [{ id: 'binding1', origin, canvasCourseId: '1', academicYear: '2024-2025', sources: 10, lastSyncedAt: '2026-09-01' }] } }
  const rows = courseEditions({ entry, codes: ['BCS2120'], shells: available, jobs: [{ bindingId: 'binding1', courseCode: 'BCS2120', academicYear: '2024-2025', status: 'completed', createdAt: '2026-09-01' }] })
  assert.deepEqual(rows.map(r => r.year), ['2026-2027','2025-2026','2024-2025','2023-2024'])
  assert.equal(rows[2].sources, 10)
  assert.equal(rows[2].missing[0].id, 'second-shell')
  assert.equal(rows[3].shells.length, 0)
  assert.equal(rows[3].attempts, 1)
})

test('latest failure overrides old success and pending jobs prevent duplicate collection', () => {
  const entry = { corpus: { editions: [{ id: 'binding1', origin, canvasCourseId: '1', academicYear: '2024-2025', sources: 10, lastSyncedAt: '2026-09-01' }] } }
  const job = { bindingId: 'binding1', courseCode: 'BCS2120', academicYear: '2024-2025' }
  const options = { entry, codes: ['BCS2120'], shells: courseCanvasShells([shells[0]], ['BCS2120']) }
  const failed = courseEditions({ ...options, jobs: [{ ...job, status: 'completed', createdAt: '2026-09-01' }, { ...job, status: 'failed', createdAt: '2026-09-02' }] })[0]
  assert.equal(failed.failed, true)
  assert.equal(failed.missing.length, 1)
  const running = courseEditions({ ...options, jobs: [{ ...job, status: 'running' }] })[0]
  assert.equal(running.busy, true)
  assert.equal(running.missing.length, 0)
  const queued = courseEditions({ codes: ['BCS2120'], shells: options.shells, queued: [`${origin}:1`] })[0]
  assert.equal(queued.busy, true)
  assert.equal(queued.missing.length, 0)
})
