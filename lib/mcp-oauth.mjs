import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const minute=60_000, day=86400_000
const secret=()=>randomBytes(32).toString('base64url')
const hash=value=>createHash('sha256').update(String(value)).digest('hex')
const equal=(left,right)=>typeof left==='string'&&typeof right==='string'&&left.length===right.length&&timingSafeEqual(Buffer.from(left),Buffer.from(right))
export class McpOAuthError extends Error {
  constructor(code, message, status=400) { super(message);this.code=code;this.status=status }
}
const fail=(code,message,status)=>{throw new McpOAuthError(code,message,status)}
function scopes(value='read') {
  const result=[...new Set(String(value).split(' ').filter(Boolean))]
  if(!result.length||result.some(scope=>!['read','write'].includes(scope)))fail('invalid_scope','Supported scopes are read and write.')
  if(!result.includes('read'))result.unshift('read')
  return result
}
export function validateMcpRedirect(value) {
  let url;try{url=new URL(value)}catch{fail('invalid_redirect_uri','A valid callback URL is required.')}
  if(url.username||url.password||url.hash||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))fail('invalid_redirect_uri','Callbacks must use HTTPS, or HTTP on loopback for a local client.')
  return url.href
}

export function createMcpOAuth({store,origin}) {
  const resource=`${origin}/api/mcp`
  function audience(value){if(String(value||'')!==resource)fail('invalid_target','The resource must be this server’s /api/mcp URL.')}
  async function client(id) {
    const row=await store.get('client',String(id||''))
    if(!row)fail('invalid_client','This client is not registered.',401)
    return row.value
  }
  async function authenticateClient(body, authorization) {
    let id=body.client_id, supplied=body.client_secret
    if(authorization) {
      if(!authorization.startsWith('Basic ')||supplied)fail('invalid_client','Use one client authentication method.',401)
      const decoded=Buffer.from(authorization.slice(6),'base64').toString();const index=decoded.indexOf(':')
      if(index<0)fail('invalid_client','Invalid client authentication.',401)
      const basicId=decodeURIComponent(decoded.slice(0,index));if(id&&id!==basicId)fail('invalid_client','Client mismatch.',401)
      id=basicId;supplied=decodeURIComponent(decoded.slice(index+1))
    }
    const found=await client(id)
    if(found.authMethod==='none') {if(supplied)fail('invalid_client','Public clients do not use a secret.',401)}
    else if(!supplied||!equal(hash(supplied),found.secretHash)||Boolean(authorization)!==(found.authMethod==='client_secret_basic'))fail('invalid_client','Invalid client authentication.',401)
    return found
  }
  async function codeRow(value,found) {
    const row=await store.get('code',hash(value))
    if(!row||row.value.used||row.value.clientId!==found.id)fail('invalid_grant','The authorization code is invalid or expired.')
    return row
  }
  async function issue(grantId, grant, refreshToken) {
    const access_token=`wmo_${secret()}`
    await store.put('access',hash(access_token),{grantId,userId:grant.userId,clientId:grant.clientId,scopes:grant.scopes,resource},60*minute)
    return {access_token,token_type:'Bearer',expires_in:3600,refresh_token:refreshToken,scope:grant.scopes.join(' ')}
  }
  return {
    metadata: {issuer:origin,authorization_endpoint:`${origin}/api/mcp/oauth/authorize`,token_endpoint:`${origin}/api/mcp/oauth/token`,registration_endpoint:`${origin}/api/mcp/oauth/register`,revocation_endpoint:`${origin}/api/mcp/oauth/revoke`,response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none','client_secret_post','client_secret_basic'],revocation_endpoint_auth_methods_supported:['none','client_secret_post','client_secret_basic'],scopes_supported:['read','write'],service_documentation:`${origin}/docs#mcp`},
    protectedMetadata:{resource,authorization_servers:[origin],scopes_supported:['read','write'],bearer_methods_supported:['header'],resource_name:'Wicker Study'},
    async register(body) {
      if(!Array.isArray(body.redirect_uris)||!body.redirect_uris.length||body.redirect_uris.length>10)fail('invalid_client_metadata','Provide between one and ten callback URLs.')
      const redirects=body.redirect_uris.map(validateMcpRedirect)
      const method=body.token_endpoint_auth_method||'client_secret_basic'
      if(!['none','client_secret_post','client_secret_basic'].includes(method))fail('invalid_client_metadata','Unsupported client authentication method.')
      if((body.grant_types&&!Array.isArray(body.grant_types))||(body.response_types&&!Array.isArray(body.response_types)))fail('invalid_client_metadata','Grant types and response types must be arrays.')
      if(body.grant_types?.some(value=>!['authorization_code','refresh_token'].includes(value))||body.response_types?.some(value=>value!=='code'))fail('invalid_client_metadata','Only authorization code and refresh token grants are supported.')
      const id=secret(), clientSecret=method==='none'?undefined:secret()
      const name=String(body.client_name||'MCP service').replace(/[\x00-\x1f\x7f]/g,'').slice(0,100)
      const granted=scopes(body.scope)
      await store.put('client',id,{id,name,redirects,authMethod:method,secretHash:clientSecret?hash(clientSecret):null,scopes:granted},365*day)
      return {client_id:id,client_id_issued_at:Math.floor(Date.now()/1000),...(clientSecret?{client_secret:clientSecret,client_secret_expires_at:Math.floor((Date.now()+365*day)/1000)}:{}),client_name:name,redirect_uris:redirects,token_endpoint_auth_method:method,grant_types:['authorization_code','refresh_token'],response_types:['code'],scope:granted.join(' ')}
    },
    async authorize(body) {
      const found=await client(body.client_id)
      if(body.response_type!=='code')fail('unsupported_response_type','Use the authorization code flow.')
      if(!found.redirects.includes(body.redirect_uri))fail('invalid_request','The callback must exactly match a registered URL.')
      audience(body.resource)
      if(body.code_challenge_method!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(body.code_challenge||''))fail('invalid_request','S256 PKCE is required.')
      if(body.state&&String(body.state).length>1024)fail('invalid_request','State is too long.')
      const granted=scopes(body.scope);if(granted.some(scope=>!found.scopes.includes(scope)))fail('invalid_scope','Scope was not registered for this client.')
      const request=secret()
      await store.put('pending',hash(request),{clientId:found.id,name:found.name,redirectUri:body.redirect_uri,scopes:granted,challenge:body.code_challenge,state:body.state||'',resource,used:false},10*minute)
      return `${origin}/connect/remote?request=${request}`
    },
    async pending(request) {
      const row=await store.get('pending',hash(request))
      if(!row||row.value.used)fail('invalid_request','This connection request expired. Start again from your service.')
      return {name:row.value.name,redirectUri:row.value.redirectUri,scopes:row.value.scopes}
    },
    async consent(request,userId,approved) {
      const id=hash(request),row=await store.get('pending',id)
      if(!row||row.value.used)fail('invalid_request','This connection request expired or was already answered.')
      if(!await store.cas('pending',id,row.version,{...row.value,used:true,userId}))fail('invalid_request','This request was already answered.')
      const redirect=new URL(row.value.redirectUri)
      if(row.value.state)redirect.searchParams.set('state',row.value.state)
      if(!approved)redirect.searchParams.set('error','access_denied')
      else {
        const code=secret()
        await store.put('code',hash(code),{...row.value,used:false,userId},5*minute)
        redirect.searchParams.set('code',code)
      }
      return {redirect:redirect.href}
    },
    async token(body, authorization) {
      const found=await authenticateClient(body,authorization);audience(body.resource)
      if(body.grant_type==='authorization_code') {
        const row=await codeRow(body.code,found)
        if(body.redirect_uri!==row.value.redirectUri||!/^[-._~A-Za-z0-9]{43,128}$/.test(body.code_verifier||'')||!equal(createHash('sha256').update(body.code_verifier).digest('base64url'),row.value.challenge))fail('invalid_grant','The code proof or callback does not match.')
        if(!await store.cas('code',hash(body.code),row.version,{...row.value,used:true}))fail('invalid_grant','This code has already been used.')
        const id=secret(),refresh=`wmr_${secret()}`
        const grant={userId:row.value.userId,clientId:found.id,name:found.name,scopes:row.value.scopes,resource,refreshHash:hash(refresh),revoked:false,createdAt:new Date().toISOString()}
        await store.put('grant',id,grant,30*day)
        await store.put('refresh',hash(refresh),{grantId:id,clientId:found.id,userId:grant.userId},30*day)
        return issue(id,grant,refresh)
      }
      if(body.grant_type==='refresh_token') {
        const held=await store.get('refresh',hash(body.refresh_token));if(!held||held.value.clientId!==found.id)fail('invalid_grant','This refresh token is invalid or expired.')
        const id=held.value.grantId,row=await store.get('grant',id)
        if(!row||row.value.revoked)fail('invalid_grant','This connection expired or was revoked.')
        if(row.value.refreshHash!==hash(body.refresh_token)) {
          await store.cas('grant',id,row.version,{...row.value,revoked:true})
          fail('invalid_grant','Refresh token reuse detected. Reconnect this service.')
        }
        const requested=body.scope?scopes(body.scope):row.value.scopes
        if(requested.some(scope=>!row.value.scopes.includes(scope)))fail('invalid_scope','Refresh cannot expand access.')
        const refresh=`wmr_${secret()}`,grant={...row.value,scopes:requested,refreshHash:hash(refresh)}
        if(!await store.cas('grant',id,row.version,grant))fail('invalid_grant','The refresh token has already been used.')
        await store.put('refresh',hash(refresh),{grantId:id,clientId:found.id,userId:grant.userId},30*day)
        return issue(id,grant,refresh)
      }
      fail('unsupported_grant_type','Use authorization_code or refresh_token.')
    },
    async verify(token) {
      const access=await store.get('access',hash(token));if(!access)return null
      const grant=await store.get('grant',access.value.grantId)
      if(!grant||grant.value.revoked||grant.value.resource!==resource)return null
      return {userId:grant.value.userId,keyId:`oauth-${access.value.grantId}`,scopes:access.value.scopes.filter(scope=>grant.value.scopes.includes(scope)),clientId:grant.value.clientId,remoteMcp:true}
    },
    async revoke(body,authorization) {
      const found=await authenticateClient(body,authorization)
      const row=await store.get('access',hash(body.token))||await store.get('refresh',hash(body.token))
      if(!row||row.value.clientId!==found.id)return
      for(let attempt=0;attempt<4;attempt++){
        const grant=await store.get('grant',row.value.grantId)
        if(!grant||grant.value.revoked||await store.cas('grant',row.value.grantId,grant.version,{...grant.value,revoked:true}))return
      }
      fail('temporarily_unavailable','Try revocation again.',503)
    },
    async connections(userId){return (await store.list('grant',userId)).filter(row=>!row.revoked).map(({id,name,scopes,createdAt})=>({id,name,scopes,createdAt}))},
    async disconnect(id,userId){
      for(let attempt=0;attempt<4;attempt++){
        const row=await store.get('grant',id)
        if(!row||row.value.userId!==userId)fail('invalid_request','Connection not found.',404)
        if(row.value.revoked||await store.cas('grant',id,row.version,{...row.value,revoked:true}))return {revoked:true}
      }
      fail('temporarily_unavailable','Try revocation again.',503)
    }
  }
}
