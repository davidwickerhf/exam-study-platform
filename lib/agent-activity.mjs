import { randomUUID } from 'node:crypto'
import { sql } from './db.mjs'
import { currentUserId, withRequestContext } from './request-context.mjs'
import { writeDocument, listDocuments } from './user-store.mjs'
import { AGENT_MANIFEST } from './agent-manifest.mjs'

const namespace = 'agentActivity'
const cleanLabel = value => typeof value === 'string' && /^[a-zA-Z0-9_. -]{1,100}$/.test(value) ? value : ''
function routeFor(method, pathname) {
  return AGENT_MANIFEST.endpoints.find(endpoint => {
    if (endpoint.method !== method) return false
    const route = endpoint.path.split('?')[0].replace(/\[.*$/, '')
    const pattern = route.split('/').map(part => part.includes('{') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/')
    return new RegExp(`^${pattern}/?$`).test(pathname)
  })
}
export function agentActivityEntry(req, auth, url, now = Date.now()) {
  const method = req.method || 'GET', route = routeFor(method, url.pathname)
  return { id: `${String(now).padStart(13, '0')}-${randomUUID()}`, startedAt: new Date(now).toISOString(),
    keyId: auth.keyId || '', client: cleanLabel(req.headers['x-wicker-client']) || 'API client', tool: cleanLabel(req.headers['x-wicker-tool']),
    method, route: route?.path.split('?')[0] || '/api/(unlisted route)',
    operation: url.pathname === '/api/tutor/updates/prepare' ? 'prepare' : ['GET', 'HEAD', 'OPTIONS'].includes(method) || route?.scope === 'read' ? 'read' : 'write',
    clientConfirmed: req.headers['x-wicker-confirmed'] === 'true', status: 'running', statusCode: null, durationMs: null, confirmationId: null }
}

export async function beginAgentActivity(req, res, auth, url) {
  if (auth.mode !== 'api-key') return
  const entry = agentActivityEntry(req, auth, url)
  const persist = value => withRequestContext(auth, () => writeDocument(namespace, entry.id, value))
  await persist(entry)
  let ended = false
  const end = res.end.bind(res)
  // Finish the durable event before ending the serverless response. A killed
  // process leaves a visible started record, never a fabricated success.
  res.end = (...args) => {
    if (ended) return res
    ended = true
    const statusCode = res.statusCode
    // Account erasure must not recreate the account's audit data afterwards.
    const erased = res.agentActivityErased === true
    const complete = { ...entry, statusCode, status: statusCode >= 400 ? 'failed' : 'completed', durationMs: Date.now() - Date.parse(entry.startedAt),
      confirmationId: cleanLabel(res.agentActivityConfirmation) || null }
    Promise.resolve(erased ? undefined : persist(complete)).catch(() => console.error('Agent activity completion could not be stored.')).finally(() => end(...args))
    return res
  }
  res.once('close', () => {
    if (!ended) { ended = true; void persist({ ...entry, status: 'interrupted', durationMs: Date.now() - Date.parse(entry.startedAt) }).catch(() => {}) }
  })
}

export async function readAgentActivity({ before = '', operation = '', status = '', limit = 40 } = {}) {
  const count = Math.min(100, Math.max(1, Number(limit) || 40))
  const cursor = /^\d{13}-[a-f0-9-]{36}$/.test(before) ? before : ''
  const kind = ['read','write','prepare'].includes(operation) ? operation : ''
  const state = ['completed','failed','running','interrupted'].includes(status) ? status : ''
  let items
  if (sql) {
    const rows = await sql`SELECT value FROM user_documents WHERE user_id=${currentUserId()} AND namespace=${namespace}
      AND (${cursor}='' OR document_key < ${cursor}) AND (${kind}='' OR value->>'operation'=${kind})
      AND (${state}='' OR value->>'status'=${state}) ORDER BY document_key DESC LIMIT ${count + 1}`
    items = rows.map(row => row.value)
  } else items = (await listDocuments(namespace)).map(row => row.value).filter(row => (!cursor || row.id < cursor) && (!kind || row.operation === kind) && (!state || row.status === state)).sort((a,b) => b.id.localeCompare(a.id)).slice(0,count + 1)
  return { items: items.slice(0,count), nextCursor: items.length > count ? items[count - 1].id : null }
}

export async function exportAgentActivity() { return (await listDocuments(namespace)).map(row => row.value) }
