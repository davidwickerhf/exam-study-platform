import { serveOriginalDownload } from './original-downloads.mjs'
import { createHash } from 'node:crypto'
import { createMcpStore } from './mcp-store.mjs'
import { sql } from './db.mjs'
import { createMcpOAuth, McpOAuthError } from './mcp-oauth.mjs'
import { authenticate, authenticateKeyIdentity } from './auth.mjs'
import { createMcpApiBridge } from './mcp-bridge.mjs'
import { handleMcpRequest, MCP_LIMITS } from './mcp-http.mjs'

export function mcpOrigin(env=process.env) {
  const value=env.WICKER_MCP_ORIGIN||(env.VERCEL_ENV==='preview'&&env.VERCEL_URL?`https://${env.VERCEL_URL}`:env.NODE_ENV==='production'||env.VERCEL?'https://study.wicker.life':`http://localhost:${env.PORT||4177}`)
  const url=new URL(value)
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new Error('WICKER_MCP_ORIGIN must be a plain HTTPS origin (or local loopback).')
  return url.origin
}
let service
export function remoteMcpService() {
  if(!service){const store=createMcpStore(),origin=mcpOrigin();service={store,origin,oauth:createMcpOAuth({store,origin})};const cleanup=setInterval(()=>store.cleanup().catch(()=>console.error('MCP expiry cleanup failed.')),600000);cleanup.unref()}
  return service
}
export async function deleteRemoteMcpData(userId){if(service)await service.store.deleteOwner(userId);else if(sql)await createMcpStore().deleteOwner(userId)}
export function isMcpRoute(path) {return path==='/api/mcp'||path.startsWith('/api/mcp/')||['/.well-known/oauth-authorization-server','/.well-known/oauth-protected-resource/api/mcp','/.well-known/oauth-protected-resource'].includes(path)}
async function readRequest(req,limit) {
  const chunks=[];let size=0
  for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>limit)throw new McpOAuthError('invalid_request','Request body exceeds the size limit.',413);chunks.push(Buffer.from(chunk))}
  req.mcpBodyBytes=size
  const text=Buffer.concat(chunks).toString('utf8')
  try{
    if(String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded')){
      const params=new URLSearchParams(text);for(const key of params.keys())if(params.getAll(key).length>1)throw new Error('Duplicate field')
      return Object.fromEntries(params)
    }
    const parsed=text?JSON.parse(text):{}
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Expected an object')
    return parsed
  }catch{throw new McpOAuthError('invalid_request','The request body is not valid JSON or form data.')}
}
const digest=value=>createHash('sha256').update(value).digest('hex')
export async function handleRemoteMcp(req,res,{handler,ip,dependencies=remoteMcpService()}) {
  const {store,origin,oauth}=dependencies
  const url=new URL(req.url,origin),path=url.pathname
  const json=(status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value))}
  res.setHeader('Cache-Control','no-store')
  res.setHeader('X-Content-Type-Options','nosniff')
  res.setHeader('Referrer-Policy','no-referrer')
  try{
    // Only explicitly configured or registered client origins may call MCP in
    // browsers. Non-browser services omit Origin. Cookies never authorize MCP.
    const callerOrigin=req.headers.origin
    if(callerOrigin){
      let parsed;try{parsed=new URL(callerOrigin)}catch{throw new McpOAuthError('invalid_request','Invalid Origin.',403)}
      const extra=(process.env.WICKER_MCP_ALLOWED_ORIGINS||'').split(',').map(value=>value.trim())
      const permitted=parsed.origin===callerOrigin&&(callerOrigin===origin||extra.includes(callerOrigin)||Boolean(await store.get('origin',digest(callerOrigin))))
      const publicDiscovery=path.startsWith('/.well-known/')||path==='/api/mcp/oauth/register'||(path==='/api/mcp'&&!req.headers.authorization&&(parsed.protocol==='https:'||['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)))
      if(!permitted&&!publicDiscovery)throw new McpOAuthError('invalid_request','This browser origin is not allowed. Register the client callback or configure WICKER_MCP_ALLOWED_ORIGINS.',403)
      res.setHeader('Access-Control-Allow-Origin',callerOrigin)
      res.setHeader('Vary','Origin')
    }
    const originalDownload=path==='/api/mcp/original'
    res.setHeader('Access-Control-Expose-Headers','WWW-Authenticate, Retry-After, MCP-Protocol-Version'+(originalDownload?', ETag, Content-Range, Accept-Ranges, Content-Disposition':''))
    if(req.method==='OPTIONS'){
      res.setHeader('Access-Control-Allow-Methods',originalDownload?'GET, HEAD, OPTIONS':'GET, POST, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID'+(originalDownload?', Range, If-Match, If-Range':''))
      res.writeHead(204);res.end();return
    }
    if(!await store.charge(`mcp-ip:${digest(ip)}`,1,120,60000)){res.setHeader('Retry-After','60');throw new McpOAuthError('rate_limit_exceeded','Too many connection requests. Retry in a minute.',429)}
    if(path==='/api/mcp/original'){ await serveOriginalDownload(req,res,{store}); return }
    if(path.startsWith('/.well-known/')){
      if(req.method!=='GET'){res.setHeader('Allow','GET');json(405,{error:'method_not_allowed'});return}
      json(200,path.includes('oauth-authorization-server')?oauth.metadata:oauth.protectedMetadata);return
    }
    const oauthMethods={'/api/mcp/oauth/authorize':'GET','/api/mcp/oauth/register':'POST','/api/mcp/oauth/token':'POST','/api/mcp/oauth/revoke':'POST'}
    if(oauthMethods[path]&&req.method!==oauthMethods[path]){res.setHeader('Allow',oauthMethods[path]);json(405,{error:'method_not_allowed'});return}
    if(path==='/api/mcp/oauth/authorize'&&req.method==='GET'){
      for(const name of url.searchParams.keys())if(url.searchParams.getAll(name).length>1)throw new McpOAuthError('invalid_request','Duplicate authorization parameter.')
      const location=await oauth.authorize(Object.fromEntries(url.searchParams))
      res.writeHead(302,{Location:location});res.end();return
    }
    if(['/api/mcp/oauth/register','/api/mcp/oauth/token','/api/mcp/oauth/revoke'].includes(path)&&req.method==='POST'){
      const action=path.split('/').at(-1)
      if(!await store.charge(`mcp-oauth:${action}:${digest(ip)}`,1,action==='register'?10:30,600000)){res.setHeader('Retry-After','600');throw new McpOAuthError('rate_limit_exceeded','Too many authorization requests.',429)}
      const body=await readRequest(req,16384)
      if(action==='register'){
        const result=await oauth.register(body)
        for(const redirect of result.redirect_uris){const clientOrigin=new URL(redirect).origin;if(!await store.get('origin',digest(clientOrigin)))try{await store.put('origin',digest(clientOrigin),{origin:clientOrigin},365*86400000)}catch(error){if(!await store.get('origin',digest(clientOrigin)))throw error}}
        json(201,result)
      }else if(action==='token')json(200,await oauth.token(body,req.headers.authorization))
      else{await oauth.revoke(body,req.headers.authorization);json(200,{})}
      return
    }
    if(path==='/api/mcp/consent'||path==='/api/mcp/connections'||path.startsWith('/api/mcp/connections/')){
      const auth=await authenticate(req)
      if(!auth.authenticated||!['clerk','local-login','local-test-user','local'].includes(auth.mode)){json(401,{error:'Sign in to Wicker Study to manage connections.'});return}
      if(req.method!=='GET'&&req.headers.origin!==origin){json(403,{error:'Connection approval must originate from Wicker Study.'});return}
      if(path==='/api/mcp/consent'&&req.method==='GET'){json(200,await oauth.pending(url.searchParams.get('request')));return}
      if(path==='/api/mcp/consent'&&req.method==='POST'){
        const body=await readRequest(req,4096)
        if(typeof body.approved!=='boolean')throw new McpOAuthError('invalid_request','Choose whether to approve this connection.')
        if(!await store.charge(`mcp-consent:${auth.userId}`,1,10,3600000))throw new McpOAuthError('rate_limit_exceeded','Too many connection approvals. Try later.',429)
        json(200,await oauth.consent(body.request,auth.userId,body.approved));return
      }
      if(path==='/api/mcp/connections'&&req.method==='GET'){json(200,{connections:await oauth.connections(auth.userId)});return}
      if(path.startsWith('/api/mcp/connections/')&&req.method==='DELETE'){json(200,await oauth.disconnect(path.split('/').at(-1),auth.userId));return}
      json(405,{error:'method_not_allowed'});return
    }
    if(path!=='/api/mcp'){json(404,{error:'Unknown MCP endpoint.'});return}
    const token=/^Bearer ([^\s]+)$/i.exec(req.headers.authorization||'')?.[1]
    let auth
    if(token?.startsWith('wmo_'))auth=await authenticateKeyIdentity(await oauth.verify(token))
    else if(token?.startsWith('wsk_'))auth=await authenticate(req)
    if(!auth?.authenticated||auth.mode!=='api-key'){
      res.setHeader('WWW-Authenticate',`Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp", scope="read"`)
      json(401,{error:'invalid_token',error_description:'Connect using OAuth or a valid Wicker Study API key.'});return
    }
    auth={...auth,remoteMcp:true,mcpBudgetStore:store}
    if(!auth.scopes.includes('read')){json(403,{error:'insufficient_scope'});return}
    if(req.method!=='POST'){res.setHeader('Allow','POST, OPTIONS');json(405,{error:'Stateless Streamable HTTP uses POST. No persistent event stream or session is allocated.'});return}
    if(String(req.headers['content-type']).split(';')[0].trim()!=='application/json'){json(415,{error:'Use application/json for MCP requests.'});return}
    const body=await readRequest(req,MCP_LIMITS.requestBytes)
    await handleMcpRequest(req,res,{body,auth,store,api:createMcpApiBridge(handler,auth)})
  }catch(error){
    if(res.headersSent){if(!res.writableEnded)res.end();return}
    if(error instanceof McpOAuthError)json(error.status,{error:error.code,error_description:error.message})
    else{console.error('Remote MCP request failed:',error instanceof Error?error.name:'unknown');json(503,{error:'temporarily_unavailable',error_description:'The connection service is temporarily unavailable. Try again later.'})}
  }
}
