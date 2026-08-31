import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export class LocalCanvasPromptError extends Error {}

function clean(value) {
  return String(value ?? '').replace(/\0/g, '').trim()
}

async function appleScript(script) {
  if (process.platform !== 'darwin') throw new LocalCanvasPromptError('Interactive Canvas import needs macOS here. Provide courseUrl, outputFolder, and CANVAS_ACCESS_TOKEN explicitly on another platform.')
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 120_000, maxBuffer: 1024 * 1024 })
    return clean(stdout)
  } catch (error) {
    const message = `${error.message || ''}\n${error.stderr || ''}`
    if (/user canceled|user cancelled|-128/i.test(message)) throw new LocalCanvasPromptError('Canvas import was cancelled.')
    throw new LocalCanvasPromptError('Wicker Study could not open the local Canvas import dialog. Provide the values directly or allow this local process to show macOS dialogs.')
  }
}

export async function promptForLocalCanvasImport({ courseUrl, outputFolder, accessToken } = {}) {
  let resolvedCourseUrl = clean(courseUrl)
  let resolvedOutputFolder = clean(outputFolder)
  let resolvedAccessToken = clean(accessToken)
  if (!resolvedCourseUrl) {
    resolvedCourseUrl = await appleScript('return text returned of (display dialog "Paste the Canvas course Modules URL." default answer "" with title "Wicker Study" buttons {"Cancel", "Continue"} default button "Continue" cancel button "Cancel")')
    if (!resolvedCourseUrl) throw new LocalCanvasPromptError('A Canvas course URL is required.')
  }
  if (!resolvedOutputFolder) {
    resolvedOutputFolder = await appleScript('set selectedFolder to choose folder with prompt "Choose a new or previous Wicker Study Canvas import folder."\nreturn POSIX path of selectedFolder')
    if (!resolvedOutputFolder) throw new LocalCanvasPromptError('An output folder is required.')
  }
  if (!resolvedAccessToken) {
    resolvedAccessToken = await appleScript('return text returned of (display dialog "Paste a short-lived Canvas Personal Access Token. It will be used only for this import and will not be saved." default answer "" with hidden answer with title "Wicker Study" buttons {"Cancel", "Import"} default button "Import" cancel button "Cancel")')
    if (!resolvedAccessToken) throw new LocalCanvasPromptError('A Canvas Personal Access Token is required.')
  }
  return { courseUrl: resolvedCourseUrl, outputFolder: resolvedOutputFolder, accessToken: resolvedAccessToken }
}
