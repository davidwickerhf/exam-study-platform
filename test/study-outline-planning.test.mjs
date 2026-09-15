import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeStudyOutline} from '../lib/study-version-pipeline.mjs'
import {teachingPlanPrompt} from '../lib/study-pedagogy.mjs'
import {outlinePrompt,resolveOutlineGroups,inputHash} from '../lib/study-version-content.mjs'

function snapshot(lengths,scopeLength=10000){
 return {sources:[{key:'teaching',title:'Lectures'},{key:'scope',title:'Course manual'}],chunks:[...lengths.map((size,index)=>({id:`e-${index}`,sourceKey:'teaching',text:'x'.repeat(size)})),{id:'e-scope',sourceKey:'scope',text:'s'.repeat(scopeLength)}]}
}
function outline(s){return {topics:[{id:'mechanism',title:'A connected mechanism',sourceIds:s.chunks.map(c=>c.id)}],gaps:[]}}

test('coherent topics can cross mapper batches without manufacturing extra chapters',()=>{
 const s=snapshot([12000,12000,12000,12000])
 const result=normalizeStudyOutline(outline(s),s)
 assert.equal(result.topics.length,1)
 assert.deepEqual(new Set(result.topics[0].sourceIds),new Set(s.chunks.map(c=>c.id)))
 assert.deepEqual(result.unmappedSourceIds,[])
})

test('scope consumes shared packet capacity once and every evidence passage survives necessary splits',()=>{
 const s=snapshot([20000,20000,20000,20000])
 const result=normalizeStudyOutline(outline(s),s)
 assert.equal(result.topics.length,2)
 assert.deepEqual(new Set(result.topics.flatMap(t=>t.sourceIds)),new Set(s.chunks.map(c=>c.id)))
 for(const topic of result.topics){
  const evidence=s.chunks.filter(c=>topic.sourceIds.includes(c.id)||c.sourceKey==='scope')
  assert.ok(evidence.reduce((n,c)=>n+c.text.length,0)<=72000)
  assert.equal(topic.sourceIds.filter(id=>id==='e-scope').length,1)
 }
 assert.deepEqual(result.unmappedSourceIds,[])
})

test('planning retains prior concept identity and refuses evidence that cannot fit without truncation',()=>{
 const s=snapshot([10000])
 assert.equal(normalizeStudyOutline(outline(s),s,[{id:'saved-topic',title:'A connected mechanism'}]).topics[0].id,'saved-topic')
 for(const s of [snapshot([10000],72000),snapshot([65000],10000)])assert.throws(()=>normalizeStudyOutline(outline(s),s),/no evidence was omitted/)
 const invalid=outline(s);invalid.topics[0].sourceIds.push('unknown')
 assert.throws(()=>normalizeStudyOutline(invalid,s),/evidence|source/i)
})

test('outline instructions distinguish candidate concepts from chapters and preserve difficult objectives',()=>{
 const prompt=outlinePrompt({courseCode:'TEST'},[],[],{chapterEvidenceCharacters:72000,scopeCharacters:10000,evidenceSizes:[]})
 assert.match(prompt,/candidate concepts, not a required chapter/)
 assert.match(prompt,/Do not omit difficult content/)
 assert.match(prompt,/72000/)
 assert.doesNotMatch(prompt,/Do not merge more than 8/)
})


test('teaching plans receive neighboring responsibilities without hiding necessary prerequisites',()=>{
 const prompt=teachingPlanPrompt('Evidence',{id:'ledger',title:'Ledger structure'},[{id:'ledger',title:'Ledger structure'},{id:'consensus',title:'Consensus and finality'}])
 assert.match(prompt,/Consensus and finality/)
 assert.match(prompt,/retaining the full explanation needed to solve/)
 assert.match(prompt,/do not expand a neighboring chapter/)
 assert.match(prompt,/Do not omit an essential mechanism/)
})


test('compact outline groups preserve all concept and evidence provenance exactly',()=>{
 const maps=[{topics:[{id:'a',title:'Mechanism A',sourceIds:['e-1','e-2']},{id:'b',title:'Mechanism B',sourceIds:['e-2','e-3']}],gaps:['Current-year scope limits apply.']}]
 const result=resolveOutlineGroups({topics:[{id:'combined',title:'Interacting mechanisms',topicRefs:['map-0-topic-0','map-0-topic-1']}],gaps:[]},maps)
 assert.deepEqual(result.topics[0].sourceIds,['e-1','e-2','e-3'])
 assert.deepEqual(result.topics[0].concepts,['Mechanism A','Mechanism B'])
 assert.deepEqual(result.gaps,maps[0].gaps)
 for(const refs of [['map-0-topic-0'],['unknown'],['map-0-topic-0','map-0-topic-0']])assert.throws(()=>resolveOutlineGroups({topics:[{id:'combined',title:'Combined',topicRefs:refs}],gaps:[]},maps),/omitted|unknown|twice/)
})


test('concept regrouping invalidates teaching inputs without invalidating unchanged legacy topics',()=>{
 const s=snapshot([10000]);const topic=outline(s).topics[0]
 assert.equal(inputHash(topic,s.chunks),inputHash({...topic,concepts:[topic.title]},s.chunks))
 assert.notEqual(inputHash(topic,s.chunks),inputHash({...topic,concepts:[topic.title,'Another mechanism']},s.chunks))
})


test('historical administration is not automatic current-year scope, but stays available when selected',()=>{
 const s=snapshot([12000,12000,12000,12000])
 s.sources[1].academicYear='2026-2027'
 s.sources.push({key:'historical',title:'Course manual',academicYear:'2025-2026'})
 s.chunks.push({id:'e-historical',sourceKey:'historical',text:'h'.repeat(30000)})
 const result=outline(s);result.topics[0].sourceIds=result.topics[0].sourceIds.filter(id=>id!=='e-historical')
 assert.equal(normalizeStudyOutline(result,s,[],{academicYear:'2026-2027'}).topics.length,1)
 assert.equal(normalizeStudyOutline(result,s).topics.length,2,'unknown edition retains conservative scope context')
 const selected=normalizeStudyOutline(outline(s),s,[],{academicYear:'2026-2027'})
 assert.equal(selected.topics.length,2)
 assert.ok(selected.topics.some(t=>t.sourceIds.includes('e-historical')))
 assert.equal(s.chunks.at(-1).text.length,30000,'original historical evidence remains intact')
})
