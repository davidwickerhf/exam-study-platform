import test from 'node:test'
import assert from 'node:assert/strict'
import { assessTextQuality } from '../lib/editorial-workflow.mjs'

const prose = ('Numerical methods approximate solutions to problems that have no closed form. ' +
  'The bisection method brackets a root and halves the interval until the width is below a tolerance. ' +
  'Convergence is linear, so each step gains a fixed number of bits of accuracy. ').repeat(4)

test('ordinary course prose is readable', () => {
  const q = assessTextQuality(prose, { pages: 2 })
  assert.equal(q.readable, true)
  assert.ok(q.score > 0.8, `score was ${q.score}`)
})

test('a formula sheet is not penalised for being symbolic', () => {
  const formulas = 'Let f(x) = 0 where a < x < b and tolerance eps > 0. ' +
    'x_{n+1} = x_n - f(x_n)/f\'(x_n) for Newton iteration with quadratic convergence near a simple root. ' +
    'The trapezoid rule gives h/2 (f_0 + 2 f_1 + ... + f_n) with error term proportional to h squared. '
  assert.equal(assessTextQuality(formulas.repeat(3), { pages: 1 }).readable, true)
})

// What the real handwritten lecture notes produced.
test('garbled optical recognition is rejected', () => {
  const garbled = 'rn tlie qq xz frn 1l1 vv nnn rrn tlie qq xz frn 1l1 vv nnn cl1 rn tlie qq xz frn 1l1 '.repeat(6)
  const q = assessTextQuality(garbled, { pages: 9 })
  assert.equal(q.readable, false)
  assert.match(q.reason, /readable|recognition/)
})

test('an empty or near-empty extraction is rejected', () => {
  assert.equal(assessTextQuality('', {}).readable, false)
  assert.equal(assessTextQuality('page 1', {}).readable, false)
})

test('a scan yielding a few words per page is rejected', () => {
  const q = assessTextQuality(Array.from({ length: 60 }, () => 'figure').join(' '), { pages: 30 })
  assert.equal(q.readable, false)
  assert.match(q.reason, /per page/)
})
