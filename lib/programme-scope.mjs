import { readAcademicState } from './academics.mjs'
// Keep this uncached: setup and account flows may switch the active workspace
// and immediately perform another operation in the same request context.
export async function activeProgrammeId() {
  const state = await readAcademicState()
  return state.index?.activeProgrammeId || state.workspace?.id || 'default'
}

export function scopedDocumentKey(programmeId, key) {
  return `programme:${programmeId}:${key}`
}
