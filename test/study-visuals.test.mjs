import test from 'node:test'
import assert from 'node:assert/strict'
import { studyVisualIssues } from '../lib/study-visuals.mjs'
import { studyLessonQuality } from '../lib/study-content-quality.mjs'
import { lesson } from '../scripts/verification/study-fixtures.mjs'
import { teachingSchema, studyResponseSchema } from '../lib/study-version-content.mjs'

const visual = diagram => ({ title:'Explore the idea', caption:'An illustrative example, with values defined here.', basis:'illustrative', sourceIds:['e-1'], diagram })
test('visual validation catches broken relationships, mismatched tables and invalid plotted data', () => {
  const process = lesson(['e-1']).sections[2].visual
  assert.deepEqual(studyVisualIssues(process), [])
  process.diagram.edges[0].to = 'missing'
  assert.match(studyVisualIssues(process).join(' '), /existing nodes/)
  process.diagram.nodes[1].id = process.diagram.nodes[0].id
  assert.match(studyVisualIssues(process).join(' '), /unique identities/)
  assert.match(studyVisualIssues(visual({kind:'comparison',columns:['A','B','C'],rows:[{label:'One',cells:['a','b']},{label:'Two',cells:['a','b']}]})).join(' '), /column headings/)
  assert.match(studyVisualIssues(visual({kind:'plot',style:'line',xLabel:'Time',yLabel:'Value',points:[{label:'A',x:1,y:2},{label:'B',x:1,y:3}]})).join(' '), /distinct x/)
  assert.match(studyVisualIssues(visual({kind:'plot',style:'bar',xLabel:'Time',yLabel:'Value',points:[{label:'A',x:1,y:Infinity},{label:'B',x:2,y:3}]})).join(' '), /invalid/)
})
test('set visuals require actual membership and never accept executable or fetched graphics', () => {
  const spec = visual({kind:'sets',aLabel:'Even',bLabel:'Above 3',universe:['1','2','3','4','5','6'],a:['2','4','6'],b:['4','5','6']})
  assert.deepEqual(studyVisualIssues(spec), [])
  spec.diagram.a.push('7')
  assert.match(studyVisualIssues(spec).join(' '), /universe/)
  spec.caption = '<img src="https://example.com/tracker">'
  assert.match(studyVisualIssues(spec).join(' '), /executable markup/)
})
test('teaching gate rejects dense prose, empty summaries and shallow repetitive practice even with valid JSON', () => {
  const good = lesson(['e-1'])
  assert.ok(teachingSchema.safeParse(good).success)
  assert.deepEqual(studyLessonQuality(good), [])
  const bad = structuredClone(good)
  bad.sections.forEach(s => {s.visual=null;s.text += ' More text.'.repeat(80)})
  bad.summary.forEach(s => {s.text='This chapter covers addition and its topics.'})
  bad.questions.forEach(q => {q.skill='recall';q.difficulty='foundation';q.answer='Five.'})
  bad.flashcards.forEach(c => {c.front='What is addition?';c.kind='definition'})
  const issues=studyLessonQuality(bad).join(' ')
  for (const term of [/concise/,/visual/,/summary/,/progressive challenge/,/distinct prompts/]) assert.match(issues,term)
  const contract=studyResponseSchema(teachingSchema,['e-1'])
  assert.deepEqual(contract.properties.sections.items.properties.visual.anyOf[0].properties.sourceIds.items.enum,['e-1'])
})
