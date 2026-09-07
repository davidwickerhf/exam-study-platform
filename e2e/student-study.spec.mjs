import { activeProgrammeId } from '../lib/programme-scope.mjs'
import { mutateStudyVersion } from '../lib/study-version-store.mjs'
import { randomUUID } from 'node:crypto'
import { createStudyPractice, stepStudyPractice } from '../lib/study-practice.mjs'
import { studyRevision } from '../lib/study-version-store.mjs'
import { removeOriginal } from '../lib/academic-originals.mjs'
import { test, expect } from '@playwright/test'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, writeDocument, readDocument } from '../lib/user-store.mjs'
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
function previewPdf(label, pageCount=1) {
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${Array.from({length:pageCount},(_,i)=>`${4+i*2} 0 R`).join(' ')}] /Count ${pageCount} >>`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  for(let i=0;i<pageCount;i++){
    const stream=`BT /F1 16 Tf 30 230 Td (${label}${pageCount>1 ? ` page ${i+1}` : ''}) Tj ET`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+i*2} 0 R >>`,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  }
  let pdf='%PDF-1.4\n';const offsets=[0]
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`})
  const xref=Buffer.byteLength(pdf),size=objects.length+1
  pdf+=`xref\n0 ${size}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return pdf
}
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
        { topicId: 'probability', severity: 'error', detail: 'Current exam duration is 120 minutes; the historical rules are outdated.' },
        { topicId:'probability', severity:'error', detail:'The visual includes odd face 1 in the even set; its membership is incorrect.' }
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
  await page.getByRole('tab', { name: /^Practice \(\d+\)$/ }).click()
  await page.getByRole('button', { name: 'Show worked solution', exact: true }).click()
  await expect(page.getByText('Subtract three to verify the original two items.', { exact: false }).first()).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', {name:'Recheck this chapter'}).click()
  await expect(page.getByText('Reuses the exact chapter from', {exact:false})).toBeVisible()
  await expect(page.getByText('0 calls recorded · $0.0000 recorded cost · pending')).toBeVisible()
  await expect(page.getByRole('button', {name:'Review against sources'})).toBeVisible()
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
  await expect(page.getByRole('button',{name:/^Course manual /})).toBeVisible()
  await page.screenshot({path:'/tmp/wicker-course-materials-desktop.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/wicker-course-materials-mobile.png',fullPage:true})
  await page.setViewportSize({width:1280,height:900})
  await page.getByRole('button',{name:/^Course manual /}).click()
  const dialog=page.getByRole('complementary',{name:'Reference document'})
  await expect(dialog.getByRole('spinbutton',{name:'Page number'})).toHaveValue('1')
  await expect.poll(()=>dialog.locator('canvas').first().evaluate(c=>c.width)).toBeGreaterThan(100)
  await dialog.getByRole('button',{name:'Next page',exact:true}).click()
  await expect(dialog.getByRole('spinbutton',{name:'Page number'})).toHaveValue('2')
  await dialog.getByRole('button',{name:'Page text',exact:true}).click()
  await expect(dialog.getByText('Floyd-Warshall',{exact:false}).last()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button',{name:/^Lecture slides /}).click()
  await expect(dialog.getByRole('spinbutton',{name:'Slide number'})).toHaveValue('1')
  await dialog.getByRole('spinbutton',{name:'Slide number'}).fill('7')
  await dialog.getByRole('spinbutton',{name:'Slide number'}).press('Enter')
  await expect(dialog.getByRole('status')).toHaveCount(0)
  await page.screenshot({path:'/tmp/wicker-slide-viewer.png'})
  await dialog.getByRole('button',{name:'Text and notes',exact:true}).click()
  await expect(dialog.getByText('The Floyd-Warshall algorithm',{exact:false}).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button',{name:/^exercise /}).click()
  await expect(dialog.getByText('def probability(even, total):',{exact:false})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button',{name:/^Probability lab /}).click()
  await expect(dialog.getByRole('heading',{name:'Probability lab',exact:true}).last()).toBeVisible()
  await expect(dialog.getByText('0.5',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>window.notebookExecuted)).toBeUndefined()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await page.getByRole('tab',{name:'Attendance',exact:true}).click()
  await expect(page.getByText('Requirement unknown',{exact:true})).toBeVisible()
  await expect(page.getByText('Not required (source confirmed)',{exact:true})).toBeVisible()
  await expect(page.getByText('Required',{exact:true})).toBeVisible()
  await page.screenshot({path:'/tmp/wicker-course-attendance-desktop.png',fullPage:true})

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
  await page.getByRole('tab', { name: /^Practice \(\d+\)$/ }).click()
  await page
    .getByLabel('Your practice answer', { exact: true })
    .fill('Five, because the groups do not overlap.')
  await page.getByRole('button', { name: 'Save answer', exact: true }).click()
  await expect(
    page.getByRole('heading', {name:'Answer saved',exact:true})
  ).toBeVisible()
  await page.getByRole('button', { name: 'Show worked solution' }).click()
  await expect(
    page.getByText('Subtract three to verify', { exact: false })
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Build practice exam', exact: true }).click()
  await page
    .getByRole('button', { name: 'Build a 10-question practice exam' })
    .click()
  await page
    .getByLabel('Your answer', { exact: true })
    .fill('Subtract one group to check the other.')
  for (let i = 0; i < 7; i++)
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
  await panel.getByRole('button',{name:'View document',exact:true}).click()
  const recordPreview=page.getByRole('dialog',{name:'Academic Work.txt',exact:true})
  await expect(recordPreview.locator('pre')).toContainText('Operating Systems')
  await recordPreview.getByRole('button',{name:'Done reviewing',exact:true}).click()
  await expect(recordPreview).not.toBeVisible()
  await expect.poll(async()=>{const response=await page.request.get('/api/onboarding/documents/record/original');return Boolean((await response.json()).original)}).toBe(true)
  // Reload proves the original comes from private storage, not component memory.
  await page.reload()
  await expect(panel.getByRole('button',{name:'View document',exact:true})).toBeEnabled()
  const writes=[]
  const observe=request=>{if(request.method()!=='GET' && /\/api\/(academics|onboarding)/.test(request.url()))writes.push(request.url())}
  page.on('request',observe)
  await panel.getByRole('button',{name:'View document',exact:true}).click()
  await expect(recordPreview.locator('pre')).toContainText('Operating Systems')
  await recordPreview.getByRole('button',{name:'Done reviewing',exact:true}).click()
  await expect(recordPreview).not.toBeVisible()
  const downloadEvent=page.waitForEvent('download')
  await panel.getByRole('button',{name:'Download document',exact:true}).click()
  const download=await downloadEvent
  expect(download.suggestedFilename()).toBe('Academic Work.txt')
  expect((await readFile(await download.path())).toString()).toBe(record)
  expect(writes).toEqual([])
  page.off('request',observe)
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

test('transcript side panels keep setup compact, preserve selection and render the original PDF', async ({page})=>{
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
  const pdf=previewPdf('Transcript preview fixture')
  await page.goto('/app/setup?step=transcript')
  const main=page.getByRole('main')
  await main.locator('input[type=file]').setInputFiles({name:'Long transcript.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)})
  await expect(main.getByRole('button',{name:'Apply 40 changes',exact:true})).toBeEnabled()
  await expect(main.getByRole('list',{name:'Proposed transcript changes'})).toHaveCount(0)
  await expect(main.getByRole('list',{name:'Compared results'})).toHaveCount(0)
  for (const width of [1280,390]) {
    await page.setViewportSize({width,height:844})
    await main.getByRole('button',{name:'Review 40 changes',exact:true}).click()
    const drawer=page.getByRole('dialog',{name:'Review transcript changes',exact:true})
    await expect(drawer.getByRole('listitem')).toHaveCount(40)
    await drawer.getByRole('checkbox').first().uncheck()
    await drawer.getByRole('listitem').last().scrollIntoViewIfNeeded()
    await expect(drawer.getByRole('listitem').last()).toBeVisible()
    await expect(drawer.getByRole('button',{name:'Done reviewing',exact:true})).toBeInViewport()
    if(width===390) await page.screenshot({path:'/tmp/wicker-transcript-drawer-mobile.png'})
    await drawer.getByRole('button',{name:'Done reviewing',exact:true}).click()
    await expect(main.getByRole('button',{name:'Apply 39 changes',exact:true})).toBeEnabled()
    if(width===1280) {
      const downloaded=page.waitForEvent('download')
      await main.getByRole('button',{name:'Download document',exact:true}).click()
      expect(await readFile(await (await downloaded).path())).toEqual(Buffer.from(pdf))
    }
    await main.getByRole('button',{name:'Compare 40 results',exact:true}).click()
    const comparison=page.getByRole('dialog',{name:'Compare document results',exact:true})
    await expect(comparison.getByRole('listitem')).toHaveCount(40)
    await comparison.getByRole('listitem').last().scrollIntoViewIfNeeded()
    await expect(comparison.getByRole('listitem').last()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(main.getByRole('button',{name:'Compare 40 results',exact:true})).toBeFocused()
    await main.getByRole('button',{name:'View document',exact:true}).click()
    const original=page.getByRole('dialog',{name:'Long transcript.pdf',exact:true})
    await expect(original.getByRole('region',{name:'Page 1',exact:true})).toBeVisible()
    await expect.poll(()=>original.locator('canvas').first().evaluate(element=>element.width)).toBeGreaterThan(0)
    if(width===1280) await page.screenshot({path:'/tmp/wicker-transcript-original-pdf.png'})
    await original.getByRole('button',{name:'Page text',exact:true}).click()
    await expect(original.getByText('Transcript preview fixture',{exact:true})).toBeVisible()
    await original.getByRole('button',{name:'Done reviewing',exact:true}).click()
    await expect(original).not.toBeVisible()
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    // Forty rows should not increase the height of the setup card.
    expect(await main.evaluate(element=>element.getBoundingClientRect().height)).toBeLessThan(1000)
    if(width===1280) await page.screenshot({path:'/tmp/wicker-transcript-compact.png',fullPage:true})
  }
})


test('saved Academic Work keeps forty curriculum changes in a side panel before continuing', async ({page})=>{
  await page.route('**/api/onboarding',async route=>{
    const response=await route.fetch(),body=await response.json()
    await route.fulfill({json:{...body,skipped:[],state:{...body.state,programme:true,electives:true,record:true,recordDocument:{name:'Academic Work.pdf',createdAt:'2026-09-06T12:00:00Z'},transcript:false,transcriptDocument:null,issues:[],curriculumReconciliation:{currentCount:40,recognizedCount:40,outsideCount:0,otherYearCount:0,historicalCount:40,changes:Array.from({length:40},(_,i)=>({id:`history-${i}`,name:`Historical course ${i+1}`,placements:[{versionId:'2025-2026',code:`BCS${i}`,yearLevel:2,period:1}]}))}}}})
  })
  await page.goto('/app/setup?step=record')
  const main=page.getByRole('main')
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:844})
    await expect(main.getByRole('button',{name:'Continue to transcript',exact:true})).toBeEnabled()
    await expect(main.getByRole('list',{name:'Historical curriculum changes'})).toHaveCount(0)
    await main.getByRole('button',{name:'Review 40 historical changes',exact:true}).click()
    const drawer=page.getByRole('dialog',{name:'Curriculum changes',exact:true})
    await expect(drawer.getByRole('listitem')).toHaveCount(40)
    await drawer.getByRole('listitem').last().scrollIntoViewIfNeeded()
    await expect(drawer.getByRole('button',{name:'Done reviewing',exact:true})).toBeInViewport()
    await drawer.getByRole('button',{name:'Done reviewing',exact:true}).click()
    await expect(drawer).not.toBeVisible()
    expect(await main.evaluate(element=>element.getBoundingClientRect().height)).toBeLessThan(1000)
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    if(width===1280) await page.screenshot({path:'/tmp/wicker-academic-work-compact.png',fullPage:true})
  }
  await main.getByRole('button',{name:'Continue to transcript',exact:true}).click()
  await expect(main.getByRole('heading',{name:'Your transcript',exact:true})).toBeVisible()
})


test('legacy original restoration persists a real PDF for view and download, and removal erases it',async({page})=>{
  await run(()=>removeOriginal('record'))
  await page.route('**/api/onboarding',async route=>{
    const response=await route.fetch(),body=await response.json()
    await route.fulfill({json:{...body,state:{...body.state,programme:true,electives:true}}})
  })
  await page.goto('/app/setup?step=record')
  const main=page.getByRole('main')
  await expect(main.getByRole('button',{name:'View document',exact:true})).toBeDisabled()
  await expect(main.getByRole('button',{name:'Download document',exact:true})).toBeDisabled()
  await expect(main.getByRole('button',{name:'Restore original',exact:true})).toBeVisible()
  const pdf=Buffer.from(previewPdf('Saved Academic Work original'))
  const mutations=[]
  page.on('request',request=>{if(request.method()!=='GET'&&/\/api\/(academics|onboarding)/.test(request.url())&&!request.url().includes('/original'))mutations.push(request.url())})
  await main.getByLabel('Restore original document').setInputFiles({name:'Academic Work.pdf',mimeType:'application/pdf',buffer:pdf})
  await expect(main.getByRole('button',{name:'Download document',exact:true})).toBeEnabled()
  expect(mutations).toEqual([])
  await page.reload()
  await main.getByRole('button',{name:'View document',exact:true}).click()
  const drawer=page.getByRole('dialog',{name:'Academic Work.pdf',exact:true})
  await expect(drawer.getByRole('region',{name:'Page 1',exact:true})).toBeVisible()
  await expect.poll(() => drawer.locator('[data-pdf-page="1"] canvas').evaluate(canvas => canvas.width)).toBeGreaterThan(0)
  await page.screenshot({path:'/tmp/wicker-saved-original-panel.png'})
  await drawer.getByRole('button',{name:'Done reviewing',exact:true}).click()
  await expect(drawer).not.toBeVisible()
  const downloaded=page.waitForEvent('download')
  await main.getByRole('button',{name:'Download document',exact:true}).click()
  expect(await readFile(await (await downloaded).path())).toEqual(pdf)
  await page.screenshot({path:'/tmp/wicker-document-icon-actions.png',fullPage:true})
  const original=(await (await page.request.get('/api/onboarding/documents/record/original')).json()).original
  await main.getByRole('button',{name:'Remove document',exact:true}).click()
  await expect(main.getByLabel('Your Academic Work PDF',{exact:true})).toBeVisible()
  expect((await page.request.get(`/api/onboarding/documents/record/original/${original.id}/chunks/0`)).status()).toBe(404)
})

test('guided lesson exposes interactive diagrams, optional depth and progressive practice on desktop and mobile', async ({ page }) => {
  await page.setViewportSize({width:1600,height:1000})
  await page.goto(`/app/study/${versionId}`)
  await expect(page.getByText('By the end, you can')).toBeVisible()
  await expect(page.locator('article header li .katex').first()).toBeVisible()
  const definition = page.getByRole('complementary', {name:'Definition: Adding disjoint groups'})
  await expect(definition).toBeVisible()
  await expect(definition.locator('.katex-display')).toBeVisible()
  await expect(definition).toContainText('A ∩ B')
  await expect(definition).not.toContainText('\\cap')
  await expect(definition.getByRole('button', {name:/Sources/})).toBeVisible()
  const figure = page.getByRole('complementary', {name:'Visual explanation'})
  await expect(figure.locator('[data-study-visual="process"] svg')).toBeVisible()
  await expect(figure.locator('foreignObject .katex').first()).toBeVisible()
  await expect(figure.locator('figcaption .katex')).toBeVisible()
  await figure.getByRole('button', {name:'3. 5 items'}).click()
  await expect(figure.getByText('The total combines both groups; subtract three to recover two.').first()).toBeVisible()
  await page.getByText('Go deeper: Reasoning', {exact:true}).click()
  await expect(page.getByText('Subtraction gives an independent check:', {exact:false})).toBeVisible()
  await page.locator('[data-story-section="2"]').scrollIntoViewIfNeeded()
  await expect(figure).toHaveAttribute('data-active-story-section','2')
  await page.getByRole('tab', {name:/^Summary$/}).click()
  await expect(page.getByText('If groups overlap, first remove the shared members', {exact:false})).toBeVisible()
  await page.getByRole('tab', {name:/^Practice \(8\)$/}).click()
  await page.getByText('Need a hint?',{exact:true}).click()
  await expect(page.getByText('Check which items and units', {exact:false})).toBeVisible()
  for (let i=0;i<6;i++) await page.getByRole('button',{name:'Next question',exact:true}).click()
  await expect(page.getByText('challenge',{exact:true})).toBeVisible()
  await expect(page.getByText('Design a test that distinguishes', {exact:false})).toBeVisible()
  await page.getByRole('tab',{name:/^Flashcards \(12\)$/}).click()
  await expect(page.getByText('Card 1 of 12')).toBeVisible()
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click()
  await expect(page.getByText('Quantities expressed in matching units.',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Next card',exact:true}).click()
  await expect(page.getByRole('button',{name:'Reveal answer',exact:true})).toBeVisible()
  await page.setViewportSize({width:390,height:844})
  await page.getByRole('tab',{name:'Learn',exact:true}).click()
  const mobileFigure=page.locator('[data-story-section="2"] [data-study-visual="process"]')
  await mobileFigure.scrollIntoViewIfNeeded()
  await expect(mobileFigure.locator('svg')).toBeVisible()
  await mobileFigure.getByRole('button',{name:'2. Add 3'}).click()
  await expect(mobileFigure.getByText('Combine the second group, counting every item once.').first()).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/wicker-guided-lesson-mobile.png',fullPage:true})
})

test('chapter feedback proposes changes for review without a separate manual editor', async ({ page }) => {
  await page.goto(`/app/study/${versionId}`)
  const edited = await page.request.get(`/api/study-versions/${versionId}`).then(r => r.json())
  await expect(page.getByRole('button', { name: 'Edit chapter', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Improve chapter', exact: true }).click()
  const panel = page.getByRole('dialog')
  await expect(panel.getByRole('heading', { name: 'Improve chapter' })).toBeVisible()
  await expect(panel.getByLabel('Your wording')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Add a worked example', exact: true }).click()
  await expect(panel.getByLabel('What should change?')).toHaveValue('Add a worked example')
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
  // Fixture only replaces the provider call. The proposal persistence and
  // apply/discard HTTP routes below use the same runtime as production.
  await run(async () => {
    const { improveStudyChapter } = await import('../lib/study-version-editing.mjs')
    await improveStudyChapter(versionId, { baseRevisionId: edited.revision.id, topicId: edited.revision.chapters[0].id, feedback: 'Add a worked example' })
    for (let i = 0; i < 6; i++) await processStudyStep(versionId, { generate: async prompt => {
      if (prompt.includes('Independently check')) return { issues: [] }
      const result = lesson(edited.revision.snapshot.chunks.map(c => c.id))
      result.sections[0].text += ' A newly proposed worked example explains this calculation.'
      return result
    } })
  })
  await page.reload()
  await page.getByRole('button', { name: 'Review proposed changes', exact: true }).click()
  await expect(panel.getByRole('heading', { name: 'Review proposed changes' })).toBeVisible()
  expect((await panel.boundingBox()).width).toBeGreaterThanOrEqual(850)
  await panel.getByRole('tab', { name: 'Full chapter preview' }).click()
  await expect(panel.getByText('A newly proposed worked example', { exact: false })).toBeVisible()
  const pending = await page.request.get(`/api/study-versions/${versionId}`).then(r => r.json())
  expect(pending.version.activeRevisionId).toBe(edited.revision.id)
  await panel.getByRole('button', { name: 'Apply chapter update', exact: true }).click()
  await expect(panel).not.toBeVisible()
  await expect(page.getByText('A newly proposed worked example', { exact: false })).toBeVisible()
  const applied = await page.request.get(`/api/study-versions/${versionId}`).then(r => r.json())
  expect(applied.version.activeRevisionId).toBe(pending.proposal.id)
  await page.getByRole('combobox', { name: 'Version history' }).click()
  await page.getByRole('option').filter({ hasText: edited.version.history[0].edit?.label || 'Generated revision' }).first().click()
  await page.getByRole('button', { name: 'Restore this revision' }).click()
  await expect(page.getByText('A newly proposed worked example', { exact: false })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Improve chapter', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Generate proposal', exact: true })).toBeInViewport()
  expect(Math.round((await panel.boundingBox()).width)).toBe(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('chapter workspace restores course papers, free answer-key grading, source inspection and tutor panel', async ({page}) => {
  await run(async () => { const programmeId = await activeProgrammeId(); await mutateStudyVersion(versionId, v => { v.programmeId = programmeId }) })
  await page.route('**/api/state', route => route.fulfill({json:{courses:[{id:course.courseCode,code:course.courseCode,name:course.courseName,chapters:[],items:[]}]}}))
  let setId, secondSetId
  await run(async()=>{
    const v=await ownStudyVersion(versionId),revision=await studyRevision(v)
    const paper=await addStudyNote({...course,title:'Mock exam fixture'},[{page:2,text:'1(a) Select the result of 2 + 3. A: 4 B: 5 [2 marks]. Answer: B, five.'}])
    const set=await createStudyPractice(versionId,{revisionId:revision.id,topicId:revision.chapters[0].id,mode:'extract',questionSourceKey:paper.id},{billing:{source:'platform',model:'gpt-5-mini',maxJobUsd:1}})
    setId=set.id
    const snapshot=await readStudySourceSnapshot(course,[paper.id]),id=snapshot.chunks[0].id
    await stepStudyPractice(versionId,set.id,{generate:async()=>JSON.stringify({title:'Arithmetic mock exam',questions:[{label:'1(a)',question:'Select the result of 2 + 3.',sharedContext:'',type:'mc',options:['4','5'],correctOptions:[1],marks:2,page:2,answer:'Five.',answerBasis:'source',hint:'',difficulty:'foundation',sourceIds:[id],answerSourceIds:[id],needsOriginal:false}],warnings:[]})})
    await stepStudyPractice(versionId,set.id,{generate:async()=>JSON.stringify({issues:[]})})
    const record=await readDocument('study-practice',set.id)
    record.snapshot.sources[0]={...record.snapshot.sources[0],title:'Mock exam fixture.pdf',url:'/api/test-original-paper.pdf'}
    await writeDocument('study-practice',set.id,record)
    secondSetId='sp-'+randomUUID()
    await writeDocument('study-practice',secondSetId,{...record,id:secondSetId,createdAt:new Date(Date.parse(record.createdAt)-1000).toISOString(),result:{...record.result,title:'Another paper section'}})

  })
  await page.route('**/api/account/ai',async route=>{const response=await route.fetch();const body=await response.json();await route.fulfill({json:{...body,platform:{...body.platform,provider:'openai'}}})})
  await page.route('**/api/test-original-paper.pdf',route=>route.fulfill({contentType:'application/pdf',body:previewPdf('Original exam',24)}))
  await page.route('**/api/study-versions/course-papers?*', async route => {
    const response = await route.fetch(), bank = await response.json()
    await route.fulfill({ json: { ...bank, papers: bank.papers.map(p => p.title === 'Mock exam fixture' ? { ...p, title: 'Mock exam fixture.pdf', url: '/api/test-original-paper.pdf' } : p) } })
  })
  await page.goto(`/app/courses/${course.courseCode}?tab=papers&year=${course.academicYear}`)
  await expect(page.getByRole('tab',{name:'Mock papers',exact:true})).toHaveAttribute('aria-selected','true')
  await expect(page.getByRole('region',{name:'Past paper library'})).toBeVisible()
  await expect(page.getByText('What does the Turing Test evaluate?',{exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'View teaching source',exact:true})).toHaveCount(0)
  await page.getByRole('button', { name: 'View paper', exact: true }).click()
  const focusedPaper = page.getByRole('complementary', { name: 'Reference document', exact: true })
  await expect(focusedPaper.getByRole('button', { name: 'Split view', exact: true })).toBeVisible()
  await expect.poll(() => focusedPaper.evaluate(el => Math.abs(el.getBoundingClientRect().bottom - innerHeight))).toBeLessThanOrEqual(2)
  await expect(focusedPaper.locator('[data-pdf-page="1"] .pdf-reader-text')).toContainText('Original exam page 1')
  await expect(page.getByRole('region', { name: 'Past paper library' })).not.toBeVisible()
  await focusedPaper.getByRole('button', { name: 'Close reference', exact: true }).click()

  await page.screenshot({path:'/tmp/wicker-paper-library-desktop.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/wicker-paper-library-mobile.png',fullPage:true})
  await page.setViewportSize({width:1280,height:900})
  await page.getByRole('button',{name:'Details for Mock exam fixture',exact:true}).click()
  await page.getByRole('button',{name:'Syllabus fit',exact:true}).click()
  await expect(page.getByRole('dialog').getByText('No current syllabus or assessment document is available.',{exact:false})).toBeVisible()
  await expect(page.getByRole('button',{name:'Check syllabus fit',exact:true})).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Mock exam fixture',exact:true})).toBeVisible()
  const sections=page.getByRole('combobox',{name:'Prepared questions for Mock exam fixture',exact:true})
  await sections.selectOption(secondSetId)
  await page.getByRole('button',{name:'Practise',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Another paper section',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'All past papers',exact:true}).click()
  await page.getByRole('button',{name:'Details for Mock exam fixture',exact:true}).click()
  await page.getByRole('combobox',{name:'Prepared questions for Mock exam fixture',exact:true}).selectOption(setId)
  await expect(page.getByRole('button',{name:'Prepare another section',exact:true})).toBeVisible()
  await page.screenshot({path:'/tmp/wicker-paper-detail-desktop.png'})
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/wicker-paper-detail-mobile.png'})
  await page.setViewportSize({width:1280,height:900})
  await page.getByRole('button',{name:'Practise',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Arithmetic mock exam',exact:true})).toBeVisible()
  await expect(page.getByRole('combobox',{name:'Exercise set',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'All past papers',exact:true}).click()
  await page.goto(`/app/study/${versionId}`)
  await page.getByRole('button',{name:'Ask AI tutor',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Course tutor',exact:true})).toBeVisible()
  await expect(page.getByRole('complementary',{name:'Course tutor',exact:true})).toBeVisible()
  await page.getByRole('complementary',{name:'Course tutor',exact:true}).getByRole('button',{name:'Close reference',exact:true}).click()
  await page.getByRole('tab',{name:/^Practice \(\d+\)$/}).click()
  await page.getByRole('combobox',{name:'Exercise set',exact:true}).selectOption(setId)
  await expect(page.getByText('Extracted course paper',{exact:true})).toBeVisible()
  await expect(page.getByText('2 marks · Page 2',{exact:true})).toBeVisible()
  await page.getByRole('radio',{name:'5',exact:true}).check()
  await page.getByRole('button',{name:'Check answer & save',exact:true}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'2 / 2 · Practice assessment',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'View question paper',exact:true}).click()
  await expect(page.getByRole('complementary',{name:'Reference document',exact:true}).getByLabel('Page number')).toHaveValue('2')
  await expect.poll(()=>page.getByRole('complementary',{name:'Reference document',exact:true}).locator('canvas').first().evaluate(el=>el.width)).toBeGreaterThan(100)
  await expect(page.getByRole('complementary',{name:'Reference document',exact:true}).locator('[data-pdf-page="2"] canvas')).toBeVisible()
  await expect(page.getByRole('radio',{name:'5',exact:true})).toBeChecked()
  const reader=page.getByRole('complementary',{name:'Reference document',exact:true})
  await expect(reader.locator('[data-pdf-page="2"] .pdf-reader-text')).toContainText('Original exam page 2')
  const splitWidth=await reader.evaluate(el=>el.getBoundingClientRect().width)
  await reader.getByRole('button',{name:'Focus document',exact:true}).click()
  await expect.poll(()=>reader.evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(splitWidth*1.8)
  await reader.getByRole('combobox',{name:'Zoom',exact:true}).selectOption('page')
  await reader.getByRole('spinbutton',{name:'Page number'}).fill('1')
  await reader.getByRole('spinbutton',{name:'Page number'}).press('Enter')
  await expect(reader.getByRole('spinbutton',{name:'Page number'})).toHaveValue('1')
  await reader.getByRole('button',{name:'Find in document',exact:true}).click()
  await reader.getByRole('textbox',{name:'Search document',exact:true}).fill('page 24')
  await reader.getByRole('button',{name:'Find',exact:true}).click()
  await expect(reader.getByText('1 matching page',{exact:true})).toBeVisible()
  await expect(reader.getByRole('spinbutton',{name:'Page number'})).toHaveValue('24')
  await expect.poll(()=>reader.locator('canvas').count()).toBeLessThan(10)
  await reader.getByRole('button',{name:'Page thumbnails',exact:true}).click()
  await reader.getByRole('button',{name:'Go to page 1',exact:true}).click()
  await expect(reader.getByRole('spinbutton',{name:'Page number'})).toHaveValue('1')
  await reader.getByRole('button',{name:'Page thumbnails',exact:true}).click()
  await reader.getByRole('button',{name:'Close search',exact:true}).click()
  await reader.getByRole('button',{name:'Split view',exact:true}).click()
  await expect(page.getByRole('radio',{name:'5',exact:true})).toBeInViewport()
  await page.screenshot({path:'/tmp/wicker-pdf-reader-desktop.png'})
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/wicker-pdf-reader-mobile.png'})
  await page.getByRole('button',{name:'Your work',exact:true}).click()
  await expect(page.getByRole('radio',{name:'5',exact:true})).toBeChecked()
  await page.getByRole('button',{name:'Document',exact:true}).click()
  await page.setViewportSize({width:1280,height:900})
  await page.getByRole('complementary',{name:'Reference document',exact:true}).getByRole('tab',{name:'Extracted text',exact:true}).click()
  await expect(page.getByText('1(a) Select the result of 2 + 3. A: 4 B: 5 [2 marks]. Answer: B, five.',{exact:true})).toBeVisible()
  await reader.getByRole('button',{name:'Close reference',exact:true}).click()
  await page.reload()
  await page.getByRole('tab',{name:/^Practice \(\d+\)$/}).click()
  await page.getByRole('combobox',{name:'Exercise set',exact:true}).selectOption(setId)
  await expect(page.getByRole('heading',{name:'2 / 2 · Practice assessment',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Change AI preferences',exact:true}).click()
  await page.getByRole('dialog').getByLabel('Generation quality').selectOption('enhanced')
  await page.getByRole('dialog').getByRole('button',{name:'Save AI preferences',exact:true}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const saved=await page.request.get('/api/account/ai/preferences').then(r=>r.json())
  expect(saved.revision).toBeTruthy()
  expect(saved.quality).toBe('enhanced')
  await page.reload()
  const reloaded=await page.request.get('/api/account/ai/preferences').then(r=>r.json())
  expect(reloaded).toEqual(saved)
  await page.getByRole('tab',{name:/^Practice \(\d+\)$/}).click()
  await page.getByRole('combobox',{name:'Exercise set',exact:true}).selectOption(setId)
  await page.getByRole('radio',{name:'4',exact:true}).check()
  const request=page.waitForRequest(r=>r.url().endsWith('/assess')&&r.method()==='POST')
  await page.getByRole('button',{name:'Check answer & save',exact:true}).click()
  expect((await request).postDataJSON().quality).toBe('enhanced')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'0 / 2 · Practice assessment',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Add practice set',exact:true}).click()
  await expect(page.getByRole('dialog').getByLabel('Generation quality')).toHaveValue('enhanced')
  await expect(page.getByRole('radio',{name:'Course paper or exercise sheet',exact:true})).toBeChecked()
  await page.getByRole('radio',{name:'Generate additional exercises',exact:true}).check()
  await expect(page.getByRole('button',{name:'Generate and check exercises',exact:true})).toBeVisible()
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})


test('course exercises reuse Practice, include personal guides and keep course navigation compact', async ({ page }) => {
  await run(async () => {
    const v = await ownStudyVersion(versionId), r = await studyRevision(v), c = r.chapters[0]
    const id = `sp-${randomUUID()}`
    await writeDocument('study-practice', id, { id, revision: randomUUID(), kind: 'set', mode: 'generate', versionId, revisionId: r.id, topicId: c.id, chapterTitle: c.title, course: r.course, snapshot: r.snapshot, status: 'complete', createdAt: new Date().toISOString(), result: { title: 'Additional calculation practice', questions: [{ id: 'q-choice', question: 'Choose the sum of two and three.', answer: 'Five, because the disjoint groups contain five items in total.', type: 'mc', options: ['4', '5'], correctOptions: [1], marks: 2, sourceIds: r.snapshot.chunks.map(c => c.id), answerSourceIds: [], answerBasis: 'generated', needsOriginal: false, difficulty: 'standard' }], warnings: [] } })
  })
  await run(async () => { const programmeId = await activeProgrammeId(); await mutateStudyVersion(versionId, v => { v.programmeId = programmeId }) })
  await page.route('**/api/state', route => route.fulfill({json:{courses:[{id:course.courseCode,code:course.courseCode,name:course.courseName,chapters:[],items:[]}]}}))
  let guideFailure = true
  await page.route('**/api/study-versions?*', route => {
    if (guideFailure) { return route.fulfill({status:503,json:{error:'Study guides temporarily unavailable.'}}) }
    return route.continue()
  })
  await page.goto(`/app/courses/${course.courseCode}`)
  await expect(page.getByRole('tab', { name: 'Exercises', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Mock papers', exact: true })).toBeVisible()
  await expect(page.getByText('No study chapters yet', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Canvas editions' })).toHaveCount(0)
  await expect(page.getByRole('alert').filter({hasText:'Study guides temporarily unavailable.'})).toBeVisible()
  guideFailure = false
  await page.getByRole('button',{name:'Try again',exact:true}).click()
  await expect(page.getByRole('link', { name: 'Open guide', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Chapters', exact: true })).toBeVisible()
  await page.getByRole('tab',{name:'Study guides',exact:true}).focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('tab',{name:'Exercises',exact:true})).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab',{name:'Exercises',exact:true})).toHaveAttribute('aria-selected','true')
  await page.getByRole('tab',{name:'Study guides',exact:true}).click()
  await page.getByRole('button', { name: 'Create study guide', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Create study guide', exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('tab', { name: 'Materials', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Manage collection', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Canvas editions', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Manage collection', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Canvas collection', exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Study guides', exact: true })).toHaveAttribute('aria-selected', 'true')
  for (const [label,name] of [['Results','results'],['Details','details']]) {
    await page.getByRole('tab',{name:label,exact:true}).click()
    await expect(page.getByRole('tabpanel')).toBeVisible()
    await page.screenshot({path:`/tmp/wicker-course-${name}-desktop.png`,fullPage:true})
  }
  await page.getByRole('tab',{name:'Study guides',exact:true}).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('tab', { name: 'Study guides', exact: true })).toBeInViewport()
  await page.screenshot({ path: '/tmp/wicker-course-guides-mobile.png', fullPage: true })
  const sourceAction = page.getByRole('button', {name:/Go to the source/})
  await sourceAction.scrollIntoViewIfNeeded()
  await expect(sourceAction).toBeInViewport()
  await page.screenshot({path:'/tmp/wicker-course-guides-mobile-bottom.png'})
  await sourceAction.click()
  await expect(page.getByRole('tab',{name:'Materials',exact:true})).toHaveAttribute('aria-selected','true')
  await page.getByRole('tab',{name:'Study guides',exact:true}).click()
  await page.evaluate(()=>window.scrollTo(0,0))
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: '/tmp/wicker-course-hub-desktop.png', fullPage: true })
  await page.getByRole('tab', { name: 'Exercises', exact: true }).click()
  const bank = await page.request.get(`/api/practice?courseId=${course.courseCode}&courseCode=${course.courseCode}`).then(r => r.json())
  expect(bank.questions.length).toBeGreaterThanOrEqual(8)
  expect(bank.questions.every(q => q.study && q.courseCode === course.courseCode)).toBe(true)
  await expect(page.getByRole('button', { name: 'Check answer', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reference answer', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reference answer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Hide reference', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Your answer', exact: true }).fill('My answer stays while I browse papers.')
  await page.getByRole('tab', { name: 'Mock papers', exact: true }).click()
  await page.getByRole('tab', { name: 'Exercises', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Your answer', exact: true })).toHaveValue('My answer stays while I browse papers.')
  await page.screenshot({ path: '/tmp/wicker-course-exercises-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/wicker-course-exercises-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Adjust setup', exact: true }).click()
  await page.getByRole('combobox', { name: 'Question type', exact: true }).click()
  await page.getByRole('option', { name: /Best option/ }).click()
  await page.getByRole('radio', { name: '5', exact: true }).locator('..').click()
  await expect(page.getByRole('radio', { name: '5', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  await expect(page.getByText('10/10', { exact: true })).toBeVisible()
  const history = await page.request.get(`/api/study-versions/${versionId}/practice`).then(r => r.json())
  expect(history.records.some(r => r.kind === 'assessment' && r.question?.id === 'q-choice' && r.answer === '1' && r.result?.earned === 2)).toBe(true)

  await page.reload()
  await expect(page.getByRole('tab', { name: 'Exercises', exact: true })).toHaveAttribute('aria-selected','true')
})

test('automatic paper processing survives leaving the library and exposes checked questions on return',async({page})=>{
  const {queueCoursePapers,retryPaperJob,processPaperJob,PAPER_JOBS}=await import('../lib/study-paper-jobs.mjs')
  let jobId
  await run(async()=>{
    await addStudyNote({...course,title:'Automatic background exam.pdf'},[{page:1,text:'Explain why disjoint groups can be added.'},{page:2,text:'Describe how subtraction checks an addition.'}])
    const jobs=await queueCoursePapers(course)
    jobId=jobs.find(j=>j.title==='Automatic background exam.pdf').id
  })
  await page.route('**/api/state',route=>route.fulfill({json:{courses:[{id:course.courseCode,code:course.courseCode,name:course.courseName,chapters:[],items:[]}]}}))
  await page.goto(`/app/courses/${course.courseCode}?tab=papers&year=${course.academicYear}`)
  await expect(page.getByRole('heading',{name:'Automatic background exam',exact:true})).toBeVisible()
  // The fixture enqueued directly, so deliver its wake as ingestion would.
  expect((await page.request.post('/api/study-versions/course-papers', { data: { ...course, action: 'auto-prepare' } })).status()).toBe(202)
  // Local test servers have no paid provider configured. Wait for that explicit
  // pause, leave, then run the real durable worker with deterministic AI output.
  await expect.poll(()=>run(async()=> (await readDocument(PAPER_JOBS,jobId,null)).status)).toBe('paused')
  await page.getByRole('tab',{name:'Study guides',exact:true}).click()
  await run(async()=>{
    await retryPaperJob(jobId)
    for(let i=0;i<8;i++){
      const result=await processPaperJob(jobId,{platform:{configured:true,provider:'openai',model:'gpt-5-mini'},generate:async(prompt,opts)=>{
        if(opts.usageMetadata.stage==='review')return JSON.stringify({issues:[]})
        const chunks=JSON.parse(prompt.split('EVIDENCE: ').at(-1))
        return JSON.stringify({title:'Automatic background exam',warnings:[],questions:chunks.map(c=>({label:String(c.page),question:c.text,sharedContext:'',type:'written',options:[],correctOptions:[],marks:null,page:c.page,answer:'',answerBasis:'unavailable',hint:'',difficulty:'standard',sourceIds:[c.id],answerSourceIds:[],needsOriginal:false}))})
      }})
      if(!result.again)break
    }
    expect((await readDocument(PAPER_JOBS,jobId,null)).status).toBe('complete')
  })
  await page.getByRole('tab',{name:'Mock papers',exact:true}).click()
  const paper=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Automatic background exam',exact:true})})
  await expect(paper.getByText('2 questions ready',{exact:true})).toBeVisible()
  await paper.getByRole('button',{name:'Practise',exact:true}).click()
  await expect(page.getByText('Explain why disjoint groups can be added.',{exact:true})).toBeVisible()
})

test('paper library keeps ready sections usable through paused processing, with compact responsive browsing', async ({page}) => {
  const names=['Practice exam 2025','Practice exam 2024','Week 2 tutorial','Week 3 tutorial','Week 4 tutorial','Week 6 tutorial']
  const papers=names.map((name,i)=>({key:`paper-${i}`,title:`${name}.pdf`,academicYear:i===1?'2023-2024':'2024-2025',paperKind:i<2?'paper':'exercises',kind:'canvas',sha256:`sha-${i}`,url:'/api/test-original-paper.pdf'}))
  const processing=papers.map((p,i)=>({id:`job-${i}`,sourceKey:p.key,status:'paused',completedSections:0,totalSections:1,setId:`pending-${i}`,error:'The AI provider returned HTTP 429.'}))
  const sets=[{id:'ready-section',versionId,revisionId:'fixture',topicId:'fixture',title:'Search questions',questionCount:8,sourcePages:[1,2],questionSourceKey:'paper-0',status:'complete',academicYear:'2024-2025'}, {id:'pending-0',questionSourceKey:'paper-0',status:'pending',questionCount:0,title:'New extraction'}]
  let writes=0
  await page.route('**/api/state', route=>route.fulfill({json:{courses:[{id:course.courseCode,code:course.courseCode,name:course.courseName,chapters:[],items:[]}]}}))
  await page.route('**/api/study-versions/course-papers**',route=>{
    if(route.request().method()!=='GET') writes++
    return route.fulfill({json:{papers,sets,processing,syllabi:[],reviews:[]}})
  })
  await page.route('**/api/test-original-paper.pdf',route=>route.fulfill({contentType:'application/pdf',body:previewPdf('Original exam',2)}))
  await page.setViewportSize({width:1280,height:900})
  await page.goto(`/app/courses/${course.courseCode}?tab=papers&year=${course.academicYear}`)
  const library=page.getByRole('region',{name:'Past paper library'})
  await expect(library.locator('article')).toHaveCount(6)
  await expect(library.getByText('8 questions ready · selected pages')).toBeVisible()
  await expect(library.getByRole('button',{name:'Practise section',exact:true})).toBeVisible()
  await expect(library.getByText('The AI provider returned HTTP 429.')).not.toBeVisible()
  await expect.poll(()=>library.locator('article').evaluateAll(rows=>rows.filter(row=>row.getBoundingClientRect().bottom<=innerHeight).length)).toBeGreaterThanOrEqual(4)
  await page.screenshot({path:'/tmp/wicker-paper-six-desktop.png',fullPage:true})
  await page.setViewportSize({width:1920,height:1080})
  await page.screenshot({path:'/tmp/wicker-paper-six-wide.png',fullPage:true})
  await library.getByRole('button',{name:'Details for Practice exam 2025',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByRole('combobox')).toHaveValue('ready-section')
  await expect(dialog.getByText('Preparation paused.',{exact:false})).toBeVisible()
  await page.screenshot({path:'/tmp/wicker-paper-six-detail.png',animations:'disabled'})
  await dialog.getByRole('button',{name:'View paper',exact:true}).click()
  await expect(dialog).not.toBeVisible()
  const viewer=page.getByRole('complementary',{name:'Reference document',exact:true})
  await expect(viewer.locator('[data-pdf-page="1"] .pdf-reader-text')).toContainText('Original exam page 1')
  await viewer.getByRole('button',{name:'Close reference',exact:true}).click()
  const details=library.getByRole('button',{name:'Details for Practice exam 2025',exact:true})
  await details.focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape')
  await expect(details).toBeFocused()
  await library.getByRole('textbox',{name:'Search past papers'}).fill('unknown file')
  await expect(library.getByText('No papers match these filters')).toBeVisible()
  await library.getByRole('button',{name:'Clear filters'}).click()
  await library.getByRole('combobox',{name:'Paper year'}).selectOption('2023-2024')
  await expect(library.locator('article')).toHaveCount(1)
  await library.getByRole('combobox',{name:'Paper year'}).selectOption('all')
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/wicker-paper-six-mobile.png',fullPage:true})
  await library.getByRole('button',{name:'6 paused',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:/Practice exam 2025/}).click()
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Practice exam 2025',exact:true})).toBeVisible()
  await page.screenshot({path:'/tmp/wicker-paper-six-detail-mobile.png',animations:'disabled'})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(writes).toBe(0)
  await page.getByRole('dialog').getByRole('button',{name:'Prepare another section'}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Back to paper'}).click()
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Practice exam 2025',exact:true})).toBeVisible()
  let releaseStep
  let stepGate=new Promise(resolve=>{releaseStep=resolve})
  const pending={id:'pending-0',versionId,status:'pending'}
  await page.route('**/api/study-versions/course-papers',route=>route.fulfill({json:pending}))
  await page.route('**/practice-step',async route=>{await stepGate;await route.fulfill({json:{...pending,status:'failed',error:'Fixture extraction paused'}})})
  await page.getByRole('dialog').getByRole('button',{name:'Prepare another section'}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Prepare questions',exact:true}).click()
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Preparing questions…')
  await page.screenshot({path:'/tmp/wicker-paper-preparing-mobile.png',animations:'disabled'})
  releaseStep()
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Fixture extraction paused')
  await page.getByRole('dialog').getByRole('combobox').selectOption('pending-0')
  stepGate=new Promise(resolve=>{releaseStep=resolve})
  await page.route('**/practice?setId=pending-0',route=>route.fulfill({json:{records:[pending]}}))
  await page.getByRole('dialog').getByRole('button',{name:'Resume questions',exact:true}).click()
  await expect(page.getByRole('dialog').getByRole('button',{name:'Resuming…',exact:true})).toBeDisabled()
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Resuming questions…')
  await page.screenshot({path:'/tmp/wicker-paper-resuming-mobile.png',animations:'disabled'})
  releaseStep()
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Fixture extraction paused')
})

test('attendance retains a cited assessed-participation rule after scan failure without guessing tutorial requirements',async({page})=>{
  const {recoverLiteralAttendance}=await import('../lib/priority-evidence.mjs')
  const courseProfile=recoverLiteralAttendance({assessment:{status:'needs-review',conflicts:[{title:'Priority scan allowance reached',chunkIds:[1]}]}},[{chunkId:1,assetId:'attendance-manual',filename:'Course manual.pdf',sourceType:'syllabus',page:1,content:'Attendance and participation in these debates counts for 10% of your final grade (pass/fail).'}])
  await page.route('**/api/state',route=>route.fulfill({json:{courses:[{id:course.courseCode,code:course.courseCode,name:course.courseName,chapters:[],items:[]}]}}))
  await page.route('**/api/calendar/events',async route=>{
    const response=await route.fetch(),calendar=await response.json()
    const report=attendanceOverview([{id:'debate-fixture',courseCode:course.courseCode,title:'Tutorial',activity:'Tutorial',start:'2026-10-09T09:00:00Z',end:'2026-10-09T11:00:00Z',attendanceEligible:true,category:'timetable'}],[],[{code:course.courseCode,courseProfile,ruleAcademicYear:'2026-2027',priorityScan:{status:'needs-review'}}])
    await route.fulfill({json:{...calendar,events:report.events,attendance:{summary:report.summary,courses:report.courses}}})
  })
  await page.route('**/api/corpus/assets/attendance-manual',route=>route.fulfill({contentType:'application/pdf',body:previewPdf('Debate attendance: 10 percent')}))
  await page.goto(`/app/courses/${course.courseCode}?tab=attendance&year=${course.academicYear}`)
  await expect(page.getByText('Some course requirements could not be checked')).toBeVisible()
  await expect(page.getByRole('heading',{name:'Attendance and participation in the syllabus'})).toBeVisible()
  await expect(page.getByText('debate · Assessed participation')).toBeVisible()
  await expect(page.getByText('Attendance and participation in these debates counts for 10% of your final grade (pass/fail)',{exact:true})).toBeVisible()
  await expect(page.getByText('Requirement unknown',{exact:true})).toBeVisible()
  await page.screenshot({path:'/tmp/wicker-attendance-recovery.png',fullPage:true})
  await page.getByRole('button',{name:'View source',exact:true}).click()
  await expect(page.getByRole('complementary',{name:'Reference document',exact:true}).locator('[data-pdf-page="1"] .pdf-reader-text')).toContainText('Debate attendance: 10 percent')
})

test('course tutor follows tabs, preserves drafts and conversations, and fits desktop and mobile',async({page})=>{
  await run(async () => { const programmeId = await activeProgrammeId(); await mutateStudyVersion(versionId, v => { v.programmeId = programmeId }) })
  const posts=[]
  await page.route('**/api/state',route=>route.fulfill({json:{courses:[{id:course.courseCode,code:course.courseCode,name:course.courseName,chapters:[],items:[]}]}}))
  await page.route('**/api/tutor**',route=>{
    if(route.request().method()==='POST'){
      const body=route.request().postDataJSON();posts.push(body)
      return route.fulfill({json:{conversation:{id:body.conversation,messages:[{role:'user',content:body.message,context:body.context},{role:'assistant',content:'Let’s work through this together.'}]},conversations:[],receipts:[],memory:{facts:[],plans:[]},attachments:[]}})
    }
    return route.fulfill({json:{available:true,conversation:null,conversations:[],receipts:[],memory:{facts:[],plans:[]},attachments:[]}})
  })
  await page.setViewportSize({width:1440,height:1000})
  await page.goto(`/app/courses/${course.courseCode}?year=${course.academicYear}`)
  await expect(page.locator('.course-heading')).toHaveCSS('background-color','rgb(32, 38, 58)')
  await expect(page.locator('.course-heading h1')).toHaveCSS('color','rgb(255, 255, 255)')
  await page.getByRole('button',{name:'Ask tutor',exact:true}).click()
  const tutor=page.getByRole('complementary',{name:'Course tutor',exact:true})
  const input=tutor.getByRole('textbox',{name:'Ask the tutor'})
  await expect(input).toBeVisible()
  await input.fill('Keep this draft')
  await page.screenshot({path:'/tmp/wicker-course-tutor-desktop.png',fullPage:true})
  await tutor.getByRole('button',{name:'Close reference',exact:true}).click()
  await page.getByRole('button',{name:'Ask tutor',exact:true}).click()
  await expect(input).toHaveValue('Keep this draft')
  for(const name of ['Exercises','Mock papers','Materials','Attendance','Results','Details','Study guides']){
    await page.getByRole('tab',{name:new RegExp(`^${name}`)}).click()
    await expect(tutor).toBeVisible()
    await expect(input).toHaveValue('Keep this draft')
  }
  expect(posts).toHaveLength(0)
  await page.getByRole('tab',{name:'Materials',exact:true}).click()
  await input.fill('Explain this material');await input.press('Enter')
  await expect(tutor.getByText('Let’s work through this together.',{exact:true})).toBeVisible()
  expect(posts[0].context).toMatchObject({courseCode:course.courseCode,courseTab:'materials',academicYear:course.academicYear})
  await page.getByRole('tab',{name:'Attendance',exact:true}).click()
  await input.fill('What is required here?');await input.press('Enter')
  await expect.poll(()=>posts.length).toBe(2)
  expect(posts[1].context.courseTab).toBe('attendance')
  expect(posts[1].conversation).toBe(posts[0].conversation)
  await page.getByRole('tab',{name:'Exercises',exact:true}).click()
  await expect(tutor.getByText(/^Question:/)).toBeVisible()
  await input.fill('Help me start this question');await input.press('Enter')
  await expect.poll(()=>posts.length).toBe(3)
  expect(posts[2].context.selection.kind).toBe('question')
  expect(posts[2].context.selection.text.length).toBeGreaterThan(5)
  await page.setViewportSize({width:1280,height:900})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/wicker-course-tutor-exercise.png',fullPage:true})
  await page.getByRole('tab',{name:'Attendance',exact:true}).click()
  await page.setViewportSize({width:390,height:844})
  await expect(input).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await expect.poll(()=>input.evaluate(el=>{const rect=el.getBoundingClientRect();return rect.bottom<innerHeight-64})).toBe(true)
  await page.screenshot({path:'/tmp/wicker-course-tutor-mobile.png',fullPage:true})
  await page.getByRole('button',{name:'Your work',exact:true}).click()
  await expect(page.getByRole('tab',{name:'Attendance',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Tutor',exact:true}).click()
  await expect(input).toBeVisible()
})

test('course materials send the opened document and current PDF page to the tutor',async({page})=>{
  let sent
  await page.route('**/api/state',route=>route.fulfill({json:{courses:[{id:course.courseCode,code:course.courseCode,name:course.courseName,chapters:[],items:[]}]}}))
  await page.route('**/api/corpus/materials**',route=>route.fulfill({json:{materials:[{assetId:'manual-fixture',filename:'Course manual.pdf',sourcePath:'manual.pdf',sourceType:'syllabus',mediaType:'application/pdf',byteSize:1200,academicYear:course.academicYear,period:'1',current:true,url:'/api/corpus/assets/manual-fixture',downloadUrl:'/api/corpus/assets/manual-fixture'}]}}))
  await page.route('**/api/corpus/assets/manual-fixture',route=>route.fulfill({contentType:'application/pdf',body:previewPdf('Course manual',2)}))
  await page.route('**/api/tutor**',route=>{
    if(route.request().method()==='POST')sent=route.request().postDataJSON()
    return route.fulfill({json:{available:true,conversation:sent?{id:sent.conversation,messages:[{role:'assistant',content:'I can help with this page.'}]}:null,conversations:[],receipts:[],memory:{facts:[],plans:[]},attachments:[]}})
  })
  await page.goto(`/app/courses/${course.courseCode}?tab=materials&year=${course.academicYear}`)
  await page.getByRole('button',{name:/^Course manual PDF/}).click()
  const viewer=page.getByRole('complementary',{name:'Reference document'})
  await expect(viewer.locator('[data-pdf-page="1"] .pdf-reader-text')).toContainText('Course manual page 1')
  await viewer.getByRole('button',{name:'Next page',exact:true}).click()
  await expect(viewer.getByRole('spinbutton',{name:'Page number'})).toHaveValue('2')
  await viewer.getByRole('button',{name:'Ask tutor',exact:true}).click()
  const tutor=page.getByRole('complementary',{name:'Course tutor'})
  await expect(tutor.getByText('Source: Course manual.pdf · Page 2')).toBeVisible()
  const input=tutor.getByRole('textbox',{name:'Ask the tutor'})
  await input.fill('Explain this page');await input.press('Enter')
  await expect.poll(()=>sent?.context.selection).toMatchObject({kind:'document',title:'Course manual.pdf',sourceAssetId:'manual-fixture',page:2})
})

test('editorial chapter opens the shared tutor with its chapter and source path',async({page})=>{
  let sent
  await page.route('**/api/state',route=>route.fulfill({json:{courses:[{id:'editorial-fixture',code:'CS101',name:'Foundations',chapters:[{id:'1',title:'Addition',file:'content/addition.md'}],items:[]}]}}))
  await page.route('**/api/chapter/editorial-fixture/1',route=>route.fulfill({json:{title:'Addition',content:'# Addition\n\nCombine two disjoint groups.'}}))
  await page.route('**/api/practice?**',route=>route.fulfill({json:{questions:[]}}))
  await page.route('**/api/tutor**',route=>{
    if(route.request().method()==='POST')sent=route.request().postDataJSON()
    return route.fulfill({json:{available:true,conversation:sent?{id:sent.conversation,messages:[{role:'assistant',content:'Let’s work through addition.'}]}:null,conversations:[],receipts:[],memory:{facts:[],plans:[]},attachments:[]}})
  })
  await page.goto('/app/courses/editorial-fixture/1')
  await page.getByRole('button',{name:'Ask tutor',exact:true}).click()
  const tutor=page.getByRole('complementary',{name:'Course tutor'})
  const input=tutor.getByRole('textbox',{name:'Ask the tutor'})
  await input.fill('Explain this chapter');await input.press('Enter')
  await expect.poll(()=>sent?.context).toMatchObject({courseCode:'CS101',chapterId:'1',chapterName:'Addition',sourcePath:'content/addition.md',courseTab:'chapter'})
  await page.keyboard.press('Escape')
  await expect(tutor).not.toBeVisible()
  await expect(page.getByRole('button',{name:'Ask tutor',exact:true})).toBeFocused()
})

test('tutor explains exhausted credits beside the question, survives reload and recovers without duplicates',async({page})=>{
  let saved=null,posts=0
  const failure={code:'provider_credits'}
  const hub=()=>({available:true,conversation:saved,conversations:[],receipts:[],memory:{facts:[],plans:[]},attachments:[]})
  await page.route('**/api/tutor**',route=>{
    if(route.request().method()==='POST'){
      const body=route.request().postDataJSON();posts++
      saved={id:body.conversation,messages:[{role:'user',content:body.message}],reply:{status:'failed',failure}}
      if(posts===1)return route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'error',error:'PRIVATE PROVIDER JSON',failure,conversation:saved})+'\n'})
      expect(body.retry).toBe(true)
      saved={...saved,messages:[...saved.messages,{role:'assistant',content:'Rational agents choose actions based on expected performance.'}],reply:{status:'complete'}}
      return route.fulfill({json:hub()})
    }
    return route.fulfill({json:hub()})
  })
  await page.setViewportSize({width:390,height:844})
  await page.goto('/app/tutor')
  const input=page.getByRole('textbox',{name:'Ask the tutor'})
  await expect(input).toBeEnabled()
  await input.fill('Explain rational agents')
  await input.press('Enter')
  const alert=page.getByRole('alert').filter({hasText:'API credits exhausted'})
  await expect(alert).toContainText('Tutor is paused: API credits exhausted')
  await expect(alert).toContainText('platform owner needs to restore')
  await expect(page.getByText('PRIVATE PROVIDER JSON')).toHaveCount(0)
  await page.screenshot({path:'/tmp/wicker-tutor-credit-error-mobile.png',fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.reload()
  await expect(alert).toContainText('API credits exhausted')
  expect(posts).toBe(1)
  await page.getByRole('button',{name:'Retry after billing is resolved'}).click()
  await expect(page.getByText('Rational agents choose actions based on expected performance.')).toBeVisible()
  await expect(alert).toHaveCount(0)
  await expect(page.getByText('Explain rational agents',{exact:true})).toHaveCount(1)
  expect(posts).toBe(2)
})

test('course tutor shows temporary throttling as a retryable error in its sidebar',async({page})=>{
  let posts=0
  await page.route('**/api/state',route=>route.fulfill({json:{courses:[{id:course.courseCode,code:course.courseCode,name:course.courseName,chapters:[],items:[]}]}}))
  await page.route('**/api/tutor**',route=>{
    if(route.request().method()==='POST'){
      posts++
      return route.fulfill({status:429,json:{error:'PRIVATE PROVIDER JSON',failure:{code:'provider_rate_limit'}}})
    }
    return route.fulfill({json:{available:true,conversation:null,conversations:[],receipts:[],memory:{facts:[],plans:[]},attachments:[]}})
  })
  await page.goto(`/app/courses/${course.courseCode}?year=${course.academicYear}`)
  await page.getByRole('button',{name:'Ask tutor',exact:true}).click()
  const tutor=page.getByRole('complementary',{name:'Course tutor',exact:true})
  const input=tutor.getByRole('textbox',{name:'Ask the tutor'})
  await expect(input).toBeEnabled()
  await input.fill('Explain this topic');await input.press('Enter')
  await expect(tutor.getByRole('alert')).toContainText('Tutor is temporarily busy')
  await expect(tutor.getByRole('button',{name:'Retry reply',exact:true})).toBeVisible()
  await expect(page.getByText('PRIVATE PROVIDER JSON')).toHaveCount(0)
  expect(posts).toBe(1)
  await page.screenshot({path:'/tmp/wicker-tutor-rate-error-desktop.png',fullPage:true})
})

test('course groups show teammates, isolate retake years, and refresh membership without stale rosters',async({page})=>{
  await page.route('**/api/tutor**',route=>route.fulfill({json:{available:true,conversation:null,conversations:[],receipts:[],memory:{facts:[],plans:[]},attachments:[]}}))
  let refreshed=false
  const calls=[]
  const makeGroup=year=>({id:year==='2026-2027'?'501':'502',origin:'https://canvas.example.edu',name:year==='2026-2027'?'Project team 4':'Previous project team',scope:'course',courseId:'1',courseName:'Foundations',courseCode:course.courseCode,academicYear:year,url:'https://canvas.example.edu/groups/501',memberCount:3,membersStatus:'not-loaded',members:null})
  await page.route('**/api/state',route=>route.fulfill({json:{courses:[{id:course.courseCode,code:course.courseCode,name:course.courseName,chapters:[],items:[]}]}}))
  await page.route('**/api/integrations/canvas/groups?**',route=>{
    const q=new URL(route.request().url()).searchParams;calls.push(Object.fromEntries(q))
    if(q.get('refresh')==='1')refreshed=true
    const year=q.get('academicYear')||course.academicYear,group=makeGroup(year)
    if(q.has('groupId')){group.membersStatus='loaded';group.members=[{id:'1',name:'Student',isYou:true},{id:'2',name:year==='2026-2027'?(refreshed?'Grace Hopper':'Ada Lovelace'):'Previous teammate',isYou:false}]}
    return route.fulfill({json:{connected:true,groups:[group],problems:[],matchedCourses:[{id:'1'}],refreshMinutes:10}})
  })
  await page.goto(`/app/courses/${course.courseCode}?year=${course.academicYear}&tab=groups`)
  const groups=page.getByRole('region',{name:'Your course groups'})
  await expect(groups.getByRole('heading',{name:'Project team 4'})).toBeVisible()
  await expect(groups.getByRole('list',{name:'Group members'})).toContainText('Ada Lovelace')
  await expect(groups.getByText('You',{exact:true})).toBeVisible()
  await groups.getByRole('button',{name:'Refresh groups'}).click()
  await expect(groups.getByRole('list',{name:'Group members'})).toContainText('Grace Hopper')
  await expect(groups.getByText('Ada Lovelace')).toHaveCount(0)
  await page.screenshot({path:'/tmp/wicker-course-groups-desktop.png',fullPage:true})
  await page.getByRole('button',{name:'Ask tutor',exact:true}).click()
  const tutor=page.getByRole('complementary',{name:'Course tutor',exact:true})
  await expect(tutor.getByText('Group: Project team 4',{exact:true})).toBeVisible()
  await tutor.getByRole('button',{name:'Close reference',exact:true}).click()
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/wicker-course-groups-mobile.png',fullPage:true})
  await page.goto(`/app/courses/${course.courseCode}?year=2025-2026&tab=groups`)
  await expect(groups.getByRole('heading',{name:'Previous project team'})).toBeVisible()
  await expect(groups.getByRole('list',{name:'Group members'})).toContainText('Previous teammate')
  expect(calls.some(call=>call.groupId==='502'&&call.academicYear==='2025-2026')).toBe(true)
})

test('settings activity links and browser history keep the selected tab in sync', async ({ page }) => {
  await page.route('**/api/account/api-keys', route => route.fulfill({ json: { keys: [], scopes: ['read', 'write'], admin: false } }))
  await page.route('**/api/account/agent-activity?*', route => route.fulfill({ json: { items: [], nextCursor: null } }))
  await page.goto('/app/settings?tab=api')
  await expect(page.getByRole('tab', { name: 'API access', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('link', { name: 'View AI activity' }).click()
  await expect(page.getByRole('heading', { name: 'AI activity', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'AI activity', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('No AI activity yet', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Manage API access' }).click()
  await expect(page.getByRole('tab', { name: 'API access', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'AI activity', exact: true })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('link', { name: 'View AI activity' })).toBeVisible()
  await page.getByRole('tab', { name: 'AI activity', exact: true }).click()
  await expect(page).toHaveURL(/tab=activity/)
  await expect(page.getByRole('heading', { name: 'AI activity', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'AI activity', exact: true })).toBeVisible()
})

test('global Canvas groups stay separate, and a denied roster never looks like an empty team',async({page})=>{
  const global={id:'601',origin:'https://canvas.example.edu',name:'Data Science society',scope:'global',contextName:'Student communities',url:'https://canvas.example.edu/groups/601',membersStatus:'not-loaded',members:null}
  const courseGroup={...global,id:'602',name:'Graph theory team',scope:'course',courseName:'Graph Theory',academicYear:'2026-2027'}
  await page.route('**/api/integrations/canvas/groups?**',route=>{
    const groupId=new URL(route.request().url()).searchParams.get('groupId')
    return route.fulfill({json:{connected:true,groups:[global,courseGroup].map(group=>({...group,membersStatus:group.id===groupId?'unavailable':'not-loaded'})),problems:groupId?[{part:'members',message:'Canvas did not allow the member list to load.'}]:[],matchedCourses:[]}})
  })
  await page.goto('/app/groups')
  await page.getByRole('button',{name:'Global groups',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Data Science society'})).toBeVisible()
  await expect(page.getByRole('region',{name:'Your Canvas groups'}).getByRole('alert')).toContainText('Canvas did not allow')
  await expect(page.getByText('Canvas returned no visible members for this group.')).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'Graph theory team'})).toHaveCount(0)
  await page.getByRole('button',{name:'Course teams',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Graph theory team'})).toBeVisible()
})
