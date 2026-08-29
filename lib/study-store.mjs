import { sql, userId, localRows, saveLocalRows, localUpsert, localDelete, iso, num, jsonb, remember, diffAgainstSnapshot } from './db.mjs'

// Repositories for the student's own study record. Every function is scoped
// to the authenticated user. Rows are plain camelCase objects; the SQL branch
// maps them to columns, the local branch stores them as they are.

// ── Course settings ──────────────────────────────────────────────────────

export async function listCourseSettings() {
  if (sql) {
    const rows = await sql`SELECT course_id, archived, sort_order FROM course_settings WHERE user_id = ${userId()}`
    return rows.map((row) => ({ courseId: row.course_id, archived: Boolean(row.archived), order: row.sort_order == null ? null : Number(row.sort_order) }))
  }
  return localRows('course_settings')
}

export async function upsertCourseSettings(entries) {
  const list = (Array.isArray(entries) ? entries : [entries]).filter((entry) => entry?.courseId)
  if (!list.length) return
  if (sql) {
    for (const entry of list) {
      await sql`INSERT INTO course_settings (user_id, course_id, archived, sort_order, updated_at)
        VALUES (${userId()}, ${entry.courseId}, ${entry.archived === true}, ${entry.order == null ? null : Math.trunc(entry.order)}, now())
        ON CONFLICT (user_id, course_id) DO UPDATE SET
          archived = CASE WHEN ${entry.archived === undefined} THEN course_settings.archived ELSE excluded.archived END,
          sort_order = CASE WHEN ${entry.order === undefined} THEN course_settings.sort_order ELSE excluded.sort_order END,
          updated_at = now()`
    }
    return
  }
  const existing = new Map((await localRows('course_settings')).map((row) => [row.courseId, row]))
  const merged = list.map((entry) => {
    const prev = existing.get(entry.courseId) || { courseId: entry.courseId, archived: false, order: null }
    return { courseId: entry.courseId, archived: entry.archived === undefined ? prev.archived : entry.archived === true, order: entry.order === undefined ? prev.order : entry.order }
  })
  await localUpsert('course_settings', (row) => row.courseId, merged)
}

// ── Item progress (mastery, notes, priority, review log) ─────────────────

const PROGRESS_FIELDS = ['mastery', 'masteryUpdatedAt', 'reviewLog', 'notes', 'priority']

export function hasProgress(item) {
  return PROGRESS_FIELDS.some((field) => field in item && item[field] !== undefined)
}

export async function listItemProgress() {
  if (sql) {
    const rows = await sql`SELECT item_id, course_id, mastery, mastery_updated_at, notes, priority, review_log FROM item_progress WHERE user_id = ${userId()}`
    return rows.map((row) => {
      const entry = { itemId: row.item_id, courseId: row.course_id }
      if (row.mastery != null) entry.mastery = Number(row.mastery)
      if (row.mastery_updated_at) entry.masteryUpdatedAt = iso(row.mastery_updated_at)
      if (row.notes != null) entry.notes = row.notes
      if (row.priority != null) entry.priority = row.priority
      if (Array.isArray(row.review_log) && row.review_log.length) entry.reviewLog = row.review_log
      return entry
    })
  }
  return localRows('item_progress')
}

export async function upsertItemProgress(courseId, item) {
  const entry = { itemId: item.id, courseId }
  for (const field of PROGRESS_FIELDS) if (field in item && item[field] !== undefined) entry[field] = item[field]
  if (sql) {
    await sql`INSERT INTO item_progress (user_id, item_id, course_id, mastery, mastery_updated_at, notes, priority, review_log, updated_at)
      VALUES (${userId()}, ${entry.itemId}, ${courseId}, ${entry.mastery ?? null}, ${iso(entry.masteryUpdatedAt)}, ${entry.notes ?? null}, ${entry.priority ?? null}, ${jsonb(entry.reviewLog || [])}::jsonb, now())
      ON CONFLICT (user_id, item_id) DO UPDATE SET course_id = excluded.course_id, mastery = excluded.mastery, mastery_updated_at = excluded.mastery_updated_at,
        notes = excluded.notes, priority = excluded.priority, review_log = excluded.review_log, updated_at = now()`
    return entry
  }
  await localUpsert('item_progress', (row) => row.itemId, [entry])
  return entry
}

