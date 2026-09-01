import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withRequestContext } from '../lib/request-context.mjs'
import { AgentAuthorizationError, approveAgentAuthorization, assertLoopbackRedirect, exchangeAgentAuthorization } from '../lib/agent-authorization.mjs'
import { authorizationUrl, makeVerifier, startCallbackListener } from '../mcp/authorize.mjs'
import { configPath, forgetApiKey, listSavedServers, normaliseServerUrl, resolveApiKey, saveApiKey } from '../mcp/config.mjs'
import { checkMcpVendor } from '../scripts/sync-mcp-vendor.mjs'

// Exchanging a code mints a real key into the local document store, and an
// account is capped at twenty. A fixed user id therefore poisons the suite
// after twenty runs, so each run gets its own throwaway account and deletes it.
const dataRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data/users')
const scratchUsers = new Set()
function scratchUser(prefix) {
  const id = `${prefix}_${randomUUID().slice(0, 8)}`
  scratchUsers.add(id)
  return id
}
test.after(async () => {
  for (const id of scratchUsers) await rm(join(dataRoot, id), { recursive: true, force: true })
  await rm(join(dataRoot, '_agent-authorizations'), { recursive: true, force: true })
})

const asUser = (id, callback) => withRequestContext({ userId: id, mode: 'clerk' }, callback)

test('an agent key is only ever delivered to loopback', () => {
  assert.equal(assertLoopbackRedirect('http://127.0.0.1:8765/callback'), 'http://127.0.0.1:8765/callback')
  assert.equal(assertLoopbackRedirect('http://localhost:41917/callback'), 'http://localhost:41917/callback')
  for (const hostile of [
    'https://evil.test/callback',
    'http://evil.test/callback',
    // A host that merely looks local must not pass.
    'http://127.0.0.1.evil.test/callback',
    'http://localhost.evil.test/callback',
    'http://user:pass@127.0.0.1/callback',
    'not a url'
  ]) {
    assert.throws(() => assertLoopbackRedirect(hostile), AgentAuthorizationError, hostile)
  }
})

test('a code is single use, verifier-bound, and mints a key only at exchange', async () => {
  const { verifier, challenge } = makeVerifier()
  const owner = scratchUser('user_alpha')
  const approval = await asUser(owner, () => approveAgentAuthorization({ name: 'Claude Code', scopes: ['read', 'write'], challenge }))
  assert.match(approval.code, /^[A-Za-z0-9_-]{20,}$/)
  assert.deepEqual(approval.scopes, ['read', 'write'])

  // The verifier is what the agent never transmits until it redeems the code,
  // so a code seen in browser history is not enough on its own.
  await assert.rejects(() => exchangeAgentAuthorization({ code: approval.code, verifier: makeVerifier().verifier }), AgentAuthorizationError)

  const granted = await exchangeAgentAuthorization({ code: approval.code, verifier })
  assert.match(granted.apiKey, /^wsk_/)
  assert.equal(granted.userId, owner)
  assert.deepEqual(granted.scopes, ['read', 'write'])

  // Spent codes stay spent, even with the right verifier.
  await assert.rejects(() => exchangeAgentAuthorization({ code: approval.code, verifier }), AgentAuthorizationError)
})

test('the challenge must be a digest, and admin scope needs an administrator', async () => {
  const owner = scratchUser('user_beta')
  await assert.rejects(() => asUser(owner, () => approveAgentAuthorization({ name: 'x', scopes: ['read'], challenge: 'a-literal-secret' })), AgentAuthorizationError)
  const { challenge } = makeVerifier()
  await assert.rejects(() => asUser(owner, () => approveAgentAuthorization({ name: 'x', scopes: ['admin'], challenge })),
    (error) => error instanceof AgentAuthorizationError && error.status === 403)
  await assert.rejects(() => asUser(owner, () => approveAgentAuthorization({ name: 'x', scopes: ['teleport'], challenge })), AgentAuthorizationError)
})

test('an unknown code fails the same way as a spent one', async () => {
  const unknown = exchangeAgentAuthorization({ code: 'A'.repeat(43), verifier: 'B'.repeat(43) })
  await assert.rejects(() => unknown, (error) => /not valid/.test(error.message))
  // Malformed input must not reveal that it was malformed rather than wrong.
  await assert.rejects(() => exchangeAgentAuthorization({ code: '', verifier: '' }), (error) => /not valid/.test(error.message))
})

