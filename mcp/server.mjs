#!/usr/bin/env node
// Wicker Study MCP server — a thin stdio wrapper over the HTTP API so agents
// (Claude Desktop, Claude Code, Codex, Cursor, …) can read course material and
// a student's record, record study activity, collect a private Canvas course
// snapshot, and — with an admin key — maintain editorial content.
//
//   npx wicker-study-mcp                      uses the saved key, or asks for one
//   WICKER_STUDY_URL=http://localhost:4177 npx wicker-study-mcp
//   WICKER_STUDY_API_KEY=wsk_… npx wicker-study-mcp
//
// It runs from anywhere: nothing here needs the application checkout. When no
// key is available the server still starts, so the agent can call
// `wicker_authorize` and walk the user through a browser approval rather than
// failing at launch with an environment variable the user has never heard of.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, realpath } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import { CANVAS_IMPORT_LIMITS, canvasCourseFolderName, filterCanvasCourses, importCanvasCourse, listCanvasCourseModules, listCanvasCourses, parseCanvasCourseUrl } from './vendor/canvas-course-import.mjs'
import { exportCanvasCourseZip } from './vendor/canvas-course-export.mjs'
import { getSavedCanvasAccessToken, promptForLocalCanvasImport, saveCanvasAccessTokenFromClipboard } from './vendor/local-canvas-prompts.mjs'
import { beginAuthorization } from './authorize.mjs'
import { configPath, forgetApiKey, listSavedServers, normaliseServerUrl, resolveApiKey, saveApiKey } from './config.mjs'

const baseUrl = normaliseServerUrl(process.env.WICKER_STUDY_URL || 'https://study.wicker.life')
const DEFAULT_CANVAS_URL = process.env.WICKER_CANVAS_URL || 'https://canvas.maastrichtuniversity.nl'

// Resolved once at startup and again after an authorization, so a key granted
// mid-session takes effect without restarting the agent.
let credential = await resolveApiKey(baseUrl)

const NEEDS_AUTHORIZATION = `Not connected to ${baseUrl}. Call wicker_authorize to get a key: it opens a Wicker Study page the user approves in their browser, and the key is delivered straight to this machine — never through the conversation. Set WICKER_STUDY_URL first if this is the wrong server.`

function requireKey() {
  if (!credential.apiKey) throw new Error(NEEDS_AUTHORIZATION)
  return credential.apiKey
}

