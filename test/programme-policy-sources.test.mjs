import test from 'node:test'
import assert from 'node:assert/strict'
import { chunkProgrammePolicyText, normaliseAcademicYear, PROGRAMME_POLICY_KINDS, validateProgrammePolicyPublication } from '../lib/programme-policy-sources.mjs'
import { TUTOR_TOOLS, tutorSystemPrompt } from '../lib/tutor-agent.mjs'

test('programme policy originals default to restricted programme access', () => {
  assert.deepEqual(validateProgrammePolicyPublication({}), {
    visibility: 'programme',
    rightsBasis: 'institution-member-reference',
    sourceUrl: null,
    originalDownloadable: false
  })
})

test('public policy sources require a reviewed rights basis and official URL', () => {
  assert.throws(() => validateProgrammePolicyPublication({ visibility: 'public' }), /official source URL/)
  assert.throws(() => validateProgrammePolicyPublication({ visibility: 'public', rightsBasis: 'institution-member-reference', sourceUrl: 'https://example.edu/rules.pdf' }), /official source URL/)
  assert.deepEqual(validateProgrammePolicyPublication({ visibility: 'public', rightsBasis: 'official-publication', sourceUrl: 'https://example.edu/rules.pdf', originalDownloadable: true }), {
    visibility: 'public',
    rightsBasis: 'official-publication',
    sourceUrl: 'https://example.edu/rules.pdf',
    originalDownloadable: true
  })
})

test('programme policy text is chunked with useful overlap', () => {
  const text = Array.from({ length: 140 }, (_, index) => `Article ${index + 1}. The Board of Examiners decides this request under the applicable procedure.`).join('\n\n')
  const chunks = chunkProgrammePolicyText(text, 700, 100)
  assert.ok(chunks.length > 10)
  assert.ok(chunks.every((chunk) => chunk.length <= 700))
  assert.match(chunks[1], /Board of Examiners/)
})

test('academic-year scope accepts typographic dashes from uploaded records', () => {
  assert.equal(normaliseAcademicYear('2026–2027'), '2026-2027')
})

test('Tutor has a focused regulations tool and routes formal rules to it', () => {
  const tool = TUTOR_TOOLS.find((entry) => entry.function.name === 'search_programme_regulations')
  assert.ok(tool)
  assert.deepEqual(tool.function.parameters.properties.documentKind.enum, PROGRAMME_POLICY_KINDS)
  const prompt = tutorSystemPrompt({ memory: {}, briefing: null, planner: null, context: {}, today: '2026-09-05', now: new Date('2026-09-05T10:00:00Z') })
  assert.match(prompt, /call search_programme_regulations first/)
  assert.match(prompt, /Do not scan course sources for a programme-level rule/)
})
