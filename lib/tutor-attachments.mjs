import { randomUUID } from 'node:crypto'
import { activeProgrammeId, scopedDocumentKey } from './programme-scope.mjs'
import { deleteDocument, listDocuments, readDocument, writeDocument } from './user-store.mjs'

const NAMESPACE = 'tutor-attachments'
const INDEX = 'index'
export const MAX_TUTOR_ATTACHMENT_BYTES = 12 * 1024 * 1024
export const MAX_TUTOR_ATTACHMENTS = 80
const MAX_TEXT = 240_000
const MAX_CHUNKS = 240
const ALLOWED_TYPES = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown', 'text/csv', 'text/calendar', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic'])

export class TutorAttachmentError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

const clean = (value, max = 400) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
async function key(value) { return scopedDocumentKey(await activeProgrammeId(), value) }

function words(value) {
  return String(value || '').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []
}

function chunksFrom(text) {
  const value = String(text || '').trim().slice(0, MAX_TEXT)
  if (!value) return []
  const paragraphs = value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  const chunks = []
  let held = ''
  for (const paragraph of paragraphs) {
    if (held && held.length + paragraph.length > 1_300) {
      chunks.push(held)
      held = ''
    }
    if (paragraph.length > 1_600) {
      for (let at = 0; at < paragraph.length; at += 1_200) chunks.push(paragraph.slice(at, at + 1_400))
    } else held = held ? `${held}\n\n${paragraph}` : paragraph
    if (chunks.length >= MAX_CHUNKS) break
  }
  if (held && chunks.length < MAX_CHUNKS) chunks.push(held)
  return chunks.map((content, index) => ({ id: index + 1, content }))
}

function publicAttachment(value) {
  if (!value?.id) return null
  const { dataUrl: _dataUrl, chunks: _chunks, text: _text, ...metadata } = value
  return metadata
}

export async function listTutorAttachments() {
  const index = await readDocument(NAMESPACE, await key(INDEX), { items: [] })
  return (index.items || []).slice(0, MAX_TUTOR_ATTACHMENTS)
}

export async function readTutorAttachment(id) {
  const value = await readDocument(NAMESPACE, await key(`source-${clean(id, 100)}`), null)
  return value?.id ? value : null
}

export async function saveTutorAttachment(input = {}) {
  const name = clean(input.name || 'Untitled source', 180)
  const dataUrl = String(input.dataUrl || '')
  const matched = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/)
  if (!matched) throw new TutorAttachmentError('The selected file could not be read.')
  const type = clean(matched[1], 120).toLowerCase()
  if (!ALLOWED_TYPES.has(type)) throw new TutorAttachmentError('Private sources accept PDF, DOCX, text, Markdown, calendar, and common image files.')
  const bytes = Buffer.byteLength(matched[2], 'base64')
  if (!bytes || bytes > MAX_TUTOR_ATTACHMENT_BYTES) throw new TutorAttachmentError('Tutor sources must be 12 MB or smaller.', 413)
  const text = String(input.text || '').trim().slice(0, MAX_TEXT)
  const now = new Date().toISOString()
  const id = randomUUID()
  const stored = {
    id,
    name,
    type,
    size: bytes,
    dataUrl,
    text,
    chunks: chunksFrom(text),
    courseId: clean(input.courseId, 120) || null,
    courseCode: clean(input.courseCode, 40).toUpperCase() || null,
    courseName: clean(input.courseName, 180) || null,
    chapterId: clean(input.chapterId, 120) || null,
    chapterName: clean(input.chapterName, 180) || null,
    conversationId: clean(input.conversationId, 120) || null,
    origin: clean(input.origin, 40) === 'documents' ? 'documents' : 'tutor',
    status: text ? 'indexed' : 'stored',
    createdAt: now,
    updatedAt: now,
    private: true
  }
  await writeDocument(NAMESPACE, await key(`source-${id}`), stored)
  const index = await readDocument(NAMESPACE, await key(INDEX), { items: [] })
  await writeDocument(NAMESPACE, await key(INDEX), {
    items: [publicAttachment(stored), ...(index.items || []).filter((item) => item.id !== id)].slice(0, MAX_TUTOR_ATTACHMENTS)
  })
  return publicAttachment(stored)
}

export async function deleteTutorAttachment(id) {
  const index = await readDocument(NAMESPACE, await key(INDEX), { items: [] })
  const items = (index.items || []).filter((item) => item.id !== id)
  if (items.length === (index.items || []).length) return false
  await writeDocument(NAMESPACE, await key(INDEX), { items })
  await deleteDocument(NAMESPACE, await key(`source-${id}`))
  return true
}

export async function searchTutorAttachments({ query, courseCode = '', attachmentIds = [], limit = 8 } = {}) {
  const tokens = [...new Set(words(query))]
  const wanted = clean(courseCode, 40).toUpperCase()
  const selected = new Set((attachmentIds || []).map(String))
  const metadata = await listTutorAttachments()
  const candidates = metadata.filter((item) => (!wanted || !item.courseCode || item.courseCode === wanted) && (!selected.size || selected.has(item.id)))
  const rows = []
  for (const item of candidates.slice(0, 30)) {
    const source = await readTutorAttachment(item.id)
    for (const chunk of source?.chunks || []) {
      const haystack = words(`${item.name} ${item.courseCode || ''} ${chunk.content}`)
      const counts = new Map()
      for (const word of haystack) counts.set(word, (counts.get(word) || 0) + 1)
      const score = tokens.length ? tokens.reduce((sum, token) => sum + Math.min(4, counts.get(token) || 0), 0) / tokens.length : 0
      if (!tokens.length || score > 0) rows.push({ ...chunk, score, attachment: item })
    }
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, Math.min(20, Math.max(1, Number(limit) || 8)))
}

export async function exportTutorAttachments() {
  const documents = await listDocuments(NAMESPACE)
  return documents.filter((entry) => entry.value?.id).map((entry) => entry.value)
}
