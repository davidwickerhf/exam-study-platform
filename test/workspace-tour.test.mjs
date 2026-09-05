import test from 'node:test'
import assert from 'node:assert/strict'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { finishSetup, resetConversation } from '../lib/onboarding-runtime.mjs'
import { offerWorkspaceTour, saveWorkspaceTour, workspaceTour } from '../lib/workspace-tour.mjs'
import { setupSettled, setupSteps } from '../lib/workspace/setup.mjs'
import { tourPosition, TOUR_STEPS } from '../lib/workspace/tour.mjs'

const asStudent = (fn) => withRequestContext({ userId: `tour-${crypto.randomUUID()}` }, async () => {
  try { return await fn() } finally { await deleteAllDocuments() }
})

test('finishing or skipping setup offers the tour once; dismissal survives setup replay and conversation reset', async () => {
  await asStudent(async () => {
    assert.equal((await workspaceTour()).status, 'unoffered')
    await finishSetup({ allowEmpty: true })
    assert.equal((await workspaceTour()).status, 'pending')
    await saveWorkspaceTour('dismissed')
    await finishSetup({ allowEmpty: true })
    await resetConversation()
    assert.equal((await workspaceTour()).status, 'dismissed')
    await saveWorkspaceTour('completed')
    await offerWorkspaceTour()
    assert.equal((await workspaceTour()).status, 'completed')
    await assert.rejects(() => saveWorkspaceTour('anything-else'), /valid tour state/)
  })
})

test('tour dismissal belongs to the account, not the shared browser or another student', async () => {
  await asStudent(async () => {
    await saveWorkspaceTour('dismissed')
    await asStudent(async () => {
      assert.equal((await workspaceTour()).status, 'unoffered')
      await offerWorkspaceTour()
      assert.equal((await workspaceTour()).status, 'pending')
    })
    assert.equal((await workspaceTour()).status, 'dismissed')
  })
})

test('automatic dashboard handoff waits until every source is connected or deliberately skipped', () => {
  const state = { programme: true, electives: true, record: true, transcript: true, calendar: true, timetable: true, canvas: false }
  assert.equal(setupSettled(setupSteps({ state })), false)
  assert.equal(setupSettled(setupSteps({ state, skipped: ['canvas'] })), true)
  assert.equal(setupSettled(setupSteps({ state: { ...state, canvas: true } })), true)
  assert.equal(setupSettled(setupSteps({ state: { ...state, programme: false }, skipped: ['programme', 'canvas'] })), false)
  assert.equal(setupSettled([]), false)
})

test('coachmarks sit alongside desktop navigation and above mobile bottom navigation', () => {
  const panel = { width: 352, height: 320 }
  const desktop = tourPosition({ left: 8, top: 240, right: 240, bottom: 280, width: 232, height: 40 }, panel, { width: 1280, height: 800 })
  assert.equal(desktop.left, 256)
  const mobile = tourPosition({ left: 80, top: 745, right: 160, bottom: 800, width: 80, height: 55 }, panel, { width: 390, height: 844 })
  assert.ok(mobile.top + panel.height < 745)
  assert.ok(mobile.left + mobile.width <= 374)
  const fallback = tourPosition(null, panel, { width: 320, height: 480 })
  assert.equal(fallback.width, 288)
  assert.ok(fallback.top >= 16)
  assert.equal(TOUR_STEPS.length, 10)
  assert.equal(TOUR_STEPS[0].route, '/app')
  assert.equal(TOUR_STEPS.at(-1).route, '/app')
  assert.equal(new Set(TOUR_STEPS.map(step => step.route)).size, 9)
})
