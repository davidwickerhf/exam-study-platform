import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMcpStore } from '../lib/mcp-store.mjs'
import { prepareOriginalDownload, serveOriginalDownload, ORIGINAL_DOWNLOAD_LIMITS as limits } from '../lib/original-downloads.mjs'
import { createApiKey, revokeApiKey } from '../lib/api-keys.mjs'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments } from '../lib/user-store.mjs'
import { originalByteRange, sendCorpusAsset } from '../lib/corpus-asset-response.mjs'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
function fixture(bytes = Buffer.from('complete original')) {
  const store = createMcpStore(null)
  const auth = { authenticated: true, mode: 'api-key', userId: 'student-a', keyId: 'key-a', scopes: ['read'] }
  const asset = { id: 'asset-a', byteSize: bytes.length, sha256: digest(bytes), filename: 'Résumé.pdf', mediaType: 'application/pdf' }
  let active = true, accessible = true
  const lookupAsset = async ({accountId, assetId}) => accessible && accountId === auth.userId && assetId === asset.id ? asset : null
  const validateIdentity = async ticket => active && ticket.userId === auth.userId && ticket.keyId === auth.keyId
  const readChunks = async ({first,last}) => Array.from({length:last-first+1},(_,i)=>({chunk_index:first+i,data:bytes.subarray((first+i)*524288,(first+i+1)*524288)}))
  return {store,auth,asset,lookupAsset,validateIdentity,readChunks,revoke(){active=false},deny(){accessible=false}}
}
async function http(t, env, overrides = {}) {
  const server = createServer(async(req,res)=>{
    try { await serveOriginalDownload(req,res,{...env,sendAsset:(req,res,asset,opts)=>sendCorpusAsset(req,res,asset,{...opts,readChunks:env.readChunks}),...overrides}) }
    catch(error) { if(res.headersSent)res.destroy();else{res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.code||error.message}))} }
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve))})
  const origin=`http://127.0.0.1:${server.address().port}`
  const descriptor=await prepareOriginalDownload({...env,assetId:env.asset.id,origin})
  return {descriptor,fetch:options=>fetch(descriptor.url,{...options,headers:{...descriptor.headers,...options?.headers}})}
}

test('direct HTTP transfers preserve multi-batch originals, metadata, HEAD and resumable ranges',async t=>{
  const bytes=Buffer.alloc(9*1024*1024+13);for(let i=0;i<bytes.length;i++)bytes[i]=i%251
  const env=fixture(bytes),remote=await http(t,env)
  assert.ok(JSON.stringify(remote.descriptor).length<3000)
  assert.equal(new URL(remote.descriptor.url).search,'')
  assert.match(remote.descriptor.headers.Authorization,/^Bearer wdl_/)
  assert.equal(remote.descriptor.sha256,digest(bytes))
  const head=await remote.fetch({method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(Number(head.headers.get('content-length')),bytes.length)
  assert.match(head.headers.get('content-disposition'),/^attachment;.*filename\*=UTF-8''R%C3%A9sum%C3%A9.pdf/)
  assert.equal(head.headers.get('cache-control'),'private, no-store')
  const full=await remote.fetch();assert.equal(full.status,200);assert.equal(digest(Buffer.from(await full.arrayBuffer())),digest(bytes))
  const a=await remote.fetch({headers:{Range:'bytes=0-599999'}}),b=await remote.fetch({headers:{Range:'bytes=600000-'}})
  assert.equal(a.status,206);assert.equal(b.status,206);assert.equal(b.headers.get('content-range'),`bytes 600000-${bytes.length-1}/${bytes.length}`)
  assert.equal(digest(Buffer.concat([Buffer.from(await a.arrayBuffer()),Buffer.from(await b.arrayBuffer())])),digest(bytes))
  assert.equal((await remote.fetch({headers:{'If-Match':'"wrong"'}})).status,412)
  assert.equal((await remote.fetch({headers:{Range:'bytes=99999999-'}})).status,416)
})

test('tickets cannot cross accounts or assets; forgery, lost access, revocation and expiry fail closed',async t=>{
  const env=fixture(),remote=await http(t,env)
  await assert.rejects(()=>prepareOriginalDownload({...env,assetId:'asset-b',origin:'https://study.example'}),{status:404})
  await assert.rejects(()=>prepareOriginalDownload({...env,auth:{...env.auth,userId:'student-b'},assetId:env.asset.id,origin:'https://study.example'}),{status:404})
  await assert.rejects(()=>prepareOriginalDownload({...env,auth:{...env.auth,scopes:['write']},assetId:env.asset.id,origin:'https://study.example'}),{status:403})
  assert.equal((await remote.fetch({headers:{Authorization:'Bearer wdl_'+'A'.repeat(43)}})).status,401)
  assert.equal((await fetch(remote.descriptor.url+'?token=anything')).status,400)
  assert.equal((await remote.fetch({method:'POST'})).status,405)
  env.asset.sha256='a'.repeat(64);assert.equal((await remote.fetch()).status,412);env.asset.sha256=remote.descriptor.sha256
  env.revoke();assert.equal((await remote.fetch()).status,401)
  const denied=fixture(),deniedRemote=await http(t,denied);denied.deny();assert.equal((await deniedRemote.fetch()).status,401)
  const expired=fixture(),expiredRemote=await http(t,expired)
  const read=expired.store.get.bind(expired.store);expired.store.get=async(kind,id)=>kind==='download'?null:read(kind,id)
  assert.equal((await expiredRemote.fetch()).status,401)
})

test('download reservations stop transfers before work and share byte budgets across keys',async t=>{
  const env=fixture(),remote=await http(t,env)
  const bucket=`download-bytes:${Math.floor(Date.now()/86400000)}:user:${env.auth.userId}`
  await env.store.charge(bucket,limits.bytesPerDay-env.asset.byteSize,limits.bytesPerDay,172800000)
  const first=await remote.fetch();assert.equal(first.status,200);await first.arrayBuffer()
  env.auth.keyId='key-b'
  const second=await http(t,env);const rejected=await second.fetch();assert.equal(rejected.status,429);assert.ok(Number(rejected.headers.get('retry-after'))>0)
  assert.equal((await second.fetch({method:'HEAD'})).status,200)
})

test('leases bound concurrent downloads and failed partial streams release unused reservations',async t=>{
  const env=fixture(Buffer.alloc(1024)),remote=await http(t,env,{sendAsset:async(req,res)=>{res.writeHead(200);res.write(Buffer.alloc(10));throw new Error('stream failed')}})
  await remote.fetch().then(response=>response.arrayBuffer()).catch(()=>{})
  // The request can fail before fetch resolves or after its first bytes; either
  // way only bytes passed to the response writer stay charged.
  const bucket=`download-bytes:${Math.floor(Date.now()/86400000)}:user:${env.auth.userId}`
  assert.equal(await env.store.charge(bucket,limits.bytesPerDay-10,limits.bytesPerDay,172800000),true)
  assert.equal(await env.store.charge(bucket,1,limits.bytesPerDay,172800000),false)
  for(let i=0;i<limits.concurrent;i++)assert.equal(await env.store.acquireLease(`download:${env.auth.userId}:${i}`,'held',60000),true)
  const blocked=await remote.fetch();assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'5')
})

test('local originals and empty files stream correctly without escaping the asset directory',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'original-download-'));t.after(()=>rm(dir,{recursive:true,force:true}))
  const env=fixture();await writeFile(join(dir,'original'),Buffer.from('complete original'));env.asset.localObjectKey='original'
  const remote=await http(t,env,{sendAsset:(req,res,asset,opts)=>sendCorpusAsset(req,res,asset,{...opts,assetDirectory:dir})})
  assert.equal(await (await remote.fetch()).text(),'complete original')
  env.asset.localObjectKey='../outside';assert.equal((await remote.fetch()).status,500)
  const empty=await http(t,fixture(Buffer.alloc(0)));assert.equal((await empty.fetch()).headers.get('content-length'),'0')
  assert.equal((await empty.fetch({headers:{Range:'bytes=0-'}})).status,416)
})

