'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './agent-connect.module.css'

type Pending = { name: string; redirectUri: string; scopes: string[] }
type Connection = { id: string; name: string; scopes: string[]; createdAt: string }
export function RemoteConnect() {
  const search=useSearchParams(), request=search.get('request')
  const [pending,setPending]=useState<Pending|null>(null)
  const [connections,setConnections]=useState<Connection[]>([])
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[signIn,setSignIn]=useState(false)
  useEffect(()=>{
    let cancelled=false
    document.documentElement.classList.remove('app-mode')
    document.body.classList.remove('app-mode')
    setLoaded(false);setSignIn(false);setPending(null);setConnections([]);setError('')
    fetch(request?`/api/mcp/consent?request=${encodeURIComponent(request)}`:'/api/mcp/connections',{cache:'no-store'}).then(async response=>{
      const body=await response.json()
      if(cancelled)return
      if(response.status===401){setSignIn(true);return}
      if(!response.ok)throw new Error(body.error_description||body.error||'Could not load this connection.')
      if(request)setPending(body);else setConnections(body.connections)
    }).catch(error=>{if(!cancelled)setError(error.message)}).finally(()=>{if(!cancelled)setLoaded(true)})
    return()=>{cancelled=true}
  },[request])
  async function answer(approved:boolean) {
    setBusy(true);setError('')
    try{
      const response=await fetch('/api/mcp/consent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request,approved})})
      const body=await response.json()
      if(!response.ok)throw new Error(body.error_description||body.error||'Could not complete this connection.')
      window.location.assign(body.redirect)
    }catch(error){setError(error instanceof Error?error.message:'Could not complete this connection.');setBusy(false)}
  }
  async function disconnect(id:string) {
    setBusy(true);setError('')
    try{
      const response=await fetch(`/api/mcp/connections/${encodeURIComponent(id)}`,{method:'DELETE'})
      if(!response.ok)throw new Error('Could not disconnect this service. Try again.')
      setConnections(current=>current.filter(item=>item.id!==id))
    }catch(error){setError(error instanceof Error?error.message:'Could not disconnect.')}finally{setBusy(false)}
  }
  return <main className={styles.page}><section className={styles.card}>
    <a href="/app/settings?tab=api">← Back to settings</a>
    <p className={styles.eyebrow}>Remote MCP</p>
    <h1>{pending?`Connect ${pending.name}?`:request?'Connect a service':'Connected services'}</h1>
    {pending?<><p className={styles.lead}>This service is asking to access your Wicker Study account. Only approve it if you started this connection and trust the service.</p>
      <p>Return address: <strong>{new URL(pending.redirectUri).origin}</strong></p>
      <ul className={styles.scopes}>{pending.scopes.map(scope=><li key={scope}><strong>{scope==='write'?'Make study changes':'Read your study data'}</strong><span>{scope==='write'?'Save answers, progress, plans and context, and request AI processing.':'Read your course materials, calendar, groups, progress and saved context.'}</span></li>)}</ul>
      <p className={styles.note}>Access expires after 30 days unless you reconnect. You can disconnect at any time. Canvas credentials are never shared. Request limits and token budgets apply.</p>
      <div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>answer(true)}>{busy?'Connecting…':'Approve connection'}</button><button className={styles.secondary} disabled={busy} onClick={()=>answer(false)}>Cancel</button></div>
    </>:null}
    {!loaded?<p role="status">Loading connection…</p>:null}
    {signIn?<><p className={styles.lead}>{request?'Sign in to review the service and permissions before connecting.':'Sign in to see which services can access your Wicker Study account.'}</p><a className={styles.primary} href={`/sign-in?redirect_url=${encodeURIComponent(`/connect/remote${request?`?request=${encodeURIComponent(request)}`:''}`)}`}>Sign in to continue</a></>:null}
    {!request&&!signIn&&loaded&&!error?<><p className={styles.lead}>Services you have authorized through MCP. Disconnecting stops future access and token refreshes.</p>{connections.length?<ul className={styles.scopes}>{connections.map(item=><li key={item.id}><strong>{item.name}</strong><span>{item.scopes.join(' · ')} · Connected {new Date(item.createdAt).toLocaleDateString()}</span><button className={styles.secondary} disabled={busy} onClick={()=>disconnect(item.id)}>Disconnect</button></li>)}</ul>:<p>No services connected yet.</p>}</>:null}
    {error?<p role="alert" className={styles.error}>{error}</p>:null}
  </section></main>
}
