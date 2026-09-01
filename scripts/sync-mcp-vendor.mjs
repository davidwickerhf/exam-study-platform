#!/usr/bin/env node
// The MCP server is published as its own package so an agent can run it from
// anywhere with `npx wicker-study-mcp`. npm cannot pack files from outside a
// package root, so the handful of modules it shares with the application are
// copied into mcp/ and committed. This script does the copying; the test suite
// asserts the copies are byte-identical, so the two can never drift silently.
//
//   node scripts/sync-mcp-vendor.mjs          verify (exit 1 on drift)
//   node scripts/sync-mcp-vendor.mjs --write  copy

import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const MCP_VENDORED_FILES = Object.freeze([
  ['lib/canvas-course-import.mjs', 'mcp/vendor/canvas-course-import.mjs'],
  ['lib/canvas-course-export.mjs', 'mcp/vendor/canvas-course-export.mjs'],
  ['lib/local-canvas-prompts.mjs', 'mcp/vendor/local-canvas-prompts.mjs'],
  // local-canvas-prompts.mjs resolves this relative to its own directory, so
  // the layout inside the package has to mirror the repository's.
  ['scripts/macos-keychain.swift', 'mcp/scripts/macos-keychain.swift']
])

export async function checkMcpVendor() {
  const drifted = []
  for (const [from, to] of MCP_VENDORED_FILES) {
    const source = await readFile(resolve(root, from), 'utf8')
    let copy = null
    try { copy = await readFile(resolve(root, to), 'utf8') } catch {}
    if (copy !== source) drifted.push({ from, to, missing: copy === null })
  }
  return drifted
}

export async function writeMcpVendor() {
  for (const [from, to] of MCP_VENDORED_FILES) {
    const target = resolve(root, to)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await readFile(resolve(root, from)))
  }
  return MCP_VENDORED_FILES.length
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--write')) {
    console.log(`Copied ${await writeMcpVendor()} shared modules into mcp/.`)
  } else {
    const drifted = await checkMcpVendor()
    if (!drifted.length) console.log('mcp/ vendored modules match lib/.')
    else {
      for (const entry of drifted) console.error(`${entry.to} ${entry.missing ? 'is missing' : 'differs from'} ${entry.from}`)
      console.error('Run `npm run mcp:sync` to update the published copies.')
      process.exit(1)
    }
  }
}
