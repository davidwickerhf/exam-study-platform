import test from 'node:test'
import assert from 'node:assert/strict'
import { searchable, searchHref, searchLabel } from '../lib/v2/search.mjs'

test('search starts only after two non-space characters', () => {
  assert.equal(searchable(' a '), false)
  assert.equal(searchable(' ab '), true)
})
test('a result points to its migrated chapter and optional heading', () => {
  assert.equal(searchHref('math/1', { chapterId: '2', headingSlug: 'sets & maps' }), '/v2/courses/math%2F1/2#sets%20%26%20maps')
})
test('a repeated chapter heading is not announced twice', () => {
  assert.equal(searchLabel({ chapterName: 'Sets', headingText: 'Sets' }), 'Sets')
  assert.equal(searchLabel({ chapterName: 'Sets', headingText: 'Maps' }), 'Sets · Maps')
})
