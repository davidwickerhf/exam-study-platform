import { readDocument, writeDocument } from './user-store.mjs'

const NAMESPACE = 'onboarding'
const KEY = 'workspace-tour-v1'
const STATES = new Set(['pending', 'dismissed', 'completed'])

export async function workspaceTour() {
  return await readDocument(NAMESPACE, KEY, { status: 'unoffered' })
}

// Finishing setup again must never reopen a tour the student already closed.
export async function offerWorkspaceTour() {
  const held = await workspaceTour()
  return held.status === 'unoffered' ? saveWorkspaceTour('pending') : held
}

export async function saveWorkspaceTour(status) {
  if (!STATES.has(status)) throw new Error('Choose a valid tour state.')
  return writeDocument(NAMESPACE, KEY, { status, updatedAt: new Date().toISOString() })
}