async function apiResponse(path, { method = 'GET', body, query } = {}) {
  const url = new URL(baseUrl + path)
  for (const [key, value] of Object.entries(query || {})) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${requireKey()}`, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  if (!response.ok) {
    const text = await response.text()
    let data
    try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
    // A revoked or expired key is the same dead end as no key at all, so say
    // the same thing rather than leaving the agent to interpret a 401.
    if (response.status === 401) throw new Error(`${baseUrl} rejected this API key. It may have been revoked or expired. Call wicker_authorize to replace it.`)
    throw new Error(`${method} ${path} → ${response.status}: ${data?.error || text.slice(0, 300)}`)
  }
  return response
}

async function api(path, options = {}) {
  const response = await apiResponse(path, options)
  const text = await response.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  return data
}

const json = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] })
const failed = (error) => ({ isError: true, content: [{ type: 'text', text: error.message }] })
const run = (fn) => async (args) => { try { return json(await fn(args)) } catch (error) { return failed(error) } }

const server = new McpServer({ name: 'wicker-study', version: '2.6.0' })
const courseId = z.string().describe('Course id (e.g. "sec"). Use list_courses to discover ids.')
const chapterId = z.string().describe('Chapter id (e.g. "02").')

const COURSE_SOURCE_EXTENSIONS = new Set(['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.txt', '.md', '.csv', '.tex', '.m', '.py', '.r', '.html', '.htm', '.png', '.jpg', '.jpeg', '.webp'])
const SOURCE_MIME = { '.pdf': 'application/pdf', '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.tex': 'text/x-tex', '.m': 'text/x-matlab', '.py': 'text/x-python', '.r': 'text/x-r', '.html': 'text/html', '.htm': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
const EDITORIAL_CHUNK_BYTES = 512 * 1024
const MAX_EDITORIAL_FILE_BYTES = 100 * 1024 * 1024

async function inventoryCourseFolder(folderPath) {
  const root = await realpath(resolve(folderPath))
  const rootStat = await lstat(root)
  if (!rootStat.isDirectory()) throw new Error('folderPath must point to a directory.')
  const files = []
  const ignored = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const path = resolve(directory, entry.name)
      if (!path.startsWith(`${root}${sep}`)) throw new Error('A folder entry resolved outside the selected course directory.')
      if (entry.isSymbolicLink()) { ignored.push({ path: relative(root, path), reason: 'symbolic link' }); continue }
      if (entry.isDirectory()) { await visit(path); continue }
      if (!entry.isFile()) continue
      const extension = extname(entry.name).toLowerCase()
      const sourcePath = relative(root, path).split(sep).join('/')
      if (!COURSE_SOURCE_EXTENSIONS.has(extension)) { ignored.push({ path: sourcePath, reason: 'unsupported type' }); continue }
      const details = await lstat(path)
      if (!details.size || details.size > MAX_EDITORIAL_FILE_BYTES) { ignored.push({ path: sourcePath, reason: details.size ? 'over 100 MB' : 'empty file' }); continue }
      const bytes = await readFile(path)
      files.push({ path, relativePath: sourcePath, name: entry.name, type: SOURCE_MIME[extension] || 'application/octet-stream', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
      if (files.length > 250) throw new Error('A course-folder sync is limited to 250 supported files.')
    }
  }
  await visit(root)
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, undefined, { numeric: true }))
  return { root, files, ignored }
}

function publicInventory(inventory) {
  return { root: inventory.root, files: inventory.files.map(({ path: _path, ...file }) => file), ignored: inventory.ignored, totals: { files: inventory.files.length, bytes: inventory.files.reduce((sum, file) => sum + file.size, 0) } }
}

async function syncCourseFolder(args) {
  const inventory = await inventoryCourseFolder(args.folderPath)
  let edition = null
  let editionWorkspace = null
  if (args.editionId) {
    editionWorkspace = await api(`/api/admin/editorial-editions/${encodeURIComponent(args.editionId)}`)
    edition = editionWorkspace.editions?.[0]
    if (!edition) throw new Error(`Unknown course edition: ${args.editionId}`)
  }
  if (!edition && (!args.courseName || !args.courseCode)) throw new Error('courseCode and courseName are required when creating a new edition.')
  const workspace = await api('/api/admin/editorial-workspace')
  const matching = edition || workspace.editions?.find((candidate) => candidate.courseCode === String(args.courseCode || '').toUpperCase() && candidate.academicYear === String(args.academicYear || '') && candidate.period === String(args.period || '')) || null
  if (matching && !editionWorkspace) editionWorkspace = await api(`/api/admin/editorial-editions/${encodeURIComponent(matching.id)}`)
  const currentSources = matching ? (editionWorkspace?.sources || []).filter((source) => source.contribution.editionId === matching.id && ['accepted', 'candidate'].includes(source.contribution.consentStatus)) : []
  const currentByPath = new Map(currentSources.map((source) => [source.contribution.sourcePath, source]))
  const localPaths = new Set(inventory.files.map((file) => file.relativePath))
  const plan = {
    edition: matching,
    add: inventory.files.filter((file) => !currentByPath.has(file.relativePath)).map((file) => file.relativePath),
    replace: inventory.files.filter((file) => currentByPath.has(file.relativePath) && currentByPath.get(file.relativePath).sha256 !== file.sha256).map((file) => file.relativePath),
    reuse: inventory.files.filter((file) => currentByPath.get(file.relativePath)?.sha256 === file.sha256).map((file) => file.relativePath),
    retire: currentSources.filter((source) => source.contribution.sourcePath && !localPaths.has(source.contribution.sourcePath)).map((source) => source.contribution.sourcePath),
    inventory: publicInventory(inventory)
  }
  if (args.dryRun !== false) return { dryRun: true, ...plan, consentStatus: args.consentStatus || 'accepted', rightsBasis: args.rightsBasis || 'admin-supplied', next: 'Run again with dryRun=false after reviewing add/replace/retire. Set replaceManifest=true only if this folder is the authoritative complete source set.' }
  if (!edition) {
    edition = await api('/api/admin/editorial-editions', { method: 'POST', body: { programmeId: args.programmeId, canonicalCourseId: args.canonicalCourseId, institution: args.institution, courseCode: args.courseCode, courseName: args.courseName, academicYear: args.academicYear, period: args.period } })
  }
  const registered = await api(`/api/admin/editorial-editions/${encodeURIComponent(edition.id)}/sources`, {
    method: 'POST',
    body: {
      rightsBasis: args.rightsBasis || 'admin-supplied',
      consentStatus: args.consentStatus || 'accepted',
      replaceManifest: args.replaceManifest === true,
      sources: inventory.files.map(({ path: _path, ...file }) => file)
    }
  })
  let uploaded = 0
  let reused = 0
  for (const source of registered.sources || []) {
    const file = inventory.files.find((candidate) => candidate.sha256 === source.sha256)
    if (!file) continue
    if (!source.uploadRequired) { reused++; continue }
    const bytes = await readFile(file.path)
    for (let offset = 0, chunkIndex = 0; offset < bytes.length; offset += EDITORIAL_CHUNK_BYTES, chunkIndex++) {
      const chunk = bytes.subarray(offset, Math.min(offset + EDITORIAL_CHUNK_BYTES, bytes.length))
      await api(`/api/admin/editorial-editions/${encodeURIComponent(edition.id)}/sources/${encodeURIComponent(source.id)}/chunks`, { method: 'POST', body: { chunkIndex, base64: chunk.toString('base64') } })
    }
    uploaded++
  }
  return { dryRun: false, edition, uploaded, reused, replaceManifest: args.replaceManifest === true, consentStatus: args.consentStatus || 'accepted', rightsBasis: args.rightsBasis || 'admin-supplied', plan }
}

function localEnvironmentName(value) {
  const name = String(value || '').trim()
  if (!name) return null
  if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(name)) throw new Error('accessTokenEnv must name a local environment variable, for example CANVAS_ACCESS_TOKEN.')
  return name
}

async function importCanvasCourseAndMaybeSync(args) {
  if (args.syncToWicker === true && args.rightsConfirmed !== true) throw new Error('Set rightsConfirmed=true only after confirming that you are authorised to submit these Canvas materials for editorial review.')
  const accessTokenEnv = localEnvironmentName(args.accessTokenEnv)
  const input = await promptForLocalCanvasImport({ courseUrl: args.courseUrl, outputFolder: args.outputFolder, accessToken: accessTokenEnv ? process.env[accessTokenEnv] : undefined })
  const imported = await importCanvasCourse({
    courseUrl: input.courseUrl,
    accessToken: input.accessToken,
    outputFolder: input.outputFolder,
    moduleIds: args.moduleIds,
    maxResources: args.maxResources,
    maxFileBytes: args.maxFileBytes
  })
  if (args.syncToWicker !== true) return {
    imported,
    next: 'Review the local source snapshot first. To submit it to the private editorial workspace, rerun with syncToWicker=true, rightsConfirmed=true, and dryRun=false. Sources will still arrive as review candidates; accepting them, extraction, generation, and publication remain separate decisions.'
  }
  const sync = await syncCourseFolder({
    ...args,
    folderPath: imported.root,
    courseCode: args.courseCode || imported.course.code || undefined,
    courseName: args.courseName || imported.course.name,
    rightsBasis: 'authorised-course-material',
    consentStatus: 'candidate',
    replaceManifest: false
  })
  return {
    imported,
    sync,
    next: sync.dryRun ? 'Inspect the proposed folder sync, then explicitly rerun with dryRun=false. Imported Canvas sources remain candidates for rights review.' : 'Open Course production, review and accept the candidate sources you are authorised to use, then extract and map the course. Nothing has been published.'
  }
}

async function localCanvasAccessToken(canvasUrl, accessTokenEnv) {
  const environmentName = localEnvironmentName(accessTokenEnv)
  if (environmentName) {
    const token = String(process.env[environmentName] || '').trim()
    if (!token) throw new Error(`${environmentName} is not set in this local MCP process.`)
    return token
  }
  return getSavedCanvasAccessToken(canvasUrl)
}

async function listLocalCanvasCourses({ canvasUrl, accessTokenEnv, query }) {
  const result = await listCanvasCourses({ canvasUrl, accessToken: await localCanvasAccessToken(canvasUrl, accessTokenEnv) })
  const courses = filterCanvasCourses(result.courses, query)
  return { ...result, total: result.courses.length, query: query || null, matched: courses.length, courses }
}

async function importLocalCanvasCourseSet(args) {
  const catalog = await listLocalCanvasCourses(args)
  if (!catalog.courses.length) throw new Error(`No Canvas courses matched ${JSON.stringify(args.query || '')}. Use admin_list_canvas_courses first to inspect the available names, terms, and course codes.`)
  const maximum = Math.min(args.maxCourses, catalog.courses.length)
  const selected = catalog.courses.slice(0, maximum)
  const root = resolve(args.outputFolder)
  await mkdir(root, { recursive: true })
  const accessToken = await localCanvasAccessToken(args.canvasUrl, args.accessTokenEnv)
  const imports = []
  for (const course of selected) {
    const outputFolder = join(root, canvasCourseFolderName(course))
    const imported = await importCanvasCourse({ courseUrl: course.courseUrl, accessToken, outputFolder, maxResources: args.maxResources, maxFileBytes: args.maxFileBytes })
    imports.push({ course, imported })
  }
  return { root, query: args.query || null, matched: catalog.matched, imported: imports.length, omittedByMaxCourses: catalog.matched - imports.length, imports }
}

async function exportLocalCanvasCourseZip(args) {
  const accessToken = await localCanvasAccessToken(args.courseUrl, args.accessTokenEnv)
  return exportCanvasCourseZip({ courseUrl: args.courseUrl, accessToken, moduleIds: args.moduleIds, outputPath: args.zipPath, maxResources: args.maxResources, maxFileBytes: args.maxFileBytes })
}

// A remote Canvas connection is deliberately proxied through the Wicker API.
// The local MCP receives course bytes, not the user’s Canvas PAT, so Codex or
// Claude can analyse the snapshot in its own workspace without seeing or
// retaining that third-party credential.
function remoteCanvasFetch(courseUrl) {
  const canvas = parseCanvasCourseUrl(courseUrl)
  const platformOrigin = new URL(baseUrl).origin
  return async (input) => {
    const target = new URL(String(input))
    if (target.origin === canvas.origin && target.pathname.startsWith('/api/v1/')) {
      const response = await apiResponse('/api/integrations/canvas/proxy', {
        query: { canvasUrl: canvas.origin, path: `${target.pathname}${target.search}` }
      })
      // The server intentionally replaces Canvas file URLs with a relative,
      // authenticated Wicker proxy path. The local importer needs an absolute
      // URL to stream those bytes, but still never receives the Canvas PAT.
      if (!/^\/api\/v1\/courses\/\d+\/files(?:\/\d+)?$/.test(target.pathname)) return response
      const payload = await response.json()
      const absoluteFileUrl = (file) => file && typeof file === 'object' && typeof file.url === 'string' && file.url.startsWith('/api/integrations/canvas/')
        ? { ...file, url: new URL(file.url, platformOrigin).toString() }
        : file
      const rewritten = Array.isArray(payload) ? payload.map(absoluteFileUrl) : absoluteFileUrl(payload)
      return new Response(JSON.stringify(rewritten), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          ...(response.headers.get('link') ? { link: response.headers.get('link') } : {})
        }
      })
    }
    if (target.origin === platformOrigin && /^\/api\/integrations\/canvas\/courses\/\d+\/files\/\d+\/download$/.test(target.pathname)) {
      return apiResponse(`${target.pathname}${target.search}`)
    }
    throw new Error('The remote Canvas importer refused an unexpected download URL.')
  }
}

async function listRemoteCanvasCourses({ canvasUrl, query }) {
  const catalog = await api('/api/integrations/canvas/courses', { query: { canvasUrl } })
  const courses = filterCanvasCourses(catalog.courses || [], query)
  return { ...catalog, total: (catalog.courses || []).length, query: query || null, matched: courses.length, courses }
}

async function listRemoteCanvasCourseModules({ courseUrl }) {
  const canvas = parseCanvasCourseUrl(courseUrl)
  return api(`/api/integrations/canvas/courses/${encodeURIComponent(canvas.courseId)}/modules`, { query: { canvasUrl: canvas.origin } })
}

async function importRemoteCanvasCourse(args) {
  const imported = await importCanvasCourse({
    courseUrl: args.courseUrl,
    // This satisfies the local importer’s no-empty-token guard. The fetch
    // adapter above discards it; only Wicker’s server holds the real PAT.
    accessToken: 'stored-remotely-by-wicker',
    outputFolder: args.outputFolder,
    moduleIds: args.moduleIds,
    maxResources: args.maxResources,
    maxFileBytes: args.maxFileBytes,
    fetchImpl: remoteCanvasFetch(args.courseUrl)
  })
  return {
    imported,
    next: 'Analyse this private local snapshot with your Claude/Codex subscription. If you are authorised to propose shared material, use the separate rights-reviewed editorial sync; importing from Canvas never publishes anything automatically.'
  }
}

async function importRemoteCanvasCourseSet(args) {
  const catalog = await listRemoteCanvasCourses(args)
  if (!catalog.courses.length) throw new Error(`No remote Canvas courses matched ${JSON.stringify(args.query || '')}. Use canvas_list_remote_courses first to inspect the available titles and terms.`)
  const root = resolve(args.outputFolder)
  await mkdir(root, { recursive: true })
  const selected = catalog.courses.slice(0, Math.min(args.maxCourses, catalog.courses.length))
  const imports = []
  for (const course of selected) {
    imports.push({ course, ...(await importRemoteCanvasCourse({
      courseUrl: course.courseUrl,
      outputFolder: join(root, canvasCourseFolderName(course)),
      maxResources: args.maxResources,
      maxFileBytes: args.maxFileBytes
    })) })
  }
  return { root, query: args.query || null, matched: catalog.matched, imported: imports.length, omittedByMaxCourses: catalog.matched - imports.length, imports }
}

// ── Read ─────────────────────────────────────────────────────────────────
// ── Connecting ────────────────────────────────────────────────────────────
// These four are the only tools that work without a key, because they are how
// a key is obtained. Everything else answers with NEEDS_AUTHORIZATION until
// one exists.

let pendingAuthorization = null

server.tool('wicker_status',
  'Whether this agent is connected to Wicker Study, which account it acts as, and whether that account has Canvas connected. Call this first in a new session — it is the cheapest way to find out what still needs setting up. Never returns an API key or a Canvas token.',
  {},
  run(async () => {
    const status = {
      server: baseUrl,
      connected: Boolean(credential.apiKey),
      keySource: credential.source,
      configFile: configPath(),
      otherSavedServers: (await listSavedServers()).map((entry) => entry.server).filter((server) => server !== baseUrl)
    }
    if (pendingAuthorization) status.pendingAuthorization = { url: pendingAuthorization.url, startedAt: pendingAuthorization.startedAt, note: 'Waiting for the user to approve in their browser.' }
    if (!status.connected) return { ...status, next: NEEDS_AUTHORIZATION }
    try {
      const me = await api('/api/me')
      status.account = { userId: me.userId, email: me.email ?? null, scopes: me.scopes, admin: Boolean(me.admin) }
    } catch (error) {
      return { ...status, connected: false, problem: error.message }
    }
    try {
      const canvas = await api('/api/account/integrations/canvas')
      const connections = canvas.connections || []
      status.canvas = connections.length
        ? { connected: true, origins: connections.map((connection) => connection.origin) }
        : { connected: false, next: 'Call canvas_connect for the page the student uses to add their Canvas Personal Access Token. Canvas material is unavailable until then.' }
    } catch (error) {
      status.canvas = { connected: false, problem: error.message }
    }
    return status
  }))

server.tool('wicker_authorize',
  'Get an API key for this machine. Returns a Wicker Study URL: show it to the user and ask them to open it and approve. The key is delivered straight back to this computer over loopback and saved globally, so it never appears in the conversation and every later session on this machine reuses it. Poll wicker_status to see when it has landed. Requires a browser on this machine.',
  {
    scopes: z.array(z.enum(['read', 'write', 'admin'])).optional().describe('Default ["read","write"]. Ask for "admin" only when the user maintains course content; only administrators can approve it.'),
    name: z.string().max(80).optional().describe('How this agent should appear in the approval screen and the key list, e.g. "Claude Code on David’s MacBook".')
  },
  run(async ({ scopes, name }) => {
    if (credential.apiKey) {
      return {
        alreadyConnected: true,
        server: baseUrl,
        keySource: credential.source,
        note: 'A key is already available. Call wicker_sign_out first if you need to replace it.'
      }
    }
    if (pendingAuthorization) return { ...pendingAuthorization, note: 'An authorization is already waiting. Show this URL again, or call wicker_sign_out to abandon it.' }

    const flow = beginAuthorization(baseUrl, { name: name || 'Agent (MCP)', scopes: scopes?.length ? scopes : ['read', 'write'] })
    const { url } = await flow.ready
    pendingAuthorization = { url, startedAt: new Date().toISOString() }
    flow.completed
      .then(async () => { credential = await resolveApiKey(baseUrl) })
      .catch(() => {})
      .finally(() => { pendingAuthorization = null })

    return {
      url,
      server: baseUrl,
      expiresInMinutes: 5,
      instructions: [
        `Ask the user to open ${url} and approve.`,
        'They must be signed in to Wicker Study; the page will offer sign-in if not.',
        'Then call wicker_status. Once it reports connected, every other tool works.',
        'Do not ask the user to paste a key into the chat — this flow exists so that is never necessary.'
      ]
    }
  }))

server.tool('wicker_sign_out',
  'Forget the API key saved on this machine for this server, and abandon any authorization waiting for approval. The key itself stays valid until revoked under Account → API access in the web app.',
  {},
  run(async () => {
    pendingAuthorization = null
    const removed = await forgetApiKey(baseUrl)
    credential = await resolveApiKey(baseUrl)
    return {
      server: baseUrl,
      removed,
      stillConnected: Boolean(credential.apiKey),
      note: credential.apiKey
        ? 'WICKER_STUDY_API_KEY is set in this process’s environment and still applies; unset it to disconnect fully.'
        : `Revoke the key itself at ${baseUrl}/app/account?tab=api if it should stop working everywhere.`
    }
  }))

server.tool('canvas_connect',
  'Check whether the connected Wicker Study account has a Canvas connection, and if not, return the page where the student adds one. Call this before any canvas_* tool. The Canvas Personal Access Token is entered in the browser and encrypted for the account — it is never given to an agent, and must never be requested in chat.',
  { canvasUrl: z.string().optional().describe(`Canvas origin. Default ${DEFAULT_CANVAS_URL}.`) },
  run(async ({ canvasUrl }) => {
    const origin = new URL(canvasUrl || DEFAULT_CANVAS_URL).origin
    const settings = `${baseUrl}/app/account?tab=connections`
    const connections = (await api('/api/account/integrations/canvas')).connections || []
    const match = connections.find((connection) => connection.origin === origin) || null
    if (match) {
      return {
        connected: true,
        origin: match.origin,
        connectedAt: match.createdAt,
        lastUsedAt: match.lastUsedAt,
        next: 'Use canvas_list_remote_courses to see what is available, then canvas_import_remote_course.'
      }
    }
    return {
      connected: false,
      origin,
      otherConnections: connections.map((connection) => connection.origin),
      authorizationUrl: settings,
      instructions: [
        `Ask the user to open ${settings}.`,
        `They create a Personal Access Token in Canvas (${origin}/profile/settings), then paste it there — into Wicker Study, in their browser, not into this conversation.`,
        'Wicker Study encrypts it for their account. Agents receive proxied course data and never the token.',
        'Then call canvas_connect again to confirm.'
      ]
    }
  }))

server.tool('whoami', 'Who this key acts as, its scopes, programme memberships, and whether it is an administrator.', {}, run(() => api('/api/me')))
server.tool('join_programme', 'Join a maintained programme (organisation). Only programmes whose institution domains match the student’s email can be joined.', { programmeId: z.string() }, run(({ programmeId }) => api('/api/account/programme', { method: 'POST', body: { programmeId } })))
server.tool('list_courses', 'Courses with chapters and progress counts.', {}, run(() => api('/api/courses')))
server.tool('get_course', 'One course: chapters, mastery items with the student’s mastery, exam papers.', { courseId }, run(({ courseId }) => api(`/api/courses/${encodeURIComponent(courseId)}`)))
server.tool('get_chapter', 'Chapter markdown content. relPath opens a linked file or sub-page inside the chapter folder.', { courseId, chapterId, relPath: z.string().optional() },
  run(({ courseId, chapterId, relPath }) => api(`/api/chapter/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}${relPath ? '/' + relPath.split('/').map(encodeURIComponent).join('/') : ''}`)))
server.tool('get_course_outline', 'Heading outline of every chapter in a course.', { courseId }, run(({ courseId }) => api(`/api/course-toc/${encodeURIComponent(courseId)}`)))
server.tool('list_materials', 'Files in a course knowledge base (markdown, PDFs, images, code).', { courseId }, run(({ courseId }) => api('/api/materials', { query: { courseId } })))
server.tool('search_course', 'Hybrid full-text and embedding retrieval across published material and authorised Canvas snapshots. Results identify the exact academic-year edition and source path. Specify academicYear for a strict edition query; otherwise current and historical editions may be searched, with newer editions preferred.', {
  courseId: courseId.optional(),
  courseCode: z.string().optional().describe('Stable course code, for example BCS1540. Use this when querying Canvas editions.'),
  canonicalCourseId: z.string().optional().describe('Stable corpus course identity returned by an earlier search.'),
  academicYear: z.string().optional().describe('Exact edition such as 2025-2026.'),
  sourceType: z.enum(['syllabus', 'requirements', 'slides', 'pages', 'assessments', 'activities', 'readings', 'materials']).optional(),
  includeHistorical: z.boolean().optional().describe('Search older editions when no exact year is requested; defaults to true.'),
  query: z.string(),
  limit: z.number().int().min(1).max(20).optional()
}, run((args) => api('/api/retrieve', { method: 'POST', body: args })))
server.tool('canvas_corpus_status', 'Material collection consent, background sync jobs, versioned course editions, source counts, and last/next scrape times for the connected account.', {
  canvasUrl: z.string().url().optional()
}, run(({ canvasUrl }) => api('/api/account/integrations/canvas/corpus', { query: { canvasUrl: canvasUrl || DEFAULT_CANVAS_URL } })))
server.tool('canvas_corpus_sync', 'Queue a server-side refresh of authorised Canvas material. Collection must first be enabled by the user in the signed-in Wicker Study browser; an MCP key cannot grant or expand consent.', {
  canvasUrl: z.string().url().optional(),
  force: z.boolean().optional()
}, run(({ canvasUrl, force }) => api('/api/integrations/canvas/corpus/sync', { method: 'POST', body: { canvasUrl: canvasUrl || DEFAULT_CANVAS_URL, force } })))
server.tool('list_questions', 'Published questions for a chapter plus the student’s personal extra exercises.', { courseId, chapterId },
  run(({ courseId, chapterId }) => api(`/api/questions/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}`)))
server.tool('get_practice_queue', 'Every published question across active courses (optionally one course).', { courseId: courseId.optional(), limit: z.number().int().min(1).max(500).optional() },
  run(async ({ courseId, limit }) => { const data = await api('/api/practice'); const questions = (data.questions || []).filter((q) => !courseId || q.courseId === courseId); return { courses: data.courses, total: questions.length, questions: questions.slice(0, limit || 50) } }))
server.tool('get_progress', 'Mastery per course and item for the student.', {},
  run(async () => { const state = await api('/api/state'); return { doneThreshold: state.meta?.doneThreshold ?? 3, courses: state.courses.map((c) => ({ id: c.id, code: c.code, name: c.name, archived: Boolean(c.archived), items: (c.items || []).map((i) => ({ id: i.id, title: i.title, mastery: i.mastery ?? 0, updatedAt: i.masteryUpdatedAt || null })) })) } }))
server.tool('list_flashcards', 'Flashcards for a course by chapter, with spaced-repetition state.', { courseId }, run(({ courseId }) => api(`/api/flashcards/${encodeURIComponent(courseId)}`)))
server.tool('list_due_cards', 'Question-level spaced-repetition cards that are due now.', {}, run(() => api('/api/sr/due')))
server.tool('list_mistakes', 'Mistake bank.', { open: z.boolean().optional().describe('Only unresolved mistakes (default true).') }, run(({ open }) => api('/api/mistakes', { query: { open: open === false ? undefined : 'true' } })))
server.tool('list_mock_sessions', 'Completed mock sessions.', {}, run(() => api('/api/mocks')))
server.tool('get_mock_session', 'One mock session with every answer and correction.', { sessionId: z.string() }, run(({ sessionId }) => api(`/api/mocks/${encodeURIComponent(sessionId)}`)))
server.tool('get_academic_plan', 'Active academic programme: courses, attempts, exam dates, events, gates, summary.', {}, run(() => api('/api/academics')))
server.tool('list_known_programmes', 'The catalogue of known bachelor programmes.', {}, run(() => api('/api/editorial-programmes')))
server.tool('get_calendar', 'Unified calendar in one call: exam attempts, personal events, registration windows, the institution calendar, saved timetable feeds (lectures, tutorials, labs), and — when Canvas is connected — Canvas assignment deadlines and Canvas course events. This is the tool for "when is my next lecture", "where do I need to be", and "what is due this week". Events carry `category`, `courseCode`, and for Canvas items a `canvasStatus`; `problems` names any source that could not be read, which is how you tell an empty week from a missing timetable feed.', { from: z.string().optional().describe('ISO date; omit for everything'), to: z.string().optional() },
  run(async ({ from, to }) => { const data = await api('/api/calendar/events'); const events = data.events.filter((e) => (!from || String(e.start) >= from) && (!to || String(e.start) <= to)); return { ...data, events } }))
server.tool('get_activity', 'Study activity series, streak, weekly totals, recent events.', { days: z.number().int().min(7).max(120).optional() }, run(({ days }) => api('/api/activity', { query: { days } })))
server.tool('get_account_summary', 'What is stored for the account, per record family.', {}, run(() => api('/api/account/summary')))

// ── Write ────────────────────────────────────────────────────────────────
server.tool('submit_answer', 'Grade an answer to a published question (uses the student’s AI allowance) and record it.', { courseId, chapterId, questionId: z.string(), attempt: z.string() },
  run(async ({ courseId, chapterId, questionId, attempt }) => {
    const [course, bank] = await Promise.all([api(`/api/courses/${encodeURIComponent(courseId)}`), api(`/api/questions/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}`)])
    const question = (bank.questions || []).find((q) => q.id === questionId)
    if (!question) throw new Error(`Unknown question ${questionId} in ${courseId}/${chapterId}`)
    const chapter = (course.chapters || []).find((c) => c.id === chapterId)
    return api('/api/grade', { method: 'POST', body: { courseCode: course.code, chapterName: chapter?.name || chapterId, question, attempt, _meta: { courseId, chapterId } } })
  }))
server.tool('set_mastery', 'Set mastery (0–4) on a study item.', { itemId: z.string(), mastery: z.number().int().min(0).max(4), note: z.string().optional() },
  run(({ itemId, mastery, note }) => api(`/api/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: { mastery, note } })))
