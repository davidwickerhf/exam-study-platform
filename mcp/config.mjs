// Where an authorised key lives once the agent has one.
//
// Keys are stored per server URL, so a developer pointing at localhost and the
// same person pointing at study.wicker.life do not overwrite each other, and so
// a key is never sent to a host it was not minted for. The file is written
// 0600 and its directory 0700; the key never appears in a shell history, a
// project directory, or a chat transcript.

import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export function configDirectory(env = process.env) {
  const explicit = String(env.WICKER_STUDY_CONFIG_DIR || '').trim()
  if (explicit) return explicit
  const xdg = String(env.XDG_CONFIG_HOME || '').trim()
  return join(xdg || join(homedir(), '.config'), 'wicker-study')
}

export function configPath(env = process.env) {
  return join(configDirectory(env), 'config.json')
}

export function normaliseServerUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) throw new Error('A Wicker Study URL is required.')
  let url
  try { url = new URL(raw) } catch { throw new Error(`"${raw}" is not a valid Wicker Study URL.`) }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A Wicker Study URL must be http or https.')
  // http is only sensible against a local development server; anything else
  // would put a bearer key on the wire in clear text.
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error(`Refusing to use http for ${url.hostname}. Use https, or point at a local development server.`)
  }
  return url.origin
}

async function readConfig(env = process.env) {
  try {
    const parsed = JSON.parse(await readFile(configPath(env), 'utf8'))
    return parsed && typeof parsed === 'object' && parsed.servers && typeof parsed.servers === 'object' ? parsed : { servers: {} }
  } catch {
    return { servers: {} }
  }
}

async function writeConfig(config, env = process.env) {
  const path = configPath(env)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await chmod(dirname(path), 0o700).catch(() => {})
  // Write-then-rename so an interrupted save cannot leave a truncated file, and
  // set the mode before the content is in place at its final name.
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  await chmod(temporary, 0o600).catch(() => {})
  await rename(temporary, path)
}

export async function savedApiKey(serverUrl, env = process.env) {
  const config = await readConfig(env)
  const entry = config.servers[normaliseServerUrl(serverUrl)]
  return entry && typeof entry.apiKey === 'string' && entry.apiKey ? entry.apiKey : null
}

export async function saveApiKey(serverUrl, apiKey, details = {}, env = process.env) {
  const origin = normaliseServerUrl(serverUrl)
  const key = String(apiKey || '').trim()
  if (!key.startsWith('wsk_')) throw new Error('That does not look like a Wicker Study API key (they start with wsk_).')
  const config = await readConfig(env)
  config.servers[origin] = {
    apiKey: key,
    name: details.name || null,
    scopes: Array.isArray(details.scopes) ? details.scopes : null,
    expiresAt: details.expiresAt || null,
    savedAt: new Date().toISOString()
  }
  await writeConfig(config, env)
  return { server: origin, path: configPath(env) }
}

export async function forgetApiKey(serverUrl, env = process.env) {
  const origin = normaliseServerUrl(serverUrl)
  const config = await readConfig(env)
  if (!config.servers[origin]) return false
  delete config.servers[origin]
  await writeConfig(config, env)
  return true
}

export async function listSavedServers(env = process.env) {
  const config = await readConfig(env)
  // Never return the key itself — only that one exists and what it can do.
  return Object.entries(config.servers).map(([server, entry]) => ({
    server,
    name: entry?.name || null,
    scopes: entry?.scopes || null,
    savedAt: entry?.savedAt || null,
    expiresAt: entry?.expiresAt || null
  }))
}

// The environment always wins, so a one-off `WICKER_STUDY_API_KEY=… npx …`
// still works and CI never picks up a developer's saved key by accident.
export async function resolveApiKey(serverUrl, env = process.env) {
  const fromEnv = String(env.WICKER_STUDY_API_KEY || '').trim()
  if (fromEnv) return { apiKey: fromEnv, source: 'environment' }
  const stored = await savedApiKey(serverUrl, env)
  return stored ? { apiKey: stored, source: configPath(env) } : { apiKey: null, source: null }
}
