import test from 'node:test'
import assert from 'node:assert/strict'
import { priorityEvidenceCandidates } from '../lib/priority-evidence.mjs'

test('priority retrieval keeps obligation evidence and ranks authoritative sources first', () => {
  const rows = [
    { chunkId: 3, sourceType: 'slides', content: 'The group project is due on 18 October.', filename: 'week-1.pdf' },
    { chunkId: 2, sourceType: 'materials', content: 'Welcome to the course.', filename: 'readme.txt' },
    { chunkId: 1, sourceType: 'syllabus', content: 'Attendance at every tutorial is mandatory.', filename: 'syllabus.pdf' }
  ]
  assert.deepEqual(priorityEvidenceCandidates(rows).map((row) => row.chunkId), [1, 3])
})

test('priority retrieval does not turn ordinary teaching content into an obligation', () => {
  assert.deepEqual(priorityEvidenceCandidates([{ chunkId: 1, sourceType: 'slides', content: 'A graph has vertices and edges.' }]), [])
})
