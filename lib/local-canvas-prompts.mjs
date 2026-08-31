import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, rename, unlink } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

export class LocalCanvasPromptError extends Error {}

const keychainService = 'life.wicker.study.canvas-access-token'
const execFileAsync = promisify(execFile)

function clean(value) {
  return String(value ?? '').replace(/\0/g, '').trim()
}

function missingInputError() {
  return new LocalCanvasPromptError('Interactive Canvas import needs a terminal. Supply --course-url and --output, then provide a short-lived token through --token-env CANVAS_ACCESS_TOKEN.')
}

function canvasHost(courseUrl) {
  try {
    const url = new URL(courseUrl)
    return url.protocol === 'https:' ? url.hostname.toLowerCase() : null
  } catch {
    return null
  }
}

function normalizedOutputFolder(value) {
  const folder = clean(value)
  if (!folder) return ''
  const expanded = folder === '~' ? homedir() : folder.startsWith('~/') ? join(homedir(), folder.slice(2)) : folder
  return isAbsolute(expanded) ? expanded : resolve(homedir(), expanded)
}

async function nativeKeychainBinary() {
  const scriptPath = fileURLToPath(new URL('../scripts/macos-keychain.swift', import.meta.url))
  const source = await readFile(scriptPath)
  const digest = createHash('sha256').update(source).digest('hex').slice(0, 16)
  const cacheDirectory = join(tmpdir(), 'wicker-study')
  const binaryPath = join(cacheDirectory, `keychain-${digest}`)
  try {
    await access(binaryPath)
    return binaryPath
  } catch {}
  await mkdir(cacheDirectory, { recursive: true })
  const temporaryPath = `${binaryPath}-${process.pid}-${Date.now()}`
  try {
    await execFileAsync('swiftc', [scriptPath, '-o', temporaryPath], { timeout: 120_000, maxBuffer: 1024 * 1024 })
    await rename(temporaryPath, binaryPath)
    return binaryPath
  } catch (error) {
    await unlink(temporaryPath).catch(() => {})
    throw error
  }
}

async function keychainRequest({ operation, courseUrl, value }) {
  const host = canvasHost(courseUrl)
  if (process.platform !== 'darwin' || !host) return { found: false, value: null }
  const binaryPath = await nativeKeychainBinary()
  const request = JSON.stringify({ operation, service: keychainService, account: host, ...(value ? { value } : {}) })
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    let output = ''
    let errorOutput = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { errorOutput += chunk })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code !== 0) return reject(new Error(errorOutput || `macOS Keychain helper exited with code ${code}`))
      try { resolve(JSON.parse(output)) }
      catch { reject(new Error('macOS Keychain helper returned an invalid response.')) }
    })
    child.stdin.end(request)
  })
}

async function savedCanvasAccessToken(courseUrl) {
  const host = canvasHost(courseUrl)
  if (process.platform !== 'darwin' || !host) return ''
  try {
    const response = await keychainRequest({ operation: 'get', courseUrl })
    return response.found ? clean(response.value) : ''
  } catch {
    return ''
  }
}

async function saveCanvasAccessToken(courseUrl, accessToken) {
  const host = canvasHost(courseUrl)
  if (process.platform !== 'darwin' || !host || !accessToken) return false
  try {
    // The headless helper receives JSON through stdin, so the token never appears
    // in terminal output, command arguments, history, or app configuration.
    return Boolean((await keychainRequest({ operation: 'set', courseUrl, value: accessToken })).found)
  } catch {
    return false
  }
}

export async function forgetSavedCanvasAccessToken(courseUrl) {
  const host = canvasHost(courseUrl)
  if (process.platform !== 'darwin' || !host) return false
  try {
    return Boolean((await keychainRequest({ operation: 'delete', courseUrl })).found)
  } catch {
    return false
  }
}

function question(terminal, prompt) {
  return new Promise((resolve) => terminal.question(prompt, resolve))
}

