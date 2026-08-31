import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Postgres accepts `ON CONFLICT DO NOTHING` bare, but `DO UPDATE` needs a
// conflict target. Without one the statement only fails when it actually runs,
// which for the editorial pipeline meant the first real source sync.
test('every ON CONFLICT DO UPDATE names its conflict target', async () => {
  const root = fileURLToPath(new URL('../lib/', import.meta.url))
  const offenders = []
  for (const file of await readdir(root)) {
    if (!file.endsWith('.mjs')) continue
    const text = await readFile(root + file, 'utf8')
    text.split('\n').forEach((line, index) => {
      if (/ON CONFLICT\s+DO UPDATE/i.test(line)) offenders.push(`${file}:${index + 1}`)
    })
  }
  assert.deepEqual(offenders, [], `bare ON CONFLICT DO UPDATE at ${offenders.join(', ')}`)
})
