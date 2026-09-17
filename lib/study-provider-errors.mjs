import { providerFailure } from './tutor-errors.mjs'
import { StudyVersionError } from './study-version-content.mjs'

const messages = {
  provider_credits: 'The selected AI connection has run out of API credits or reached its billing limit. Restore its credits or choose another AI connection before retrying. Finished work is saved.',
  provider_rate_limit: 'The AI service is temporarily receiving too many requests. Wait a little, then retry the unfinished step. Finished work is saved.',
  provider_configuration: 'The selected AI connection could not access the model. Check its API key and model access before retrying. Finished work is saved.',
  provider_unavailable: 'The AI service could not complete this request. Try again shortly. Finished work is saved.'
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
  return error?.retryable===true || ['TimeoutError','APIConnectionTimeoutError'].includes(error?.name)
    || ['TimeoutError','APIConnectionTimeoutError'].includes(error?.cause?.name)
    || ['ECONNRESET','ETIMEDOUT','UND_ERR_SOCKET','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT'].includes(error?.cause?.code)
}


export function studyRetryDelayMs(error, attempt) {
  const requested=Number(error?.retryAfter)
  return Math.min(60000,Math.max(1000,Number.isFinite(requested)&&requested>0 ? requested*1000 : 10000*2**Math.max(0,attempt-1)))
}
