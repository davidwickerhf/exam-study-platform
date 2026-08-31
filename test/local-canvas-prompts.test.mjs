import test from 'node:test'
import assert from 'node:assert/strict'
import { promptForLocalCanvasImport } from '../lib/local-canvas-prompts.mjs'

test('Canvas import CLI preserves supplied values without entering interactive mode', async () => {
  const result = await promptForLocalCanvasImport({
    courseUrl: ' https://canvas.example.edu/courses/1/modules ',
    outputFolder: ' /tmp/canvas-course ',
    accessToken: ' local-token-only '
  })
  assert.deepEqual(result, {
    courseUrl: 'https://canvas.example.edu/courses/1/modules',
    outputFolder: '/tmp/canvas-course',
    accessToken: 'local-token-only'
  })
})
