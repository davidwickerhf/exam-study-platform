import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID
} from 'node:crypto'
import { currentUserId, currentAuth } from './request-context.mjs'
import {
  readDocument,
  compareAndSwapDocument,
  deleteDocument
} from './user-store.mjs'
import { StudyVersionError } from './study-version-content.mjs'
export const STUDY_MODELS = Object.freeze({
  'gpt-5.4': { provider: 'openai', label: 'GPT-5.4 · Enhanced', input: 2.5, output: 15 },
  'gpt-5-mini': {
    provider: 'openai',
    label: 'GPT-5 mini',
    input: 0.25,
    output: 2
  },
  'claude-sonnet-4-5': {
    provider: 'anthropic',
    label: 'Claude Sonnet 4.5',
    input: 3,
    output: 15
  }
})
function encryptionKey() {
  const key = Buffer.from(
    process.env.AI_CONNECTION_ENCRYPTION_KEY ||
      process.env.CANVAS_CONNECTION_ENCRYPTION_KEY ||
      '',
    'base64'
  )
  if (key.length !== 32)
    throw new StudyVersionError(
      'Secure AI key storage is not configured on this server.',
      503
    )
  return createHmac('sha256', key).update('wicker:personal-ai:v1').digest()
}
export function aiKeyStorageConfigured() {
  try {
    encryptionKey()
    return true
  } catch {
    return false
  }
}
export function sealAiKey(secret, owner = currentUserId()) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(`wicker:ai:${owner}`))
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final()
  ])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url')
  ].join('.')
}
export function openAiKey(value, owner = currentUserId()) {
  try {
    const [version, iv, tag, bytes, ...extra] = String(value).split('.')
    if (version !== 'v1' || extra.length) throw new Error()
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(iv, 'base64url')
    )
    decipher.setAAD(Buffer.from(`wicker:ai:${owner}`))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(bytes, 'base64url')),
      decipher.final()
    ]).toString('utf8')
  } catch {
    throw new StudyVersionError(
      'Your saved AI key cannot be read. Reconnect it in Settings.',
      409
    )
  }
}
export async function personalAiSettings() {
  const row = await readDocument('ai-connection', 'settings', null)
  return {
    connected: Boolean(row?.encryptedKey),
    provider: row?.provider || 'openai',
    model: row?.model || 'gpt-5-mini',
    monthlyLimitUsd: row?.monthlyLimitUsd ?? 5,
    updatedAt: row?.updatedAt || null,
    storageConfigured: aiKeyStorageConfigured(),
    models: STUDY_MODELS
  }
}
export async function updatePersonalAiSettings(input) {
  if (currentAuth().mode === 'api-key')
    throw new StudyVersionError(
      'AI credentials can only be managed in Settings.',
      403
    )
  const model = STUDY_MODELS[input.model]
  if (!model) throw new StudyVersionError('Choose a supported study model.')
  if (input.consent !== true)
    throw new StudyVersionError(
      'Confirm that selected study sources may be sent to this provider and billed to your API account.'
    )
  const limit = Number(input.monthlyLimitUsd)
  if (!Number.isFinite(limit) || limit < 0.1 || limit > 100)
    throw new StudyVersionError(
      'Choose a monthly spending limit between $0.10 and $100.'
    )
  const old = await readDocument('ai-connection', 'settings', null)
  let encryptedKey = old?.encryptedKey
  if (input.apiKey) {
    const key = String(input.apiKey).trim()
    if (key.length < 20 || key.length > 4096 || /\s/.test(key))
      throw new StudyVersionError('Enter a valid provider API key.')
    encryptedKey = sealAiKey(key)
  } else if (!encryptedKey || old?.provider !== model.provider)
    throw new StudyVersionError('Enter an API key for the selected provider.')
  await compareAndSwapDocument(
    'ai-connection',
    'settings',
    {
      provider: model.provider,
      model: input.model,
      encryptedKey,
      monthlyLimitUsd: limit,
      consentedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: randomUUID()
    },
    old?.revision ?? null
  )
  return personalAiSettings()
}
export async function removePersonalAiKey() {
  if (currentAuth().mode === 'api-key')
    throw new StudyVersionError('Remove AI credentials in Settings.', 403)
  await deleteDocument('ai-connection', 'settings')
  return personalAiSettings()
}
export async function personalAiCredential() {
  const row = await readDocument('ai-connection', 'settings', null)
  if (!row?.encryptedKey)
    throw new StudyVersionError(
      'Connect your own AI key in Settings, or explicitly choose the platform allowance.',
      409
    )
  return { ...row, apiKey: openAiKey(row.encryptedKey) }
}
