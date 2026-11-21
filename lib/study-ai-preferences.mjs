import { STUDY_GENERATION_LIMITS as generationLimits } from './study-generation-limits.mjs'
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
    quality: ({'gpt-6-sol':'standard','gpt-5.4':'enhanced','gpt-5.6-sol':'sol','gpt-6-astra':'astra'}[last?.model]) || 'standard',
    maxJobUsd: Number.isFinite(last?.maxJobUsd)
      ? Math.min(generationLimits.maxJobUsd, Math.max(0.05, last.maxJobUsd))
      : generationLimits.defaultJobUsd,
  }
}
export async function saveStudyAiPreferences(input = {}) {
  if (!input || typeof input !== 'object')
    throw new StudyVersionError('Choose valid AI preferences.')
  if (
    !['platform', 'personal'].includes(input.billingSource) ||
    !['standard', 'enhanced', 'sol', 'astra'].includes(input.quality) ||
    !Number.isFinite(input.maxJobUsd) ||
    input.maxJobUsd < 0.05 ||
    input.maxJobUsd > generationLimits.maxJobUsd
  )
    throw new StudyVersionError(
      'Choose a valid billing source, quality and spending cap ($0.05–$50).',
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
