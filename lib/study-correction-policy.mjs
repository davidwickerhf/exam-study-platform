import { digest } from './study-version-content.mjs'

export const DEFAULT_CORRECTION_LIMIT = 3
export function correctionLimit(draft) {
  const configured=draft.correctionPolicy?.maxAttempts
  return Number.isInteger(configured) && configured>=0 && configured<=5 ? configured : DEFAULT_CORRECTION_LIMIT
}
export function correctionStatus(draft) {
  return {maxAttempts:correctionLimit(draft),attempts:{...draft.automaticRepairs},manualAttempts:{...draft.manualRepairs},history:draft.correctionHistory || [],outline:outlineCorrectionStatus(draft)}
}
// A rejected course/bundle outline is visible work in progress, not a silent
// retry: report the exact issues and the remaining bounded attempts without
// re-sending the whole rejected plan.
export function outlineCorrectionStatus(draft) {
  const pending=draft.outlineCorrection
  return pending ? {corrections:pending.corrections,maxAttempts:pending.maxAttempts,exhausted:Boolean(pending.exhausted),correctable:pending.correctable!==false,error:pending.error,issues:pending.issues,omittedIssues:pending.overflow || 0} : null
}
export function recordCorrection(draft,chapter,issues,phase,{manual=false}={}) {
  const counters=manual ? (draft.manualRepairs ||= {}) : (draft.automaticRepairs ||= {})
  const attempt=(counters[chapter.id] || 0)+1
  counters[chapter.id]=attempt
  draft.correctionPolicy ||= {maxAttempts:correctionLimit(draft)}
  draft.correctionHistory ||= []
  draft.correctionHistory.push({chapterId:chapter.id,kind:manual?'manual':'automatic',attempt,phase,baseHash:digest(chapter),findings:issues.filter(i=>i.severity==='error').map(({detail,itemKey})=>({detail,...(itemKey?{itemKey}:{})})),at:new Date().toISOString()})
  return attempt
}

// Carry the correction ledger explicitly across workers and MCP clients. This
// survives a fresh provider context without sharing the reviewer's conversation.
export function correctionContext(draft, chapterId) {
  const history=(draft.correctionHistory || []).filter(row=>row.chapterId===chapterId).map(({phase,findings})=>({phase,findings}))
  if(!history.length)return ''
  return `\nCORRECTION HISTORY (regression context, not additional source evidence): ${JSON.stringify(history)}\nFix the current findings while preserving earlier corrected reasoning. Earlier findings may already be resolved: inspect the latest draft before changing them. When adding missing teaching, use a worked case distinct from the independent and transfer assessments. If a teaching change exposes the answer to an existing assessment, replace that assessment with a genuinely different reasoning task. Keep source exclusions and objective coverage intact.`
}
