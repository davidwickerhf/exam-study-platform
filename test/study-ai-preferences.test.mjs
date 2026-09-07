import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { withRequestContext } from '../lib/request-context.mjs'
import { writeDocument, deleteAllDocuments } from '../lib/user-store.mjs'
import {
  readStudyAiPreferences,
  saveStudyAiPreferences,
} from '../lib/study-ai-preferences.mjs'
import { resolveStudyBilling } from '../lib/study-ai-budget.mjs'
const platform = { configured: true, provider: 'openai', model: 'gpt-5-mini' }
test('AI defaults persist per account and resolve billing without repeated selection', async () => {
  const userId = `preferences-${randomUUID()}`
  await withRequestContext(
    { userId, mode: 'hosted', email: 'student@example.test' },
    async () => {
      try {
        assert.deepEqual(await readStudyAiPreferences(), {
          billingSource: 'platform',
          quality: 'standard',
          maxJobUsd: 1,
        })
        const saved = await saveStudyAiPreferences({
          billingSource: 'platform',
          quality: 'enhanced',
          maxJobUsd: 0.75,
        })
        assert.deepEqual(await readStudyAiPreferences(), saved)
        assert.equal((await resolveStudyBilling({}, platform)).model, 'gpt-5.4')
        assert.equal(
          (await resolveStudyBilling({ quality: 'standard' }, platform)).model,
          'gpt-5-mini',
        )
        await withRequestContext(
          { userId: `other-${randomUUID()}`, mode: 'local' },
          async () =>
            assert.equal((await readStudyAiPreferences()).quality, 'standard'),
        )
        await saveStudyAiPreferences({
          billingSource: 'personal',
          quality: 'enhanced',
          maxJobUsd: 0.75,
        })
        await assert.rejects(resolveStudyBilling({}, platform), /key|connect/i)
        assert.equal((await readStudyAiPreferences()).billingSource, 'personal')
        await assert.rejects(
          saveStudyAiPreferences({
            billingSource: 'platform',
            quality: 'invalid',
            maxJobUsd: 1,
          }),
        )
        await assert.rejects(
          saveStudyAiPreferences({
            billingSource: 'platform',
            quality: 'standard',
            maxJobUsd: 100,
          }),
        )
      } finally {
        await deleteAllDocuments()
      }
    },
  )
})
test('first use keeps the most recent explicit practice model and payer', async () => {
  await withRequestContext(
    { userId: `preferences-migration-${randomUUID()}`, mode: 'local' },
    async () => {
      try {
        await writeDocument('study-practice', 'old', {
          createdAt: '2026-09-01',
          billing: { source: 'platform', model: 'gpt-5-mini', maxJobUsd: 1 },
        })
        await writeDocument('study-practice', 'recent', {
          createdAt: '2026-09-07',
          billing: { source: 'platform', model: 'gpt-5.4', maxJobUsd: 0.5 },
        })
        assert.deepEqual(await readStudyAiPreferences(), {
          billingSource: 'platform',
          quality: 'enhanced',
          maxJobUsd: 0.5,
        })
        await saveStudyAiPreferences({
          billingSource: 'platform',
          quality: 'standard',
          maxJobUsd: 1,
        })
        assert.equal((await readStudyAiPreferences()).quality, 'standard')
      } finally {
        await deleteAllDocuments()
      }
    },
  )
})

test('account preferences require browser auth and direct chapter editing is retired', async () => {
  const { studyVersionApi } = await import('../lib/study-version-api.mjs')
  await withRequestContext(
    { userId: `preferences-api-${randomUUID()}`, mode: 'api-key' },
    async () => {
      await assert.rejects(
        studyVersionApi({
          pathname: '/api/account/ai/preferences',
          method: 'POST',
          body: {
            billingSource: 'platform',
            quality: 'enhanced',
            maxJobUsd: 1,
          },
        }),
        (error) => error.status === 403,
      )
    },
  )
  const userId = `preferences-api-${randomUUID()}`,
    id = `sv-${randomUUID()}`
  await withRequestContext({ userId, mode: 'local' }, async () => {
    try {
      await writeDocument('study-versions', id, { id, owner: userId })
      await assert.rejects(
        studyVersionApi({
          pathname: `/api/study-versions/${id}/edit`,
          method: 'POST',
        }),
        (error) => error.status === 410,
      )
    } finally {
      await deleteAllDocuments()
    }
  })
})
