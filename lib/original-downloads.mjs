import { accountQuotaExemption } from './ai-quota-policy.mjs'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { apiKeyIdentityById } from './api-keys.mjs'
import { authenticateKeyIdentity } from './auth.mjs'
import { canvasCorpusAsset } from './course-corpus.mjs'
import { originalByteRange, sendCorpusAsset } from './corpus-asset-response.mjs'
import { McpOAuthError } from './mcp-oauth.mjs'

export const ORIGINAL_DOWNLOAD_LIMITS = Object.freeze({ ticketTtlMs: 10 * 60000, fileBytes: 1024 ** 3, bytesPerDay: 4 * 1024 ** 3, requestsPerMinute: 60, ticketsPerMinute: 20, concurrent: 2 })
const hash = value => createHash('sha256').update(value).digest('hex')
const denied = () => new McpOAuthError('invalid_download', 'This download has expired or is no longer available. Request a new download through MCP.', 401)

async function activeIdentity(ticket, store) {
  let identity
  if (ticket.keyId.startsWith('oauth-')) {
    const grant = await store.get('grant', ticket.keyId.slice(6))
    if (!grant || grant.value.revoked || grant.value.userId !== ticket.userId || !grant.value.scopes.includes('read')) return null
    identity = { keyId: ticket.keyId, userId: ticket.userId, scopes: ['read'] }
  } else identity = await apiKeyIdentityById({ keyId: ticket.keyId, userId: ticket.userId })
  if (!identity?.scopes.includes('read')) return null
  const auth = await authenticateKeyIdentity(identity)
  return auth.authenticated ? auth : null
}

export async function prepareOriginalDownload({ assetId, auth, store, origin, lookupAsset = canvasCorpusAsset, quotaExemption = accountQuotaExemption }) {
  if (!auth?.authenticated || auth.mode !== 'api-key' || !auth.scopes?.includes('read') || !auth.keyId) throw new McpOAuthError('insufficient_scope', 'Use a read-scoped MCP or API connection to prepare a download.', 403)
  const asset = await lookupAsset({ accountId: auth.userId, assetId })
  if (!asset) throw new McpOAuthError('not_found', 'Original not found or not available to this account.', 404)
  if (!Number.isSafeInteger(asset.byteSize) || asset.byteSize < 0 || asset.byteSize > ORIGINAL_DOWNLOAD_LIMITS.fileBytes || !/^[a-f0-9]{64}$/i.test(asset.sha256)) throw new McpOAuthError('unsupported_original', 'This original cannot use MCP direct download. Use the original’s browser download instead.', 422)
  if (!await store.charge(`download-issue:${auth.userId}`, 1, ORIGINAL_DOWNLOAD_LIMITS.ticketsPerMinute, 60000)) throw new McpOAuthError('rate_limit_exceeded', 'Too many download preparations. Retry after one minute.', 429)
  const quotaExempt = Boolean(await quotaExemption({ owner: auth.userId }))
  const token = `wdl_${randomBytes(32).toString('base64url')}`, expiresAt = new Date(Date.now() + ORIGINAL_DOWNLOAD_LIMITS.ticketTtlMs).toISOString()
  await store.put('download', hash(token), { userId: auth.userId, keyId: auth.keyId, assetId: asset.id, sha256: asset.sha256, byteSize: asset.byteSize, expiresAt }, ORIGINAL_DOWNLOAD_LIMITS.ticketTtlMs)
  return { assetId: asset.id, filename: asset.filename, mediaType: asset.mediaType, byteSize: asset.byteSize, sha256: asset.sha256,
    url: `${origin}/api/mcp/original`, method: 'GET', headers: { Authorization: `Bearer ${token}`, 'If-Match': `"${asset.sha256}"` }, expiresAt, supportsRanges: true,
    instructions: 'Use your own HTTP/file tools to stream this URL with the supplied headers into a new temporary file. The header is a short-lived capability for this exact original, not your account token. Keep it out of chat, logs and shell history; never forward it to another host or follow redirects. Verify the complete byteSize and SHA-256 before renaming to a chosen safe local path. Treat filename as a display name, not a path. Resume with Range and the same If-Match; after expiry prepare a new ticket for the same asset/hash. Do not execute downloaded content.', limits: { ...ORIGINAL_DOWNLOAD_LIMITS, ...(quotaExempt ? { bytesPerDay: null } : {}) } }
}

