// Reader rules.
//
// The outline and the rendered headings must agree about ids, or every link in
// the outline is a link to nothing. Both sides derive them from slugOf, and
// these cases pin the parts that are easy to get subtly wrong: headings inside
// fenced code, inline markup in a heading, and punctuation in a slug.

import test from 'node:test'
import assert from 'node:assert/strict'
import { neighbours, outlineOf, readingMinutes, slugOf } from '../lib/workspace/chapter.mjs'

test('slugs match the shape rehype-slug produces', () => {
  assert.equal(slugOf('What the Exam Asks'), 'what-the-exam-asks')
  assert.equal(slugOf('Greedy: an exchange argument'), 'greedy-an-exchange-argument')
  assert.equal(slugOf('Big-O, Θ and Ω'), 'big-o-θ-and-ω')
  assert.equal(slugOf('  Spaced   out  '), 'spaced-out')
})

test('the outline takes headings in document order at the chosen depths', () => {
  const outline = outlineOf('# Title\n## One\n### Deep\n#### Too deep\n## Two')
  assert.deepEqual(outline.map((entry) => entry.text), ['One', 'Deep', 'Two'])
  assert.deepEqual(outline.map((entry) => entry.depth), [2, 3, 2])
  assert.deepEqual(outline.map((entry) => entry.id), ['one', 'deep', 'two'])
})

test('a hash inside a fenced block is code, not a section', () => {
  const outline = outlineOf('## Real\n\n```bash\n# not a heading\n## also not\n```\n\n## Also real')
  assert.deepEqual(outline.map((entry) => entry.text), ['Real', 'Also real'])
})

test('tilde fences count too, and an unclosed fence does not swallow the rest', () => {
  assert.deepEqual(outlineOf('~~~\n## hidden\n~~~\n## shown').map((e) => e.text), ['shown'])
})

test('inline markup is stripped so the slug matches the rendered text', () => {
  const [entry] = outlineOf('## The `greedy` **choice** property')
  assert.equal(entry.text, 'The greedy choice property')
  assert.equal(entry.id, 'the-greedy-choice-property')
})

test('trailing closing hashes are not part of the heading', () => {
  assert.equal(outlineOf('## Closed ##')[0].text, 'Closed')
})

test('reading time is at least a minute and scales with length', () => {
  assert.equal(readingMinutes(''), 1)
  assert.equal(readingMinutes('word '.repeat(200)), 1)
  assert.equal(readingMinutes('word '.repeat(1000)), 5)
})

test('neighbours give the way through a course, and stop at its ends', () => {
  const chapters = [{ id: '01', name: 'A' }, { id: '02', name: 'B' }, { id: '03', name: 'C' }]
  assert.deepEqual(neighbours(chapters, '02'), { previous: chapters[0], next: chapters[2] })
  assert.equal(neighbours(chapters, '01').previous, null)
  assert.equal(neighbours(chapters, '03').next, null)
  assert.deepEqual(neighbours(chapters, 'nope'), { previous: null, next: null })
})