// ── Personal extra exercises ─────────────────────────────────────────────

export async function listPersonalExercises(courseId, chapterId) {
  if (sql) {
    const rows = await sql`SELECT body FROM personal_exercises WHERE user_id = ${userId()} AND course_id = ${courseId} AND chapter_id = ${chapterId} ORDER BY created_at, id`
    return rows.map((row) => row.body)
  }
  return (await localRows('personal_exercises')).filter((row) => row.courseId === courseId && row.chapterId === chapterId).map((row) => row.body)
}

export async function addPersonalExercises(courseId, chapterId, questions) {
  const now = new Date().toISOString()
  if (sql) {
    for (const question of questions) {
      await sql`INSERT INTO personal_exercises (user_id, id, course_id, chapter_id, type, difficulty, body, created_at)
        VALUES (${userId()}, ${question.id}, ${courseId}, ${chapterId}, ${question.type ?? null}, ${question.difficulty ?? null}, ${jsonb(question)}::jsonb, ${now}::timestamptz)
        ON CONFLICT (user_id, id) DO UPDATE SET body = excluded.body, type = excluded.type, difficulty = excluded.difficulty`
    }
    return
  }
  await localUpsert('personal_exercises', (row) => row.id, questions.map((question) => ({ id: question.id, courseId, chapterId, body: question, createdAt: now })))
}

export async function deletePersonalExercise(courseId, chapterId, questionId) {
  if (sql) {
    const rows = await sql`DELETE FROM personal_exercises WHERE user_id = ${userId()} AND course_id = ${courseId} AND chapter_id = ${chapterId} AND id = ${questionId} RETURNING id`
    return rows.length > 0
  }
  return (await localDelete('personal_exercises', (row) => row.id === questionId && row.courseId === courseId && row.chapterId === chapterId)) > 0
}

// ── Flashcards (personal cards and personal state on editorial cards) ────

const CARD_FIELDS = new Set(['id', 'courseId', 'chapterId', 'front', 'back', 'source', 'sr', 'createdAt'])

function cardFromRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    chapterId: row.chapter_id,
    front: row.front,
    back: row.back,
    source: row.source ?? undefined,
    createdAt: iso(row.created_at),
    ...(row.extra && typeof row.extra === 'object' ? row.extra : {}),
    sr: { ease: Number(row.ease), interval: Number(row.interval_days), repetitions: Number(row.repetitions), lastReviewed: iso(row.last_reviewed), dueAt: iso(row.due_at), history: Array.isArray(row.history) ? row.history : [] }
  }
}

export async function listFlashcardRows() {
  if (sql) {
    const rows = await sql`SELECT * FROM flashcards WHERE user_id = ${userId()} ORDER BY created_at, id`
    return rows.map(cardFromRow)
  }
  return localRows('flashcards')
}

export async function upsertFlashcards(cards) {
  if (!cards.length) return
  if (sql) {
    for (const card of cards) {
      const sr = card.sr || {}
      const extra = Object.fromEntries(Object.entries(card).filter(([key]) => !CARD_FIELDS.has(key)))
      await sql`INSERT INTO flashcards (user_id, id, course_id, chapter_id, front, back, source, ease, interval_days, repetitions, last_reviewed, due_at, history, extra, created_at, updated_at)
        VALUES (${userId()}, ${card.id}, ${card.courseId || ''}, ${card.chapterId ?? null}, ${card.front || ''}, ${card.back || ''}, ${card.source ?? null},
          ${num(sr.ease, 2.5)}, ${num(sr.interval, 0)}, ${Math.trunc(num(sr.repetitions, 0))}, ${iso(sr.lastReviewed)}, ${iso(sr.dueAt)}, ${jsonb(sr.history || [])}::jsonb, ${jsonb(extra)}::jsonb,
          ${iso(card.createdAt) || new Date().toISOString()}::timestamptz, now())
        ON CONFLICT (user_id, id) DO UPDATE SET course_id = excluded.course_id, chapter_id = excluded.chapter_id, front = excluded.front, back = excluded.back, source = excluded.source,
          ease = excluded.ease, interval_days = excluded.interval_days, repetitions = excluded.repetitions, last_reviewed = excluded.last_reviewed, due_at = excluded.due_at,
          history = excluded.history, extra = excluded.extra, updated_at = now()`
    }
    return
  }
  await localUpsert('flashcards', (row) => row.id, cards)
}

