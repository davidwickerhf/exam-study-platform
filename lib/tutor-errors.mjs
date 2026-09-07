// Only public, actionable descriptions cross the API boundary. Provider bodies
// may contain account identifiers or request details and must never be echoed.
const failures = {
  provider_credits: {title:'Tutor is paused: API credits exhausted',message:'The AI service has run out of API credits or reached its billing limit. The platform owner needs to restore its allowance before Tutor can reply.',retryable:false,retryLabel:'Retry after billing is resolved'},
  provider_rate_limit: {title:'Tutor is temporarily busy',message:'The AI service is receiving too many requests. Wait a little, then try this question again.',retryable:true,retryLabel:'Retry reply'},
  provider_configuration: {title:'Tutor needs a connection fix',message:'The AI service connection is not configured correctly. The platform owner needs to check its credentials and model access.',retryable:false,retryLabel:'Retry after connection is fixed'},
  provider_unavailable: {title:'Tutor could not reach the AI service',message:'The AI service is temporarily unavailable. Try this question again shortly.',retryable:true,retryLabel:'Retry reply'},
  timeout: {title:'Tutor took too long to reply',message:'The request timed out before an answer was ready. You can try this question again.',retryable:true,retryLabel:'Retry reply'},
  stopped: {title:'Reply stopped',message:'The reply was interrupted before it finished. You can resume by retrying this question.',retryable:true,retryLabel:'Retry reply'},
  conversation_missing: {title:'This conversation is no longer available',message:'Start a new conversation to continue. Your question will be kept in the message box.',retryable:false,retryLabel:'Start a new conversation'},
  conversation_changed: {title:'This conversation changed',message:'Reopen this conversation to load the latest messages before continuing.',retryable:false,retryLabel:'Reopen conversation'},
  reply_failed: {title:'Tutor could not finish this reply',message:'No complete answer was returned. Try this question again; earlier replies are still available.',retryable:true,retryLabel:'Retry reply'}
}
export function providerFailure(status, body) {
  let parsed=body
  if(typeof body==='string') {try {parsed=JSON.parse(body)} catch {parsed={}}}
  const detail=parsed?.error || parsed || {}
  const code=`${detail.code || ''} ${detail.type || ''}`.toLowerCase()
  const message=String(detail.message || '')
  if(/insufficient_quota|billing|credit_balance|usage_limit/.test(code) || /no credits remaining|run out of credits|credit balance|exceeded your current quota|billing limit/i.test(message)) return tutorFailure({code:'provider_credits'})
  if(status===429 || /rate_limit_exceeded/.test(code)) return tutorFailure({code:'provider_rate_limit'})
  if([401,403,404].includes(status) || /invalid_api_key|authentication_error|permission_error|model_not_found/.test(code)) return tutorFailure({code:'provider_configuration'})
  return tutorFailure({code:'provider_unavailable'})
}
export function tutorFailure(error, stopped=false) {
  const supplied=error?.failure?.code || error?.code
  let code=Object.hasOwn(failures,supplied) ? supplied : null
  if(error?.name==='TutorStoreError' || error?.constructor?.name==='TutorStoreError') {
    if(error.status===409) code='conversation_changed'
    if(error.status===404) code='conversation_missing'
  }
  if(stopped || error?.name==='AbortError') code='stopped'
  else if(error?.name==='TimeoutError') code='timeout'
  // Older saved turns contain raw error text; classify it, never display it.
  const text=String(error?.message || error?.error || '')
  if(!code && /insufficient_quota|no credits remaining|exceeded your current quota|billing limit/i.test(text)) code='provider_credits'
  if(!code && /\b429\b|rate_limit_exceeded/i.test(text)) code='provider_rate_limit'
  if(!code && /\b(401|403)\b|invalid_api_key/i.test(text)) code='provider_configuration'
  if(!code && /timed out|too long|timeout/i.test(text)) code='timeout'
  if(!code && /fetch failed|network|unavailable/i.test(text)) code='provider_unavailable'
  code ||= 'reply_failed'
  return {code,...failures[code]}
}
