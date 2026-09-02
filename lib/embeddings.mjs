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
  if (!response.ok) throw new Error(`Embedding request failed (${response.status}).`)
  const body = await response.json()
  const rows = Array.isArray(body.data) ? [...body.data].sort((left, right) => left.index - right.index) : []
  if (rows.length !== input.length || rows.some((row) => !Array.isArray(row.embedding) || row.embedding.length !== 1536)) throw new Error('Embedding provider returned an unexpected vector shape.')
  return rows.map((row) => row.embedding)
}
