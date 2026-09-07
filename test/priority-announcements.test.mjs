import test from 'node:test'
import assert from 'node:assert/strict'
import { priorityAnnouncementDocument } from '../lib/priority-announcements.mjs'
const binding={origin:'https://canvas.example.edu',canvas_course_id:'10',course_code:'TEST1000',academic_year:'2026-2027'}
test('announcement evidence preserves publication anchors and complete text across chunks with safe originals',()=>{
  const row={id:42,title:'Pitch preparation',posted_at:'2026-09-07T07:18:00Z',message:'<p>Tomorrow: prepare a one-page pitch.</p>'+ '<p>Details and feedback instructions.</p>'.repeat(400)+'<script>steal()</script>'}
  const doc=priorityAnnouncementDocument(row,binding)
  assert.ok(doc.passages.length>1)
  assert.ok(doc.passages.every(p=>p.includes('Posted: 2026-09-07T07:18:00.000Z')))
  assert.ok(doc.text.includes('Tomorrow: prepare a one-page pitch.'))
  assert.ok(!doc.html.includes('<script>'))
  assert.equal(doc.sha,priorityAnnouncementDocument({...row,read_state:'read'},binding).sha)
  assert.notEqual(doc.sha,priorityAnnouncementDocument({...row,message:'New deadline tomorrow.'},binding).sha)
  assert.equal(priorityAnnouncementDocument({...row,published:false},binding),null)
  assert.equal(priorityAnnouncementDocument({...row,posted_at:'2099-01-01T00:00:00Z'},binding),null)
})
