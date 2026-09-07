import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, open, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

// Stream to a private, unique directory. Never replace an existing user file or
// expose a partial download as a successful original.
export async function downloadCourseOriginal({ assetId, courseCode, academicYear, outputFolder }, { api, apiResponse }) {
  const inventory = await api('/api/corpus/materials', { query: { courseCode, academicYear } })
  const material = inventory.materials?.find(item => item.assetId === assetId)
  if (!material) throw new Error('This original is not available in the selected course edition. Read canvas_course_materials again.')
  const size = Number(material.byteSize)
  if (!Number.isSafeInteger(size) || size < 0 || !/^[a-f0-9]{64}$/i.test(material.sha256 || '')) throw new Error('The original has no verifiable size or checksum. Refresh its material record before downloading.')
  if (size > 1024 ** 3) throw new Error('This original exceeds the 1 GB local download limit. Use its authenticated web download instead.')
  const response = await apiResponse(`/api/corpus/assets/${encodeURIComponent(assetId)}`, { query: { download: '1' }, timeoutMs: 300000, redirect: 'error' })
  if (response.status !== 200 || !response.body) {
    await response.body?.cancel()
    throw new Error('The server did not return a complete original file. Retry the download.')
  }
  const root = resolve(outputFolder)
  await mkdir(root, { recursive: true, mode: 0o700 })
  const folder = await mkdtemp(join(root, 'wicker-original-'))
  const filename = String(material.filename || assetId).split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '_').slice(0, 200)
  const path = join(folder, !filename || /^\.+$/.test(filename) ? 'original' : filename)
  let file
  try {
    file = await open(path, 'wx', 0o600)
    const hash = createHash('sha256')
    let byteSize = 0
    for await (const chunk of response.body) {
      byteSize += chunk.byteLength
      if (byteSize > size) throw new Error('The downloaded original does not match its recorded size.')
      hash.update(chunk)
      // FileHandle.write may make a partial write; retain every byte.
      let offset = 0
      while (offset < chunk.byteLength) {
        const { bytesWritten } = await file.write(chunk, offset, chunk.byteLength - offset)
        if (!bytesWritten) throw new Error('The original could not be written completely.')
        offset += bytesWritten
      }
    }
    const sha256 = hash.digest('hex')
    if (byteSize !== size || sha256 !== material.sha256.toLowerCase()) throw new Error('The downloaded original failed its size or checksum check. Retry; no partial file was retained.')
    await file.close(); file = null
    return { path, filename: material.filename, assetId, courseCode: material.courseCode, academicYear: material.academicYear, mediaType: material.mediaType, byteSize, sha256, complete: true, location: 'Local filesystem of this MCP server. The complete original bytes are saved; this is not extracted text.' }
  } catch (error) {
    await file?.close().catch(() => {})
    await rm(folder, { recursive: true, force: true })
    throw error
  }
}
