import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8')
const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8')
const migration = await readFile(new URL('../lib/workspace/migration.mjs', import.meta.url), 'utf8')
const nextCss = await readFile(new URL('../app/next.css', import.meta.url), 'utf8')
const tailwindCss = await readFile(new URL('../app/tailwind.css', import.meta.url), 'utf8')
const appPublicCss = await readFile(new URL('../app/public.css', import.meta.url), 'utf8')
const publicSiteCss = await readFile(new URL('../public/public-site.css', import.meta.url), 'utf8')
const databaseMigration = await readFile(new URL('../scripts/db-migrate.mjs', import.meta.url), 'utf8')
const productionRunner = await readFile(new URL('../runner.mjs', import.meta.url), 'utf8')
const programmeScopedMigration = await readFile(new URL('../db/021_programme_scoped_study.sql', import.meta.url), 'utf8')

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

test('historical workspace links translate into the React application', () => {
  assert.match(migration, /export function legacyHashTarget/)
  assert.match(migration, /return `\/app/)
  assert.doesNotMatch(server, /\/index\.html/)
})

test('framework font variables are rooted and long authentication addresses can wrap', () => {
  // Both font variables have to reach <html>, or --font-ui and --font-data
  // resolve to nothing. Asserted by mechanism rather than by face, so changing
  // the typeface is a design decision and not a test failure.
  const fonts = [...layout.matchAll(/const (\w+) = \w+\(\{[^}]*variable: '(--next-font-(?:ui|data))'/gs)]
  assert.equal(fonts.length, 2, 'a UI face and a data face are declared')
  // The className may be a template literal or a cn(...) call; what matters
  // is that both variables reach <html>.
  const rooted = layout.match(/<html[^>]+className=\{([^}]+)\}/)
  assert.ok(rooted, '<html> carries the font variable classes')
  for (const [, name] of fonts) assert.ok(rooted[1].includes(`${name}.variable`), `${name} is rooted on <html>`)
  assert.match(nextCss, /:root\s*\{[^}]*--font-ui:\s*var\(--next-font-ui\)/s)
  assert.match(publicSiteCss, /\.auth-eligibility code\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s)
})

test('headings use full-width Archivo while compact data keeps Archivo Narrow', () => {
  assert.match(tailwindCss, /--font-heading:\s*var\(--next-font-ui\)/)
  assert.match(tailwindCss, /--font-data:\s*var\(--next-font-data\)/)
  assert.match(appPublicCss, /#public-site :is\(h1, h2, h3\),\s*#auth-gate :is\(h1, h2, h3\)\s*\{\s*font-family:\s*var\(--font-ui\)/s)
})

test('production applies tracked, repeatable migrations before accepting requests', () => {
  assert.match(databaseMigration, /CREATE TABLE IF NOT EXISTS schema_migrations/)
  assert.match(databaseMigration, /checksum/)
  assert.match(programmeScopedMigration, /CREATE UNIQUE INDEX IF NOT EXISTS academic_snapshots_user_programme_hash_idx/)
  assert.match(productionRunner, /Checking database migrations before accepting requests/)
  const ready = productionRunner.indexOf('Database migrations are up to date. Starting the server.')
  assert.ok(ready >= 0)
  assert.ok(productionRunner.indexOf('start()', ready) > ready)
  assert.doesNotMatch(productionRunner, /Applying database migrations in the background/)
})