server.tool('review_card', 'Review a question-level spaced-repetition card (quality 0–5).', { questionId: z.string(), quality: z.number().int().min(0).max(5) },
  run(({ questionId, quality }) => api('/api/sr/review', { method: 'POST', body: { questionId, quality } })))
server.tool('add_to_deck', 'Add a question to the spaced-repetition deck.', { questionId: z.string() }, run(({ questionId }) => api('/api/sr/add', { method: 'POST', body: { questionId } })))
server.tool('create_flashcard', 'Create a personal flashcard in a chapter.', { courseId, chapterId, front: z.string(), back: z.string() },
  run(({ courseId, chapterId, front, back }) => api(`/api/flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}`, { method: 'POST', body: { front, back } })))
server.tool('review_flashcard', 'Review a flashcard (quality 0–5).', { courseId, chapterId, cardId: z.string(), quality: z.number().int().min(0).max(5) },
  run(({ courseId, chapterId, cardId, quality }) => api(`/api/flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(chapterId)}/${encodeURIComponent(cardId)}/review`, { method: 'POST', body: { quality } })))
server.tool('resolve_mistake', 'Mark a mistake as resolved.', { mistakeId: z.string() }, run(({ mistakeId }) => api(`/api/mistakes/${encodeURIComponent(mistakeId)}/resolve`, { method: 'POST', body: {} })))
server.tool('record_chapter_read', 'Record that the student read a chapter.', { courseId, chapterId, label: z.string().optional() },
  run(({ courseId, chapterId, label }) => api('/api/activity', { method: 'POST', body: { type: 'read', courseId, chapterId, label } })))
