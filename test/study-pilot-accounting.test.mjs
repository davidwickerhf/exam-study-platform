import test from 'node:test'
import assert from 'node:assert/strict'
import {pilotAccounting} from '../scripts/verification/study-pilot-accounting.mjs'
test('an unmeasured rejected call retains its reservation without inventing token cost',()=>{
 const summary=pilotAccounting({model:'gpt-6-astra',calls:1,calculatedUsd:1.2,callDetails:[{error:{code:'provider_credits'}}]})
 assert.equal(summary.knownUsageUsd,0);assert.equal(summary.unsettledReservationUsd,1.2);assert.equal(summary.unknownUsageCalls,1)
})
test('measured initial and update calls are accounted separately, including cache writes',()=>{
 const call={usage:{inputTokens:1000,outputTokens:100,cachedInputTokens:0,cacheWriteInputTokens:1000}}
 const summary=pilotAccounting({model:'gpt-6-astra',calls:2,calculatedUsd:0.035,callDetails:[{...call,experimentPhase:'initial'},{...call,experimentPhase:'update'}]})
 assert.equal(summary.measuredCalls,2);assert.ok(Math.abs(summary.knownUsageUsd-0.035)<1e-9)
 assert.equal(summary.phases.initial.inputTokens,1000);assert.equal(summary.phases.update.calls,1);assert.equal(summary.unsettledReservationUsd,0)
})
