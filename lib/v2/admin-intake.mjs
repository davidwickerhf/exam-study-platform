export const REQUEST_STATUSES = Object.freeze([
  ['submitted', 'Submitted'],
  ['in-progress', 'In production'],
  ['review', 'Quality review'],
  ['published', 'Published'],
  ['declined', 'Closed']
])

const STATUS_IDS = new Set(REQUEST_STATUSES.map(([id]) => id))

export function intakeDraft(request) {
  return {
    status: STATUS_IDS.has(request?.status) ? request.status : 'submitted',
    pipelineStage: String(request?.pipelineStage || '').trim(),
    adminNote: String(request?.adminNote || '')
  }
}

export function intakePayload(draft, stages) {
  const allowedStages = new Set((stages ?? []).map((stage) => stage.id))
  const status = String(draft?.status || '')
  const pipelineStage = String(draft?.pipelineStage || '')
  if (!STATUS_IDS.has(status)) throw new Error('Choose a valid request status.')
  if (!allowedStages.has(pipelineStage)) throw new Error('Choose a valid workflow stage.')
  return { status, pipelineStage, adminNote: String(draft?.adminNote || '').trim().slice(0, 4000) }
}

export function canPrepareRequest(request) {
  return Boolean(request?.contributionConsent && !request?.editionId && !['published', 'declined'].includes(request?.status))
}

export function replaceRequest(requests, updated) {
  return (requests ?? []).map((request) => request.id === updated?.id ? updated : request)
}

export function intakeCounts(requests) {
  const list = requests ?? []
  return { total: list.length, open: list.filter((request) => !['published', 'declined'].includes(request.status)).length }
}
