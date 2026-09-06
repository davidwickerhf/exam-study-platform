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
import { createQualityEvaluation, stepQualityEvaluation } from '../lib/study-quality-evaluation.mjs'
import { readFile } from 'node:fs/promises'
import { renderSlideBytes } from '../lib/course-slide-render.mjs'
import { attendanceOverview } from '../lib/attendance.mjs'
import { previewCourseBytes } from '../lib/course-file-preview.mjs'
if (process.env.DATABASE_URL)
  throw new Error('Browser fixtures require local document storage.')
const run = (fn) =>
  withRequestContext({ userId: 'study-e2e-fixture', mode: 'local' }, fn)
let versionId, evaluationId
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
    let evaluation = await createQualityEvaluation({}, { platform: { configured: true, provider: 'openai', model: 'gpt-5-mini' } })
    evaluationId = evaluation.id
    for (let i = 0; i < 3; i++) evaluation = await stepQualityEvaluation(evaluation.id, evaluation.revision, {
      generate: async () => ({ text: JSON.stringify(i === 0 ? lesson(['e-current']) : { issues: i === 1 ? [] : [
        { topicId: 'probability', severity: 'error', detail: 'Even outcomes have probability 1/2, not 2/3.' },
        { topicId: 'probability', severity: 'error', detail: 'Current exam duration is 120 minutes; the historical rules are outdated.' }
      ] }), usage: { inputTokens: 800, outputTokens: 1500, estimated: false } })
    })
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
test('private quality report renders real persisted checks, costs, citations and exercise solutions', async ({ page }) => {
  await page.goto(`/app/study-evaluations/${evaluationId}`)
  await expect(page.getByRole('heading', { name: 'Inspect the teaching, then check the evidence.' })).toBeVisible()
  await expect(page.getByText('3 calls recorded · $0.0096 recorded cost · complete')).toBeVisible()
  await expect(page.getByText('Even outcomes have probability 1/2, not 2/3.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: /Sources ·/ }).first().click()
  await expect(page.getByText('Current probability lecture', { exact: true }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Practice', exact: true }).click()
  await page.getByRole('button', { name: 'Show worked solution', exact: true }).click()
  await expect(page.getByText('Subtract three to verify the original two items.', { exact: false }).first()).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
test('material viewers render PDF and slide graphics, preserve extracted text, and show code and notebook outputs', async ({ page }) => {
  test.setTimeout(120000)
  const name = 'content/BCS1540 Algorithmic Design Knowledge Base/Materials/02 Lecture Slides/DP - Floyd-Warshall.pptx'
  const deck = await readFile(name), pdf = await renderSlideBytes(deck, name)
  const notebook = Buffer.from(JSON.stringify({ cells: [
    { cell_type:'markdown', source:['# Probability lab'] },
    { cell_type:'code', source:['print(3 / 6)'], outputs:[{text:['0.5'], data:{'text/html':'<script>window.notebookExecuted=true</script>'}}] }
  ], metadata:{language_info:{name:'python'}} }))
  const entries = [
    { assetId:'viewer-pdf', filename:'Course manual.pdf', mediaType:'application/pdf', bytes:pdf },
    { assetId:'viewer-ppt', filename:'Lecture slides.pptx', mediaType:'application/vnd.openxmlformats-officedocument.presentationml.presentation', bytes:deck },
    { assetId:'viewer-code', filename:'exercise.py', mediaType:'text/plain', bytes:Buffer.from('def probability(even, total):\n    return even / total\n') },
    { assetId:'viewer-notebook', filename:'Probability lab.ipynb', mediaType:'application/x-ipynb+json', bytes:notebook }
  ]
  // Browser routing replaces storage discovery only. The actual file parser,
  // LibreOffice conversion, PDF.js worker and viewer components all run.
  await page.route('**/api/calendar/events', async route => {
    const response=await route.fetch(), calendar=await response.json()
    const events=['Practical','Lecture','Tutorial'].map((activity,i)=>({id:`attendance-viewer-${i}`,courseCode:'BCS1520',title:activity,activity,start:`2026-09-0${i+1}T09:00:00Z`,end:`2026-09-0${i+1}T11:00:00Z`,attendanceEligible:true,category:'timetable'}))
    const report=attendanceOverview(events,[],[{code:'BCS1520',courseProfile:{assessment:{status:'confirmed',attendanceEvidence:[{activity:'lab',text:'Labs are mandatory.',evidence:[{chunkId:1}]},{activity:'lecture',text:'Lectures are optional.',evidence:[{chunkId:2}]}]}}}])
    await route.fulfill({json:{...calendar,events:report.events,attendance:{summary:report.summary,courses:report.courses}}})
  })
  await page.route('**/api/state', async route => {
    const response = await route.fetch(), state = await response.json()
    await route.fulfill({ json: { ...state, courses: [{id:'stats',code:'BCS1520',name:'Statistics',chapters:[],items:[]}] } })
  })
  await page.route('**/api/corpus/materials?*', route => route.fulfill({ json:{materials:entries.map(({bytes,...entry})=>({...entry,byteSize:bytes.length,academicYear:'2026-2027',period:'1',current:true,sourceType:'file',sourcePath:entry.filename,url:`/api/corpus/assets/${entry.assetId}`,downloadUrl:`/api/corpus/assets/${entry.assetId}?download=1`}))} }))
  await page.route('**/api/corpus/assets/**', async route => {
    const url=new URL(route.request().url()), id=url.pathname.split('/')[4], entry=entries.find(e=>e.assetId===id)
    if (!entry) return route.abort()
    if (url.pathname.endsWith('/preview')) return route.fulfill({ json:await previewCourseBytes(entry.bytes,entry.filename) })
    return route.fulfill({ body:url.pathname.endsWith('/slides.pdf') ? pdf : entry.bytes, contentType:url.pathname.endsWith('/slides.pdf') ? 'application/pdf' : entry.mediaType,
      headers:{'X-Frame-Options':'DENY','Content-Security-Policy':"frame-ancestors 'none'"} })
  })
  await page.goto('/app/courses/stats?year=2026-2027')
  await page.getByRole('tab',{name:'Materials',exact:true}).click()
  await page.getByRole('button',{name:/^Course manual /}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByRole('spinbutton',{name:'Page number'})).toHaveValue('1')
  await expect.poll(()=>dialog.locator('canvas').evaluate(c=>c.width)).toBeGreaterThan(100)
  await dialog.getByRole('button',{name:'Next page',exact:true}).click()
  await expect(dialog.getByRole('spinbutton',{name:'Page number'})).toHaveValue('2')
  await dialog.getByRole('button',{name:'Page text',exact:true}).click()
  await expect(dialog.getByText('Floyd-Warshall',{exact:false}).last()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button',{name:/^Lecture slides /}).click()
  await expect(dialog.getByRole('spinbutton',{name:'Slide number'})).toHaveValue('1')
  await dialog.getByRole('spinbutton',{name:'Slide number'}).fill('7')
  await expect(dialog.getByRole('status')).toHaveCount(0)
  await page.screenshot({path:'/tmp/wicker-slide-viewer.png'})
  await dialog.getByRole('button',{name:'Text and notes',exact:true}).click()
  await expect(dialog.getByText('The Floyd-Warshall algorithm',{exact:false}).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button',{name:/^exercise /}).click()
  await expect(dialog.getByText('def probability(even, total):',{exact:false})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button',{name:/^Probability lab /}).click()
  await expect(dialog.getByRole('heading',{name:'Probability lab',exact:true}).last()).toBeVisible()
  await expect(dialog.getByText('0.5',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>window.notebookExecuted)).toBeUndefined()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('tab',{name:'Attendance',exact:true}).click()
  await expect(page.getByText('Requirement unknown',{exact:true})).toBeVisible()
  await expect(page.getByText('Not required (source confirmed)',{exact:true})).toBeVisible()
  await expect(page.getByText('Required',{exact:true})).toBeVisible()

  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
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
  await expect(page.getByText('No AI usage quota applies to this account or environment.',{exact:false})).toBeVisible()
  await expect(page.getByLabel('Spending cap for this generation (USD)')).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: [...document.querySelectorAll('main *')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return (
          r.right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed'
        )
      })
      .slice(0, 15)
      .map((el) => ({
        tag: el.tagName,
        classes: el.className,
        text: el.textContent?.slice(0, 60)
      }))
  }))
  expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
    layout.width
  )
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

test('Home groups recurring rules and shows priorities from several courses with coverage', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-09-06T08:00:00Z'))
  const priorityCourses = [
    {id:'block',code:'BCS3210',name:'Block Chains',ruleAcademicYear:'2026-2027',courseProfile:{assessment:{status:'confirmed',attendanceRules:['Labs are mandatory.']}}},
    {id:'os',code:'BCS2140',name:'Operating Systems'},
    {id:'stats',code:'BCS1520',name:'Statistics'},
    {id:'ai',code:'BCS2120',name:'Artificial Intelligence'}
  ]
  await page.route('**/api/workspace-shell', async route => {
    const response=await route.fetch(), body=await response.json()
    await route.fulfill({json:{...body,priorityCourses}})
  })
  await page.route('**/api/calendar/events', async route => {
    const response=await route.fetch(),body=await response.json()
    const events=[9,16,23,30].map(day=>({id:`block-${day}`,category:'timetable',courseCode:'BCS3210',courseName:'Block Chains',title:'Lab',activity:'Lab',start:`2026-09-${day.toString().padStart(2,'0')}T09:00:00Z`,end:`2026-09-${day.toString().padStart(2,'0')}T11:00:00Z`}))
    events.push({id:'stats-exam',category:'exam',courseCode:'BCS1520',title:'Statistics exam',start:'2026-09-08T09:00:00Z'})
    await route.fulfill({json:{...body,events}})
  })
  await page.route('**/api/integrations/canvas/hub?*', route=>route.fulfill({json:{connected:true,assignments:[
    {id:'os-due',courseCode:'BCS2140',title:'OS assignment',status:'upcoming',dueAt:'2026-09-07T12:00:00Z'},
    {id:'ai-due',courseCode:'BCS2120',title:'AI assignment',status:'upcoming',dueAt:'2026-09-10T12:00:00Z'},
    {id:'later-os',courseCode:'BCS2140',title:'Later OS assignment',status:'upcoming',dueAt:'2026-09-18T12:00:00Z'},
    {id:'later-ai',courseCode:'BCS2120',title:'Later AI assignment',status:'upcoming',dueAt:'2026-09-20T12:00:00Z'}
  ]}}))
  await page.goto('/app')
  const priorities=page.locator('section').filter({has:page.getByRole('heading',{name:'Priorities',exact:true})})
  await expect(priorities.getByRole('listitem')).toHaveCount(4)
  await expect(priorities.getByText('Block Chains',{exact:true})).toHaveCount(1)
  await expect(priorities.getByRole('listitem').nth(0)).toContainText('OS assignment')
  await expect(priorities.getByRole('listitem').nth(1)).toContainText('Statistics exam')
  await expect(priorities.getByText('3 later sessions in your timetable')).toBeVisible()
  await expect(priorities).toContainText('Course rules available for 1 of 4 courses.')
  await expect(priorities).toContainText('4 shown · partial')
  await priorities.screenshot({path:'/tmp/wicker-home-priorities.png'})
  await priorities.getByRole('link',{name:'View all priorities →'}).click()
  await expect(page.getByRole('heading',{name:'Your priorities'})).toBeVisible()
  const all=page.getByRole('region',{name:'All priorities',exact:true})
  await expect(all.getByRole('listitem')).toHaveCount(6)
  await page.getByRole('combobox',{name:'Course',exact:true}).click()
  await page.getByRole('option',{name:'BCS2140',exact:true}).click()
  await expect(all.getByRole('listitem')).toHaveCount(2)
  await page.getByLabel('Search priorities').fill('Later')
  await expect(all.getByRole('listitem')).toHaveCount(1)
  await expect(all).toContainText('Later OS assignment')
  await page.screenshot({path:'/tmp/wicker-priorities-page.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})

test('calendar keeps mandatory attendance prominent and filters obligations in week and agenda', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-09-07T08:00:00Z'))
  await page.route('**/api/calendar/events',async route=>{
    const response=await route.fetch(),body=await response.json()
    const base={category:'timetable',courseCode:'BCS2140',courseName:'Operating Systems',allDay:false,attendanceEligible:true,notes:'Course timetable',source:'timetable'}
    const events=[
      {...base,id:'mandatory-lab',title:'OS practical',activity:'Practical',start:'2026-09-08T09:00:00Z',end:'2026-09-08T11:00:00Z',attendanceRequired:true,attendanceRule:'Labs are mandatory.',attendanceStatus:'attended',attendancePolicy:{source:'Verified course rule',allowedMisses:null,minimumAttendancePercent:null,excusedPolicy:'',evidence:[]}},
      {...base,id:'unknown-tutorial',title:'Tutorial',activity:'Tutorial',start:'2026-09-09T09:00:00Z',end:'2026-09-09T11:00:00Z',attendanceRequired:null},
      {...base,id:'dated-exam',title:'OS exam',category:'exam',attendanceEligible:false,start:'2026-09-10T09:00:00Z',end:'2026-09-10T11:00:00Z'}
    ]
    await route.fulfill({json:{...body,events}})
  })
  await page.goto('/app/calendar')
  const required=page.locator('[data-calendar-event-id="mandatory-lab"]')
  await expect(required).toContainText('Mandatory attendance')
  await expect(required).toContainText('attended')
  await expect(page.locator('[data-calendar-event-id="unknown-tutorial"]')).toContainText('Attendance requirement unknown')
  await page.getByRole('button',{name:'Obligations only',exact:true}).click()
  await expect(page.locator('[data-calendar-event-id="unknown-tutorial"]')).toHaveCount(0)
  await expect(required).toBeVisible()
  await expect(page.locator('[data-calendar-event-id="dated-exam"]')).toContainText('Exam')
  await required.click()
  await expect(page.getByRole('complementary',{name:'Day desk'}).getByText('Labs are mandatory.',{exact:true})).toBeVisible()
  await page.screenshot({path:'/tmp/wicker-calendar-obligations.png'})
  await page.getByRole('tab',{name:'Agenda',exact:true}).click()
  await expect(required).toContainText('Mandatory attendance')
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})

test('setup saves the record, continues to transcript, applies reordered reviewed results and moves on', async ({page}) => {
  // Real parsing, review/apply APIs and persistence. Only the unrelated source
  // connection flags are fixed to reproduce a partially completed setup.
  await page.route('**/api/onboarding',async route=>{
    const response=await route.fetch(),body=await response.json()
    await route.fulfill({json:{...body,state:{...body.state,programme:true,electives:true,calendar:true,timetable:false,canvas:false}}})
  })
  const reorder=value=>Array.isArray(value) ? value.map(reorder) : value&&typeof value==='object' ? Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reorder(item)])) : value
  await page.route('**/api/academics/documents/analyze',async route=>{
    const response=await route.fetch(),body=await response.json()
    await route.fulfill({response,json:{...body,changes:body.changes?.map(reorder)}})
  })
  await page.goto('/app/setup?step=record')
  const panel=page.getByRole('main')
  const record=`Maastricht University
printed on 30 Aug 2026
Example, Student (Stud. DACS)
i0000000
Bachelor of Science in Computer Science
Current courses
Course code Description Result Credits
2026-2027-100-BCS2140 Operating Systems - 0,0/4,0
Completed courses
Course code Description Result Credits
2024-2025-100-BCS1110 Foundations of Computing 8,0 4,0/4,0
This is not an official document issued by Maastricht University.`
  await panel.locator('input[type=file]').setInputFiles({name:'Academic Work.txt',mimeType:'text/plain',buffer:Buffer.from(record)})
  await expect(panel.getByText('Academic Work.txt',{exact:true})).toBeVisible()
  await expect(panel.getByRole('region',{name:'Document comparison'})).toHaveCount(0)
  await expect(panel.getByText(/Next, you can add a transcript/)).toBeVisible()
  await panel.getByRole('button',{name:'Continue to transcript',exact:true}).click()
  await expect(panel.getByRole('heading',{name:'Your transcript',exact:true})).toBeVisible()
  await expect(panel.getByRole('button',{name:'Do this later',exact:true})).toBeEnabled()
  await panel.getByRole('button',{name:'Do this later',exact:true}).click()
  await expect(panel.getByRole('heading',{name:'The academic calendar',exact:true})).toBeVisible()
  await panel.getByRole('button',{name:'Do this later',exact:true}).click()
  await expect(panel.getByRole('heading',{name:'Your timetable',exact:true})).toBeVisible()
  await page.getByRole('button',{name:/^Your transcript/}).click()
  const transcript='Transcript / Resultatenoverzicht\nBSc CS year 1 core courses\nFoundations of Computing 8,0 18.06.2025 4,00 4,00 1\nEND OF TRANSCRIPT'
  await panel.locator('input[type=file]').setInputFiles({name:'Transcript Example.txt',mimeType:'text/plain',buffer:Buffer.from(transcript)})
  await expect(panel.getByText('Results corroborated',{exact:true})).toBeVisible()
  const applied=page.waitForResponse(r=>r.url().endsWith('/api/academics/documents/apply')&&r.request().method()==='POST')
  await panel.getByRole('button',{name:/Apply \d+ changes?/}).click()
  const response=await applied
  expect(response.status(),await response.text()).toBe(200)
  await expect(panel.getByText('Transcript Example.txt',{exact:true}).first()).toBeVisible()
  await expect(panel.getByRole('button',{name:'Remove document',exact:true})).toBeVisible()
  await expect(panel.getByRole('button',{name:'Continue to timetable',exact:true})).toBeEnabled()
  await page.screenshot({path:'/tmp/wicker-setup-transcript-saved.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await panel.getByRole('button',{name:'Continue to timetable',exact:true}).click()
  await expect(panel.getByRole('heading',{name:'Your timetable',exact:true})).toBeVisible()
})

test('long transcript changes and comparisons use page scrolling', async ({page})=>{
  await page.route('**/api/onboarding',async route=>{
    const response=await route.fetch(),body=await response.json()
    await route.fulfill({json:{...body,state:{...body.state,programme:true,electives:true,transcript:false,transcriptDocument:null,timetable:false,canvas:false}}})
  })
  // A long review fixture isolates the layout without changing real grades.
  const result={grade:8,status:'passed',creditsEarned:4,creditsTotal:4}
  await page.route('**/api/academics/documents/analyze',route=>route.fulfill({json:{
    revision:1,reviewIds:['layout-only'],warnings:[],
    changes:Array.from({length:40},(_,i)=>({id:`layout:${i}`,label:`Course ${i+1}: exam date`,detail:'Reviewed transcript date'})),
    documentCheck:{status:'confirmed',message:'Results agree.',recordCredits:160,transcriptCredits:160,counts:{confirmed:40},issues:[],checks:Array.from({length:40},(_,i)=>({status:'confirmed',course:`COURSE${i+1}`,name:`Course ${i+1}`,academicYear:'2025-2026',transcript:result,record:[result]}))}
  }}))
  await page.goto('/app/setup?step=transcript')
  await page.getByRole('main').locator('input[type=file]').setInputFiles({name:'Long transcript.txt',mimeType:'text/plain',buffer:Buffer.from('Transcript layout fixture')})
  const changes=page.getByRole('list',{name:'Proposed transcript changes'})
  await expect(changes.getByRole('listitem')).toHaveCount(40)
  await page.getByText('40 results agree · Inspect all 40 comparisons',{exact:true}).click()
  const comparisons=page.getByRole('list',{name:'Compared results'})
  await expect(comparisons.getByRole('listitem')).toHaveCount(40)
  for (const width of [1280,390]) {
    await page.setViewportSize({width,height:844})
    for (const list of [changes,comparisons]) {
      await expect.poll(()=>list.evaluate(element=>element.scrollHeight<=element.clientHeight+1)).toBe(true)
      await list.getByRole('listitem').last().scrollIntoViewIfNeeded()
      await expect(list.getByRole('listitem').last()).toBeVisible()
    }
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  }
})
