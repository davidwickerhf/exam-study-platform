'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ReviewPanel } from './review-panel'
const PdfViewer=dynamic(()=>import('./course-pdf-viewer'),{ssr:false})
function TextPreview({file}:{file:File}) {
  const [text,setText]=useState<string|null>(null)
  useEffect(()=>{let active=true;void file.text().then(value=>{if(active)setText(value)}).catch(()=>{if(active)setText('The original could not be read. Choose the file again.')});return()=>{active=false}},[file])
  return text===null ? <p role="status">Loading document…</p> : <pre className="min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words text-sm leading-6">{text}</pre>
}
export function UploadedDocumentPreview({file}:{file:File}) {
  return <ReviewPanel trigger="View document" title={file.name} description="Original file, available during this review. It is not stored on the server." bodyClassName="flex overflow-hidden">
    {/\.pdf$/i.test(file.name)||file.type==='application/pdf' ? <PdfViewer file={file} title={file.name}/> : <TextPreview file={file}/>}
  </ReviewPanel>
}
