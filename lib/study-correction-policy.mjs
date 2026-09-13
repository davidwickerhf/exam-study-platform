import { digest } from './study-version-content.mjs'

export const DEFAULT_CORRECTION_LIMIT = 3
export function correctionLimit(draft) {
  const configured=draft.correctionPolicy?.maxAttempts
  return Number.isInteger(configured) && configured>=0 && configured<=5 ? configured : DEFAULT_CORRECTION_LIMIT
}
export function correctionStatus(draft) {
  return {maxAttempts:correctionLimit(draft),attempts:{...draft.automaticRepairs},manualAttempts:{...draft.manualRepairs},history:draft.correctionHistory || []}
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