export async function deleteFlashcards(ids) {
  if (!ids.length) return 0
  if (sql) {
    const rows = await sql`DELETE FROM flashcards WHERE user_id = ${userId()} AND id = ANY(${ids}) RETURNING id`
    return rows.length
  }
  const set = new Set(ids)
  return localDelete('flashcards', (row) => set.has(row.id))
}

// The server reads the whole deck, mutates it, and writes it back. Only rows
// that actually changed are written.
export function rememberFlashcards(container, cards) {
  return remember(container, cards, (card) => card.id)
}

export async function writeFlashcardDiff(container, cards, { editorialIds = new Set(), editorialById = new Map() } = {}) {
  const personal = cards.filter((card) => !editorialIds.has(card.id) || JSON.stringify(card) !== JSON.stringify(editorialById.get(card.id)))
  const { changed, removed } = diffAgainstSnapshot(container, personal, (card) => card.id)
  await upsertFlashcards(changed)
  await deleteFlashcards(removed)
}

// ── Spaced-repetition cards keyed by question id ─────────────────────────

export async function listSrCards() {
  if (sql) {
    const rows = await sql`SELECT question_id, ease, interval_days, repetitions, last_reviewed, due_at, history FROM sr_cards WHERE user_id = ${userId()}`
    return Object.fromEntries(rows.map((row) => [row.question_id, { ease: Number(row.ease), interval: Number(row.interval_days), repetitions: Number(row.repetitions), lastReviewed: iso(row.last_reviewed), dueAt: iso(row.due_at), history: Array.isArray(row.history) ? row.history : [] }]))
  }
  return Object.fromEntries((await localRows('sr_cards')).map((row) => [row.questionId, row.card]))
}

export async function upsertSrCards(entries) {
  if (!entries.length) return
  if (sql) {
    for (const [questionId, card] of entries) {
      await sql`INSERT INTO sr_cards (user_id, question_id, ease, interval_days, repetitions, last_reviewed, due_at, history, updated_at)
        VALUES (${userId()}, ${questionId}, ${num(card.ease, 2.5)}, ${num(card.interval, 0)}, ${Math.trunc(num(card.repetitions, 0))}, ${iso(card.lastReviewed)}, ${iso(card.dueAt)}, ${jsonb(card.history || [])}::jsonb, now())
        ON CONFLICT (user_id, question_id) DO UPDATE SET ease = excluded.ease, interval_days = excluded.interval_days, repetitions = excluded.repetitions,
          last_reviewed = excluded.last_reviewed, due_at = excluded.due_at, history = excluded.history, updated_at = now()`
    }
    return
  }
  await localUpsert('sr_cards', (row) => row.questionId, entries.map(([questionId, card]) => ({ questionId, card })))
}

export async function deleteSrCards(ids) {
  if (!ids.length) return 0
  if (sql) {
    const rows = await sql`DELETE FROM sr_cards WHERE user_id = ${userId()} AND question_id = ANY(${ids}) RETURNING question_id`
    return rows.length
  }
  const set = new Set(ids)
  return localDelete('sr_cards', (row) => set.has(row.questionId))
}

export function rememberSrCards(container, cards) {
  return remember(container, Object.entries(cards), ([id]) => id)
}

export async function writeSrDiff(container, cards) {
  const { changed, removed } = diffAgainstSnapshot(container, Object.entries(cards), ([id]) => id)
  await upsertSrCards(changed)
  await deleteSrCards(removed)
}

// ── Mistakes ─────────────────────────────────────────────────────────────

function mistakeFromRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    chapterId: row.chapter_id,
    questionId: row.question_id,
    type: row.type,
    difficulty: row.difficulty,
    question: row.question,
    options: row.options ?? undefined,
    expected: row.expected ?? undefined,
    source: row.source,
    attempt: row.attempt,
    correction: row.correction,
    score: row.score == null ? null : Number(row.score),
    createdAt: iso(row.created_at),
    resolvedAt: iso(row.resolved_at)
  }
}

export async function listMistakes(filter = {}) {
  let all
  if (sql) {
    const rows = await sql`SELECT * FROM mistakes WHERE user_id = ${userId()} ORDER BY created_at DESC`
    all = rows.map(mistakeFromRow)
  } else {
    all = (await localRows('mistakes')).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  }
  return all.filter((m) => {
    if (filter.courseId && m.courseId !== filter.courseId) return false
    if (filter.chapterId && m.chapterId !== filter.chapterId) return false
    if (filter.open !== undefined && (filter.open ? m.resolvedAt : !m.resolvedAt)) return false
    return true
  })
}

export async function insertMistake(record) {
  // Same open question again: replace the previous open record.
  if (record.questionId) await deleteMistakesWhere({ questionId: record.questionId, open: true })
  if (sql) {
    await sql`INSERT INTO mistakes (user_id, id, course_id, chapter_id, question_id, type, difficulty, question, options, expected, source, attempt, correction, score, created_at, resolved_at)
      VALUES (${userId()}, ${record.id}, ${record.courseId}, ${record.chapterId ?? null}, ${record.questionId ?? null}, ${record.type ?? null}, ${record.difficulty ?? null},
        ${record.question ?? null}, ${record.options === undefined ? null : jsonb(record.options)}::jsonb, ${record.expected === undefined ? null : jsonb(record.expected)}::jsonb,
        ${record.source ?? null}, ${record.attempt == null ? null : String(record.attempt)}, ${record.correction ?? null}, ${num(record.score)},
        ${iso(record.createdAt) || new Date().toISOString()}::timestamptz, ${iso(record.resolvedAt)})
      ON CONFLICT (user_id, id) DO UPDATE SET correction = excluded.correction, score = excluded.score, attempt = excluded.attempt, resolved_at = excluded.resolved_at`
    return record
  }
  await localUpsert('mistakes', (row) => row.id, [record])
  return record
}

export async function updateMistake(id, patch) {
  if (sql) {
    const rows = await sql`UPDATE mistakes SET resolved_at = CASE WHEN ${'resolvedAt' in patch} THEN ${iso(patch.resolvedAt)}::timestamptz ELSE resolved_at END
      WHERE user_id = ${userId()} AND id = ${id} RETURNING *`
    return rows[0] ? mistakeFromRow(rows[0]) : null
  }
  const rows = await localRows('mistakes')
  const found = rows.find((row) => row.id === id)
  if (!found) return null
  Object.assign(found, patch)
  await saveLocalRows('mistakes', rows)
  return found
}

export async function deleteMistakesWhere({ id, courseId, chapterId, questionId, open } = {}) {
  if (sql) {
    const rows = await sql`DELETE FROM mistakes WHERE user_id = ${userId()}
      AND (${id ?? null}::text IS NULL OR id = ${id ?? null})
      AND (${courseId ?? null}::text IS NULL OR course_id = ${courseId ?? null})
      AND (${chapterId ?? null}::text IS NULL OR chapter_id = ${chapterId ?? null})
      AND (${questionId ?? null}::text IS NULL OR question_id = ${questionId ?? null})
      AND (${open !== true} OR resolved_at IS NULL)
      RETURNING id`
    return rows.length
  }
  return localDelete('mistakes', (row) => (id == null || row.id === id) && (courseId == null || row.courseId === courseId)
    && (chapterId == null || row.chapterId === chapterId) && (questionId == null || row.questionId === questionId) && (open !== true || !row.resolvedAt))
}

// ── Mock sessions ────────────────────────────────────────────────────────