server.tool('save_academic_plan', 'Save the active academic programme workspace. Pass the revision you read to avoid overwriting concurrent edits.', { workspace: z.record(z.any()), expectedRevision: z.number().int() },
  run(({ workspace, expectedRevision }) => api('/api/academics', { method: 'PUT', body: { workspace, expectedRevision } })))
server.tool('set_course_visibility', 'Archive/unarchive or reorder a course for the student.', { courseId, archived: z.boolean().optional(), order: z.number().int().optional() },
  run(({ courseId, archived, order }) => api(`/api/courses/${encodeURIComponent(courseId)}`, { method: 'PATCH', body: { archived, order } })))

// ── Canvas through the account connection (no local PAT) ──────────────────
server.tool('get_study_briefing',
  'The student\u2019s whole situation in one call, ranked: work Canvas marks missing, overdue hand-ins, upcoming exams, what is due this week, the week\u2019s lectures and tutorials with rooms, recent announcements, and their credits so far. Call this first for "what should I focus on", "what is due", "what is my week like", or any question about priorities \u2014 it replaces orchestrating get_calendar, canvas_updates and get_academic_plan yourself. `notConnected` lists sources that could not be read: say a timetable is not connected rather than reporting a quiet week.',
  { days: z.number().int().min(1).max(31).optional().describe('How far ahead to look. Default 7.') },
  run(({ days }) => api('/api/briefing', { query: { days } })))

