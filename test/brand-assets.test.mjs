import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('the shared brand mark drives the interface and browser metadata', async () => {
  const [mark, favicon, layout, publicChrome, workspace, brandComponent] = await Promise.all([
    read('public/brand-mark.svg'),
    read('public/favicon.svg'),
    read('app/layout.tsx'),
    read('components/site/public-chrome.tsx'),
    read('components/workspace/workspace-shell.tsx'),
    read('components/brand/brand-mark.tsx')
  ])

  assert.match(mark, /#3f51d9/i)
  assert.match(mark, /folded W monogram/i)
  assert.match(favicon, /#3f51d9/i)
  assert.match(layout, /apple-touch-icon\.png/)
  assert.match(layout, /site\.webmanifest/)
  assert.match(publicChrome, /BrandMark/)
  assert.match(workspace, /BrandMark/)
  assert.match(brandComponent, /brand-mark\.svg/)
  assert.doesNotMatch(publicChrome, /<span>W<\/span>/)
  assert.doesNotMatch(workspace, />W<\/span>/)
})