test('the authorization URL carries the challenge and never the verifier', () => {
  const { verifier, challenge } = makeVerifier()
  const url = new URL(authorizationUrl('https://study.wicker.life', {
    name: 'Claude Code', scopes: ['read', 'write'], challenge, state: 'st', redirectUri: 'http://127.0.0.1:9/callback'
  }))
  assert.equal(url.origin + url.pathname, 'https://study.wicker.life/connect')
  assert.equal(url.searchParams.get('challenge'), challenge)
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:9/callback')
  assert.ok(!url.toString().includes(verifier))
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'))
})

test('the callback listener binds loopback and refuses a mismatched state', async () => {
  const listener = startCallbackListener({ timeoutMs: 5_000 })
  const { port, redirectUri, state } = await listener.address
  assert.equal(redirectUri, `http://127.0.0.1:${port}/callback`)

  const wrong = await fetch(`http://127.0.0.1:${port}/callback?code=abc&state=not-the-state`)
  assert.equal(wrong.status, 400)

  const right = await fetch(`http://127.0.0.1:${port}/callback?code=the-code&state=${encodeURIComponent(state)}`)
  assert.equal(right.status, 200)
  assert.equal(await listener.code, 'the-code')
})

test('the saved key is per server, 0600, and never returned by a listing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wicker-mcp-config-'))
  const env = { WICKER_STUDY_CONFIG_DIR: directory }
  try {
    assert.equal(await resolveApiKey('https://study.wicker.life', env).then((entry) => entry.apiKey), null)
    await saveApiKey('https://study.wicker.life', 'wsk_production', { name: 'prod', scopes: ['read'] }, env)
    await saveApiKey('http://localhost:4177', 'wsk_local', { name: 'dev', scopes: ['read', 'admin'] }, env)

    assert.equal((await resolveApiKey('https://study.wicker.life', env)).apiKey, 'wsk_production')
    assert.equal((await resolveApiKey('http://localhost:4177/', env)).apiKey, 'wsk_local', 'a trailing slash is the same server')

    const listed = await listSavedServers(env)
    assert.equal(listed.length, 2)
    assert.ok(!JSON.stringify(listed).includes('wsk_'), 'a listing must not expose the key itself')

    const mode = (await stat(configPath(env))).mode & 0o777
    assert.equal(mode, 0o600, 'the key file must not be world- or group-readable')

    // The environment wins so a one-off run never picks up a stored key.
    assert.deepEqual(await resolveApiKey('https://study.wicker.life', { ...env, WICKER_STUDY_API_KEY: 'wsk_override' }),
      { apiKey: 'wsk_override', source: 'environment' })

    assert.equal(await forgetApiKey('https://study.wicker.life', env), true)
    assert.equal(await forgetApiKey('https://study.wicker.life', env), false)
    assert.equal((await resolveApiKey('https://study.wicker.life', env)).apiKey, null)
    assert.equal((await resolveApiKey('http://localhost:4177', env)).apiKey, 'wsk_local', 'the other server is untouched')

    await assert.rejects(() => saveApiKey('https://study.wicker.life', 'not-a-key', {}, env))
    assert.ok(JSON.parse(await readFile(configPath(env), 'utf8')).servers)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('a bearer key is never put on the wire in clear text', () => {
  assert.equal(normaliseServerUrl('https://study.wicker.life/'), 'https://study.wicker.life')
  assert.equal(normaliseServerUrl('http://localhost:4177'), 'http://localhost:4177')
  assert.equal(normaliseServerUrl('http://127.0.0.1:4177/x'), 'http://127.0.0.1:4177')
  assert.throws(() => normaliseServerUrl('http://study.wicker.life'), /Refusing to use http/)
  assert.throws(() => normaliseServerUrl('ftp://study.wicker.life'))
  assert.throws(() => normaliseServerUrl(''))
})

test('the published MCP package carries an exact copy of the modules it shares', async () => {
  const drifted = await checkMcpVendor()
  assert.deepEqual(drifted, [], 'run `npm run mcp:sync` — mcp/ ships its own copies and they must match lib/')
})