export async function listMockSessions() {
  if (sql) {
    const rows = await sql`SELECT s.id, s.course_id, s.chapter_id, s.submitted_at, s.total_score, s.total_max, s.duration_seconds,
        (SELECT count(*) FROM mock_session_answers a WHERE a.user_id = s.user_id AND a.session_id = s.id)::int AS count
      FROM mock_sessions s WHERE s.user_id = ${userId()} ORDER BY s.submitted_at DESC NULLS LAST`
    return rows.map((row) => ({ id: row.id, courseId: row.course_id, chapterId: row.chapter_id, submittedAt: iso(row.submitted_at), totalScore: num(row.total_score), totalMax: num(row.total_max), count: Number(row.count), duration: row.duration_seconds == null ? null : Number(row.duration_seconds) }))
  }
  return (await localRows('mock_sessions'))
    .map((s) => ({ id: s.id, courseId: s.courseId, chapterId: s.chapterId, submittedAt: s.submittedAt, totalScore: s.totalScore, totalMax: s.totalMax, count: s.questions?.length || 0, duration: s.duration }))
    .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
}

export async function getMockSession(id) {
  if (sql) {
    const [session] = await sql`SELECT * FROM mock_sessions WHERE user_id = ${userId()} AND id = ${id}`
    if (!session) return null
    const answers = await sql`SELECT * FROM mock_session_answers WHERE user_id = ${userId()} AND session_id = ${id} ORDER BY position`
    return {
      id: session.id, courseId: session.course_id, chapterId: session.chapter_id, startedAt: iso(session.started_at), submittedAt: iso(session.submitted_at),
      duration: session.duration_seconds == null ? null : Number(session.duration_seconds), totalScore: num(session.total_score), totalMax: num(session.total_max),
      questions: answers.map((row) => ({ ...(row.question || {}), attempt: row.attempt ?? '', ...(row.attempt_images ? { attemptImages: row.attempt_images } : {}), correction: row.correction ?? '', score: num(row.score, 0) }))
    }
  }
  return (await localRows('mock_sessions')).find((s) => s.id === id) || null
}

export async function saveMockSession(session) {
  if (sql) {
    await sql`INSERT INTO mock_sessions (user_id, id, course_id, chapter_id, started_at, submitted_at, duration_seconds, total_score, total_max)
      VALUES (${userId()}, ${session.id}, ${session.courseId || ''}, ${session.chapterId ?? null}, ${iso(session.startedAt)}, ${iso(session.submittedAt)}, ${session.duration == null ? null : Math.trunc(num(session.duration, 0))}, ${num(session.totalScore)}, ${num(session.totalMax)})
      ON CONFLICT (user_id, id) DO UPDATE SET submitted_at = excluded.submitted_at, duration_seconds = excluded.duration_seconds, total_score = excluded.total_score, total_max = excluded.total_max`
    await sql`DELETE FROM mock_session_answers WHERE user_id = ${userId()} AND session_id = ${session.id}`
    const questions = Array.isArray(session.questions) ? session.questions : []
    for (const [position, q] of questions.entries()) {
      const { attempt, attemptImages, correction, score, ...question } = q
      await sql`INSERT INTO mock_session_answers (user_id, session_id, position, question_id, question, attempt, attempt_images, correction, score)
        VALUES (${userId()}, ${session.id}, ${position}, ${q.id ?? null}, ${jsonb(question)}::jsonb, ${attempt == null ? null : String(attempt)}, ${attemptImages ? jsonb(attemptImages) : null}::jsonb, ${correction ?? null}, ${num(score)})`
    }
    return session
  }
  await localUpsert('mock_sessions', (row) => row.id, [session])
  return session
}

export async function deleteMockSessionsWhere({ courseId } = {}) {
  if (sql) {
    const rows = await sql`DELETE FROM mock_sessions WHERE user_id = ${userId()} AND (${courseId ?? null}::text IS NULL OR course_id = ${courseId ?? null}) RETURNING id`
    return rows.length
  }
  return localDelete('mock_sessions', (row) => courseId == null || row.courseId === courseId)
}

// ── Browser state sync (reading positions, chapter tabs, drafts) ─────────

