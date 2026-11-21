import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTutorAttachmentIndex } from '../lib/tutor-attachment-index.mjs'
import { hasVisiblePixels } from '../lib/workspace/tutor-files.ts'

test('blank rendered PDF pages are not sent for visual enrichment', () => {
  const pixels = (count, value) => new Uint8ClampedArray(Array.from({ length: count }, () => [value, value, value, 255]).flat())
  assert.equal(hasVisiblePixels(pixels(600, 255)), false)
  assert.equal(hasVisiblePixels(pixels(511, 30)), false)
  assert.equal(hasVisiblePixels(pixels(512, 30)), true)
})

test('a visual-enrichment failure preserves a PDF text layer and cleans temporary images', async () => {
  const removed = []
  let reported = null
  const text = await buildTutorAttachmentIndex({
    text: 'Page 1\nA complete searchable chapter.',
    images: ['data:image/jpeg;base64,blank-page']
  }, {
    writeImages: async () => ['/tmp/exam-platform-images/page.jpg'],
    transcribeVisual: async () => { throw Object.assign(new Error('provider detail'), { code: 'provider_unavailable' }) },
    onVisualFailure: (error) => { reported = error.code },
    removeImages: async (paths) => { removed.push(...paths) }
  })

  assert.equal(text, 'Page 1\nA complete searchable chapter.')
  assert.equal(reported, 'provider_unavailable')
  assert.deepEqual(removed, ['/tmp/exam-platform-images/page.jpg'])
})

test('an image-only source is still storable when optional transcription is unavailable', async () => {
  const text = await buildTutorAttachmentIndex({ images: ['data:image/png;base64,image'] }, {
    writeImages: async () => ['/tmp/exam-platform-images/page.png'],
    transcribeVisual: async () => { throw new Error('offline') },
    removeImages: async () => {}
  })
  assert.equal(text, '')
})

test('successful visual enrichment remains appended to the extracted text', async () => {
  const text = await buildTutorAttachmentIndex({ text: 'Text layer', images: ['image'] }, {
    writeImages: async () => ['/tmp/image.jpg'],
    transcribeVisual: async (prompt, paths) => {
      assert.match(prompt, /Existing text layer for context:\nText layer/)
      assert.deepEqual(paths, ['/tmp/image.jpg'])
      return 'Diagram labels'
    },
    removeImages: async () => {}
  })
  assert.equal(text, 'Text layer\n\nVISUAL CONTENT\nDiagram labels')
})
