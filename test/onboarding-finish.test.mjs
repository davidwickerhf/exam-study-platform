// Finishing setup, and never being locked into it.
//
// The workspace gate reads one field: GET /api/onboarding's `finished`. Until
// it is true, require-auth sends every destination back to /app/setup. The
// conversational path sets it when the model calls `finish`; the checklist —
// the path a student takes when the conversation is unavailable or they would
// rather click — had no way to set it at all, so completing setup by hand left
// the account bouncing off its own workspace.
//
// Two rules follow, and both are here because either one failing is a lockout:
// finishing is possible once the required step is met, and an account that
// already has a working academic record is never asked to prove it again.

import test from 'node:test'
import assert from 'node:assert/strict'
import { withRequestContext } from '../lib/request-context.mjs'
import { deleteAllDocuments, readDocument } from '../lib/user-store.mjs'
import { applyProgramme, finishSetup, onboardingView } from '../lib/onboarding-runtime.mjs'
import { emptyAcademicWorkspace, saveActiveAcademicWorkspace } from '../lib/academics.mjs'
import { OnboardingError } from '../lib/onboarding-agent.mjs'

const CS = 'maastricht-university-bsc-computer-science'

const asNewStudent = (body) => withRequestContext(
  { userId: `finish-${Date.now()}-${Math.random().toString(16).slice(2)}` },
  async () => { try { return await body() } finally { await deleteAllDocuments() } }
)

test('an account with nothing recorded cannot declare itself finished', async () => {
  await asNewStudent(async () => {
    await assert.rejects(() => finishSetup(), (error) => {
      assert.ok(error instanceof OnboardingError)
      assert.equal(error.status, 409)
      assert.match(error.message, /programme/i)
      return true
    })
    assert.equal((await onboardingView()).finished, false)
  })
})

test('a programme with no courses can still be finished explicitly, and it sticks', async () => {
  await asNewStudent(async () => {
    // A student whose programme is not in the maintained catalogue names it
    // themselves; their courses arrive later from their own record.
    await saveActiveAcademicWorkspace({ ...emptyAcademicWorkspace(), profile: { programme: 'BSc Liberal Arts' } }, 0)

    // Nothing was ever finished and there is no course ledger, so the account
    // is not grandfathered — it has to say so.
    assert.equal((await onboardingView()).finished, false)

    const view = await finishSetup()
    assert.equal(view.finished, true)

    // Written down, not merely returned: a reload must agree.
    assert.equal((await readDocument('onboarding', 'conversation', null))?.finished, true)
    assert.equal((await onboardingView()).finished, true)
  })
})

test('finishing twice is not an error and does not rewrite the summary', async () => {
  await asNewStudent(async () => {
    await saveActiveAcademicWorkspace({ ...emptyAcademicWorkspace(), profile: { programme: 'BSc Liberal Arts' } }, 0)
    const first = await finishSetup()
    const second = await finishSetup()
    assert.equal(second.finished, true)
    assert.equal(second.summary, first.summary)
  })
})

test('an existing account with a programme and courses is already finished', async () => {
  await asNewStudent(async () => {
    // Exactly the state a student who set up before the checklist existed is
    // in: a real record, and no conversation that ever called `finish`.
    await applyProgramme({ programmeId: CS, studyYear: 3 })
    assert.equal(await readDocument('onboarding', 'conversation', null), null, 'no conversation was ever stored')

    const view = await onboardingView()
    assert.equal(view.finished, true, 'a working record is not sent back to setup')
    assert.ok(view.state.courseCount > 0)
    assert.ok(view.state.programmeName)
  })
})