export async function serveOriginalDownload(req, res, { store, lookupAsset = canvasCorpusAsset, validateIdentity = activeIdentity, sendAsset = sendCorpusAsset, quotaExemption = accountQuotaExemption }) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); throw new McpOAuthError('method_not_allowed', 'Downloads use GET or HEAD.', 405) }
  if (new URL(req.url, 'https://local.invalid').search) throw new McpOAuthError('invalid_request', 'Download credentials belong in the supplied header, not the URL.', 400)
  const token = /^Bearer (wdl_[A-Za-z0-9_-]{43})$/i.exec(req.headers.authorization || '')?.[1]
  const row = token && await store.get('download', hash(token))
  if (!row || !await validateIdentity(row.value, store)) throw denied()
  const ticket = row.value, ids = [`user:${ticket.userId}`, `key:${ticket.keyId}`]
  for (const id of ids) if (!await store.charge(`download-requests:${id}`, 1, ORIGINAL_DOWNLOAD_LIMITS.requestsPerMinute, 60000)) { res.setHeader('Retry-After', '60'); throw new McpOAuthError('rate_limit_exceeded', 'Too many download requests. Retry after one minute.', 429) }
  const asset = await lookupAsset({ accountId: ticket.userId, assetId: ticket.assetId })
  if (!asset) throw denied()
  if (asset.sha256 !== ticket.sha256 || asset.byteSize !== ticket.byteSize || (req.headers['if-match'] && req.headers['if-match'] !== `"${ticket.sha256}"`)) throw new McpOAuthError('original_changed', 'The original changed. Request new metadata and download it again.', 412)
  const raw = req.method === 'HEAD' ? '' : req.headers['if-range'] && req.headers['if-range'] !== `"${ticket.sha256}"` ? '' : String(req.headers.range || '')
  let range
  try { range = originalByteRange(ticket.byteSize, raw) }
  catch (error) { if (error.status !== 416) throw error; res.setHeader('Content-Range', `bytes */${ticket.byteSize}`); throw new McpOAuthError('invalid_range', error.message, 416) }
  if (req.method === 'HEAD') { await sendAsset(req, res, asset, { download: true, cacheControl: 'private, no-store' }); return }
  const nonce = randomUUID(); let lease
  for (let i = 0; i < ORIGINAL_DOWNLOAD_LIMITS.concurrent; i++) {
    const slot = `download:${ticket.userId}:${i}`
    if (await store.acquireLease(slot, nonce, ORIGINAL_DOWNLOAD_LIMITS.ticketTtlMs)) { lease = slot; break }
  }
  if (!lease) { res.setHeader('Retry-After', '5'); throw new McpOAuthError('rate_limit_exceeded', 'Two downloads are already running. Wait for one to finish.', 429) }
  const quotaExempt = Boolean(await quotaExemption({ owner: ticket.userId }))
  const reservations = []; let bytes = 0
  const write = res.write.bind(res), end = res.end.bind(res)
  const capture = (chunk, encoding) => { if (chunk && (!res.statusCode || res.statusCode < 400)) bytes += Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : undefined) }
  try {
    for (const id of ids) {
      const bucket = `download-bytes:${Math.floor(Date.now() / 86400000)}:${id}`
      if (!await store.charge(bucket, range.length, quotaExempt ? Number.MAX_SAFE_INTEGER : ORIGINAL_DOWNLOAD_LIMITS.bytesPerDay, 2 * 86400000)) {
        res.setHeader('Retry-After', String(Math.ceil((86400000 - Date.now() % 86400000) / 1000)))
        throw new McpOAuthError('download_budget_exceeded', 'The daily original-download byte budget is exhausted. Resume after it resets.', 429)
      }
      reservations.push(bucket)
    }
    res.write = (chunk, ...args) => { capture(chunk, args[0]); return write(chunk, ...args) }
    res.end = (chunk, ...args) => { capture(chunk, args[0]); return end(chunk, ...args) }
    // Bound a stalled transfer before its concurrency lease expires.
    const timeout = setTimeout(() => res.destroy(), ORIGINAL_DOWNLOAD_LIMITS.ticketTtlMs - 1000); timeout.unref()
    try { await sendAsset(req, res, asset, { download: true, cacheControl: 'private, no-store' }) }
    finally { clearTimeout(timeout) }
  } finally {
    res.write = write; res.end = end
    try { for (const bucket of reservations) await store.charge(bucket, -Math.max(0, range.length - bytes), Number.MAX_SAFE_INTEGER, 2 * 86400000) }
    finally { await store.releaseLease(lease, nonce) }
  }
}
