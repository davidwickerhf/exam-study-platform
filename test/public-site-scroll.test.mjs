import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const css = await readFile(new URL('../public/public-site.css', import.meta.url), 'utf8')

test('public pages use normal document scrolling instead of the locked app shell', () => {
  const htmlRule = css.match(/html\.public-mode\s*\{([^}]*)\}/)?.[1] || ''
  const bodyRule = css.match(/body\.public-mode\s*\{([^}]*)\}/)?.[1] || ''

  assert.match(htmlRule, /height:\s*auto/)
  assert.match(htmlRule, /overflow:\s*visible/)
  assert.match(bodyRule, /height:\s*auto/)
  assert.match(bodyRule, /overflow:\s*visible/)
  assert.doesNotMatch(htmlRule, /overflow-y:\s*(?:hidden|auto|scroll)/)
  assert.doesNotMatch(bodyRule, /overflow-y:\s*(?:hidden|auto|scroll)/)
})
