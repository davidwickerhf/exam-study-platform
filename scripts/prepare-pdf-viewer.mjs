import { cp, mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
const root = dirname(require.resolve('pdfjs-dist/package.json'))
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const target = new URL(`../public/vendor/pdfjs/${version}/`, import.meta.url)
await mkdir(target, { recursive: true })
for (const name of ['build/pdf.worker.min.mjs', 'cmaps', 'standard_fonts', 'wasm'])
  await cp(join(root, name), new URL(name.startsWith('build/') ? 'pdf.worker.min.mjs' : name, target), { recursive: true })
