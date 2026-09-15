import { sql } from './db.mjs'
import { currentAuth, currentUserId, withRequestContext } from './request-context.mjs'
import { writeDocument, listDocuments } from './user-store.mjs'
import { aggregateCallEvents, usageReport } from './ai-call-metrics.mjs'
import { readdir } from 'node:fs/promises'
const namespace='ai-call-events'
export async function saveAiCallEvent(event) {
  if(sql) await sql`INSERT INTO ai_call_events(id,user_id,created_at,event) VALUES(${event.id},${event.userId},${event.createdAt},${JSON.stringify(event)}::jsonb)
    ON CONFLICT(id) DO UPDATE SET event=excluded.event WHERE ai_call_events.user_id=excluded.user_id`
  else await withRequestContext({userId:event.userId},()=>writeDocument(namespace,event.id,event))
}
function filtersFor(input, global) {
  const end=input.to?new Date(input.to+'T23:59:59.999Z'):new Date()
  const start=input.from?new Date(input.from+'T00:00:00.000Z'):new Date(new Date(end.getTime()-29*86400000).toISOString().slice(0,10)+'T00:00:00.000Z')
  if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<start||end-start>93*86400000)throw Object.assign(new Error('Choose a valid date range of at most 93 days.'),{status:400})
  return {from:start.toISOString(),to:end.toISOString(),userId:global?String(input.userId || '').slice(0,200):currentUserId(),feature:String(input.feature || '').slice(0,120),model:String(input.model || '').slice(0,120),payer:String(input.payer || '').slice(0,40)}
}
export async function aiCallReport(input={}, {global=false}={}) {
  if(global && (!currentAuth().admin || (currentAuth().mode==='api-key'&&!currentAuth().scopes?.includes('admin'))))throw Object.assign(new Error('Administrator access required.'),{status:403})
  const f=filtersFor(input,global)
  let events
  if(sql) {
    // Aggregate in the database; never cap the raw events before computing totals.
    const [rows,recent]=await Promise.all([
      sql`WITH selected AS (SELECT event FROM ai_call_events WHERE created_at>=${f.from} AND created_at<=${f.to}
        AND (${f.userId}='' OR user_id=${f.userId}) AND (${f.feature}='' OR event->>'feature'=${f.feature})
        AND (${f.model}='' OR event->>'model'=${f.model}) AND (${f.payer}='' OR event->>'payer'=${f.payer}))
      SELECT d.dimension,d.key,count(*)::float AS calls,
        sum(COALESCE((event->>'inputTokens')::numeric,0))::float AS "inputTokens",
        sum(COALESCE((event->>'outputTokens')::numeric,0))::float AS "outputTokens",
        sum(COALESCE((event->>'totalTokens')::numeric,0))::float AS "totalTokens",
        sum(COALESCE((event->>'cachedInputTokens')::numeric,0))::float AS "cachedInputTokens",
        sum(COALESCE((event->>'cacheWriteInputTokens')::numeric,0))::float AS "cacheWriteInputTokens",
        sum(COALESCE((event->>'reasoningTokens')::numeric,0))::float AS "reasoningTokens",
        sum(COALESCE((event->>'estimatedCostUsd')::numeric,0))::float AS "estimatedCostUsd",
        count(*) FILTER(WHERE event->>'usageStatus'='unavailable')::float AS "unknownUsageCalls",
        count(*) FILTER(WHERE event->>'estimatedCostUsd' IS NULL)::float AS "unpricedCalls",
        count(*) FILTER(WHERE event->>'status' IN ('failed','aborted','incomplete'))::float AS "failedCalls",
        sum(COALESCE((event->>'durationMs')::numeric,0))::float AS "durationMs"
      FROM selected CROSS JOIN LATERAL (VALUES ('total','all'),('day',left(event->>'createdAt',10)),('userId',event->>'userId'),
        ('feature',event->>'feature'),('model',event->>'model'),('payer',event->>'payer'),('phase',event->>'phase'),('status',event->>'status')) d(dimension,key)
      GROUP BY d.dimension,d.key`,
      sql`SELECT event FROM ai_call_events WHERE created_at>=${f.from} AND created_at<=${f.to}
        AND (${f.userId}='' OR user_id=${f.userId}) AND (${f.feature}='' OR event->>'feature'=${f.feature})
        AND (${f.model}='' OR event->>'model'=${f.model}) AND (${f.payer}='' OR event->>'payer'=${f.payer}) ORDER BY created_at DESC,id DESC LIMIT 100`
    ])
    return usageReport(rows.map(r=>({...r,key:r.key || 'unclassified'})),recent.map(r=>r.event),f)
  }
  const users=global?await readdir(new URL('../data/users/',import.meta.url)).catch(()=>[]):[f.userId]
  events=(await Promise.all(users.map(userId=>withRequestContext({userId},()=>listDocuments(namespace))))).flat().map(r=>r.value)
    .filter(e=>e&&(!f.userId||e.userId===f.userId)&&e.createdAt>=f.from&&e.createdAt<=f.to&&(!f.feature||e.feature===f.feature)&&(!f.model||e.model===f.model)&&(!f.payer||e.payer===f.payer))
  return usageReport(aggregateCallEvents(events),events.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100),f)
}
