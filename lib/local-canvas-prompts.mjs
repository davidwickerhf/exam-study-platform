import { execFile, spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline'
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

function security(args, password) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/security', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let output = ''
    let errorOutput = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { errorOutput += chunk })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve(output)
      else reject(new Error(errorOutput || `security exited with code ${code}`))
    })
    if (password === undefined) child.stdin.end()
    // `security add-generic-password -w` asks for the value twice when creating
    // an item. Both values travel only over this child process's standard input.
    else child.stdin.end(`${password}\n${password}\n`)
  })
}

async function savedCanvasAccessToken(courseUrl) {
  const host = canvasHost(courseUrl)
  if (process.platform !== 'darwin' || !host) return ''
  try {
    return clean(await security(['find-generic-password', '-a', host, '-s', keychainService, '-w']))
  } catch {
    return ''
  }
}

async function saveCanvasAccessToken(courseUrl, accessToken) {
  const host = canvasHost(courseUrl)
  if (process.platform !== 'darwin' || !host || !accessToken) return false
  try {
    // With `-w` as the final argument, the macOS tool reads the password from
    // stdin. The token is never placed in a command argument, terminal history,
    // or application config file.
    await security([
      'add-generic-password', '-U',
      '-a', host,
      '-s', keychainService,
      '-l', `Wicker Study Canvas token (${host})`,
      '-w'
    ], accessToken)
    return true
  } catch {
    return false
  }
}

export async function forgetSavedCanvasAccessToken(courseUrl) {
  const host = canvasHost(courseUrl)
  if (process.platform !== 'darwin' || !host) return false
  try {
    await security(['delete-generic-password', '-a', host, '-s', keychainService])
    return true
  } catch {
    return false
  }
}

function question(terminal, prompt) {
  return new Promise((resolve) => terminal.question(prompt, resolve))
}

async function canvasTokenFromClipboard(terminal) {
  if (process.platform !== 'darwin') {
    throw new LocalCanvasPromptError('Copy-to-Keychain is available on macOS. On another platform, provide a local token through --token-env CANVAS_ACCESS_TOKEN.')
  }
  await question(terminal, 'Copy the Canvas Personal Access Token, then press Return to save it in macOS Keychain\n> ')
  try {
    const { stdout: clipboard } = await execFileAsync('pbpaste', [], { maxBuffer: 1024 * 1024 })
    const token = clean(clipboard)
    if (token) return token
  } catch {}
  throw new LocalCanvasPromptError('No Canvas token was found in the clipboard. Copy the token first, then run the command again.')
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
      resolvedAccessToken = await canvasTokenFromClipboard(terminal)
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
