import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { providerFetch } from '../lib/provider-fetch.mjs'

async function fixture(handler,work){
  const server=createServer(handler)
  server.listen(0,'127.0.0.1');await once(server,'listening')
  try{await work(`http://127.0.0.1:${server.address().port}`)}
  finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}
test('provider deadline cancels a request waiting for headers',async()=>{
  await fixture(()=>{},async url=>{
    await assert.rejects(providerFetch(url,{},50),error=>error.name==='TimeoutError')
  })
})
test('provider deadline remains active while consuming the response body',async()=>{
  await fixture((req,res)=>{res.writeHead(200);res.write('{')},async url=>{
    const response=await providerFetch(url,{},1000)
    await assert.rejects(response.text(),error=>['TimeoutError','AbortError'].includes(error.name))
  })
})
test('provider transport returns content and honours caller cancellation',async()=>{
  await fixture((req,res)=>res.end('{"ready":true}'),async url=>{
    assert.deepEqual(await (await providerFetch(url,{},1000)).json(),{ready:true})
    const controller=new AbortController();controller.abort()
    await assert.rejects(providerFetch(url,{signal:controller.signal},1000),error=>error.name==='AbortError')
    assert.throws(()=>providerFetch(url,{},Infinity),/finite provider deadline/)
  })
})
