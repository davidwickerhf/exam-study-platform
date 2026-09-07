'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DocumentActions } from './uploaded-document-preview'
import { originalStatus,saveOriginal,loadOriginal,type OriginalStatus,type ImportedFile,type DocumentKind } from '@/lib/workspace/academic-originals'

export function SavedDocumentOriginal({name,kind,source}:{name:string;kind:DocumentKind;source?:ImportedFile}) {
  const [status,setStatus]=useState<OriginalStatus|null>(null),[local,setLocal]=useState<File|null>(source?.file||null),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  const input=useRef<HTMLInputElement>(null)
  const initial=useRef<Promise<OriginalStatus>|null>(null)
  const cache=useRef<Promise<File>|null>(null)
  useEffect(()=>{
    let active=true
    initial.current??=(async()=>{
      const status=await originalStatus(kind)
      if(source){
        if(status.binding!==source.binding)throw new Error('The record changed. Reload to view its current original.')
        if(active)setSaving(true)
        return {...status,original:await saveOriginal(kind,source.file,source.binding)}
      }
      return status
    })()
    void initial.current.then(value=>{if(active)setStatus(value)}).catch(error=>{if(active)setError(error.message)}).finally(()=>{if(active)setSaving(false)})
    return()=>{active=false}
  },[kind,source])
  const load=useCallback(async()=>{
    if(local)return local
    if(!status?.original)throw new Error('The original was not kept with this older import.')
    cache.current??=loadOriginal(kind,status.original).catch(error=>{cache.current=null;throw error})
    return cache.current
  },[local,status,kind])
  async function restore(file:File) {
    if(!file.size || file.size>15*1024*1024 || !/\.(pdf|txt)$/i.test(file.name)){setError('Choose a PDF or text file up to 15 MB.');return}
    setSaving(true);setError('')
    try {const fresh=await originalStatus(kind);if(!fresh.binding)throw new Error('Import the document first.');const original=await saveOriginal(kind,file,fresh.binding);setStatus({...fresh,original});setLocal(file);cache.current=null}
    catch(error){setError(error instanceof Error?error.message:'The original could not be saved.')}finally{setSaving(false)}
  }
  return <div className="flex flex-col items-end gap-1">
    <DocumentActions name={status?.original?.name||local?.name||name} load={load} disabled={!local&&!status?.original}/>
    {saving?<span role="status" className="text-xs text-muted-foreground">Saving original…</span>:status&&!status.original&&!local?<><span className="text-xs text-muted-foreground">Original not retained</span><Button type="button" variant="ghost" size="sm" onClick={()=>input.current?.click()}><UploadIcon className="size-3.5"/>Restore original</Button></>:null}
    {error&&<div className="max-w-64 text-right"><p role="alert" className="text-xs text-destructive">{error}</p><Button type="button" variant="ghost" size="sm" disabled={saving} onClick={()=>local?void restore(local):input.current?.click()}>Retry saving original</Button></div>}
    <input ref={input} type="file" className="hidden" aria-label="Restore original document" accept="application/pdf,.pdf,.txt" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void restore(file)}}/>
  </div>
}
