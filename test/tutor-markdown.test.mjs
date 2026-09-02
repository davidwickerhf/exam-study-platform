// The tutor's answer is Markdown, and the single most useful thing in it is
// usually a Canvas link. Rendering it as plain text turned that link into an
// unclickable string, so it is parsed — and a parser that reads model output
// is worth pinning down: three separate wrong-but-plausible renderings shipped
// before this test existed (steps restarting at 1, sub-bullets detaching from
// their step, and hard line breaks folded into one run-on sentence).
//
// The React tutor and setup assistant import this same ESM implementation.

import test from 'node:test'
import assert from 'node:assert/strict'
import { tutorMarkdown } from '../lib/workspace/markdown.mjs'

test('a numbered answer keeps its own numbering across blank lines', () => {
  // Blank lines between steps are how the tutor spaces a plan out; they must
  // not restart the count, which is what three separate lists would do.
  const html = tutorMarkdown('1) First thing\n\n2) Second thing\n\n3) Third thing')
  assert.equal(html, '<ol><li>First thing</li><li>Second thing</li><li>Third thing</li></ol>')
})

test('a list that opens partway through carries its start number', () => {
  const html = tutorMarkdown('Some preamble.\n\n3) Third thing\n4) Fourth thing')
  assert.match(html, /<ol start="3"><li>Third thing<\/li><li>Fourth thing<\/li><\/ol>/)
})

test('a paragraph between steps ends the list', () => {
  const html = tutorMarkdown('1) First\n\nA note in between.\n\n1) A new first')
  assert.equal((html.match(/<ol/g) || []).length, 2)
})

test('bullets under a numbered step are that step, not a new list', () => {
  const html = tutorMarkdown('1) Attend your sessions:\n- 08:30 Lecture\n- 11:00 Lab\n\n2) Then revise')
  assert.match(html, /<li>Attend your sessions:<ul><li>08:30 Lecture<\/li><li>11:00 Lab<\/li><\/ul><\/li>/)
  assert.equal((html.match(/<ul/g) || []).length, 1)
})

test('a blank line before a bullet starts a list of its own', () => {
  const html = tutorMarkdown('1) A step\n\n- A separate point')
  assert.match(html, /<\/ol><ul><li>A separate point<\/li><\/ul>/)
})

test('hard line breaks stack a deadline instead of running it together', () => {
  const html = tutorMarkdown('- Quiz 1 — BCS3120  \n  Due: 2026-09-08  \n  Points: 5')
  assert.match(html, /Quiz 1 — BCS3120<br>Due: 2026-09-08<br>Points: 5/)
})

test('a wrapped line without a hard break still flows as one sentence', () => {
  const html = tutorMarkdown('- Submit the checkpoint\n  before the lecture')
  assert.match(html, /Submit the checkpoint before the lecture/)
  assert.doesNotMatch(html, /<br>/)
})

test('the Canvas link is a link, and it says where it goes', () => {
  const html = tutorMarkdown('Submit now: https://canvas.maastrichtuniversity.nl/courses/1/assignments/2')
  assert.match(html, /<a href="https:\/\/canvas\.maastrichtuniversity\.nl\/courses\/1\/assignments\/2" target="_blank" rel="noopener noreferrer">Open in Canvas<\/a>/)
})

test('a sentence keeps its full stop and the link does not', () => {
  const html = tutorMarkdown('See https://example.com/a.')
  assert.match(html, /href="https:\/\/example\.com\/a"/)
  assert.match(html, /<\/a>\.<\/p>/)
})

test('a labelled link is not auto-linked a second time', () => {
  const html = tutorMarkdown('[the brief](https://example.com/brief)')
  assert.equal((html.match(/<a /g) || []).length, 1)
  assert.match(html, />the brief<\/a>/)
})

test('model output cannot inject markup', () => {
  const html = tutorMarkdown('<img src=x onerror=alert(1)> and <script>alert(2)</script>')
  assert.doesNotMatch(html, /<img|<script/)
  assert.match(html, /&lt;img/)
})

test('a javascript: URL is not turned into a link', () => {
  const html = tutorMarkdown('[click](javascript:alert(1))')
  assert.doesNotMatch(html, /<a /)
})

test('emphasis and code render, and a bare asterisk does not', () => {
  const html = tutorMarkdown('**BCS3120** uses `make` for *builds*')
  assert.match(html, /<strong>BCS3120<\/strong>/)
  assert.match(html, /<code>make<\/code>/)
  assert.match(html, /<em>builds<\/em>/)
})

test('a heading is a heading and a rule is dropped', () => {
  const html = tutorMarkdown('### This week\n\n---\n\nSomething')
  assert.match(html, /<h4>This week<\/h4>/)
  assert.doesNotMatch(html, /<hr/)
})

test('an empty answer renders nothing rather than an empty paragraph', () => {
  assert.equal(tutorMarkdown(''), '')
  assert.equal(tutorMarkdown('   \n\n  '), '')
})
