// Private originals are separate from derived evidence and never enter AI context.
import { randomUUID, createHash } from 'node:crypto'
import { activeProgrammeId } from './programme-scope.mjs'
import { listAcademicSnapshots } from './academic-snapshots.mjs'
import { listAcademicDocumentRecords } from './academic-document-register.mjs'
import { readDocument, deleteDocument, compareAndSwapDocument } from './user-store.mjs'
export const ORIGINAL_CHUNK_BYTES = 512 * 1024
export const ORIGINAL_MAX_BYTES = 15 * 1024 * 1024
const NS = 'academic-originals', CHUNKS = 'academic-original-chunks'
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }) }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export async function originalContext(kind) {
  if (!['record', 'transcript'].includes(kind)) fail('Choose an academic record or transcript.')
  const programmeId = await activeProgrammeId()
  const snapshots = await listAcademicSnapshots()
  const snapshot = snapshots.find(row => kind === 'record' ? row.kind !== 'transcript' : row.kind === 'transcript')
  const record = kind === 'transcript' ? (await listAcademicDocumentRecords()).find(row => row.kind === 'transcript') : null
  const source = record?.versions?.[0] || snapshot
  return { key: `${programmeId}:${kind}`, binding: source ? `${programmeId}:${kind}:${source.id}` : null }
}
const partKey = (key, file, index) => `${key}:${file.id}:${index}`
async function eraseParts(key, file) {
  if (file) for (let i=0; i<file.chunks; i++) await deleteDocument(CHUNKS, partKey(key,file,i))
}
export async function originalStatus(kind) {
  const {key,binding} = await originalContext(kind)
  const held = await readDocument(NS,key,null)
  return {binding, original: binding && held?.active?.binding === binding ? held.active : null}
}
export async function beginOriginal(kind, input) {
  const {key,binding} = await originalContext(kind)
  if (!binding || input.binding !== binding) fail('This imported document changed. Reload before attaching its original.',409)
  const size = input.size
  if (!Number.isInteger(size) || size < 1 || size > ORIGINAL_MAX_BYTES) fail('Choose a nonempty file up to 15 MB.',413)
  if (!/^[a-f0-9]{64}$/.test(input.sha256 || '')) fail('A file checksum is required.')
  const name = String(input.name || '').replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,240)
  const type = /\.pdf$/i.test(name) ? 'application/pdf' : /\.txt$/i.test(name) ? 'text/plain' : null
  if (!type) fail('Choose a PDF or text document.')
  const held = await readDocument(NS,key,null)
  const pending = {id:randomUUID(),binding,name,type,size,sha256:input.sha256,chunks:Math.ceil(size/ORIGINAL_CHUNK_BYTES),createdAt:new Date().toISOString()}
  await compareAndSwapDocument(NS,key,{revision:(held?.revision || 0)+1,active:held?.active || null,pending},held?.revision ?? null)
  await eraseParts(key,held?.pending)
  return pending
}
async function pendingOriginal(kind,id) {
  const {key,binding} = await originalContext(kind)
  const held = await readDocument(NS,key,null)
  if (!held?.pending || held.pending.id !== id || held.pending.binding !== binding) fail('This upload is no longer current. Retry saving the original.',409)
  return {key,held,file:held.pending}
}
export async function putOriginalChunk(kind,id,index,data) {
  const {key,file} = await pendingOriginal(kind,id)
  if (!Number.isInteger(index) || index<0 || index>=file.chunks) fail('Invalid document chunk.')
  if (typeof data !== 'string' || data.length > Math.ceil(ORIGINAL_CHUNK_BYTES/3)*4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) fail('Invalid document bytes.')
  const bytes=Buffer.from(data,'base64'), expected=Math.min(ORIGINAL_CHUNK_BYTES,file.size-index*ORIGINAL_CHUNK_BYTES)
  if(bytes.length!==expected) fail('Document chunk size does not match.')
  const chunkKey=partKey(key,file,index)
  try { await compareAndSwapDocument(CHUNKS,chunkKey,{data},null) }
  catch(error) { if((await readDocument(CHUNKS,chunkKey,null))?.data!==data) throw error }
  // Concurrent replacement/removal must not leave a late chunk behind; chunks
  // already promoted by completion remain immutable and may finish a retry.
  try { await pendingOriginal(kind,id) } catch(error) {
    const current=await readDocument(NS,key,null)
    if(current?.active?.id!==id) { await deleteDocument(CHUNKS,chunkKey); throw error }
  }
  return {saved:true}
}
export async function completeOriginal(kind,id) {
  const {key,held,file} = await pendingOriginal(kind,id)
  const parts=[]
  for(let i=0;i<file.chunks;i++) {
    const chunk=await readDocument(CHUNKS,partKey(key,file,i),null)
    if(!chunk) fail('The original is incomplete. Retry saving it.',409)
    parts.push(Buffer.from(chunk.data,'base64'))
  }
  const bytes=Buffer.concat(parts)
  if(bytes.length!==file.size || hash(bytes)!==file.sha256) fail('The original checksum does not match. Retry saving it.',409)
  if(file.type==='application/pdf' && !bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))) fail('This file is not a PDF.')
  const current=await originalContext(kind)
  if(current.binding!==file.binding) fail('The imported document changed during upload.',409)
  await compareAndSwapDocument(NS,key,{revision:held.revision+1,active:file,pending:null},held.revision)
  await eraseParts(key,held.active)
  return {original:file}
}
export async function readOriginalChunk(kind,id,index) {
  const {key,binding}=await originalContext(kind)
  const held=await readDocument(NS,key,null), file=held?.active
  if(!file || file.binding!==binding || file.id!==id) fail('This original is unavailable.',404)
  if(!Number.isInteger(index) || index<0 || index>=file.chunks) fail('Invalid document chunk.',404)
  const chunk=await readDocument(CHUNKS,partKey(key,file,index),null)
  if(!chunk) fail('The stored original is incomplete.',503)
  return Buffer.from(chunk.data,'base64')
}
export async function removeOriginal(kind,binding=null) {
  const {key}=await originalContext(kind)
  const held=await readDocument(NS,key,null)
  if(binding && held?.active?.binding!==binding && held?.pending?.binding!==binding) return
  await deleteDocument(NS,key)
  await eraseParts(key,held?.active); await eraseParts(key,held?.pending)
}
