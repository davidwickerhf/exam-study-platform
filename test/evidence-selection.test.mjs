import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../lib/editorial-workflow.mjs', import.meta.url), 'utf8')

// A chapter's evidence is larger than any prompt budget, so what gets left out
// must be chosen, not decided by ingestion order.
test('chapter evidence is ranked before it is trimmed', () => {
  const query = source.slice(source.indexOf('async function chapterEvidence'), source.indexOf('function generationPrompt'))
  assert.match(query, /ts_rank_cd/, 'must rank with the retrieval index')
  assert.match(query, /bool_or\(t\.id=/, 'chunks mapped straight to the chapter must outrank concept-level ones')
  assert.match(query, /ORDER BY direct DESC, score DESC/, 'ordering must be by directness then relevance')
  assert.doesNotMatch(query, /ORDER BY r\.id`/, 'ingestion order must not decide what is dropped')
})

test('evidence that does not fit is recorded rather than dropped silently', () => {
  const helper = source.slice(source.indexOf('function evidenceText'), source.indexOf('function mappingPrompt'))
  assert.doesNotMatch(helper, /> maxChars\) break/, 'a silent break hides dropped evidence')
  assert.match(helper, /exceeded the prompt budget and were not supplied/, 'the prompt must say what was withheld')
  assert.match(source, /deferredSourceChunks: \[/, 'omitted chunks must be deferred in coverage')
})
