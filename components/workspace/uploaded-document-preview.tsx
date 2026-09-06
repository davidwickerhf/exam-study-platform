'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { EyeIcon, DownloadIcon, LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReviewPanel } from './review-panel'
const PdfViewer=dynamic(()=>import('./course-pdf-viewer'),{ssr:false,loading:()=> <p role="status">Loading document…</p>})
function RenderOriginal({load}:{load:()=>Promise<File>}) {
  const [file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[text,setText]=useState<string|null>(null)
  useEffect(()=>{let active=true;void load().then(async file=>{
    const text=/\.pdf$/i.test(file.name)||file.type==='application/pdf'?null:await file.text()
    if(active){setFile(file);setText(text)}
  }).catch(error=>{if(active)setError(error.message)});return()=>{active=false}},[load])
  if(error)return <p role="alert">{error}</p>
  if(!file)return <p role="status">Loading document…</p>
  return text!==null?<pre className="min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words text-sm leading-6">{text}</pre>:<PdfViewer file={file} title={file.name}/>
}
export function DocumentActions({name,load,disabled=false}:{name:string;load:()=>Promise<File>;disabled?:boolean}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  return <div className="flex shrink-0 items-center gap-1">
    <ReviewPanel trigger={<EyeIcon className="size-4"/>} triggerLabel="View document" disabled={disabled} title={name} description="Original document" bodyClassName="flex overflow-hidden"><RenderOriginal load={load}/></ReviewPanel>
    <Button type="button" variant="ghost" size="icon-sm" aria-label="Download document" title="Download document" disabled={disabled||busy} onClick={async()=>{
      setBusy(true);setError('')
      try {const file=await load();const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000)}
      catch(error){setError(error instanceof Error?error.message:'Download failed. Try again.')}finally{setBusy(false)}
    }}>{busy?<LoaderCircleIcon className="size-4 animate-spin"/>:<DownloadIcon className="size-4"/>}</Button>
    {error&&<span role="alert" className="max-w-52 text-xs text-destructive">{error}</span>}
  </div>
}
export function UploadedDocumentPreview({file}:{file:File}) {
  return <DocumentActions name={file.name} load={async()=>file}/>
}
