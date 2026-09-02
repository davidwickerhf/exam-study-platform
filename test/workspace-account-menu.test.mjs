import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('the account dropdown composes Base UI labels and items inside menu groups', async () => {
  const source = await readFile(new URL('../components/workspace/workspace-shell.tsx', import.meta.url), 'utf8')
  assert.match(source, /DropdownMenuGroup/)
  const content = source.slice(source.indexOf('<DropdownMenuContent'), source.indexOf('</DropdownMenuContent>'))
  assert.equal((content.match(/<DropdownMenuGroup>/g) || []).length, 4)
  assert.equal((content.match(/<DropdownMenuLabel>/g) || []).length, 2)
})
