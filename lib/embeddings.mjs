import { providerFailure } from './tutor-errors.mjs'

const MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')

export function embeddingConfiguration() {
  return { configured: Boolean(process.env.OPENAI_API_KEY), model: MODEL, dimensions: 1536 }
}

export async function embedTexts(values = []) {
  const input = values.map((value) => String(value || '').trim()).filter(Boolean)
  if (!input.length) return []
  if (!process.env.OPENAI_API_KEY) return input.map(() => null)
  const response = await fetch(`${BASE_URL}/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, input, dimensions: 1536 }),
    signal: AbortSignal.timeout(60_000)
  })
  if (!response.ok) {
    const failure = providerFailure(response.status, await response.text().catch(() => ''))
    const messages = {
      provider_credits: 'Search indexing is paused: AI credits are exhausted or its billing limit was reached. The platform owner must restore the allowance, then retry sync. Materials already saved are retained.',
      provider_rate_limit: 'Search indexing was temporarily rate-limited by the AI service. Sync will retry unfinished work; materials already saved are retained.',
      provider_configuration: 'Search indexing is paused: the AI connection needs fixing. The platform owner must check its credentials and model access, then retry sync. Materials already saved are retained.',
      provider_unavailable: 'Search indexing could not reach the AI service. Retry sync shortly; materials already saved are retained.'
    }
    throw Object.assign(new Error(messages[failure.code]), {
      code: failure.code, status: response.status, retryable: failure.retryable,
      blockedReason: failure.retryable ? null : failure.code
    })
  }
  const body = await response.json()
  const rows = Array.isArray(body.data) ? [...body.data].sort((left, right) => left.index - right.index) : []
  if (rows.length !== input.length || rows.some((row) => !Array.isArray(row.embedding) || row.embedding.length !== 1536)) throw new Error('Embedding provider returned an unexpected vector shape.')
  return rows.map((row) => row.embedding)
}