server.tool('canvas_updates',
  'What is happening in the student’s Canvas courses right now: announcements, assignments with their submission state, Canvas course events, and the grade Canvas shows. This is the tool for "what was announced", "what is due", "what have I not handed in", and "how am I doing". Answers are cached for ten minutes; pass refresh:true only when the student says something is missing. Never returns the Canvas token.',
  {
    scope: z.enum(['current', 'all']).optional().describe('"current" (default) is the courses being taught now, plus any the student starred on their Canvas dashboard and the standing faculty spaces. "all" includes concluded enrolments.'),
    days: z.number().int().min(1).max(365).optional().describe('How far back to read announcements. Default 60.'),
    courseIds: z.array(z.string()).optional().describe('Restrict to these Canvas course ids. Overrides scope.'),
    parts: z.array(z.enum(['announcements', 'assignments', 'events', 'grades'])).optional().describe('Fetch only what is needed. Omitting this fetches all four.'),
    refresh: z.boolean().optional()
  },
  run(({ scope, days, courseIds, parts, refresh }) => api('/api/integrations/canvas/hub', {
    query: {
      canvasUrl: DEFAULT_CANVAS_URL,
      scope,
      days,
      courseIds: courseIds?.join(','),
      parts: parts?.join(','),
      refresh: refresh ? '1' : undefined
    }
  })))

server.tool('canvas_course_requirements',
  'The course syllabus and whichever module item carries the rules — assessment components and weights, minimum grades, attendance, deadlines, resit conditions. Use this for "what do I need to pass", "is attendance mandatory", "how is this graded". Canvas’s own syllabus field is usually only a filename or an unfilled placeholder, so when `syllabus.substantive` is false the answer is in `requirementItems`: fetch that File or Page and read it before answering. Never state a rule you have not read in a source — say it is not published yet instead.',
  { courseUrl: z.string().describe('Canvas course URL, e.g. https://canvas.example.edu/courses/25806/modules. Use canvas_list_remote_courses to find it.') },
  run(async ({ courseUrl }) => {
    const result = await listRemoteCanvasCourseModules({ courseUrl })
    return {
      course: result.course,
      syllabus: result.syllabus,
      requirementItems: result.requirementItems,
      next: result.syllabus?.substantive
        ? 'The syllabus text below is the source. Cite it.'
        : result.requirementItems?.length
          ? 'Read these items before answering. canvas_import_remote_course with the containing module downloads them locally, where a File can be opened and a Page is saved as readable HTML.'
          : 'Neither a syllabus nor a requirements document is published for this course yet. Say so; do not infer rules from convention or from another course.',
      moduleCount: result.modules?.length ?? 0
    }
  }))

