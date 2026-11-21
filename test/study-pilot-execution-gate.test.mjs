import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { assertPilotExecutionMode, resolveSavedPilotRun } from '../scripts/verification/study-pilot-execution-gate.mjs'

const pilotWithUpdates = { updateSourceKeys: ['update-1'] }
const pilotInitialOnly = { updateSourceKeys: [] }

test('a non-pilot run is never gated', () => {
  assert.doesNotThrow(() => assertPilotExecutionMode(null, {}))
})

test('a course pilot must declare synthetic update source keys and an explicit mode', () => {
  assert.throws(() => assertPilotExecutionMode({}, { STUDY_PIPELINE_MODE: 'local' }), /explicit synthetic update source keys/)
  assert.throws(() => assertPilotExecutionMode(pilotInitialOnly, {}), /explicitly set to local or hosted/)
  assert.throws(() => assertPilotExecutionMode(pilotInitialOnly, { STUDY_PIPELINE_MODE: 'both' }), /explicitly set to local or hosted/)
})

test('hosted mode is allowed for the initial phase of a pilot with no maintenance data', () => {
  assert.doesNotThrow(() => assertPilotExecutionMode(pilotInitialOnly, { STUDY_PIPELINE_MODE: 'hosted' }))
})

test('hosted mode still refuses maintenance/update runs', () => {
  assert.throws(
    () => assertPilotExecutionMode(pilotInitialOnly, { STUDY_PIPELINE_MODE: 'hosted', STUDY_PIPELINE_UPDATE_ONLY: '1' }),
    /maintenance\/update pilots require local mode/
  )
  // A pilot carrying real synthetic update source keys cannot run hosted
  // unless the update phase is explicitly deferred to a separate local run.
  assert.throws(
    () => assertPilotExecutionMode(pilotWithUpdates, { STUDY_PIPELINE_MODE: 'hosted' }),
    /run the initial phase only/
  )
  assert.doesNotThrow(() =>
    assertPilotExecutionMode(pilotWithUpdates, { STUDY_PIPELINE_MODE: 'hosted', STUDY_PIPELINE_DEFER_UPDATE: '1' })
  )
})

test('local mode is unaffected by the hosted-only maintenance restriction', () => {
  assert.doesNotThrow(() => assertPilotExecutionMode(pilotWithUpdates, { STUDY_PIPELINE_MODE: 'local' }))
  assert.doesNotThrow(() =>
    assertPilotExecutionMode(pilotWithUpdates, { STUDY_PIPELINE_MODE: 'local', STUDY_PIPELINE_UPDATE_ONLY: '1' })
  )
})

test('resuming a saved run in the same execution mode never converts anything', () => {
  const previous = { runs: [{ execution: 'local', draft: { id: 'd1' } }] }
  const { savedRun, executionConverted } = resolveSavedPilotRun(previous, 'local', false)
  assert.equal(savedRun.draft.id, 'd1')
  assert.equal(executionConverted, null)
})

test('resuming a saved draft under a different execution mode is refused without explicit conversion', () => {
  const previous = { runs: [{ execution: 'local', draft: { id: 'd1' } }] }
  assert.throws(() => resolveSavedPilotRun(previous, 'hosted', false), /generated in 'local' mode/)
  const { savedRun, executionConverted } = resolveSavedPilotRun(previous, 'hosted', true)
  assert.equal(savedRun.draft.id, 'd1')
  assert.deepEqual(executionConverted, { from: 'local', to: 'hosted' })
})

test('no saved run at all resolves to null without throwing', () => {
  const previous = { runs: [] }
  assert.deepEqual(resolveSavedPilotRun(previous, 'hosted', true), { savedRun: null, executionConverted: null })
})

test('the course suite forwards hosted mode only for the initial phase', async () => {
  const source = await readFile(new URL('../scripts/verification/study-course-suite.mjs', import.meta.url), 'utf8')
  const mode = /STUDY_PIPELINE_MODE:\(([^)]*)\)\?'hosted':'local'/.exec(source)
  assert.ok(mode, 'the suite must choose its child execution mode from the requested mode')
  assert.match(mode[1], /phase==='initial'/)
  assert.match(mode[1], /process\.env\.STUDY_PIPELINE_MODE==='hosted'/)
})
