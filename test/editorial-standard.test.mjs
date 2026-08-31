import test from 'node:test'
import assert from 'node:assert/strict'
import { EDITORIAL_STANDARD, EDITORIAL_STANDARD_VERSION, editorialStudyPageIssues } from '../lib/editorial-workflow.mjs'

test('editorial standard requires direct, source-preserving teaching', () => {
  assert.equal(EDITORIAL_STANDARD.version, EDITORIAL_STANDARD_VERSION)
  assert.match(EDITORIAL_STANDARD.teaching, /worked example/i)
  assert.match(EDITORIAL_STANDARD.publication, /thin summaries/i)
})

test('study-page quality check rejects thin curriculum commentary', () => {
  const issues = editorialStudyPageIssues('This course covers greedy algorithms and dynamic programming.')
  assert.ok(issues.some((issue) => /too short/i.test(issue)))
  assert.ok(issues.some((issue) => /meta-summary/i.test(issue)))
  assert.ok(issues.some((issue) => /worked example/i.test(issue)))
})

test('study-page quality check accepts a direct explanatory page shape', () => {
  const page = `# Greedy choice property

## The idea

A greedy algorithm commits to one locally optimal choice and never revisits it. That
commitment is valid only when an optimal full solution can be rearranged to contain the
same first choice. The proof is an exchange argument: begin with an optimal solution,
replace its first incompatible choice with the greedy one, and show that feasibility and
the objective value do not get worse.

## Why it works

The mechanism is not “greedy choices usually work.” The candidate choice must leave a
subproblem whose optimum is independent of the discarded alternatives. If the exchange
cannot be justified, local optimality is only a heuristic and may fail.

## Worked example

For interval scheduling, sort intervals by finishing time. Choose the interval that
finishes first, remove every interval that overlaps it, then repeat. Replacing the
first interval of an optimal schedule with the earliest-finishing compatible interval
cannot reduce the number of later intervals that fit, because the replacement frees at
least as much time. The same argument applies after the first choice, so induction
proves optimality.

## Common mistakes and limits

Choosing the shortest interval is not the same rule and can fail. A weighted interval
scheduling problem also breaks the simple exchange argument: an early low-value interval
can block a later high-value one, so dynamic programming is needed instead.

## Check yourself

Before applying a greedy rule, state the exchange argument and construct a counterexample
for a plausible alternative rule.`
  assert.deepEqual(editorialStudyPageIssues(page), [])
})