server.tool('canvas_list_remote_courses', 'List current and concluded Canvas courses from the caller’s encrypted Wicker Study Canvas connection. Search title, course code, term, or title initials (for example “IUI”). The Canvas PAT is never returned to the agent.', {
  canvasUrl: z.string().url().default('https://canvas.maastrichtuniversity.nl'), query: z.string().max(240).optional()
}, run(listRemoteCanvasCourses))
server.tool('canvas_list_remote_course_modules', 'List modules and their items for a Canvas course, plus its syllabus and any item that looks like the course manual. Use this before importing a chosen subset; for rules and assessment specifically, canvas_course_requirements returns the same data already narrowed down.', {
  courseUrl: z.string().url()
}, run(listRemoteCanvasCourseModules))
server.tool('canvas_import_remote_course', 'Download an entire Canvas course or selected modules into a private local folder through Wicker’s authenticated Canvas proxy. The destination is local to this MCP process, so Claude/Codex can analyse it using its own subscription; it never receives the Canvas PAT. Canvas pages are followed recursively within the course, linked files download when accessible, and URLs are compiled into link indexes.', {
  courseUrl: z.string().url(), outputFolder: z.string().min(1), moduleIds: z.array(z.string().min(1)).max(500).optional(), maxResources: z.number().int().min(1).max(CANVAS_IMPORT_LIMITS.maxResources).default(CANVAS_IMPORT_LIMITS.maxResources), maxFileBytes: z.number().int().min(1).max(CANVAS_IMPORT_LIMITS.maxFileBytes).default(CANVAS_IMPORT_LIMITS.maxFileBytes)
}, run(importRemoteCanvasCourse))
server.tool('canvas_import_remote_course_set', 'Find every remotely connected Canvas course matching a title, course code, term, or initials, then create separate local snapshots for each. Use for requests such as “import all IUI courses across the years”; preserve each Canvas course id and academic term as a separate source edition.', {
  canvasUrl: z.string().url().default('https://canvas.maastrichtuniversity.nl'), query: z.string().min(1).max(240), outputFolder: z.string().min(1), maxCourses: z.number().int().min(1).max(100).default(25), maxResources: z.number().int().min(1).max(CANVAS_IMPORT_LIMITS.maxResources).default(CANVAS_IMPORT_LIMITS.maxResources), maxFileBytes: z.number().int().min(1).max(CANVAS_IMPORT_LIMITS.maxFileBytes).default(CANVAS_IMPORT_LIMITS.maxFileBytes)
}, run(importRemoteCanvasCourseSet))

server.tool('analyze_documents', 'Analyse supporting documents (transcript, exam schedule, timetable, academic calendar, curriculum) with AI and return a reviewable change set against the student’s plan. Uses the student’s intake allowance. Follow with apply_changes.', { kind: z.enum(['auto', 'transcript', 'exam-schedule', 'timetable', 'academic-calendar', 'curriculum']).optional(), description: z.string().optional(), documents: z.array(z.object({ name: z.string(), type: z.string().optional(), text: z.string().optional(), images: z.array(z.string()).optional() })) },
  run((body) => api('/api/academics/documents/analyze', { method: 'POST', body })))
server.tool('apply_changes', 'Apply accepted change objects (from analyze_documents or a calendar preview) to the active plan.', { changes: z.array(z.record(z.any())), expectedRevision: z.number().int() },
  run((body) => api('/api/academics/documents/apply', { method: 'POST', body })))
server.tool('preview_calendar', 'Parse an iCalendar link or pasted .ics text into a change set without saving.', { url: z.string().optional(), ics: z.string().optional() }, run((body) => api('/api/academics/calendars/preview', { method: 'POST', body })))
server.tool('save_calendar_link', 'Save a timetable/exam-schedule calendar link to the plan and get its events as a change set.', { url: z.string(), label: z.string().optional() }, run((body) => api('/api/academics/calendars', { method: 'POST', body })))
server.tool('sync_calendar_link', 'Re-fetch a saved calendar link and get new events as a change set.', { id: z.string() }, run(({ id }) => api(`/api/academics/calendars/${encodeURIComponent(id)}/sync`, { method: 'POST', body: {} })))
server.tool('remove_calendar_link', 'Remove a saved calendar link.', { id: z.string() }, run(({ id }) => api(`/api/academics/calendars/${encodeURIComponent(id)}`, { method: 'DELETE' })))

