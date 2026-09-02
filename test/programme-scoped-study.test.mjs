import test from 'node:test'
import assert from 'node:assert/strict'
import { createAcademicProgramme, selectAcademicProgramme } from '../lib/academics.mjs'
import { deletePersonalData } from '../lib/account-data.mjs'
import { recordActivity, readActivity } from '../lib/activity.mjs'
import { listItemProgress, upsertItemProgress } from '../lib/study-store.mjs'
import { listConversations, newConversation, saveConversation } from '../lib/tutor-store.mjs'
import { withRequestContext } from '../lib/request-context.mjs'

test('learning state, activity, and tutor history follow the active programme', async () => {
  const userId = `programme-study-${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    await withRequestContext({ userId }, async () => {
      await upsertItemProgress('CS-A', { id: 'same-item', mastery: 4 })
      await recordActivity('read', { courseId: 'CS-A' })
      await saveConversation({ ...newConversation(), title: 'Bachelor thread' })

      const second = await createAcademicProgramme({ programme: 'Master programme' })
      assert.equal((await listItemProgress()).length, 0)
      assert.equal((await readActivity({ since: '1970-01-01T00:00:00.000Z' })).length, 0)
      assert.equal((await listConversations()).length, 0)

      await upsertItemProgress('CS-B', { id: 'same-item', mastery: 1 })
      assert.equal((await listItemProgress())[0].mastery, 1)

      await selectAcademicProgramme('default')
      assert.equal((await listItemProgress())[0].mastery, 4)
      assert.equal((await readActivity({ since: '1970-01-01T00:00:00.000Z' })).length, 1)
      assert.equal((await listConversations())[0].title, 'Bachelor thread')

      await selectAcademicProgramme(second.workspace.id)
      assert.equal((await listItemProgress())[0].mastery, 1)
    })
  } finally {
    await withRequestContext({ userId }, () => deletePersonalData())
  }
})
