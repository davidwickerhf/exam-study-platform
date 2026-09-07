import { randomUUID } from 'node:crypto'
import {
  readDocument,
  listDocuments,
  compareAndSwapDocument,
} from './user-store.mjs'
import { StudyVersionError } from './study-version-content.mjs'
export async function readStudyAiPreferences() {
  const saved = await readDocument('study-ai-preferences', 'defaults', null)
  if (saved) return saved
  // Preserve the user's most recent explicit practice choice on first upgrade.
  const last = (await listDocuments('study-practice'))
    .map((r) => r.value)
    .filter((r) => r.billing)
    .sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    )[0]?.billing
  return {
    billingSource: last?.source || 'platform',
    quality: last?.model === 'gpt-5.4' ? 'enhanced' : 'standard',
    maxJobUsd: Number.isFinite(last?.maxJobUsd)
      ? Math.min(10, Math.max(0.05, last.maxJobUsd))
      : 1,
  }
}
export async function saveStudyAiPreferences(input = {}) {
  if (!input || typeof input !== 'object')
    throw new StudyVersionError('Choose valid AI preferences.')
  if (
    !['platform', 'personal'].includes(input.billingSource) ||
    !['standard', 'enhanced'].includes(input.quality) ||
    !Number.isFinite(input.maxJobUsd) ||
    input.maxJobUsd < 0.05 ||
    input.maxJobUsd > 10
  )
    throw new StudyVersionError(
      'Choose a valid billing source, quality and spending cap ($0.05–$10).',
    )
  const old = await readDocument('study-ai-preferences', 'defaults', null)
  const next = {
    billingSource: input.billingSource,
    quality: input.quality,
    maxJobUsd: input.maxJobUsd,
    revision: randomUUID(),
  }
  await compareAndSwapDocument(
    'study-ai-preferences',
    'defaults',
    next,
    old?.revision ?? null,
  )
  return next
}
