import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, rename, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export class LocalCanvasPromptError extends Error {}

function clean(value) {
  return String(value ?? '').replace(/\0/g, '').trim()
}

async function nativePanelBinary(scriptPath) {
  const source = await readFile(scriptPath)
  const digest = createHash('sha256').update(source).digest('hex').slice(0, 16)
  const cacheDirectory = join(tmpdir(), 'wicker-study')
  const binaryPath = join(cacheDirectory, `canvas-import-panel-${digest}`)
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

async function nativeCanvasImportPanel(input) {
  if (process.platform !== 'darwin') throw new LocalCanvasPromptError('Interactive Canvas import needs macOS here. Provide courseUrl, outputFolder, and CANVAS_ACCESS_TOKEN explicitly on another platform.')
  const scriptPath = fileURLToPath(new URL('../scripts/local-canvas-import-prompt.swift', import.meta.url))
  const promptInput = Buffer.from(JSON.stringify({ courseUrl: input.courseUrl, outputFolder: input.outputFolder, hasAccessToken: Boolean(input.hasAccessToken) })).toString('base64url')
  try {
    const binaryPath = await nativePanelBinary(scriptPath)
    const { stdout } = await execFileAsync(binaryPath, [promptInput], { timeout: 120_000, maxBuffer: 1024 * 1024 })
    const result = JSON.parse(clean(stdout))
    if (result?.cancelled) throw new LocalCanvasPromptError('Canvas import was cancelled.')
    return { courseUrl: clean(result?.courseUrl), outputFolder: clean(result?.outputFolder), accessToken: clean(result?.accessToken) }
  } catch (error) {
    if (error instanceof LocalCanvasPromptError) throw error
    const message = `${error.message || ''}\n${error.stderr || ''}`
    if (/user canceled|user cancelled|-128/i.test(message)) throw new LocalCanvasPromptError('Canvas import was cancelled.')
    throw new LocalCanvasPromptError('Wicker Study could not open the local Canvas import panel. Install Xcode Command Line Tools, or provide the values directly on another platform.')
  }
}

export async function promptForLocalCanvasImport({ courseUrl, outputFolder, accessToken } = {}) {
  let resolvedCourseUrl = clean(courseUrl)
  let resolvedOutputFolder = clean(outputFolder)
  let resolvedAccessToken = clean(accessToken)
  if (!resolvedCourseUrl || !resolvedOutputFolder || !resolvedAccessToken) {
    const prompted = await nativeCanvasImportPanel({ courseUrl: resolvedCourseUrl, outputFolder: resolvedOutputFolder, hasAccessToken: Boolean(resolvedAccessToken) })
    resolvedCourseUrl = prompted.courseUrl || resolvedCourseUrl
    resolvedOutputFolder = prompted.outputFolder || resolvedOutputFolder
    resolvedAccessToken = prompted.accessToken || resolvedAccessToken
  }
  if (!resolvedCourseUrl) throw new LocalCanvasPromptError('A Canvas course URL is required.')
  if (!resolvedOutputFolder) throw new LocalCanvasPromptError('An output folder is required.')
  if (!resolvedAccessToken) throw new LocalCanvasPromptError('A Canvas Personal Access Token is required.')
  return { courseUrl: resolvedCourseUrl, outputFolder: resolvedOutputFolder, accessToken: resolvedAccessToken }
}
