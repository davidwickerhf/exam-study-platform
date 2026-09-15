import { test, expect } from '@playwright/test'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, writeDocument } from '../lib/user-store.mjs'
import { addStudyNote } from '../lib/study-version-sources.mjs'
import { course } from '../scripts/verification/study-fixtures.mjs'

if (process.env.DATABASE_URL)
  throw new Error('Browser fixtures require local document storage.')
const run = (fn) =>
  withRequestContext({ userId: 'study-e2e-fixture', mode: 'local' }, fn)

// The whole-course "Study scope" select is not otherwise browser-tested: this
// checks the create form actually sends courseBundle through to the estimate
// call, and that switching scope invalidates a fetched estimate.
test.beforeAll(async () => {
  await run(async () => {
    await deleteAllDocuments()
    await writeDocument('onboarding', 'conversation', { finished: true })
    await addStudyNote({ ...course, title: 'Bundle scope fixture notes' }, [
      {
        page: 1,
        text: 'Course scope fixture text for the whole-course planning selector.'
      }
    ])
  })
})
test.afterAll(async () => {
  await run(deleteAllDocuments)
})
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => console.error('Browser error:', e.message))
})

test('selecting whole-course scope sends courseBundle:true and invalidates the estimate on change', async ({
  page
}) => {
  await page.route('**/api/state', (route) =>
    route.fulfill({
      json: {
        courses: [
          {
            id: course.courseCode,
            code: course.courseCode,
            name: course.courseName,
            chapters: [],
            items: []
          }
        ]
      }
    })
  )
  // Hosted billing is unconfigured in this fixture server; stub the estimate
  // response so the test isolates the form's own payload and invalidation
  // behavior instead of platform billing setup.
  let estimateBody = null
  await page.route('**/api/study-versions/estimate', async (route) => {
    estimateBody = route.request().postDataJSON()
    await route.fulfill({
      json: {
        chapterRange: [3, 6],
        estimatedUsd: [1, 2],
        maxJobUsd: 10,
        billingSource: 'platform',
        model: 'gpt-6-astra',
        explanation: 'Stubbed estimate for the course-scope test.'
      }
    })
  })
  await page.goto(`/app/courses/${course.courseCode}?year=${course.academicYear}`)
  await page.getByRole('button', { name: 'Create study guide', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', { name: 'Create study guide', exact: true })
  ).toBeVisible()
  await expect(dialog.getByRole('combobox', { name: 'Study scope' })).toContainText(
    'guide'
  )
  await dialog.getByRole('combobox', { name: 'Study scope' }).click()
  await page.getByRole('option', { name: 'Whole course · multiple guides' }).click()
  await expect(dialog.getByText('500 sources and 5,000,000 characters')).toBeVisible()
  await dialog.getByRole('button', { name: 'Review generation estimate', exact: true }).click()
  await expect(dialog.getByText(/estimated \$/)).toBeVisible()
  expect(estimateBody?.courseBundle).toBe(true)
  await expect(
    dialog.getByRole('button', { name: 'Generate my study version', exact: true })
  ).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Study scope' }).click()
  await page.getByRole('option', { name: 'One guide' }).click()
  await expect(
    dialog.getByRole('button', { name: 'Review generation estimate', exact: true })
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Review generation estimate', exact: true }).click()
  await expect(dialog.getByText(/estimated \$/)).toBeVisible()
  expect(estimateBody?.courseBundle).toBe(false)
})
