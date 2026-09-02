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
  // Both font variables have to reach <html>, or --font-ui and --font-data
  // resolve to nothing. Asserted by mechanism rather than by face, so changing
  // the typeface is a design decision and not a test failure.
  const fonts = [...layout.matchAll(/const (\w+) = \w+\(\{[^}]*variable: '(--next-font-(?:ui|data))'/gs)]
  assert.equal(fonts.length, 2, 'a UI face and a data face are declared')
  const rooted = layout.match(/<html[^>]+className=\{`([^`]+)`\}/)
  assert.ok(rooted, '<html> carries the font variable classes')
  for (const [, name] of fonts) assert.ok(rooted[1].includes(`\${${name}.variable}`), `${name} is rooted on <html>`)
  assert.match(nextCss, /:root\s*\{[^}]*--font-ui:\s*var\(--next-font-ui\)/s)
  assert.match(publicSiteCss, /\.auth-eligibility code\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s)
})
