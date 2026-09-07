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
  // Retrying generation remains explicit; a 429 alone is not permission to
  // repeat a paid request, and exhausted credits cannot recover by waiting.
  return error
}
