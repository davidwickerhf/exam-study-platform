const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.mjs'
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs'
export const MAX_TUTOR_FILE_BYTES = 12 * 1024 * 1024

type PdfPage = {
  getTextContent: () => Promise<{ items: { str?: string }[] }>
  getViewport: (options: { scale: number }) => { width: number; height: number }
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> }
}
type PdfLibrary = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (options: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (page: number) => Promise<PdfPage> }> }
}

let heldPdf: Promise<PdfLibrary> | null = null
function pdfLibrary() {
  heldPdf ??= (import(/* webpackIgnore: true */ PDFJS) as Promise<unknown>).then((module) => {
    const library = module as PdfLibrary
    library.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
    return library
  })
  return heldPdf
}

function dataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

async function shrinkImage(file: File) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error(`${file.name} could not be read.`)
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', 0.78)
}

async function extractPdf(file: File) {
  const library = await pdfLibrary()
  const pdf = await library.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  const images: string[] = []
  for (let number = 1; number <= Math.min(pdf.numPages, 80); number += 1) {
    const page = await pdf.getPage(number)
    const content = await page.getTextContent()
    const text = content.items.map((item) => String(item.str || '').trim()).filter(Boolean).join(' ').trim()
    if (text) pages.push(`Page ${number}\n${text}`)
    if (text.length < 80 && images.length < 4) {
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(1.6, 1500 / Math.max(1, base.width)) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d')
      if (context) {
        context.fillStyle = '#fff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: context, viewport }).promise
        images.push(canvas.toDataURL('image/jpeg', 0.75))
      }
    }
  }
  return { text: pages.join('\n\n').slice(0, 220_000), images }
}

export async function readTutorFile(file: File) {
  if (!file.size || file.size > MAX_TUTOR_FILE_BYTES) throw new Error(`${file.name} must be 12 MB or smaller.`)
  const lower = file.name.toLowerCase()
  const original = await dataUrl(file)
  if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
    return { name: file.name, type: 'application/pdf', dataUrl: original, ...(await extractPdf(file)) }
  }
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lower.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return {
      name: file.name,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      dataUrl: original,
      text: result.value.slice(0, 220_000),
      images: []
    }
  }
  if (file.type.startsWith('image/')) {
    return { name: file.name, type: file.type, dataUrl: original, text: '', images: [await shrinkImage(file)] }
  }
  if (file.type.startsWith('text/') || /\.(txt|md|csv|ics)$/i.test(file.name)) {
    return { name: file.name, type: file.type || 'text/plain', dataUrl: original, text: (await file.text()).slice(0, 220_000), images: [] }
  }
  throw new Error(`${file.name} is not a supported PDF, DOCX, image, Markdown, or text file.`)
}
