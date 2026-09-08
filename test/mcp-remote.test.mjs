import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { auth as authorizeMcp } from '@modelcontextprotocol/sdk/client/auth.js'
import { createMcpStore } from '../lib/mcp-store.mjs'
import { createMcpOAuth } from '../lib/mcp-oauth.mjs'
import { handleRemoteMcp } from '../lib/mcp-service.mjs'
import { internalMcpAuth } from '../lib/mcp-bridge.mjs'
import { createMcpApiBridge } from '../lib/mcp-bridge.mjs'
import { authorise } from '../lib/auth.mjs'
import { reserveRemoteModelBudget } from '../lib/mcp-model-budget.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { AI_LIMITS } from '../lib/ai-usage.mjs'

const origin='https://study.example.com',redirect='https://client.example.com/callback'
async function grant(oauth,{userId='student-a',scope='read write',method='none'}={}) {
  const client=await oauth.register({client_name:'Test client',redirect_uris:[redirect],token_endpoint_auth_method:method,scope})
  const verifier=randomBytes(32).toString('base64url')
  const location=await oauth.authorize({client_id:client.client_id,redirect_uri:redirect,resource:oauth.protectedMetadata.resource,response_type:'code',scope,code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url'),state:'caller-state'})
  const request=new URL(location).searchParams.get('request')
  const approved=await oauth.consent(request,userId,true)
  assert.equal(new URL(approved.redirect).searchParams.get('state'),'caller-state')
  const body={client_id:client.client_id,...(method==='client_secret_post'?{client_secret:client.client_secret}:{}),grant_type:'authorization_code',code:new URL(approved.redirect).searchParams.get('code'),redirect_uri:redirect,code_verifier:verifier,resource:oauth.protectedMetadata.resource}
  const authorization=method==='client_secret_basic'?`Basic ${Buffer.from(`${client.client_id}:${client.client_secret}`).toString('base64')}`:undefined
  return {client,body,authorization,request}
}

test('OAuth binds approval, PKCE, callback, client and resource; codes are single use',async()=>{
  const oauth=createMcpOAuth({store:createMcpStore(null),origin})
  const issued=await grant(oauth)
  await assert.rejects(()=>oauth.consent(issued.request,'student-b',true),/already/)
  for(const override of [{resource:'https://attacker.example/api/mcp'},{redirect_uri:'https://attacker.example/callback'},{code_verifier:'A'.repeat(43)}])await assert.rejects(()=>oauth.token({...issued.body,...override}),/resource|proof|callback/)
  const results=await Promise.allSettled([oauth.token(issued.body),oauth.token(issued.body)])
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1)
  const tokens=results.find(result=>result.status==='fulfilled').value
  assert.equal((await oauth.verify(tokens.access_token)).userId,'student-a')
  assert.equal(await oauth.verify('wmo_invalid'),null)
})

test('refresh rotates, rejects scope escalation, detects replay and revokes the token family',async()=>{
  const oauth=createMcpOAuth({store:createMcpStore(null),origin}),issued=await grant(oauth,{scope:'read'})
  const first=await oauth.token(issued.body)
  const refresh={client_id:issued.client.client_id,grant_type:'refresh_token',refresh_token:first.refresh_token,resource:oauth.protectedMetadata.resource}
  await assert.rejects(()=>oauth.token({...refresh,scope:'read write'}),/expand/)
  const second=await oauth.token(refresh)
  assert.ok(await oauth.verify(second.access_token))
  await assert.rejects(()=>oauth.token(refresh),/reuse/)
  assert.equal(await oauth.verify(first.access_token),null)
  assert.equal(await oauth.verify(second.access_token),null)
})

test('public and confidential clients work; secrets, redirects and scope escalation are rejected',async()=>{
  for(const method of ['none','client_secret_post','client_secret_basic']){
    const store=createMcpStore(null),oauth=createMcpOAuth({store,origin}),issued=await grant(oauth,{method})
    if(method!=='none'){
      assert.ok(!(await store.get('client',issued.client.client_id)).value.client_secret)
      await assert.rejects(()=>oauth.token({...issued.body,client_secret:'wrong'}),/authentication/)
    }
    const tokens=await oauth.token(issued.body,issued.authorization)
    await oauth.revoke({client_id:issued.client.client_id,...(method==='client_secret_post'?{client_secret:issued.client.client_secret}:{}),token:tokens.access_token},issued.authorization)
    assert.equal(await oauth.verify(tokens.access_token),null)
  }
  const oauth=createMcpOAuth({store:createMcpStore(null),origin})
  for(const value of ['javascript:alert(1)','https://good.example/cb#bad','http://remote.example/cb'])await assert.rejects(()=>oauth.register({redirect_uris:[value]}),/callback|Callbacks/)
  await assert.rejects(()=>oauth.register({redirect_uris:[redirect],scope:'admin'}),/scopes/)
})

test('atomic budgets do not overspend under concurrent requests',async()=>{
  const store=createMcpStore(null)
  const results=await Promise.all(Array.from({length:40},()=>store.charge('shared-user',4,20,60000)))
  assert.equal(results.filter(Boolean).length,5)
})

test('hosted model budget reserves before calls and shares the account ceiling across connections',async()=>{
  const store=createMcpStore(null)
  const id=`mcp-model:day:${Math.floor(Date.now()/86400000)}:user:student`
  await store.charge(id,AI_LIMITS.tokensPerDay-1100,AI_LIMITS.tokensPerDay,86400000)
  const auth={remoteMcp:true,userId:'student',keyId:'one',mcpBudgetStore:store}
  const settle=await withRequestContext(auth,()=>reserveRemoteModelBudget({message:'hello'},30))
  await assert.rejects(()=>withRequestContext({...auth,keyId:'two'},()=>reserveRemoteModelBudget({message:'hello'},30)),/token budget/)
  await settle({prompt_tokens:3,completion_tokens:4})
  assert.ok(await withRequestContext({...auth,keyId:'two'},()=>reserveRemoteModelBudget({message:'hello'},30)))
})

test('concurrency leases resist double acquisition and stale release',async()=>{
  const store=createMcpStore(null)
  assert.equal(await store.acquireLease('account-slot','first',60000),true)
  assert.equal(await store.acquireLease('account-slot','second',60000),false)
  await store.releaseLease('account-slot','second')
  assert.equal(await store.acquireLease('account-slot','third',60000),false)
  await store.releaseLease('account-slot','first')
  assert.equal(await store.acquireLease('account-slot','third',60000),true)
})

test('original range bridge returns exact binary bytes and range metadata without filesystem writes',async()=>{
  const bytes=Buffer.from([0,255,1,128,42])
  const api=createMcpApiBridge(async(req,res)=>{
    assert.equal(req.headers.range,'bytes=0-4')
    assert.equal(internalMcpAuth.get(req).userId,'student')
    res.writeHead(206,{'content-type':'application/pdf','content-range':'bytes 0-4/5','etag':'source-hash'})
    res.end(bytes)
  },{userId:'student',mode:'api-key',scopes:['read']})
  const result=await api('/api/corpus/assets/source',{range:'bytes=0-4'})
  assert.deepEqual(Buffer.from(result.data,'base64'),bytes)
  assert.equal(result.contentRange,'bytes 0-4/5')
  await assert.rejects(()=>api('https://other.example/file'),/Unsupported/)
})

test('real Streamable HTTP client discovers tools/guidance, preserves account isolation and read scopes',async t=>{
  const store=createMcpStore(null);let dependencies
  const calls=[]
  const apiHandler=async(req,res)=>{
    const auth=internalMcpAuth.get(req)
    calls.push({auth,tool:req.headers['x-wicker-tool'],confirmed:req.headers['x-wicker-confirmed']})
    const denial=authorise(auth,{method:req.method,pathname:new URL(req.url,'https://example.com').pathname})
    res.writeHead(denial?403:200,{'content-type':'application/json'})
    res.end(JSON.stringify(denial?{error:denial}:{userId:auth.userId,courses:[]}))
  }
  const server=createServer((req,res)=>handleRemoteMcp(req,res,{handler:apiHandler,ip:'test-ip',dependencies}))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise(resolve=>server.close(resolve)))
  const host=`http://127.0.0.1:${server.address().port}`
  dependencies={store,origin:host,oauth:createMcpOAuth({store,origin:host})}
  const preflight=await fetch(`${host}/api/mcp/original`,{method:'OPTIONS',headers:{Origin:host,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,if-match,range'}})
  assert.equal(preflight.status,204)
  assert.match(preflight.headers.get('access-control-allow-headers'),/If-Match/)
  assert.match(preflight.headers.get('access-control-allow-methods'),/HEAD/)
  assert.match(preflight.headers.get('access-control-expose-headers'),/Content-Range/)
  const forbiddenDownloadOrigin=await fetch(`${host}/api/mcp/original`,{method:'OPTIONS',headers:{Origin:'https://unregistered.example'}})
  assert.equal(forbiddenDownloadOrigin.status,403)
  const challenge=await fetch(`${host}/api/mcp`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})
  assert.equal(challenge.status,401)
  assert.match(challenge.headers.get('www-authenticate'),/resource_metadata/)
  const metadata=await (await fetch(`${host}/.well-known/oauth-protected-resource/api/mcp`)).json()
  assert.equal(metadata.resource,`${host}/api/mcp`)
  // The SDK performs metadata discovery, dynamic registration, PKCE and the
  // code exchange itself. Only the user's browser approval is simulated here.
  let clientInfo,tokens,verifier,authorizationUrl
  const provider={
    redirectUrl:redirect,
    clientMetadata:{client_name:'SDK OAuth consumer',redirect_uris:[redirect],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code'],scope:'read'},
    clientInformation:()=>clientInfo,saveClientInformation:value=>{clientInfo=value},
    tokens:()=>tokens,saveTokens:value=>{tokens=value},
    saveCodeVerifier:value=>{verifier=value},codeVerifier:()=>verifier,
    redirectToAuthorization:value=>{authorizationUrl=value}
  }
  assert.equal(await authorizeMcp(provider,{serverUrl:new URL(`${host}/api/mcp`)}),'REDIRECT')
  const destination=await fetch(authorizationUrl,{redirect:'manual'})
  assert.equal(destination.status,302)
  const pending=new URL(destination.headers.get('location')).searchParams.get('request')
  // Force an unauthenticated identity in the development-auth test server.
  // The browser must sign in first; neither inspecting nor
  // attempting approval consumes the pending request or issues a code.
  const signedOutRead=await fetch(`${host}/api/mcp/consent?request=${encodeURIComponent(pending)}`,{headers:{authorization:'Bearer wsk_invalid'}})
  assert.equal(signedOutRead.status,401)
  const signedOutApproval=await fetch(`${host}/api/mcp/consent`,{method:'POST',headers:{'content-type':'application/json',origin:host,authorization:'Bearer wsk_invalid'},body:JSON.stringify({request:pending,approved:true})})
  assert.equal(signedOutApproval.status,401)
  assert.equal((await dependencies.oauth.pending(pending)).name,'SDK OAuth consumer')
  // Simulate completed browser authentication and explicit consent. The real
  // SDK then finishes the PKCE exchange with the original connection state.
  const approval=await dependencies.oauth.consent(pending,'sdk-student',true)
  assert.equal(await authorizeMcp(provider,{serverUrl:new URL(`${host}/api/mcp`),authorizationCode:new URL(approval.redirect).searchParams.get('code')}),'AUTHORIZED')
  const oauthClient=new Client({name:'oauth-integration-test',version:'1.0'})
  await oauthClient.connect(new StreamableHTTPClientTransport(new URL(`${host}/api/mcp`),{authProvider:provider}))
  assert.equal(JSON.parse((await oauthClient.callTool({name:'wicker_status',arguments:{}})).content[0].text).userId,'sdk-student')
  await oauthClient.close()
  for(const userId of ['student-a','student-b']){
    const issued=await grant(dependencies.oauth,{userId,scope:'read'}),tokens=await dependencies.oauth.token(issued.body)
    const client=new Client({name:'integration-test',version:'1.0'})
    t.after(()=>client.close())
    await client.connect(new StreamableHTTPClientTransport(new URL(`${host}/api/mcp`),{requestInit:{headers:{Authorization:`Bearer ${tokens.access_token}`}}}))
    const listed=await client.listTools()
    assert.ok(Buffer.byteLength(JSON.stringify(listed))<128*1024,'tool discovery fits the reserved response capacity')
    assert.ok(listed.tools.some(tool=>tool.name==='list_courses'))
    assert.ok(listed.tools.some(tool=>tool.name==='prepare_original_download'))
    assert.ok(listed.tools.some(tool=>tool.name==='study_generation_contract'))
    assert.ok(!listed.tools.some(tool=>tool.name==='download_course_original'||tool.name.startsWith('admin_')))
    const guidance=await client.callTool({name:'wicker_guidance',arguments:{}})
    assert.match(guidance.content[0].text,/tutor_sources/)
    const resources=await client.listResources()
    assert.ok(resources.resources.some(resource=>resource.uri==='wicker://guidance/current'))
    const result=await client.callTool({name:'list_courses',arguments:{}})
    assert.equal(JSON.parse(result.content[0].text).userId,userId)
    const unconfirmed=await client.callTool({name:'set_mastery',arguments:{courseId:'course',itemId:'item',mastery:2}})
    assert.equal(unconfirmed.isError,true)
    const denied=await client.callTool({name:'create_flashcard',arguments:{courseId:'course',chapterId:'one',front:'Question',back:'Answer',confirmed:true}})
    assert.equal(denied.isError,true)
    assert.match(denied.content[0].text,/read-only/)
    const forbiddenOrigin=await fetch(`${host}/api/mcp`,{method:'POST',headers:{Origin:'https://unregistered.example',Authorization:`Bearer ${tokens.access_token}`,'content-type':'application/json'},body:'{}'})
    assert.equal(forbiddenOrigin.status,403)
    await client.close()
  }
  assert.ok(calls.every(call=>call.auth.remoteMcp))
  assert.ok(calls.some(call=>call.tool==='list_courses'))
  const limited=await grant(dependencies.oauth,{userId:'limited-student',scope:'read'})
  const limitedTokens=await dependencies.oauth.token(limited.body)
  const headers={authorization:`Bearer ${limitedTokens.access_token}`,accept:'application/json, text/event-stream','content-type':'application/json'}
  const oversized=await fetch(`${host}/api/mcp`,{method:'POST',headers,body:JSON.stringify({padding:'a'.repeat(256*1024)})})
  assert.equal(oversized.status,413)
  await store.charge(`mcp-tokens:minute:${Math.floor(Date.now()/60000)}:user:limited-student`,900000,1000000,120000)
  const callsBefore=calls.length
  const throttled=await fetch(`${host}/api/mcp`,{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'list_courses',arguments:{}}})})
  assert.equal(throttled.status,429)
  assert.ok(Number(throttled.headers.get('retry-after'))>0)
  assert.match((await throttled.json()).error.message,/token budget/)
  assert.equal(calls.length,callsBefore,'a rejected reservation must not execute the tool')
})
