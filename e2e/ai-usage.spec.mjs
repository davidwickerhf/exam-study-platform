import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {saveAiCallEvent,aiCallReport} from '../lib/ai-call-store.mjs'
import {withRequestContext} from '../lib/request-context.mjs'
import {deleteDocument} from '../lib/user-store.mjs'
const userId='study-e2e-fixture'
test('AI usage has admin-only totals, filters, unknown counts and responsive breakdowns',async({page})=>{
 const ids=[randomUUID(),randomUUID()]
 const base={userId,createdAt:new Date().toISOString(),provider:'openai',model:'gpt-5-mini',feature:'tutor',phase:'answer',payer:'platform',durationMs:250,status:'completed',usageStatus:'reported',inputTokens:1000,outputTokens:100,totalTokens:1100,cachedInputTokens:400,reasoningTokens:20,estimatedCostUsd:.001}
 try{
  await saveAiCallEvent({...base,id:ids[0]})
  await saveAiCallEvent({...base,id:ids[1],status:'failed',usageStatus:'unavailable',inputTokens:null,outputTokens:null,totalTokens:null,estimatedCostUsd:null})
  expect((await page.request.get('/api/admin/ai-usage')).status()).toBe(403)
  const own=await page.request.get('/api/ai/calls?userId=another-user').then(r=>r.json())
  expect(own.recent.some(r=>r.id===ids[0])).toBe(true)
  expect(own.recent.every(r=>r.userId===userId)).toBe(true)
  await page.route('**/api/me',r=>r.fulfill({json:{admin:true,userId,mode:'local'}}))
  await page.route('**/api/admin/ai-usage?*',async route=>{
   const report=await withRequestContext({userId,admin:true},()=>aiCallReport({...Object.fromEntries(new URL(route.request().url()).searchParams),userId},{global:true}))
   return route.fulfill({json:report})
  })
  await page.route('**/api/admin/status',r=>r.fulfill({json:{writable:false}}))
  await page.goto('/app/admin?tab=usage')
  const region=page.getByRole('region',{name:'Platform AI usage'})
  await expect(region.getByRole('heading',{name:'AI usage',exact:true})).toBeVisible()
  await expect(region.getByRole('heading',{name:'Daily usage'})).toBeVisible()
  await expect(region.getByText('Unavailable',{exact:true}).first()).toBeVisible()
  await region.getByLabel('Group by').selectOption('userId')
  await expect(region.getByRole('cell',{name:userId,exact:true}).first()).toBeVisible()
  await page.screenshot({path:'/tmp/wicker-ai-usage-desktop.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/wicker-ai-usage-mobile.png',fullPage:true})
  await region.getByLabel('Feature',{exact:true}).fill('no-such-feature')
  await region.getByRole('button',{name:'Apply filters'}).click()
  await expect(region.getByText(/No AI calls in this date range/)).toBeVisible()
 }finally{for(const id of ids)await withRequestContext({userId},()=>deleteDocument('ai-call-events',id))}
})
