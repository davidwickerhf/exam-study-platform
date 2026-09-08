import { Readable, Writable } from 'node:stream'
import { withRequestContext } from './request-context.mjs'
import { toolRequestContext } from '../mcp/write-confirmation.mjs'

// Only in-process requests can carry this identity. No header can impersonate it.
export const internalMcpAuth = new WeakMap()
export function createMcpApiBridge(handler, auth) {
  return async (path,{method='GET',body,query,range}={})=>{
    if(!path.startsWith('/api/')||path.startsWith('/api/mcp')||path.includes('\\'))throw new Error('Unsupported MCP API path.')
    const url=new URL(path,'http://mcp.internal')
    if(url.origin!=='http://mcp.internal')throw new Error('Invalid API origin.')
    for(const [key,value] of Object.entries(query||{}))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value))
    // Match IncomingMessage: body readers consume bytes, not object-mode strings.
    const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body),'utf8')],{objectMode:false})
    const tool=toolRequestContext.getStore()
    Object.assign(req,{method,url:url.pathname+url.search,headers:{host:'mcp.internal',accept:'application/json','content-type':'application/json','x-wicker-client':'wicker-study-remote','x-wicker-tool':tool?.tool||'','x-wicker-confirmed':String(tool?.confirmed===true)},socket:{remoteAddress:'127.0.0.1'}})
    if(range)req.headers.range=range
    internalMcpAuth.set(req,{...auth,remoteMcp:true})
    const chunks=[];let size=0
    const res=new Writable({write(chunk,encoding,done){size+=chunk.length;if(size<=8*1024*1024)chunks.push(Buffer.from(chunk));done()}})
    const headers=new Map()
    Object.assign(res,{statusCode:200,headersSent:false,setHeader(name,value){headers.set(name.toLowerCase(),value)},getHeader(name){return headers.get(name.toLowerCase())},writeHead(status,values={}){this.statusCode=status;this.headersSent=true;for(const [name,value]of Object.entries(values))this.setHeader(name,value);return this}})
    const finished=new Promise((resolve,reject)=>{res.once('finish',resolve);res.once('error',reject)})
    await withRequestContext({...auth,remoteMcp:true},()=>handler(req,res))
    await finished
    if(size>8*1024*1024)throw new Error('Result is too large. Narrow the query or use a focused source read.')
    const bytes=Buffer.concat(chunks)
    if(range&&res.statusCode<400){
      if(res.statusCode!==206)throw new Error('The original did not support a bounded range read.')
      return {encoding:'base64',data:bytes.toString('base64'),contentRange:headers.get('content-range'),mediaType:headers.get('content-type'),etag:headers.get('etag')}
    }
    const text=bytes.toString('utf8')
    let data;try{data=JSON.parse(text)}catch{data={text}}
    if(res.statusCode>=400)throw Object.assign(new Error(`${res.statusCode}: ${data.error||'The operation could not be completed.'}`),{status:res.statusCode,retryAfter:Number(headers.get('retry-after'))||undefined})
    return data
  }
}
