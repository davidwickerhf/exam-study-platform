import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { readCourseAssetBytes } from './course-file-preview.mjs'
const exec = promisify(execFile), cache = new Map(), pending = new Map()
let active = false
const error = (message, status = 503) => Object.assign(new Error(message), { status })
export async function renderSlideBytes(bytes, filename) {
  const extension = extname(filename).toLowerCase()
  if (!['.pptx', '.ppt'].includes(extension)) throw error('Only PowerPoint files can be rendered as slides.', 400)
  if (!Buffer.isBuffer(bytes) || bytes.length > 64 * 1024 * 1024) throw error('This slide deck exceeds the 64 MB preview limit.', 413)
  const key = createHash('sha256').update(bytes).update('slides-pdf-v1').digest('hex')
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.bytes
  if (pending.has(key)) return pending.get(key)
  if (active) throw error('Another slide deck is being prepared. Try again shortly.', 429)
  active = true
  const operation = (async () => {
    let directory
    try {
      directory = await mkdtemp(join(tmpdir(), 'wicker-slides-'))
      const profile = join(directory, 'profile'), output = join(directory, 'output'), source = join(directory, `slides${extension}`)
      await mkdir(join(profile, 'user'), { recursive: true }); await mkdir(output)
      // Fresh private profile, highest macro security, no recent documents or
      // inherited browser/AI credentials in the converter subprocess.
      await writeFile(join(profile, 'user/registrymodifications.xcu'), '<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>')
      await writeFile(source, bytes)
      await exec(process.env.LIBREOFFICE_PATH || 'soffice', [`-env:UserInstallation=${pathToFileURL(profile).href}`, '--headless', '--nologo', '--nodefault', '--norestore', '--convert-to', 'pdf:impress_pdf_Export', '--outdir', output, source], {
        timeout: 60000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
        env: { PATH: process.env.PATH || '/usr/bin:/bin', LANG: 'en_US.UTF-8', TMPDIR: directory }
      })
      const file = join(output, 'slides.pdf')
      if ((await stat(file)).size > 64 * 1024 * 1024) throw error('The rendered deck exceeds the preview limit. Download the original.', 413)
      const result = await readFile(file)
      if (!result.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw error('The slide deck did not produce a readable preview.')
      // Bounded, ephemeral derivative cache. Authorization is checked by the
      // route before this cache is consulted, including after withdrawal.
      let total = result.length
      for (const [id, value] of [...cache].reverse()) {
        total += value.bytes.length
        if (value.expires <= Date.now() || total > 96 * 1024 * 1024 || cache.size >= 6) cache.delete(id)
      }
      cache.set(key, { bytes: result, expires: Date.now() + 15 * 60 * 1000 })
      return result
    } catch (cause) {
      if (cause.status) throw cause
      throw error(cause.code === 'ENOENT' ? 'Slide rendering is unavailable on this server. The extracted text and original are still available.' : 'This deck could not be rendered. Try the extracted text or download the original.')
    } finally { active = false; if (directory) await rm(directory, { recursive: true, force: true }) }
  })()
  pending.set(key, operation)
  try { return await operation } finally { pending.delete(key) }
}
export async function renderCourseSlides(asset) {
  return renderSlideBytes(await readCourseAssetBytes(asset), asset.filename)
}
