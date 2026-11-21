import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { papersTarget } from '../lib/papers-redirect.mjs'

// Paths MCP clients and the stdio package fetch outside the pages; they must never be sent to papers (issue #121).
const SERVED = [
  '/.well-known/oauth-protected-resource/api/mcp',
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-authorization-server',
  '/skills/wicker-study/SKILL.md',
  '/api/mcp',
]

test('papersTarget keeps the API, OAuth discovery and skills on study', () => {
  for (const path of [...SERVED, '/sign-in', '/connect/consent', '/internal', '/canvas']) assert.equal(papersTarget(path), null, path)
  assert.equal(papersTarget('/'), 'https://papers.wicker.life/from-study/')
  assert.equal(papersTarget('/plan'), 'https://papers.wicker.life/from-study/')
  assert.equal(papersTarget('/apiary'), 'https://papers.wicker.life/from-study/')
  assert.equal(papersTarget('/terms'), 'https://papers.wicker.life/privacy/')
})

test('proxy matcher skips the API, OAuth discovery and skills', async () => {
  const source = await readFile(new URL('../proxy.ts', import.meta.url), 'utf8')
  const literal = source.match(/matcher:\s*\['([^']+)'\]/)[1].replace(/\\\\/g, '\\')
  const matcher = new RegExp(`^${literal}$`)
  for (const path of SERVED) assert.equal(matcher.test(path), false, path)
  for (const path of ['/', '/plan', '/sign-in']) assert.equal(matcher.test(path), true, path)
})
