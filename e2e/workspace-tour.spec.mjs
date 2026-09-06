import { test, expect } from '@playwright/test'
import { withRequestContext } from '../lib/request-context.mjs'
import { writeDocument, deleteAllDocuments } from '../lib/user-store.mjs'
import { TOUR_STEPS } from '../lib/workspace/tour.mjs'
const run = fn => withRequestContext({ userId: 'study-e2e-fixture', mode: 'local' }, fn)
test.beforeAll(() => run(async () => {
  await deleteAllDocuments()
  await writeDocument('onboarding', 'conversation', { finished: true })
}))
test.afterAll(() => run(deleteAllDocuments))

test('tour waits for delayed content, visits all stops, reuses planning data and stays in the viewport', async ({ page }) => {
  test.setTimeout(120000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  let academicReads = 0
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/academics' && request.method() === 'GET') academicReads++ })
  let releasePractice
  const held = new Promise(resolve => { releasePractice = resolve })
  await page.route('**/api/practice', async route => { await held; await route.continue() })
  await page.goto('/app')
  await page.getByRole('button', { name: 'Take a tour' }).click()
  const tour = page.locator('[data-dashboard-tour]')
  for (let index = 0; index < TOUR_STEPS.length; index++) {
    const step = TOUR_STEPS[index]
    await expect(tour.getByRole('heading', { name: step.title })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${step.route.replaceAll('/', '\\/')}(\\?|$)`))
    if (step.id === 'practice') {
      await expect(tour).toHaveAttribute('data-tour-state', 'loading')
      await expect(tour.getByRole('button', { name: 'Loading…', exact: true })).toBeDisabled()
      await expect(page.locator('[data-tour-spotlight]')).toHaveCount(0)
      // Repeated activation while a request is pending cannot skip a stop.
      await page.keyboard.press('Enter')
      await expect(tour.getByRole('heading', { name: step.title })).toBeVisible()
      releasePractice()
    }
    await expect(tour).toHaveAttribute('data-tour-state', 'ready')
    await expect(page.locator('[data-tour-spotlight]')).toHaveCount(1)
    if (step.id === 'planning') {
      expect(academicReads).toBe(1)
      await page.screenshot({ path: '/tmp/wicker-tour-planning.png' })
    }
    if (step.id === 'settings') await page.setViewportSize({ width: 390, height: 844 })
    await expect.poll(async () => {
      const box = await tour.boundingBox(), viewport = page.viewportSize()
      return box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height
    }).toBe(true)
    await tour.getByRole('button', { name: index === TOUR_STEPS.length - 1 ? 'Start studying' : 'Next', exact: true }).click()
  }
  await expect(tour).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a failed page can be skipped without trapping the tour; Escape also dismisses it', async ({ page }) => {
  test.setTimeout(90000)
  await page.route('**/api/academics', route => route.fulfill({ status: 503, json: { error: 'Temporary test outage' } }))
  await page.goto('/app')
  await page.getByRole('button', { name: 'Take a tour' }).click()
  const tour = page.locator('[data-dashboard-tour]')
  for (let index = 0; index < 4; index++) {
    if (index === 3) {
      // Calendar also reads academics; its error screen has no tour target.
      await tour.getByRole('button', { name: 'Skip this stop', exact: true }).click()
    } else {
      await expect(tour).toHaveAttribute('data-tour-state', 'ready')
      await tour.getByRole('button', { name: 'Next', exact: true }).click()
    }
  }
  await expect(page.getByText('Your record could not be read')).toBeVisible()
  await expect(tour).toHaveAttribute('data-tour-state', 'loading')
  await expect(page.locator('[data-tour-spotlight]')).toHaveCount(0)
  await expect(tour.getByRole('button', { name: 'Skip this stop', exact: true })).toBeEnabled()
  await tour.getByRole('button', { name: 'Skip this stop', exact: true }).click()
  await expect(tour.getByRole('heading', { name: 'Keep your sources current' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tour).toHaveCount(0)
})

test('sync log feedback belongs to page actions on desktop and mobile', async ({ page }) => {
  await page.route('**/api/account/integrations/canvas/corpus/logs?*', route => route.fulfill({ json: { available: true, jobs: [], events: [], nextCursor: null } }))
  await page.goto('/app/settings/canvas-sync/logs')
  const actions = page.getByLabel('Sync log actions')
  await expect(actions.getByRole('button', { name: 'Give feedback' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Canvas sync', exact: true })).toBeVisible()
  await actions.getByRole('button', { name: 'Give feedback' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(actions.getByRole('button', { name: 'Give feedback' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
