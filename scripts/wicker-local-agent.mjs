#!/usr/bin/env node
// A loopback-only bridge between the signed-in Wicker Study web interface and
// the administrator's local Canvas Keychain credential. Nothing here accepts a
// token over HTTP or uploads course material to Wicker Study.

import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { filterCanvasCourses, listCanvasCourseModules, listCanvasCourses, parseCanvasOrigin } from '../lib/canvas-course-import.mjs'
import { exportCanvasCourseZip } from '../lib/canvas-course-export.mjs'
import { getSavedCanvasAccessToken, saveCanvasAccessTokenFromClipboard } from '../lib/local-canvas-prompts.mjs'

const port = Number(process.env.WICKER_LOCAL_AGENT_PORT || 41917)
const host = '127.0.0.1'
const productionOrigin = 'https://study.wicker.life'
const zipDirectory = join(tmpdir(), 'wicker-study-local-agent-zips')
const jobs = new Map()

function allowedOrigin(value) {
  if (!value) return false
  if (value === productionOrigin) return true
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && ['localhost', '127.0.0.1'].includes(url.hostname)
  } catch {
    return false
  }
}

function respond(res, status, body, origin) {
  const payload = Buffer.from(JSON.stringify(body))
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(payload.length),
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {})
  })
  res.end(payload)
}

async function readJson(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new Error('Expected an application/json request.')
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > 64 * 1024) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }
  catch { throw new Error('Request body must be valid JSON.') }
}

function canvasUrl(value) {
  const origin = parseCanvasOrigin(value || 'https://canvas.maastrichtuniversity.nl').origin
  return origin
}

async function accessToken(origin) {
  return getSavedCanvasAccessToken(origin)
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    courseId: job.courseId,
    createdAt: job.createdAt,
    completedAt: job.completedAt || null,
    error: job.error || null,
    result: job.result ? { course: job.result.imported.course, modules: job.result.imported.modules, resources: job.result.imported.resources, bytes: job.result.bytes, fileName: job.result.fileName } : null,
    downloadUrl: job.status === 'ready' ? `/v1/exports/${encodeURIComponent(job.id)}/download` : null
  }
}

async function createExport(body) {
  const origin = canvasUrl(body.canvasUrl)
  const courseId = String(body.courseId || '')
  if (!/^\d+$/.test(courseId)) throw new Error('Choose a Canvas course before creating the ZIP.')
  if (body.moduleIds !== undefined && (!Array.isArray(body.moduleIds) || !body.moduleIds.length || body.moduleIds.some((id) => !String(id || '').trim()))) throw new Error('Choose at least one course module.')
  if ([...jobs.values()].some((job) => job.status === 'running')) throw new Error('A Canvas export is already running on this Mac. Wait for it to finish before starting another.')
  await mkdir(zipDirectory, { recursive: true })
  const id = randomUUID()
  const job = { id, status: 'running', courseId, createdAt: new Date().toISOString(), result: null, error: null }
  jobs.set(id, job)
  void (async () => {
    try {
      const result = await exportCanvasCourseZip({
        courseUrl: `${origin}/courses/${encodeURIComponent(courseId)}/modules`,
        accessToken: await accessToken(origin),
        moduleIds: body.moduleIds?.map(String),
        outputPath: join(zipDirectory, `${id}.zip`)
      })
      job.status = 'ready'
      job.completedAt = new Date().toISOString()
      job.result = result
      const cleanup = () => void rm(result.zipPath, { force: true }).catch(() => {}).finally(() => jobs.delete(id))
      setTimeout(cleanup, 60 * 60_000).unref()
    } catch (error) {
      job.status = 'failed'
      job.completedAt = new Date().toISOString()
      job.error = error instanceof Error ? error.message : String(error)
      setTimeout(() => jobs.delete(id), 15 * 60_000).unref()
    }
  })()
  return publicJob(job)
}

