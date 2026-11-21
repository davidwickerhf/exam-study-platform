import test from 'node:test'
import assert from 'node:assert/strict'
import {paperSelection,paperReadiness} from '../lib/workspace/paper-library.mjs'
test('a paused newer extraction never hides a checked section',()=>{
 const done={id:'old',questionSourceKey:'p',status:'complete',questionCount:8}
 const next={...done,id:'new',status:'pending',questionCount:0}
 const job={sourceKey:'p',setId:'new',status:'paused'}
 const info=paperSelection([next,done],[job],'p')
 assert.equal(info.ready,done)
 assert.equal(paperReadiness(info.ready,job),'8 questions ready · selected pages')
 assert.equal(paperSelection([next,done],[job],'p','new').ready,undefined)
 assert.equal(paperSelection([next,done],[job],'other').ready,undefined)
})
test('finished automatic sets and empty results are labelled honestly',()=>{
 const ready={id:'whole',questionCount:2}
 assert.equal(paperReadiness(ready,{setId:'whole',status:'complete'}),'2 questions ready')
 assert.equal(paperReadiness(undefined,{setId:'whole',status:'complete'}),'No questions found')
})
