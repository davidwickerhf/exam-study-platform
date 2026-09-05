import test from 'node:test'
import assert from 'node:assert/strict'
import { chunkProgrammePolicyText, normaliseAcademicYear, PROGRAMME_POLICY_KINDS, validateProgrammePolicyPublication } from '../lib/programme-policy-sources.mjs'
import { TUTOR_TOOLS, tutorSystemPrompt } from '../lib/tutor-agent.mjs'
import manifest from '../data/programme-policy-sources.json' with { type: 'json' }

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

test('institution-distributed policy knowledge can be university-wide without exposing the original', () => {
  assert.deepEqual(validateProgrammePolicyPublication({ visibility: 'university' }), {
    visibility: 'university',
    rightsBasis: 'institution-member-reference',
    sourceUrl: null,
    originalDownloadable: false
  })
  assert.throws(() => validateProgrammePolicyPublication({ visibility: 'university', originalDownloadable: true }), /cannot be downloadable/)
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

test('reviewed regulation sources retain their Canvas provenance and are university-wide without public originals', () => {
  assert.equal(manifest.sources.length, 2)
  for (const source of manifest.sources) {
    assert.equal(source.visibility, 'university')
    assert.equal(source.originalDownloadable, false)
    assert.deepEqual(source.provenance, {
      kind: 'canvas-course',
      courseCode: 'BCS3300',
      courseName: 'Project 3-1',
      courseEdition: '2026-2027-002-BCS3300'
    })
  }
})
