import { accountQuotaExemption } from './ai-quota-policy.mjs'
import { ORIGINAL_DOWNLOAD_LIMITS } from './original-downloads.mjs'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { registerCoreTools } from '../mcp/core-tools.mjs'
import { registerStudyTools } from '../mcp/study-tools.mjs'
import { registerFeedbackTools } from '../mcp/feedback-tools.mjs'
import { registerGuidance, guidanceInfo, guidanceInstructions, mcpVersion } from '../mcp/guidance.mjs'
import { installWriteConfirmation } from '../mcp/write-confirmation.mjs'
import { randomUUID } from 'node:crypto'

export const MCP_LIMITS=Object.freeze({requestBytes:256*1024,resultBytes:128*1024,requestsPerMinute:60,concurrentRequests:4,tokenUnitsPerMinute:1_000_000,tokenUnitsPerDay:4_000_000})
const response=value=>({content:[{type:'text',text:JSON.stringify(value)}]})
export function createRemoteMcpServer({api,auth,quotaExempt=false}) {
  const server=new McpServer({name:'wicker-study',version:mcpVersion},{instructions:`${guidanceInstructions}\nThis is hosted Streamable HTTP. Only listed tools are available. Local filesystem imports, clipboard access and local downloads require the optional stdio package. Read wicker_status for limits. Never retry a mutation merely because its response was interrupted; first inspect its saved result.`})
  installWriteConfirmation(server,z)
  registerGuidance(server)
  const run=fn=>async args=>{try{
    const result=response(await fn(args))
    if(Buffer.byteLength(JSON.stringify(result))>MCP_LIMITS.resultBytes)return {isError:true,...response({error:'Result exceeds the response budget. Use a narrower query, fewer items, or read_course_source for a focused passage. Writes already completed are not undone; inspect saved state before retrying.'})}
    return result
  }catch(error){return {isError:true,...response({error:error.message,...(error.status?{status:error.status}:{}),...(error.retryAfter?{retryAfter:error.retryAfter}:{})})}}}
  registerCoreTools(server,{z,run,api,defaultCanvasUrl:'https://canvas.maastrichtuniversity.nl'})
  registerStudyTools(server,{z,run,api,defaultCanvasUrl:'https://canvas.maastrichtuniversity.nl'})
  registerFeedbackTools(server,{z,run,api})
  server.tool('read_original_chunk','Fallback for clients unable to save a direct HTTP download: read unchanged original bytes in small chunks. Prefer prepare_original_download and client file tools for large files. Choose the exact assetId and SHA-256 from canvas_course_materials first. Assemble consecutive chunks using Content-Range and verify the original size/hash. Keep binary data out of the conversation. No files are written on the hosted server.',{assetId:z.string().min(1).max(160),offset:z.number().int().min(0).max(1_073_741_823).default(0),length:z.number().int().min(1).max(49152).default(49152)},run(({assetId,offset,length})=>api(`/api/corpus/assets/${encodeURIComponent(assetId)}`,{query:{download:1},range:`bytes=${offset}-${offset+length-1}`})))
  server.tool('wicker_status','Current authenticated connection, scopes, transport, guidance version and request/token budgets. Call with wicker_guidance once per connection.',{},run(async()=>({connected:true,transport:'streamable-http',userId:auth.userId,scopes:auth.scopes,guidance:guidanceInfo,unlimited:quotaExempt,exemptionReason:quotaExempt?'account':null,limits:{...MCP_LIMITS,...(quotaExempt?{tokenUnitsPerMinute:null,tokenUnitsPerDay:null}:{})},downloadLimits:{...ORIGINAL_DOWNLOAD_LIMITS,...(quotaExempt?{bytesPerDay:null}:{})},tokenAccounting:'Null usage limits mean no account quota; request size, request rate and concurrency safeguards still apply. UTF-8 bytes conservatively bound transport tokens. Hosted AI calls also use account AI allowances; external model token usage is controlled by your MCP client.'})))
  return server
}

// No server-global MCP session: every request authenticates and creates a fresh
// transport. This works through load balancers without sticky sessions.
export async function handleMcpRequest(req,res,{api,auth,store,body,quotaExemption=accountQuotaExemption}) {
  const identities=[`user:${auth.userId}`,`key:${auth.keyId}`]
  for(const id of identities)if(!await store.charge(`mcp-requests:${id}`,1,MCP_LIMITS.requestsPerMinute,60000)){
    res.writeHead(429,{'content-type':'application/json','retry-after':'60'});res.end(JSON.stringify({jsonrpc:'2.0',id:body?.id??null,error:{code:-32000,message:'MCP request limit reached. Retry after 60 seconds.'}}));return
  }
  const quotaExempt=Boolean(await quotaExemption({owner:auth.userId}))
  const input=Math.max(req.mcpBodyBytes||0,Buffer.byteLength(JSON.stringify(body)))
  // Reserve the full response capacity before invoking tools. Reconcile after
  // sending, including failed calls; concurrent requests cannot overspend.
  const reservations=[]
  for(const [period,windowMs,limit]of [['minute',60000,MCP_LIMITS.tokenUnitsPerMinute],['day',86400000,MCP_LIMITS.tokenUnitsPerDay]]){
    for(const id of identities){
      const bucket=`mcp-tokens:${period}:${Math.floor(Date.now()/windowMs)}:${id}`,cost=input+MCP_LIMITS.resultBytes
      if(!await store.charge(bucket,cost,quotaExempt?Number.MAX_SAFE_INTEGER:limit,windowMs*2)){
        for(const item of reservations)await store.charge(item.bucket,-item.cost,Number.MAX_SAFE_INTEGER,item.windowMs*2)
        res.writeHead(429,{'content-type':'application/json','retry-after':String(Math.ceil((windowMs-Date.now()%windowMs)/1000))});res.end(JSON.stringify({jsonrpc:'2.0',id:body?.id??null,error:{code:-32000,message:`MCP ${period} token budget reached. Narrow requests or wait for the budget to reset.`}}));return
      }
      reservations.push({bucket,cost,windowMs})
    }
  }
  let output=0
  const nonce=randomUUID();let lease
  for(let index=0;index<MCP_LIMITS.concurrentRequests;index++){
    const candidate=`user:${auth.userId}:${index}`
    if(await store.acquireLease(candidate,nonce,10*60000)){lease=candidate;break}
  }
  if(!lease){
    for(const item of reservations)await store.charge(item.bucket,-item.cost,Number.MAX_SAFE_INTEGER,item.windowMs*2)
    res.writeHead(429,{'content-type':'application/json','retry-after':'5'});res.end(JSON.stringify({jsonrpc:'2.0',id:body?.id??null,error:{code:-32000,message:'Four requests are already running for this account. Wait for them to finish.'}}));return
  }
  const write=res.write.bind(res),end=res.end.bind(res)
  res.write=(chunk,...args)=>{if(chunk)output+=Buffer.byteLength(chunk);return write(chunk,...args)}
  res.end=(chunk,...args)=>{if(chunk)output+=Buffer.byteLength(chunk);return end(chunk,...args)}
  const server=createRemoteMcpServer({api,auth,quotaExempt})
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true})
  try{
    await server.connect(transport)
    await transport.handleRequest(req,res,body)
  }finally{
    await server.close()
    await store.releaseLease(lease,nonce)
    // Discovery schemas can exceed a normal tool result; account for their
    // actual bytes too. Never refund more than the unused reserved capacity.
    for(const item of reservations)await store.charge(item.bucket,-Math.max(0,MCP_LIMITS.resultBytes-output),Number.MAX_SAFE_INTEGER,item.windowMs*2)
  }
}
