#!/usr/bin/env node
/**
 * runner.mjs — supervises server.mjs and restarts it on exit code 23.
 *
 * The server triggers a restart by calling process.exit(23) — used by the
 * /api/update/restart endpoint after a successful git pull. Any other exit
 * code propagates as-is so the user can Ctrl-C cleanly.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const serverPath = resolve(__dirname, 'server.mjs')

const RESTART_EXIT_CODE = 23

let child = null
let shuttingDown = false

function start() {
  child = spawn('node', [serverPath], { stdio: 'inherit', cwd: __dirname })
  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    if (code === RESTART_EXIT_CODE) {
      console.log('\n→ Restart requested. Relaunching server in 500ms…\n')
      setTimeout(start, 500)
      return
    }
    // Any other exit: propagate
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 0)
  })
  child.on('error', (err) => {
    console.error(`runner: failed to spawn server: ${err.message}`)
    process.exit(1)
  })
}

function shutdown(signal) {
  shuttingDown = true
  if (child && !child.killed) child.kill(signal)
  setTimeout(() => process.exit(0), 500)
}
process.on('SIGINT',  () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGHUP',  () => shutdown('SIGHUP'))

start()
