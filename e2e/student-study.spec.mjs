import { test, expect } from '@playwright/test'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, writeDocument } from '../lib/user-store.mjs'
import {
  addStudyNote,
  readStudySourceSnapshot
} from '../lib/study-version-sources.mjs'
import {
  createStudyVersion,
  ownStudyVersion
} from '../lib/study-version-store.mjs'
import { processStudyStep } from '../lib/study-version-pipeline.mjs'
import { course, lesson } from '../scripts/verification/study-fixtures.mjs'
if (process.env.DATABASE_URL)
  throw new Error('Browser fixtures require local document storage.')
const run = (fn) =>
  withRequestContext({ userId: 'study-e2e-fixture', mode: 'local' }, fn)
let versionId
// The model is deterministic here; the full reader, HTTP APIs and persistence
// are real. Live model evaluation has its own explicit spending-capped command.
test.beforeAll(async () => {
  await run(async () => {
    await deleteAllDocuments()
    await writeDocument('onboarding', 'conversation', { finished: true })
    const note = await addStudyNote(
      { ...course, title: 'E2E arithmetic notes' },
      [
        {
          page: 1,
          text: 'Two plus three is five. Addition combines disjoint quantities with matching units. Subtraction checks the total.'
        }
      ]
    )
    const snapshot = await readStudySourceSnapshot(course, [note.id])
    const version = await createStudyVersion(
      course,
      'programme-test',
      snapshot,
      { title: 'My tested course' }
    )
    versionId = version.id
    const ids = snapshot.chunks.map((c) => c.id)
    for (let i = 0; i < 10; i++) {
      await processStudyStep(versionId, {
        generate: async (prompt) =>
          prompt.includes('Map this evidence batch')
            ? {
                topics: [{ id: 'addition', title: 'Addition', sourceIds: ids }],
                gaps: []
              }
            : prompt.includes('Independently check')
              ? { issues: [] }
              : lesson(ids)
      })
      if ((await ownStudyVersion(versionId)).draft.status === 'complete') break
    }
    expect((await ownStudyVersion(versionId)).draft.status).toBe('complete')
  })
})
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => console.error('Browser error:', e.message))
  page.on('response', (r) => {
    if (r.status() >= 400) console.error('HTTP', r.status(), r.url())
  })
})
test.afterAll(async () => {
  await run(deleteAllDocuments)
})
test('source-grounded study, persisted notes, exercises, mock exam and private sharing', async ({
  page,
  request
}) => {
  await page.goto(`/app/study/${versionId}`)
  await expect(
    page.getByRole('heading', { name: 'My tested course' })
  ).toBeVisible()
  await page.screenshot({
    path: '/tmp/wicker-study-reader.png',
    fullPage: true
  })
  await expect(
    page.getByText('Not editorially reviewed.', { exact: false }).first()
  ).toBeVisible()
  await page
    .getByRole('button', { name: /Sources ·/i })
    .first()
    .click()
  await expect(page.getByText('E2E arithmetic notes').first()).toBeVisible()
  await page.getByRole('tab', { name: 'My notes', exact: true }).click()
  await page
    .getByLabel('Your chapter notes')
    .fill('Private annotation survives refresh.')
  await page.getByRole('button', { name: 'Save notes', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Your notes are saved.' })
  ).toBeVisible()
  await page.reload()
  await page.getByRole('tab', { name: 'My notes', exact: true }).click()
  await expect(page.getByLabel('Your chapter notes')).toHaveValue(
    'Private annotation survives refresh.'
  )
  await page.getByRole('tab', { name: 'Practice', exact: true }).click()
  await page
    .getByLabel('Your answer', { exact: true })
    .fill('Five, because the groups do not overlap.')
  await page.getByRole('button', { name: 'Save attempt', exact: true }).click()
  await expect(
    page.getByText('Attempt saved with this question and revision.')
  ).toBeVisible()
  await page.getByRole('button', { name: 'Show worked solution' }).click()
  await expect(
    page.getByText('Subtract three to verify', { exact: false })
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Practice exam', exact: true }).click()
  await page
    .getByRole('button', { name: 'Build a 10-question practice exam' })
    .click()
  await page
    .getByLabel('Your answer', { exact: true })
    .fill('Subtract one group to check the other.')
  await page.getByRole('button', { name: 'Next question', exact: true }).click()
  await page.getByRole('button', { name: 'Next question', exact: true }).click()
  await page
    .getByRole('button', { name: 'Finish and review solutions' })
    .click()
  await expect(
    page.getByText('Completed attempt', { exact: false })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Share or contribute' }).click()
  await page.getByRole('combobox', { name: 'Share with' }).click()
  await page.getByRole('option', { name: 'Anyone with the link' }).click()
  await page
    .getByRole('checkbox', {
      name: 'The included notes are mine to share, including the cited excerpts.'
    })
    .check()
  await page
    .getByRole('checkbox', {
      name: 'I have permission to share the selected chapters and cited source excerpts with this audience.'
    })
    .check()
  await page.getByRole('button', { name: 'Publish selected chapters' }).click()
  const link = page.getByRole('link', { name: 'Open shared version' })
  await expect(link).toBeVisible()
  const href = await link.getAttribute('href')
  await page.goto(href)
  await expect(
    page.getByText('Community version', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('tab', { name: 'My notes', exact: true })
  ).toHaveCount(0)
  const pubId = href.split('/').at(-1)
  const publicData = await (
    await request.get(`/api/public/study-versions/${pubId}`)
  ).text()
  expect(publicData).not.toContain('Private annotation')
  expect(publicData).not.toContain('billing')
  await page.goto(`/app/study/shared/${pubId}`)
  await page.getByRole('button', { name: 'Withdraw publication' }).click()
  await expect(
    page.getByText('This publication has been withdrawn.')
  ).toBeVisible()
  expect(
    (await request.get(`/api/public/study-versions/${pubId}`)).status()
  ).toBe(404)
})
test('refresh source selection and BYOK settings render on mobile without overflow', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/app/study/${versionId}`)
  await page.getByRole('button', { name: 'Refresh sources' }).click()
  await expect(
    page.getByRole('heading', { name: 'Update your source selection' })
  ).toBeVisible()
  await expect(
    page.getByLabel('Spending cap for this generation (USD)')
  ).toHaveValue('1')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await page.goto('/app/settings?tab=ai-key')
  await expect(
    page.getByRole('heading', { name: 'Your AI key', exact: true }).first()
  ).toBeVisible()
  await page
    .getByLabel('API key', { exact: true })
    .fill('test-e2e-key-not-a-real-provider-secret')
  await page
    .getByRole('checkbox', {
      name: 'When I select my key, Wicker may send my selected study sources to this provider and bill the requests to my API account.'
    })
    .check()
  await page.getByRole('button', { name: 'Save AI settings' }).click()
  await expect(page.getByLabel('Replace API key (optional)')).toHaveValue('')
  await page
    .getByRole('heading', { name: 'Settings', exact: true })
    .scrollIntoViewIfNeeded()
  await page.screenshot({
    path: '/tmp/wicker-study-mobile-settings.png',
    fullPage: true
  })
  await page.getByRole('button', { name: 'Remove key' }).click()
  await expect(
    page.getByText(
      'Your AI key was removed. Jobs using it will pause before their next request.'
    )
  ).toBeVisible()
})
