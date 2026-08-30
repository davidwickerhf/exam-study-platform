import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8')
const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8')
const workspace = await readFile(new URL('../components/workspace/legacy-workspace.tsx', import.meta.url), 'utf8')
const nextCss = await readFile(new URL('../app/next.css', import.meta.url), 'utf8')
const publicSiteCss = await readFile(new URL('../public/public-site.css', import.meta.url), 'utf8')

test('Next.js App Router owns the document and route runtime', async () => {
  assert.equal(packageJson.dependencies.next.startsWith('^16.'), true)
  assert.equal(packageJson.dependencies.react.startsWith('^19.'), true)
  assert.equal(packageJson.scripts.build, 'next build')
  assert.equal(packageJson.scripts.start, 'NODE_ENV=production node runner.mjs')
  assert.match(layout, /next\/font\/google/)
  assert.match(server, /await nextHandler\(req, res\)/)
  await access(new URL('../app/(public)/page.tsx', import.meta.url))
  await access(new URL('../app/(auth)/sign-in/page.tsx', import.meta.url))
  await access(new URL('../app/app/page.tsx', import.meta.url))
})

test('the remaining vanilla workspace is isolated behind one compatibility boundary', () => {
  assert.match(workspace, /function loadLegacyApplication/)
  assert.match(workspace, /\/app\.js\?v=/)
  assert.doesNotMatch(server, /\/index\.html/)
})

test('framework font variables are rooted and long authentication addresses can wrap', () => {
  assert.match(layout, /<html[^>]+className=\{`\$\{manrope\.variable\} \$\{plexMono\.variable\}`\}/)
  assert.match(nextCss, /:root\s*\{[^}]*--font-ui:\s*var\(--next-font-ui\)/s)
  assert.match(publicSiteCss, /\.auth-eligibility code\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s)
})