async function canvasTokenFromClipboard() {
  if (process.platform !== 'darwin') {
    throw new LocalCanvasPromptError('Copy-to-Keychain is available on macOS. On another platform, provide a local token through --token-env CANVAS_ACCESS_TOKEN.')
  }
  try {
    const { stdout: clipboard } = await execFileAsync('pbpaste', [], { maxBuffer: 1024 * 1024 })
    const token = clean(clipboard)
    if (token) return token
  } catch {}
  throw new LocalCanvasPromptError('No Canvas token was found in the clipboard. Copy the token first, then run the command again.')
}

// This is deliberately a clipboard-only hand-off: an agent can ask the
// administrator to copy a PAT in Canvas, then invoke this local method without
// receiving the value in a chat, tool argument, environment variable, or log.
export async function saveCanvasAccessTokenFromClipboard(courseUrl) {
  const resolvedCourseUrl = clean(courseUrl)
  const host = canvasHost(resolvedCourseUrl)
  if (!host) throw new LocalCanvasPromptError('Provide a valid HTTPS Canvas course URL.')
  const accessToken = await canvasTokenFromClipboard()
  if (!await saveCanvasAccessToken(resolvedCourseUrl, accessToken)) {
    throw new LocalCanvasPromptError('Canvas token could not be saved in the macOS Keychain.')
  }
  return { host }
}

async function promptInTerminal({ courseUrl, outputFolder, accessToken, promptToken = true }) {
  if (!stdin.isTTY || !stdout.isTTY) throw missingInputError()
  const terminal = createInterface({ input: stdin, output: stdout, terminal: true })
  try {
    let resolvedCourseUrl = courseUrl
    let resolvedOutputFolder = outputFolder
    let resolvedAccessToken = accessToken

    if (!resolvedCourseUrl) resolvedCourseUrl = clean(await question(terminal, 'Canvas Modules URL\n> '))
    if (!resolvedOutputFolder) resolvedOutputFolder = normalizedOutputFolder(await question(terminal, 'Destination folder (for example Downloads/IUI)\n> '))
    if (!resolvedAccessToken && promptToken) {
      await question(terminal, 'Copy the Canvas Personal Access Token, then press Return to save it in macOS Keychain\n> ')
      resolvedAccessToken = await canvasTokenFromClipboard()
    }
    return { courseUrl: resolvedCourseUrl, outputFolder: resolvedOutputFolder, accessToken: resolvedAccessToken }
  } catch (error) {
    if (error instanceof LocalCanvasPromptError) throw error
    throw new LocalCanvasPromptError('Canvas import was cancelled.')
  } finally {
    terminal.close()
  }
}

export async function promptForLocalCanvasImport({ courseUrl, outputFolder, accessToken } = {}) {
  let resolvedCourseUrl = clean(courseUrl)
  let resolvedOutputFolder = normalizedOutputFolder(outputFolder)
  let resolvedAccessToken = clean(accessToken)
  if (!resolvedCourseUrl || !resolvedOutputFolder) {
    const prompted = await promptInTerminal({
      courseUrl: resolvedCourseUrl,
      outputFolder: resolvedOutputFolder,
      accessToken: resolvedAccessToken,
      promptToken: false
    })
    resolvedCourseUrl = prompted.courseUrl
    resolvedOutputFolder = normalizedOutputFolder(prompted.outputFolder)
  }
  if (!resolvedAccessToken) resolvedAccessToken = await savedCanvasAccessToken(resolvedCourseUrl)
  if (!resolvedAccessToken) {
    const prompted = await promptInTerminal({
      courseUrl: resolvedCourseUrl,
      outputFolder: resolvedOutputFolder,
      accessToken: '',
      promptToken: true
    })
    resolvedAccessToken = prompted.accessToken
    if (resolvedAccessToken && await saveCanvasAccessToken(resolvedCourseUrl, resolvedAccessToken)) {
      stdout.write('Saved this Canvas token in macOS Keychain for future local imports.\n')
    }
  }
  if (!resolvedCourseUrl) throw new LocalCanvasPromptError('A Canvas course URL is required.')
  if (!resolvedOutputFolder) throw new LocalCanvasPromptError('An output folder is required.')
  if (!resolvedAccessToken) throw new LocalCanvasPromptError('A Canvas Personal Access Token is required.')
  return { courseUrl: resolvedCourseUrl, outputFolder: resolvedOutputFolder, accessToken: resolvedAccessToken }
}
