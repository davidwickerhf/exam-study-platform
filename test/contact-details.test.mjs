import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const siteContent = await readFile(new URL('../lib/site-content.ts', import.meta.url), 'utf8')
const about = await readFile(new URL('../app/(public)/about/page.tsx', import.meta.url), 'utf8')
const privacy = await readFile(new URL('../app/(public)/privacy/page.tsx', import.meta.url), 'utf8')
const terms = await readFile(new URL('../app/(public)/terms/page.tsx', import.meta.url), 'utf8')
const security = await readFile(new URL('../lib/security.mjs', import.meta.url), 'utf8')
const securityDocs = await readFile(new URL('../docs/SECURITY.md', import.meta.url), 'utf8')
const publicSite = [siteContent, about, privacy, terms].join('\n')
const reviewedSources = [publicSite, security, securityDocs].join('\n')

test('public contact addresses use the study hostname', () => {
  for (const mailbox of ['info', 'support', 'privacy', 'security', 'legal']) {
    assert.match(publicSite, new RegExp(`${mailbox}@study\\.wicker\\.life`))
  }
  assert.doesNotMatch(reviewedSources, /(?:mailto:|https:\/\/clerk\.)[a-z]*@?wicker\.life/)
})

test('the Clerk production origin uses the current custom hostname', () => {
  assert.match(security, /https:\/\/clerk\.study\.wicker\.life/)
  assert.match(securityDocs, /`clerk\.study\.wicker\.life`/)
})

test('legal pages identify the individual operator and controller', () => {
  assert.match(privacy, /Wicker Study is operated by \{operatorName\}, acting as an individual rather than through a company or other legal entity/)
  assert.match(terms, /These terms are between you and \{operatorName\}, an individual operating the service under the name Wicker Study/)
  assert.match(siteContent, /operatorName = 'David Henry Francis Wicker'/)
})