test('byte ranges reject malformed and unsafe values without confusing suffixes or empty files',()=>{
  assert.deepEqual(originalByteRange(10,'bytes=-3'),{start:7,end:9,length:3,partial:true})
  assert.deepEqual(originalByteRange(10,'bytes=3-'),{start:3,end:9,length:7,partial:true})
  for(const range of ['bytes=-','bytes=-0','bytes=10-','bytes=5-3','bytes=9007199254740992-','bytes=0-1,3-4'])assert.throws(()=>originalByteRange(10,range),{status:416})
})


test('real API key and OAuth grant revocation invalidate their file capabilities',async t=>{
  const api=fixture();api.auth.userId=`download-test-${randomUUID()}`
  t.after(()=>withRequestContext(api.auth,()=>deleteAllDocuments()))
  const key=await withRequestContext(api.auth,()=>createApiKey({name:'Download test',scopes:['read']}));api.auth.keyId=key.id
  const apiRemote=await http(t,api,{validateIdentity:undefined})
  assert.equal((await apiRemote.fetch({method:'HEAD',headers:{Range:'bytes=0-1'}})).status,200)
  await withRequestContext(api.auth,()=>revokeApiKey(key.id))
  assert.equal((await apiRemote.fetch()).status,401)
  const oauth=fixture();oauth.auth.keyId='oauth-test-grant'
  await oauth.store.put('grant','test-grant',{userId:oauth.auth.userId,scopes:['read'],revoked:false},60000)
  const oauthRemote=await http(t,oauth,{validateIdentity:undefined})
  assert.equal((await oauthRemote.fetch({method:'HEAD'})).status,200)
  const row=await oauth.store.get('grant','test-grant')
  await oauth.store.cas('grant','test-grant',row.version,{...row.value,revoked:true})
  assert.equal((await oauthRemote.fetch()).status,401)
  await oauth.store.deleteOwner(oauth.auth.userId)
  assert.deepEqual(await oauth.store.list('download',oauth.auth.userId),[])
})

test('exempt owners can download with exhausted allowances on API keys and OAuth grants; existing tickets recheck owner policy',async t=>{
  const {accountQuotaExemption}=await import('../lib/ai-quota-policy.mjs')
  let exempt=true
  const quotaExemption=options=>accountQuotaExemption({...options,lookup:async id=>{assert.equal(id,'student-a');return {email:exempt?'d.wicker@student.maastrichtuniversity.nl':'ordinary@example.com'}}})
  for(const keyId of ['personal-key','oauth-existing-grant']){
    const env={...fixture(),quotaExemption};env.auth.keyId=keyId
    for(const id of [`user:${env.auth.userId}`,`key:${keyId}`])await env.store.charge(`download-bytes:${Math.floor(Date.now()/86400000)}:${id}`,limits.bytesPerDay,limits.bytesPerDay,172800000)
    const remote=await http(t,env)
    assert.equal(remote.descriptor.limits.bytesPerDay,null)
    const result=await remote.fetch()
    assert.equal(result.status,200)
    assert.equal(await result.text(),'complete original')
    exempt=false
    assert.equal((await remote.fetch()).status,429)
    exempt=true
    env.revoke()
    assert.equal((await remote.fetch()).status,401)
  }
})