// ── Admin (editorial content; requires an admin key) ─────────────────────
const adminCourse = (courseId) => `/api/admin/courses/${encodeURIComponent(courseId)}`
server.tool('admin_status', 'Active release and content counts.', {}, run(() => api('/api/admin/status')))
server.tool('admin_inventory_course_folder', 'Read a local course-material folder without changing Wicker Study. Returns supported files, SHA-256 hashes, ignored files, and byte totals.', { folderPath: z.string() }, run(({ folderPath }) => inventoryCourseFolder(folderPath).then(publicInventory)))
server.tool('admin_upsert_course_edition', 'Create or update a private, versioned course edition before sources or drafts are published.', { id: z.string().optional(), programmeId: z.string().optional(), canonicalCourseId: z.string().optional(), institution: z.string().optional(), courseCode: z.string(), courseName: z.string(), academicYear: z.string().optional(), period: z.string().optional(), editionKey: z.string().optional() }, run((body) => api('/api/admin/editorial-editions', { method: 'POST', body })))
server.tool('admin_register_course_urls', 'Register public web sources for an existing edition. They are fetched with SSRF protection during extraction.', { editionId: z.string(), urls: z.array(z.string().url()).min(1).max(30), rightsBasis: z.enum(['public-source', 'authorised-course-material', 'admin-supplied']).default('public-source') }, run(({ editionId, urls, rightsBasis }) => api(`/api/admin/editorial-editions/${encodeURIComponent(editionId)}/sources`, { method: 'POST', body: { rightsBasis, sources: urls.map((url, index) => ({ url, name: `linked-source-${index + 1}.html`, relativePath: url })) } })))
server.tool('admin_sync_course_folder', 'Create or update a versioned course edition from a local folder. Defaults to a dry run. Unchanged files are reused by hash; changed paths supersede older sources. Set replaceManifest only when the folder is the authoritative complete source set.', {
  folderPath: z.string(), editionId: z.string().optional(), programmeId: z.string().optional(), canonicalCourseId: z.string().optional(), institution: z.string().optional(), courseCode: z.string().optional(), courseName: z.string().optional(), academicYear: z.string().optional(), period: z.string().optional(), dryRun: z.boolean().default(true), replaceManifest: z.boolean().default(false), rightsBasis: z.enum(['authorised-course-material', 'admin-supplied']).default('admin-supplied'), consentStatus: z.enum(['accepted', 'candidate']).default('accepted')
}, run(syncCourseFolder))
server.tool('admin_save_canvas_token_from_clipboard', 'Store a Canvas Personal Access Token from this Mac’s clipboard in macOS Keychain for the Canvas host. Ask the administrator to copy the token in Canvas and confirm it is on the clipboard; never ask them to paste it into chat or a tool argument. The token value is never returned. Replaces the saved token for this host.', {
  courseUrl: z.string().url()
}, run(async ({ courseUrl }) => {
  const saved = await saveCanvasAccessTokenFromClipboard(courseUrl)
  return { saved: true, host: saved.host, next: 'Use admin_import_canvas_course with the course URL and an output folder. Future local MCP sessions on this Mac reuse this host-scoped Keychain token.' }
}))
server.tool('admin_list_canvas_courses', 'List every Canvas course available to this account, including concluded and prior-year enrolments. Query matches course name, code, term, and title initials (for example “IUI” matches Intelligent User Interfaces). Uses the host-scoped local Keychain token and returns no credential.', {
  canvasUrl: z.string().url().default('https://canvas.maastrichtuniversity.nl'), query: z.string().max(240).optional(), accessTokenEnv: z.string().optional()
}, run(listLocalCanvasCourses))
server.tool('admin_list_canvas_course_modules', 'List a Canvas course’s modules and contained item counts so the administrator can choose the whole course or a precise module subset. Uses the local Keychain token and returns no credential.', {
  courseUrl: z.string().url(), accessTokenEnv: z.string().optional()
}, run(async ({ courseUrl, accessTokenEnv }) => listCanvasCourseModules({ courseUrl, accessToken: await localCanvasAccessToken(courseUrl, accessTokenEnv) })))
server.tool('admin_import_canvas_course_set', 'Find every Canvas course matching a name, code, term, or title initials and import each into its own deterministic local folder. This is for requests such as “scrape all IUI courses across the years”. It is local-only and sequential; use admin_list_canvas_courses first when the requested match is ambiguous. Never pass Canvas credentials.', {
  canvasUrl: z.string().url().default('https://canvas.maastrichtuniversity.nl'), query: z.string().min(1).max(240), outputFolder: z.string().min(1), accessTokenEnv: z.string().optional(), maxCourses: z.number().int().min(1).max(100).default(25), maxResources: z.number().int().min(1).max(CANVAS_IMPORT_LIMITS.maxResources).default(CANVAS_IMPORT_LIMITS.maxResources), maxFileBytes: z.number().int().min(1).max(CANVAS_IMPORT_LIMITS.maxFileBytes).default(CANVAS_IMPORT_LIMITS.maxFileBytes)
}, run(importLocalCanvasCourseSet))
server.tool('admin_export_canvas_course_zip', 'Download a selected Canvas course or module subset into one local ZIP archive. Materials are only held in a temporary local staging folder, then removed after the ZIP succeeds. zipPath must be a new absolute local .zip path; existing files are never overwritten. Never pass Canvas credentials.', {
  courseUrl: z.string().url(), moduleIds: z.array(z.string().min(1)).max(500).optional(), zipPath: z.string().min(1), accessTokenEnv: z.string().optional(), maxResources: z.number().int().min(1).max(CANVAS_IMPORT_LIMITS.maxResources).default(CANVAS_IMPORT_LIMITS.maxResources), maxFileBytes: z.number().int().min(1).max(CANVAS_IMPORT_LIMITS.maxFileBytes).default(CANVAS_IMPORT_LIMITS.maxFileBytes)
}, run(exportLocalCanvasCourseZip))
server.tool('admin_import_canvas_course', 'Download every accessible Canvas module item, file, page, assignment, discussion, quiz, and external-link reference into a structured local course folder. Provide courseUrl and outputFolder; on the same Mac it reuses the host-scoped token in the user Keychain. Use admin_save_canvas_token_from_clipboard to provision or replace that local credential without exposing it to the agent. A denied course-wide Files index is recorded as skipped while accessible Module material continues. Large files stream directly to disk, with a 1 GB per-file limit. Never pass a Canvas password, OTP, cookie, or token here. The default only downloads locally. Optional Wicker sync is a separate rights-confirmed candidate review, never publication.', {
  courseUrl: z.string().url().optional(), outputFolder: z.string().optional(), moduleIds: z.array(z.string().min(1)).max(500).optional(), accessTokenEnv: z.string().optional(), maxResources: z.number().int().min(1).max(CANVAS_IMPORT_LIMITS.maxResources).default(CANVAS_IMPORT_LIMITS.maxResources), maxFileBytes: z.number().int().min(1).max(CANVAS_IMPORT_LIMITS.maxFileBytes).default(CANVAS_IMPORT_LIMITS.maxFileBytes), syncToWicker: z.boolean().default(false), rightsConfirmed: z.boolean().default(false), dryRun: z.boolean().default(true), editionId: z.string().optional(), programmeId: z.string().optional(), canonicalCourseId: z.string().optional(), institution: z.string().optional(), courseCode: z.string().optional(), courseName: z.string().optional(), academicYear: z.string().optional(), period: z.string().optional()
}, run(importCanvasCourseAndMaybeSync))
server.tool('admin_list_editorial_workspace', 'List compact course-edition summaries, or pass editionId for its sources, rights decisions, topics, jobs, artifacts, estimates, and releases.', { editionId: z.string().optional() }, run(({ editionId }) => api('/api/admin/editorial-workspace', { query: { editionId } })))
server.tool('admin_prepare_content_request', 'Turn a student request into a candidate shared edition. Fails if the student kept sources private.', { requestId: z.string() }, run(({ requestId }) => api(`/api/admin/content-requests/${encodeURIComponent(requestId)}/prepare`, { method: 'POST', body: {} })))
server.tool('admin_review_contribution', 'Accept, reject, or withdraw a source contribution after rights review.', { contributionId: z.string(), status: z.enum(['accepted', 'rejected', 'withdrawn']), reviewNote: z.string().optional() }, run(({ contributionId, ...body }) => api(`/api/admin/editorial-contributions/${encodeURIComponent(contributionId)}`, { method: 'PUT', body })))
server.tool('admin_estimate_course_generation', 'Estimate generation tokens and show cached/reusable artifact counts. This never starts generation.', { editionId: z.string() }, run(({ editionId }) => api(`/api/admin/editorial-editions/${encodeURIComponent(editionId)}/estimate`)))
server.tool('admin_queue_course_generation', 'Queue study pages, exercises, flashcards, and/or quality review. Requires an explicit confirmed=true after showing the token estimate.', { editionId: z.string(), types: z.array(z.enum(['study-pages', 'exercises', 'flashcards', 'quality'])).optional(), confirmed: z.literal(true) }, run(({ editionId, types }) => api(`/api/admin/editorial-editions/${encodeURIComponent(editionId)}/generate`, { method: 'POST', body: { types } })))
server.tool('admin_process_course_pipeline', 'Run pending extraction/mapping/generation jobs. useAi must be true for AI mapping or draft generation. untilIdle repeats bounded API calls; inspect failures and artifacts afterward.', { editionId: z.string(), types: z.array(z.enum(['extract', 'map', 'study-pages', 'exercises', 'flashcards', 'quality'])).optional(), useAi: z.boolean().default(false), limit: z.number().int().min(1).max(25).default(5), untilIdle: z.boolean().default(false), maxRuns: z.number().int().min(1).max(40).default(12) }, run(async ({ editionId, types, useAi, limit, untilIdle, maxRuns }) => {
  const runs = []
  for (let index = 0; index < (untilIdle ? maxRuns : 1); index++) {
    const result = await api(`/api/admin/editorial-editions/${encodeURIComponent(editionId)}/process`, { method: 'POST', body: { useAi, limit, types } })
    runs.push(result)
    if (!untilIdle || result.remaining === 0 || result.processed === 0) break
  }
  return { runs, remaining: runs.at(-1)?.remaining ?? null, processed: runs.reduce((sum, runResult) => sum + Number(runResult.processed || 0), 0) }
}))
server.tool('admin_review_course_artifact', 'Edit or approve/reject one generated course artifact. Keep review notes for editorial audit.', { artifactId: z.string(), status: z.enum(['draft', 'review', 'approved', 'rejected']).optional(), title: z.string().optional(), definition: z.record(z.any()).optional(), reviewNote: z.string().optional() }, run(({ artifactId, ...body }) => api(`/api/admin/editorial-artifacts/${encodeURIComponent(artifactId)}`, { method: 'PUT', body })))
server.tool('admin_publish_course_edition', 'Publish only approved, evidence-linked artifacts. confirmation must exactly match the edition course code; publication is not reversible through this tool.', { editionId: z.string(), confirmation: z.string() }, run(({ editionId, confirmation }) => api(`/api/admin/editorial-editions/${encodeURIComponent(editionId)}/publish`, { method: 'POST', body: { confirmation } })))
server.tool('admin_list_members', 'Members of a programme organisation with roles.', { programmeId: z.string() }, run(({ programmeId }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}/members`)))
server.tool('admin_set_member', 'Add a user to a programme or change their role (member | admin). Granting admin needs a global administrator.', { programmeId: z.string(), userId: z.string(), role: z.enum(['member', 'admin']).default('member') }, run(({ programmeId, userId, role }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}/members/${encodeURIComponent(userId)}`, { method: 'PUT', body: { role } })))
server.tool('admin_remove_member', 'Remove a user from a programme organisation.', { programmeId: z.string(), userId: z.string() }, run(({ programmeId, userId }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' })))
server.tool('admin_upsert_course', 'Create or update a course.', { courseId, code: z.string().optional(), name: z.string().optional(), shortName: z.string().optional(), exam: z.string().optional(), role: z.string().optional(), accent: z.string().optional(), knowledgeBase: z.string().optional(), visualStyle: z.string().optional(), examProfile: z.string().optional(), position: z.number().int().optional(), extra: z.record(z.any()).optional() },
  run(({ courseId, ...body }) => api(adminCourse(courseId), { method: 'PUT', body })))
server.tool('admin_delete_course', 'Delete a course and everything under it. Irreversible.', { courseId }, run(({ courseId }) => api(adminCourse(courseId), { method: 'DELETE' })))
server.tool('admin_upsert_chapter', 'Create or update a chapter. sourcePath is the markdown file inside the course knowledge base (create it with admin_put_material).', { courseId, chapterId, name: z.string().optional(), sourcePath: z.string().optional(), position: z.number().int().optional(), extra: z.record(z.any()).optional() },
  run(({ courseId, chapterId, ...body }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}`, { method: 'PUT', body })))
server.tool('admin_delete_chapter', 'Delete a chapter and its published questions.', { courseId, chapterId }, run(({ courseId, chapterId }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}`, { method: 'DELETE' })))
server.tool('admin_list_materials', 'Files in a course knowledge base with sizes and hashes.', { courseId }, run(({ courseId }) => api(`${adminCourse(courseId)}/materials`)))
server.tool('admin_put_material', 'Create or replace a file in a course knowledge base. Text goes in `content`; binary in `base64`. Text is re-indexed for the tutor.', { courseId, sourcePath: z.string(), content: z.string().optional(), base64: z.string().optional(), mediaType: z.string().optional() },
  run(({ courseId, sourcePath, ...body }) => api(`${adminCourse(courseId)}/materials`, { method: 'PUT', query: { path: sourcePath }, body })))
server.tool('admin_delete_material', 'Delete a file from a course knowledge base.', { courseId, sourcePath: z.string() }, run(({ courseId, sourcePath }) => api(`${adminCourse(courseId)}/materials`, { method: 'DELETE', query: { path: sourcePath } })))
server.tool('admin_extract_material', 'Re-extract text from a stored PDF and rebuild its retrieval index.', { courseId, sourcePath: z.string() }, run(({ courseId, sourcePath }) => api(`${adminCourse(courseId)}/materials/extract`, { method: 'POST', query: { path: sourcePath }, body: {} })))
server.tool('admin_list_flashcards', 'Editorial flashcards for a course or one chapter.', { courseId, chapterId: chapterId.optional() },
  run(({ courseId, chapterId }) => api(chapterId ? `${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/flashcards` : `${adminCourse(courseId)}/flashcards`)))
server.tool('admin_replace_flashcards', 'Replace a chapter’s editorial flashcards.', { courseId, chapterId, cards: z.array(z.object({ id: z.string().optional(), front: z.string(), back: z.string(), source: z.string().optional() })) },
  run(({ courseId, chapterId, cards }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/flashcards`, { method: 'PUT', body: { cards } })))
server.tool('admin_upsert_flashcard', 'Create or update one editorial flashcard.', { courseId, chapterId, id: z.string().optional(), front: z.string(), back: z.string(), source: z.string().optional() },
  run(({ courseId, chapterId, id, ...card }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/flashcards/${encodeURIComponent(id || 'new')}`, { method: 'PUT', body: { ...card, ...(id ? { id } : {}) } })))
server.tool('admin_delete_flashcard', 'Delete one editorial flashcard.', { courseId, cardId: z.string() }, run(({ courseId, cardId }) => api(`${adminCourse(courseId)}/flashcards/${encodeURIComponent(cardId)}`, { method: 'DELETE' })))
server.tool('admin_upsert_item', 'Create or update a mastery item (topic/skill) in a course.', { courseId, itemId: z.string(), definition: z.record(z.any()).describe('{ title, type?, category?, chapterId?, position?, … }') },
  run(({ courseId, itemId, definition }) => api(`${adminCourse(courseId)}/items/${encodeURIComponent(itemId)}`, { method: 'PUT', body: definition })))
server.tool('admin_delete_item', 'Delete a mastery item.', { courseId, itemId: z.string() }, run(({ courseId, itemId }) => api(`${adminCourse(courseId)}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })))
server.tool('admin_upsert_paper', 'Register a mock exam or tutorial paper (PDF paths inside the knowledge base).', { courseId, type: z.enum(['mock-exam', 'tutorial']), paperId: z.string(), label: z.string().optional(), questionPath: z.string().optional(), solutionsPath: z.string().optional(), position: z.number().int().optional() },
  run(({ courseId, type, paperId, ...body }) => api(`${adminCourse(courseId)}/papers/${type}/${encodeURIComponent(paperId)}`, { method: 'PUT', body })))
server.tool('admin_delete_paper', 'Remove a paper.', { courseId, type: z.enum(['mock-exam', 'tutorial']), paperId: z.string() }, run(({ courseId, type, paperId }) => api(`${adminCourse(courseId)}/papers/${type}/${encodeURIComponent(paperId)}`, { method: 'DELETE' })))
server.tool('admin_list_questions', 'Published question bank of a chapter (editorial only).', { courseId, chapterId }, run(({ courseId, chapterId }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/questions`)))
server.tool('admin_replace_questions', 'Replace a chapter’s whole question bank.', { courseId, chapterId, questions: z.array(z.record(z.any())) },
  run(({ courseId, chapterId, questions }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/questions`, { method: 'PUT', body: { questions } })))
server.tool('admin_upsert_question', 'Create or update one published question. Shape: { id, type, question, expected?, options?, answer?, difficulty?, source? }.', { courseId, chapterId, question: z.record(z.any()) },
  run(({ courseId, chapterId, question }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/questions/${encodeURIComponent(question.id || 'new')}`, { method: 'PUT', body: question })))
server.tool('admin_delete_question', 'Delete one published question.', { courseId, chapterId, questionId: z.string() }, run(({ courseId, chapterId, questionId }) => api(`${adminCourse(courseId)}/chapters/${encodeURIComponent(chapterId)}/questions/${encodeURIComponent(questionId)}`, { method: 'DELETE' })))
server.tool('admin_list_programmes', 'Programme catalogue as stored.', {}, run(() => api('/api/admin/programmes')))
server.tool('admin_upsert_programme', 'Create or update a known bachelor programme. Definition: { institution: { name, city?, country? }, name, degree, durationYears, totalEcts, language, versions: [{ id, label, status, courses: [{ id, code, name, ects, yearLevel, period, requirement }], choiceGroups?, pathways?, requirements? }] }.', { programmeId: z.string(), definition: z.record(z.any()) },
  run(({ programmeId, definition }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}`, { method: 'PUT', body: definition })))
server.tool('admin_set_programme_calendar', 'Set the institution-wide academic calendar for a known programme from events, an .ics text, a calendar URL, or documents (AI-analysed).', { programmeId: z.string(), events: z.array(z.record(z.any())).optional(), ics: z.string().optional(), url: z.string().optional(), documents: z.array(z.record(z.any())).optional(), replace: z.boolean().optional() },
  run(({ programmeId, ...body }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}/calendar`, { method: 'PUT', body })))
server.tool('admin_delete_programme', 'Remove a known programme from the catalogue.', { programmeId: z.string() }, run(({ programmeId }) => api(`/api/admin/programmes/${encodeURIComponent(programmeId)}`, { method: 'DELETE' })))

server.resource('manifest', 'wicker-study://manifest', { description: 'HTTP API manifest with every endpoint and scope' }, async () => ({ contents: [{ uri: 'wicker-study://manifest', mimeType: 'application/json', text: JSON.stringify(await api('/api/agent/manifest'), null, 2) }] }))

const transport = new StdioServerTransport()
await server.connect(transport)
