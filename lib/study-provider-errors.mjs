import { providerFailure } from './tutor-errors.mjs'
import { StudyVersionError } from './study-version-content.mjs'

// Shared verbatim with study-agents-sdk.mjs (where it is raised) and matched
// verbatim by the zero-cost output-limit chapter-split resume in
// study-version-pipeline.mjs, so both stay in sync with one source of truth.
export const PROVIDER_OUTPUT_LIMIT_MESSAGE = 'The AI reached this step’s output limit before finishing. Completed work is saved; reduce the review batch or revise the generation limits before retrying.'

const messages = {
  provider_credits: 'The selected AI connection has run out of API credits or reached its billing limit. Restore its credits or choose another AI connection before retrying. Finished work is saved.',
  provider_rate_limit: 'The AI service is temporarily receiving too many requests. Wait a little, then retry the unfinished step. Finished work is saved.',
  provider_configuration: 'The selected AI connection could not access the model. Check its API key and model access before retrying. Finished work is saved.',
  provider_unavailable: 'The AI service could not complete this request. Try again shortly. Finished work is saved.',
  provider_timeout: 'The AI service did not finish this request within its time allowance. The reservation for the abandoned call is kept; finished work is saved. Retry the unfinished step.'
}

// Classification must never throw over the failure it is describing. A cause
// can be absent, and `cause.code` is not always a string: a DOMException
// carries a numeric legacy `code` (20 for an abort, 23 for a timeout), and
// wrapped transport errors can carry a symbol or an object there. Reading it
// with `?.startsWith` crashed the whole diagnostic path and replaced the real
// provider failure with a TypeError.
export function providerErrorCode(error) {
  const code = error?.code
  return typeof code === 'string' && code.startsWith('provider_') ? code : null
}

// Only our own sanitized provider request id, never an arbitrary upstream value.
export function providerRequestId(error) {
  const id = error?.providerRequestId ?? error?.cause?.providerRequestId
  return typeof id === 'string' && /^req_[a-zA-Z0-9_-]{1,200}$/.test(id) ? id : null
}

// Bound the upstream body and expose only our own copy. Errors can contain
// account identifiers, provider request details or untrusted proxy responses.
export async function studyProviderError(response) {
  const reader = response.body?.getReader()
  let body = '', bytes = 0
  const decoder = new TextDecoder()
  try {
    while (reader) {
      const { done, value } = await reader.read()
      if (done) { body += decoder.decode(); break }
      bytes += value.byteLength
      if (bytes > 16_384) { body = ''; break }
      body += decoder.decode(value, { stream: true })
    }
  } catch { body = '' }
  finally { await reader?.cancel().catch(() => {}) }
  const failure = providerFailure(response.status, body)
  const error = new StudyVersionError(messages[failure.code] || messages.provider_unavailable, 502)
  error.code = failure.code
  error.providerStatus=response.status
  const requestId=response.headers.get('x-request-id')
  if(/^req_[a-zA-Z0-9_-]{1,200}$/.test(requestId || ''))error.providerRequestId=requestId
  error.retryable=response.status>=500 || failure.code==='provider_rate_limit'
  const retryAfter=Number(response.headers.get('retry-after'))
  if(error.retryable)error.retryAfter=Number.isFinite(retryAfter) && retryAfter>0 ? Math.min(120,retryAfter) : 10
  // Every retry reserves again; billing/access failures are never retried.
  return error
}


export function transientStudyFailure(error) {
  if(error?.code==='provider_credits' || error?.code==='provider_configuration')return false
  // A non-string code (or a missing cause) must simply not match, never throw.
  return error?.retryable===true || ['TimeoutError','APIConnectionTimeoutError'].includes(error?.name)
    || ['TimeoutError','APIConnectionTimeoutError'].includes(error?.cause?.name)
    || ['ECONNRESET','ETIMEDOUT','UND_ERR_SOCKET','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT'].includes(error?.cause?.code)
}


export function studyRetryDelayMs(error, attempt) {
  const requested=Number(error?.retryAfter)
  return Math.min(60000,Math.max(1000,Number.isFinite(requested)&&requested>0 ? requested*1000 : 10000*2**Math.max(0,attempt-1)))
}
