#!/usr/bin/env node
import { importCanvasCourse } from '../lib/canvas-course-import.mjs'
import { promptForLocalCanvasImport } from '../lib/local-canvas-prompts.mjs'

// The normal interactive flow intentionally does not read .env files: a stale token
// must never prevent the hidden prompt from appearing. Passing --token-env is an
// explicit local-only shortcut for a shell environment variable.

function options(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index]
    if (!value.startsWith('--')) continue
    const key = value.slice(2)
    values[key] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true
  }
  return values
}

const args = options(process.argv.slice(2))
if (args.help) {
  console.error('Usage: npm run canvas:sync (opens local prompts), or npm run canvas:sync -- --course-url https://canvas.example.edu/courses/123/modules --output /absolute/path/to/course-folder [--token-env CANVAS_ACCESS_TOKEN] [--max-resources 250]')
} else {
  const tokenEnv = args['token-env'] ? String(args['token-env']) : null
  const suppliedToken = tokenEnv ? process.env[tokenEnv] : undefined
  try {
    if (!args['course-url'] || !args.output || !suppliedToken) {
      console.log('Opening the secure local Canvas import panel…')
    }
    const input = await promptForLocalCanvasImport({
      courseUrl: args['course-url'],
      outputFolder: args.output,
      accessToken: suppliedToken
    })
    console.log('Reading the course and downloading accessible materials locally…')
    const result = await importCanvasCourse({
      courseUrl: input.courseUrl,
      outputFolder: input.outputFolder,
      accessToken: input.accessToken,
      ...(args['max-resources'] ? { maxResources: Number(args['max-resources']) } : {})
    })
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
