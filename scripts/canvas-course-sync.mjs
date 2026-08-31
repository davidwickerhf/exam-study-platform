#!/usr/bin/env node
import { config } from 'dotenv'
import { importCanvasCourse } from '../lib/canvas-course-import.mjs'

// Local convenience only. Existing shell variables always win; this never reads or
// writes a deployed environment.
config({ path: '.env.local', override: false, quiet: true })
config({ path: '.env', override: false, quiet: true })

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
if (args.help || !args['course-url'] || !args.output) {
  console.error('Usage: CANVAS_ACCESS_TOKEN=… node scripts/canvas-course-sync.mjs --course-url https://canvas.example.edu/courses/123/modules --output /absolute/path/to/course-folder [--token-env CANVAS_ACCESS_TOKEN] [--max-resources 250]')
  process.exitCode = args.help ? 0 : 1
} else {
  const tokenEnv = String(args['token-env'] || 'CANVAS_ACCESS_TOKEN')
  const token = process.env[tokenEnv]
  if (!token) {
    console.error(`Set ${tokenEnv} locally after signing in to Canvas. Do not pass a password or OTP to this script.`)
    process.exitCode = 1
  } else {
    try {
      const result = await importCanvasCourse({
        courseUrl: args['course-url'],
        outputFolder: args.output,
        accessToken: token,
        ...(args['max-resources'] ? { maxResources: Number(args['max-resources']) } : {})
      })
      console.log(JSON.stringify(result, null, 2))
    } catch (error) {
      console.error(error.message)
      process.exitCode = 1
    }
  }
}
