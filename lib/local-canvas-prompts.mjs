import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline'

export class LocalCanvasPromptError extends Error {}

function clean(value) {
  return String(value ?? '').replace(/\0/g, '').trim()
}

function missingInputError() {
  return new LocalCanvasPromptError('Interactive Canvas import needs a terminal. Supply --course-url and --output, then provide a short-lived token through --token-env CANVAS_ACCESS_TOKEN.')
}

function question(terminal, prompt) {
  return new Promise((resolve) => terminal.question(prompt, resolve))
}

async function promptInTerminal({ courseUrl, outputFolder, accessToken }) {
  if (!stdin.isTTY || !stdout.isTTY) throw missingInputError()
  const terminal = createInterface({ input: stdin, output: stdout, terminal: true })
  try {
    let resolvedCourseUrl = courseUrl
    let resolvedOutputFolder = outputFolder
    let resolvedAccessToken = accessToken

    if (!resolvedCourseUrl) resolvedCourseUrl = clean(await question(terminal, 'Canvas Modules URL\n> '))
    if (!resolvedOutputFolder) resolvedOutputFolder = clean(await question(terminal, 'Destination folder (absolute path)\n> '))
    if (!resolvedAccessToken) {
      // readline writes typed characters through this method. Keep the access token
      // out of the terminal buffer, scrollback, and screenshots while it is entered.
      const writeToOutput = terminal._writeToOutput.bind(terminal)
      terminal._writeToOutput = () => {}
      stdout.write('Canvas Personal Access Token (hidden; not saved)\n> ')
      try {
        resolvedAccessToken = clean(await question(terminal, ''))
      } finally {
        terminal._writeToOutput = writeToOutput
        stdout.write('\n')
      }
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
  let resolvedOutputFolder = clean(outputFolder)
  let resolvedAccessToken = clean(accessToken)
  if (!resolvedCourseUrl || !resolvedOutputFolder || !resolvedAccessToken) {
    const prompted = await promptInTerminal({
      courseUrl: resolvedCourseUrl,
      outputFolder: resolvedOutputFolder,
      accessToken: resolvedAccessToken
    })
    resolvedCourseUrl = prompted.courseUrl
    resolvedOutputFolder = prompted.outputFolder
    resolvedAccessToken = prompted.accessToken
  }
  if (!resolvedCourseUrl) throw new LocalCanvasPromptError('A Canvas course URL is required.')
  if (!resolvedOutputFolder) throw new LocalCanvasPromptError('An output folder is required.')
  if (!resolvedAccessToken) throw new LocalCanvasPromptError('A Canvas Personal Access Token is required.')
  return { courseUrl: resolvedCourseUrl, outputFolder: resolvedOutputFolder, accessToken: resolvedAccessToken }
}
