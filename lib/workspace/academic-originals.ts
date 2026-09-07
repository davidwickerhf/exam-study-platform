export type OriginalFile = {id:string;binding:string;name:string;type:string;size:number;chunks:number;sha256:string}
export type OriginalStatus = {binding:string|null;original:OriginalFile|null}
export type ImportedFile = {file:File;binding:string}
export type DocumentKind = 'record'|'transcript'
const root=(kind:DocumentKind)=>`/api/onboarding/documents/${kind}/original`
async function request<T>(url:string,options?:RequestInit):Promise<T> {
  const response=await fetch(url,{cache:'no-store',...options,headers:{'Content-Type':'application/json',...options?.headers}})
  const data=await response.json()
  if(!response.ok) throw new Error(data.error || 'The original could not be loaded.')
  return data
}
export const originalStatus=(kind:DocumentKind)=>request<OriginalStatus>(root(kind))
export async function saveOriginal(kind:DocumentKind,file:File,binding:string) {
  const bytes=new Uint8Array(await file.arrayBuffer())
  const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')
  const metadata=await request<OriginalFile>(root(kind),{method:'POST',body:JSON.stringify({binding,name:file.name,size:file.size,sha256})})
  for(let index=0;index<metadata.chunks;index++) {
    const part=bytes.subarray(index*512*1024,(index+1)*512*1024)
    let text=''; for(let offset=0;offset<part.length;offset+=8192)text+=String.fromCharCode(...part.subarray(offset,offset+8192))
    await request(`${root(kind)}/${metadata.id}/chunks/${index}`,{method:'PUT',body:JSON.stringify({data:btoa(text)})})
  }
  return (await request<{original:OriginalFile}>(`${root(kind)}/${metadata.id}/complete`,{method:'POST'})).original
}
export async function loadOriginal(kind:DocumentKind,metadata:OriginalFile) {
  const parts:ArrayBuffer[]=[]
  for(let index=0;index<metadata.chunks;index++) {
    const response=await fetch(`${root(kind)}/${metadata.id}/chunks/${index}`,{cache:'no-store'})
    if(!response.ok)throw new Error('The original could not be downloaded. Try again.')
    parts.push(await response.arrayBuffer())
  }
  const file=new File(parts,metadata.name,{type:metadata.type})
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('')
  if(file.size!==metadata.size || hash!==metadata.sha256)throw new Error('The downloaded original is incomplete. Try again.')
  return file
}
