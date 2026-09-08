import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { canvasCorpusAssetChunks } from './course-corpus.mjs'
import { securityHeaders } from './security.mjs'

const CHUNK_BYTES = 512 * 1024
export function originalByteRange(size, raw = '') {
  if (!Number.isSafeInteger(size) || size < 0) throw Object.assign(new Error('Invalid original size.'), { status: 503 })
  if (!raw) return { start: 0, end: size - 1, length: size, partial: false }
  const match = /^bytes=(\d*)-(\d*)$/.exec(raw)
  const invalid = () => { throw Object.assign(new Error('Requested byte range is not satisfiable.'), { status: 416 }) }
  if (!match || (!match[1] && !match[2]) || !size) return invalid()
  const first = Number(match[1]), last = Number(match[2])
  if ((match[1] && !Number.isSafeInteger(first)) || (match[2] && !Number.isSafeInteger(last))) return invalid()
  const start = match[1] ? first : Math.max(0, size - last)
  const end = match[1] && match[2] ? Math.min(size - 1, last) : size - 1
  if (start < 0 || start >= size || end < start) return invalid()
  return { start, end, length: end - start + 1, partial: true }
}

export async function sendCorpusAsset(req, res, asset, { download = false, cacheControl = 'private, max-age=3600', readChunks = canvasCorpusAssetChunks, assetDirectory = process.env.CANVAS_CORPUS_ASSET_DIR || fileURLToPath(new URL('../data/corpus-assets', import.meta.url)) } = {}) {
  const etag = `"${asset.sha256}"`
  const base = { ...securityHeaders({ page: false }), 'Cache-Control': cacheControl, 'Referrer-Policy': 'no-referrer', 'Accept-Ranges': 'bytes', ETag: etag }
  if (req.headers['if-match'] && req.headers['if-match'] !== '*' && req.headers['if-match'] !== etag) { res.writeHead(412, base); res.end(); return }
  // If-Range mismatch requires a complete representation instead of mixing versions.
  const raw = req.method === 'HEAD' ? '' : req.headers['if-range'] && req.headers['if-range'] !== etag ? '' : String(req.headers.range || '')
  let range
  try { range = originalByteRange(Number(asset.byteSize), raw) }
  catch (error) { if (error.status !== 416) throw error; res.writeHead(416, { ...base, 'Content-Range': `bytes */${asset.byteSize}` }); res.end(); return }
  const filename = String(asset.filename || 'course-material').toWellFormed().replace(/[\r\n"\\/\x00-\x1f\x7f]/g, '_').slice(0, 240)
  const asciiName = filename.replace(/[^\x20-\x7e]/g, '_')
  const headers = { ...base, 'Content-Type': asset.mediaType || 'application/octet-stream', 'Content-Length': String(range.length), 'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}` }
  if (range.partial) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${asset.byteSize}`
  let source
  if (asset.localObjectKey) {
    const root = await realpath(resolve(assetDirectory))
    const path = await realpath(resolve(root, asset.localObjectKey))
    if (!path.startsWith(root + sep) || (await stat(path)).size !== Number(asset.byteSize)) throw Object.assign(new Error('The stored original is unavailable.'), { status: 503 })
    if (range.length && req.method !== 'HEAD') source = createReadStream(path, { start: range.start, end: range.end })
  } else if (range.length && req.method !== 'HEAD') {
    const firstChunk = Math.floor(range.start / CHUNK_BYTES), lastChunk = Math.floor(range.end / CHUNK_BYTES)
    async function batch(first) {
      const last = Math.min(lastChunk, first + 15)
      const rows = await readChunks({ assetId: asset.id, first, last })
      if (rows.length !== last - first + 1 || rows.some((row, index) => Number(row.chunk_index) !== first + index)) throw new Error('The stored original is incomplete.')
      const joined = Buffer.concat(rows.map(row => Buffer.from(row.data)))
      const from = Math.max(0, range.start - first * CHUNK_BYTES)
      const to = Math.min(Number(asset.byteSize), range.end + 1, (last + 1) * CHUNK_BYTES) - first * CHUNK_BYTES
      if (joined.length < to) throw new Error('The stored original is incomplete.')
      return joined.subarray(from, to)
    }
    // Check the first batch before sending successful headers. Stream later
    // batches with backpressure; pipeline cancels the source on disconnection.
    const initial = await batch(firstChunk)
    source = Readable.from((async function* () {
      yield initial
      for (let first = firstChunk + 16; first <= lastChunk; first += 16) yield await batch(first)
    })())
  }
  res.writeHead(range.partial ? 206 : 200, headers)
  if (!source) { res.end(); return }
  await pipeline(source, res)
}
