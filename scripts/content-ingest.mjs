#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const contentRoot = resolve(root, 'content')
const definitionPath = resolve(root, 'data/study-state.template.json')
const schemaPath = resolve(root, 'content-pipeline/course.schema.json')
const outputPath = resolve(root, 'data/content-catalog.json')
const shouldWrite = process.argv.includes('--write')
const shouldNotifyAi = process.argv.includes('--ai')

const definitions = JSON.parse(await readFile(definitionPath, 'utf8'))
const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
if (!ajv.validate(schema, definitions)) {
  console.error(ajv.errorsText(ajv.errors, { separator: '\n' }))
  process.exit(1)
}

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(path))
    else if (entry.isFile()) out.push(path)
  }
  return out
}

function kindFor(extension) {
  if (extension === '.md') return 'markdown'
  if (extension === '.pdf') return 'pdf'
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(extension)) return 'image'
  if (['.ppt', '.pptx', '.doc', '.docx'].includes(extension)) return 'office'
  if (['.c', '.h', '.s', '.py', '.m', '.ipynb', '.html'].includes(extension)) return 'code'
  return 'attachment'
}

const courses = []
for (const course of definitions.courses) {
  const courseRoot = resolve(contentRoot, course.knowledgeBase)
  if (!courseRoot.startsWith(contentRoot) || !existsSync(courseRoot)) throw new Error(`Missing knowledge base: ${course.knowledgeBase}`)
  for (const chapter of course.chapters || []) {
    const chapterPath = resolve(courseRoot, chapter.file)
    if (!chapterPath.startsWith(courseRoot) || !existsSync(chapterPath)) throw new Error(`${course.id}/${chapter.id}: missing ${chapter.file}`)
  }
  const materials = []
  for (const path of await walk(courseRoot)) {
    const info = await stat(path)
    const extension = extname(path).toLowerCase()
    const bytes = await readFile(path)
    materials.push({
      path: relative(courseRoot, path),
      kind: kindFor(extension),
      mediaType: extension.slice(1) || 'binary',
      bytes: info.size,
      sha256: createHash('sha256').update(bytes).digest('hex')
    })
  }
  materials.sort((a, b) => a.path.localeCompare(b.path))
  courses.push({ id: course.id, code: course.code, name: course.name, knowledgeBase: course.knowledgeBase, materials })
}

const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'data/study-state.template.json',
  courses
}

if (shouldWrite) {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${relative(root, outputPath)}`)
}

if (shouldNotifyAi) {
  const endpoint = process.env.AI_INGEST_ENDPOINT
  if (!endpoint) throw new Error('AI_INGEST_ENDPOINT is required with --ai')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(process.env.AI_INGEST_TOKEN ? { authorization: `Bearer ${process.env.AI_INGEST_TOKEN}` } : {}) },
    body: JSON.stringify(catalog)
  })
  if (!response.ok) throw new Error(`AI ingest hook failed: ${response.status} ${await response.text()}`)
  console.log(`AI ingest hook accepted catalog (${response.status})`)
}

const counts = courses.reduce((sum, course) => sum + course.materials.length, 0)
console.log(`Validated ${courses.length} courses and indexed ${counts} source files${shouldWrite ? '' : ' (dry run)'}.`)