const server = createServer(async (req, res) => {
  const origin = String(req.headers.origin || '')
  const url = new URL(req.url || '/', `http://${host}:${port}`)
  if (req.method === 'OPTIONS') {
    if (!allowedOrigin(origin)) return respond(res, 403, { error: 'This local agent only accepts requests from Wicker Study.' })
    res.writeHead(204, { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600', vary: 'Origin' })
    res.end()
    return
  }
  if (origin && !allowedOrigin(origin)) return respond(res, 403, { error: 'This local agent only accepts requests from Wicker Study.' })
  try {
    if (req.method === 'GET' && url.pathname === '/v1/status') {
      const canvas = canvasUrl(url.searchParams.get('canvasUrl'))
      let tokenAvailable = false
      try { tokenAvailable = Boolean(await accessToken(canvas)) } catch {}
      return respond(res, 200, { ok: true, service: 'Wicker Local', canvasUrl: canvas, tokenAvailable }, origin)
    }
    if (req.method === 'POST' && url.pathname === '/v1/canvas/token/from-clipboard') {
      if (!allowedOrigin(origin)) return respond(res, 403, { error: 'A browser origin is required for this action.' })
      const body = await readJson(req)
      const canvas = canvasUrl(body.canvasUrl)
      const saved = await saveCanvasAccessTokenFromClipboard(canvas)
      return respond(res, 200, { saved: true, host: saved.host }, origin)
    }
    if (req.method === 'GET' && url.pathname === '/v1/canvas/courses') {
      const canvas = canvasUrl(url.searchParams.get('canvasUrl'))
      const catalog = await listCanvasCourses({ canvasUrl: canvas, accessToken: await accessToken(canvas) })
      const query = url.searchParams.get('query') || ''
      const courses = filterCanvasCourses(catalog.courses, query)
      return respond(res, 200, { ...catalog, total: catalog.courses.length, query: query || null, matched: courses.length, courses }, origin)
    }
    const moduleMatch = url.pathname.match(/^\/v1\/canvas\/courses\/(\d+)\/modules$/)
    if (req.method === 'GET' && moduleMatch) {
      const canvas = canvasUrl(url.searchParams.get('canvasUrl'))
      const courseUrl = `${canvas}/courses/${moduleMatch[1]}/modules`
      return respond(res, 200, await listCanvasCourseModules({ courseUrl, accessToken: await accessToken(canvas) }), origin)
    }
    if (req.method === 'POST' && url.pathname === '/v1/exports') {
      if (!allowedOrigin(origin)) return respond(res, 403, { error: 'A browser origin is required for this action.' })
      return respond(res, 202, await createExport(await readJson(req)), origin)
    }
    const jobMatch = url.pathname.match(/^\/v1\/exports\/([0-9a-f-]+)$/)
    if (req.method === 'GET' && jobMatch) {
      const job = jobs.get(jobMatch[1])
      return respond(res, job ? 200 : 404, job ? publicJob(job) : { error: 'Export not found or expired.' }, origin)
    }
    const downloadMatch = url.pathname.match(/^\/v1\/exports\/([0-9a-f-]+)\/download$/)
    if (req.method === 'GET' && downloadMatch) {
      const job = jobs.get(downloadMatch[1])
      if (!job || job.status !== 'ready' || !job.result) return respond(res, 404, { error: 'This export is not ready or has expired.' }, origin)
      res.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${String(job.result.fileName).replace(/[^a-zA-Z0-9._ -]/g, '-')}"`, ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}) })
      createReadStream(job.result.zipPath).on('error', () => { if (!res.headersSent) respond(res, 500, { error: 'The local ZIP could not be read.' }, origin); else res.destroy() }).pipe(res)
      return
    }
    return respond(res, 404, { error: 'Unknown Wicker Local endpoint.' }, origin)
  } catch (error) {
    return respond(res, 400, { error: error instanceof Error ? error.message : String(error) }, origin)
  }
})

server.listen(port, host, () => console.log(`Wicker Local is ready at http://${host}:${port}`))
