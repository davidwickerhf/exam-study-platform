import { StudyVersionError } from './study-version-content.mjs'
// Reasoning consumes the same output allowance as the final JSON. The larger
// model needs headroom for a complete evidence review, still reserved up front.
export const studyReviewTokenLimit = model => model === 'gpt-5.4' ? 8000 : 4000
export function openAiResponseText(data) {
  const choice = data.choices?.[0]
  if (choice?.finish_reason === 'length')
    throw new StudyVersionError('The AI reached its response token limit before completing. The saved chapter is intact; retry the unfinished step.', 502)
  if (choice?.message?.refusal)
    throw new StudyVersionError('The AI provider declined this request. Review the selected sources before retrying.', 422)
  const content = choice?.message?.content
  const text = (typeof content === 'string' ? content : Array.isArray(content) ? content.map(part => part.text || '').join('') : '').trim()
  if (!text) throw new StudyVersionError('The AI provider returned an empty response. Retry the unfinished step.', 502)
  return text
}
