// A whole-course pilot's execution mode gating. A course pilot must set
// STUDY_PIPELINE_MODE explicitly to 'local' or 'hosted' and supply explicit
// synthetic update source keys (never inferred from real course text).
// Hosted execution (through processStudyStep) is only supported for the
// pilot's INITIAL phase; the maintenance/update phase always requires local
// mode, so a hosted run either explicitly defers the update phase or is
// refused outright, rather than silently attempting maintenance under the
// wrong execution mode.
export function assertPilotExecutionMode(pilot, env) {
  if (!pilot) return
  if (!Array.isArray(pilot.updateSourceKeys)) throw new Error('Course pilots require explicit synthetic update source keys.')
  if (!['local', 'hosted'].includes(env.STUDY_PIPELINE_MODE)) throw new Error('Course pilots must run with STUDY_PIPELINE_MODE explicitly set to local or hosted.')
  if (env.STUDY_PIPELINE_MODE === 'hosted') {
    if (env.STUDY_PIPELINE_UPDATE_ONLY === '1') throw new Error('Course maintenance/update pilots require local mode; run the initial phase hosted, then the update phase separately with STUDY_PIPELINE_MODE=local.')
    if (pilot.updateSourceKeys.length && env.STUDY_PIPELINE_DEFER_UPDATE !== '1') throw new Error('Hosted course pilots run the initial phase only. Set STUDY_PIPELINE_DEFER_UPDATE=1 to run it hosted and run the maintenance/update phase separately with STUDY_PIPELINE_MODE=local.')
  }
}

// Resolve a resumable saved run for the current execution mode. A saved
// draft generated under the OTHER mode (for example, this course's saved
// draft was produced locally and this pass is STUDY_PIPELINE_MODE=hosted)
// is a genuine mode mismatch: it is never resumed silently. The caller must
// opt in explicitly to convert the draft's execution for the pilot's
// isolated account; the conversion is then reported back so it stays
// visible in the run record, instead of being refused with a clear message
// naming both modes.
export function resolveSavedPilotRun(previous, execution, allowConvert) {
  const savedRun = previous.runs.findLast(r => r.execution === execution && r.draft) || previous.runs.findLast(r => r.draft)
  if (!savedRun) return { savedRun: null, executionConverted: null }
  if (savedRun.execution === execution) return { savedRun, executionConverted: null }
  if (!allowConvert)
    throw new Error(
      `The saved draft for this course pilot was generated in '${savedRun.execution}' mode. Resume it with STUDY_PIPELINE_MODE=${savedRun.execution}, or set STUDY_PIPELINE_CONVERT_EXECUTION=1 to explicitly convert it to '${execution}' for this isolated pilot account.`
    )
  return { savedRun, executionConverted: { from: savedRun.execution, to: execution } }
}
