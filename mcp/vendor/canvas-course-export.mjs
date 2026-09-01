import { execFile } from 'node:child_process'
import { lstat, mkdir, mkdtemp, rename, rm, unlink, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { CanvasCourseImportError, importCanvasCourse } from './canvas-course-import.mjs'

const execFileAsync = promisify(execFile)

function safeFilename(value, fallback = 'canvas-course') {
  const name = String(value || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '')
  return name || fallback
}

async function assertNewOutput(path) {
  try {
    await lstat(path)
    throw new CanvasCourseImportError('Choose a new ZIP path. Existing files are never overwritten.')
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
}

export async function exportCanvasCourseZip({ courseUrl, accessToken, moduleIds, outputPath, maxResources, maxFileBytes, fetchImpl } = {}) {
  if (process.platform !== 'darwin') throw new CanvasCourseImportError('Local Canvas ZIP export currently requires macOS.')
  if (!outputPath || !String(outputPath).trim()) throw new CanvasCourseImportError('outputPath is required for the Canvas ZIP export.')
  if (!isAbsolute(String(outputPath))) throw new CanvasCourseImportError('outputPath must be an absolute .zip path.')
  const resolvedOutputPath = resolve(String(outputPath))
  if (!resolvedOutputPath.toLowerCase().endsWith('.zip')) throw new CanvasCourseImportError('outputPath must be an absolute .zip path.')
  await assertNewOutput(resolvedOutputPath)
  await mkdir(dirname(resolvedOutputPath), { recursive: true })

  const staging = await mkdtemp(join(tmpdir(), 'wicker-study-canvas-export-'))
  const importRoot = join(staging, 'course')
  const temporaryZip = `${resolvedOutputPath}.partial-${process.pid}-${Date.now()}`
  try {
    const imported = await importCanvasCourse({ courseUrl, accessToken, outputFolder: importRoot, moduleIds, maxResources, maxFileBytes, fetchImpl })
    const folderName = safeFilename(`${imported.course.code || 'Canvas course'} ${imported.course.id}`)
    const packagedFolder = join(staging, folderName)
    await rename(importRoot, packagedFolder)
    try {
      await execFileAsync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', packagedFolder, temporaryZip], { timeout: 10 * 60_000, maxBuffer: 1024 * 1024 })
    } catch (error) {
      throw new CanvasCourseImportError(`Could not create the Canvas ZIP: ${error.message}`)
    }
    await rename(temporaryZip, resolvedOutputPath)
    const details = await stat(resolvedOutputPath)
    return { zipPath: resolvedOutputPath, fileName: basename(resolvedOutputPath), bytes: details.size, imported }
  } catch (error) {
    await unlink(temporaryZip).catch(() => {})
    throw error
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
  }
}

export function defaultCanvasZipPath(courseId) {
  return join(homedir(), 'Downloads', `${safeFilename(`Wicker Study Canvas ${courseId}`)}.zip`)
}
