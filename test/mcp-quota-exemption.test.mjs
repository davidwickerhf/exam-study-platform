import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {accountQuotaExemption} from '../lib/ai-quota-policy.mjs'
import {handleMcpRequest,MCP_LIMITS} from '../lib/mcp-http.mjs'
import {createMcpStore} from '../lib/mcp-store.mjs'
import {reserveRemoteModelBudget} from '../lib/mcp-model-budget.mjs'
import {AI_LIMITS} from '../lib/ai-usage.mjs'
import {withRequestContext} from '../lib/request-context.mjs'

const quotaExemption=options=>accountQuotaExemption({...options,lookup:async owner=>({email:owner==='owner'?'davidwickerhf@gmail.com':'student@example.com'})})

test('exhausted MCP allowances do not block exempt API keys or OAuth grants; status reports effective limits and usage is still recorded',async t=>{
  const store=createMcpStore(null),charges=[]
  const charge=store.charge.bind(store)
  store.charge=async(...args)=>{charges.push(args);return charge(...args)}
  const server=createServer(async(req,res)=>{
    if(req.method!=='POST'){res.writeHead(405);res.end();return}
    const chunks=[];for await(const part of req)chunks.push(part)
    const body=JSON.parse(Buffer.concat(chunks).toString())
    // Identity has already been authenticated by mcp-service in production.
    const keyId=req.headers.authorization.slice(7),userId=keyId==='ordinary-key'?'ordinary':'owner'
    await handleMcpRequest(req,res,{body,store,auth:{userId,keyId,scopes:['read']},api:async()=>({courses:[]}),quotaExemption})
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve))})
  const url=new URL(`http://127.0.0.1:${server.address().port}/api/mcp`)
  for(const keyId of ['personal-key','oauth-existing','oauth-new']){
    for(const [period,window,limit] of [['minute',60000,MCP_LIMITS.tokenUnitsPerMinute],['day',86400000,MCP_LIMITS.tokenUnitsPerDay]]){
      for(const id of [`user:owner`,`key:${keyId}`]) await store.charge(`mcp-tokens:${period}:${Math.floor(Date.now()/window)}:${id}`,limit,Number.MAX_SAFE_INTEGER,window*2)
    }
    const client=new Client({name:'quota-test',version:'1'})
    await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{authorization:`Bearer ${keyId}`}}}))
    const status=JSON.parse((await client.callTool({name:'wicker_status',arguments:{}})).content[0].text)
    assert.equal(status.unlimited,true)
    assert.equal(status.exemptionReason,'account')
    assert.equal(status.limits.tokenUnitsPerDay,null)
    assert.equal(status.limits.tokenUnitsPerMinute,null)
    assert.equal(status.downloadLimits.bytesPerDay,null)
    assert.equal(status.limits.requestsPerMinute,MCP_LIMITS.requestsPerMinute)
    assert.equal(status.limits.resultBytes,MCP_LIMITS.resultBytes)
    assert.deepEqual(JSON.parse((await client.callTool({name:'list_courses',arguments:{}})).content[0].text),{courses:[]})
    await client.close()
  }
  assert.ok(charges.some(([id,cost,limit])=>id.startsWith('mcp-tokens:')&&cost<0&&limit===Number.MAX_SAFE_INTEGER),'actual usage is reconciled even for exempt accounts')
  const headers={authorization:'Bearer ordinary-key','content-type':'application/json',accept:'application/json, text/event-stream'}
  await store.charge(`mcp-tokens:day:${Math.floor(Date.now()/86400000)}:user:ordinary`,MCP_LIMITS.tokenUnitsPerDay,MCP_LIMITS.tokenUnitsPerDay,172800000)
  const body=JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'wicker_status',arguments:{unlimited:true,email:'davidwickerhf@gmail.com'}}})
  const denied=await fetch(url,{method:'POST',headers,body})
  assert.equal(denied.status,429)
  assert.match((await denied.json()).error.message,/day token budget/)
  await store.charge('mcp-requests:user:owner',MCP_LIMITS.requestsPerMinute,Number.MAX_SAFE_INTEGER,60000)
  const rateLimited=await fetch(url,{method:'POST',headers:{...headers,authorization:'Bearer personal-key'},body})
  assert.equal(rateLimited.status,429)
  assert.match((await rateLimited.json()).error.message,/request limit/)
})

test('hosted AI reservations inherit owner exemption across keys and keep usage accounting',async()=>{
  const store=createMcpStore(null),day=`day:${Math.floor(Date.now()/86400000)}`
  for(const keyId of ['personal-key','oauth-existing']){
    for(const id of ['user:owner',`key:${keyId}`])await store.charge(`mcp-model:${day}:${id}`,AI_LIMITS.tokensPerDay,Number.MAX_SAFE_INTEGER,172800000)
    const settle=await withRequestContext({remoteMcp:true,userId:'owner',keyId,mcpBudgetStore:store},()=>reserveRemoteModelBudget({message:'hello'},30,{quotaExemption}))
    assert.equal(typeof settle,'function')
    await settle({prompt_tokens:3,completion_tokens:4})
  }
  await store.charge(`mcp-model:${day}:user:ordinary`,AI_LIMITS.tokensPerDay,AI_LIMITS.tokensPerDay,172800000)
  await assert.rejects(()=>withRequestContext({remoteMcp:true,userId:'ordinary',keyId:'other',mcpBudgetStore:store,unlimited:true},()=>reserveRemoteModelBudget({message:'hello'},30,{quotaExemption})),{status:429})
})