const BROWSER_KEY_LIMIT = 400
const BROWSER_VALUE_LIMIT = 64 * 1024

export function sanitiseBrowserState(value) {
  const out = {}
  for (const [key, raw] of Object.entries(value || {})) {
    if (!key || key.startsWith('__clerk') || key.length > 200) continue
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
    if (text == null || text.length > BROWSER_VALUE_LIMIT) continue
    out[key] = text
    if (Object.keys(out).length >= BROWSER_KEY_LIMIT) break
  }
  return out
}

export async function getBrowserState() {
  if (sql) {
    const rows = await sql`SELECT key, value FROM browser_state WHERE user_id = ${userId()}`
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  }
  return Object.fromEntries((await localRows('browser_state')).map((row) => [row.key, row.value]))
}

export async function putBrowserState(value) {
  const next = sanitiseBrowserState(value)
  const current = await getBrowserState()
  const changed = Object.entries(next).filter(([key, text]) => current[key] !== text)
  const removed = Object.keys(current).filter((key) => !(key in next))
  if (sql) {
    for (const [key, text] of changed) {
      await sql`INSERT INTO browser_state (user_id, key, value, updated_at) VALUES (${userId()}, ${key}, ${text}, now())
        ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = now()`
    }
    if (removed.length) await sql`DELETE FROM browser_state WHERE user_id = ${userId()} AND key = ANY(${removed})`
    return next
  }
  await saveLocalRows('browser_state', Object.entries(next).map(([key, text]) => ({ key, value: text })))
  return next
}

// ── Account-level views over the study tables ────────────────────────────

export const STUDY_TABLES = Object.freeze([
  ['course_settings', 'Course order and archive'],
  ['item_progress', 'Mastery and review notes'],
  ['personal_exercises', 'Personal extra exercises'],
  ['flashcards', 'Flashcards'],
  ['sr_cards', 'Spaced-repetition schedule'],
  ['mistakes', 'Mistake bank'],
  ['mock_sessions', 'Mock exam sessions'],
  ['browser_state', 'Synced reading positions']
])

export async function summariseStudyTables() {
  const out = []
  for (const [table, label] of STUDY_TABLES) {
    if (sql) {
      const [row] = await sql.query(`SELECT count(*)::int AS count, coalesce(sum(pg_column_size(t.*)), 0)::bigint AS bytes,
        max(${['flashcards', 'sr_cards', 'browser_state', 'course_settings', 'item_progress'].includes(table) ? 'updated_at' : table === 'mock_sessions' ? 'submitted_at' : 'created_at'}) AS updated_at
        FROM ${table} t WHERE user_id = $1`, [userId()])
      out.push({ table, label, count: Number(row.count), bytes: Number(row.bytes), updatedAt: iso(row.updated_at) })
    } else {
      const rows = await localRows(table)
      out.push({ table, label, count: rows.length, bytes: JSON.stringify(rows).length, updatedAt: rows.length ? new Date().toISOString() : null })
    }
  }
  return out
}

export async function exportStudyTables() {
  const flashcards = await listFlashcardRows()
  const sessions = []
  for (const summary of await listMockSessions()) sessions.push(await getMockSession(summary.id))
  return {
    courseSettings: await listCourseSettings(),
    itemProgress: await listItemProgress(),
    personalExercises: sql ? (await sql`SELECT body FROM personal_exercises WHERE user_id = ${userId()} ORDER BY created_at`).map((row) => row.body) : (await localRows('personal_exercises')).map((row) => row.body),
    flashcards,
    spacedRepetition: await listSrCards(),
    mistakes: await listMistakes(),
    mockSessions: sessions,
    browserState: await getBrowserState()
  }
}

export async function deleteStudyTables() {
  const removed = {}
  for (const [table] of STUDY_TABLES) {
    if (sql) {
      const rows = await sql.query(`DELETE FROM ${table} WHERE user_id = $1 RETURNING 1`, [userId()])
      removed[table] = rows.length
    } else {
      removed[table] = (await localRows(table)).length
      await saveLocalRows(table, [])
    }
  }
  return removed
}
