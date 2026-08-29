// A compact, machine-readable description of the HTTP API for agents. Served
// at GET /api/agent/manifest. Scopes: read (GET), write (study mutations),
// admin (editorial content and programme catalogue).

export const AGENT_MANIFEST = Object.freeze({
  name: 'Wicker Study API',
  version: 1,
  auth: {
    type: 'bearer',
    header: 'Authorization: Bearer wsk_…',
    manage: 'Account → API access in the web app',
    scopes: {
      read: 'Every GET endpoint: course material, questions, progress, plan, activity.',
      write: 'Study mutations: answers, flashcard reviews, mistakes, mock sessions, mastery, plan.',
      admin: 'Editorial content and the programme catalogue (administrators only).'
    }
  },
  conventions: {
    ids: 'Course ids are short slugs (e.g. "sec"); chapter ids are zero-padded strings (e.g. "02"). Use GET /api/courses to discover them.',
    errors: 'Non-2xx responses carry { "error": "…" }. 401 = missing/invalid key, 403 = scope or admin check failed, 501 = editorial writes unavailable without a hosted database.',
    bodies: 'Send JSON with Content-Type: application/json.'
  },
  endpoints: [
    { method: 'GET', path: '/api/me', scope: 'read', summary: 'Who the key acts as, its scopes, and whether it is an administrator.' },
    { method: 'GET', path: '/api/courses', scope: 'read', summary: 'Courses with chapter lists and progress counts (light).' },
    { method: 'GET', path: '/api/courses/{courseId}', scope: 'read', summary: 'One course: chapters, mastery items with the caller’s mastery, papers.' },
    { method: 'GET', path: '/api/state', scope: 'read', summary: 'Full study state (every course, item, mastery, and order). Prefer /api/courses.' },
    { method: 'GET', path: '/api/chapter/{courseId}/{chapterId}[/{relPath}]', scope: 'read', summary: 'Chapter markdown content (or a directory listing / linked file).' },
    { method: 'GET', path: '/api/course-toc/{courseId}', scope: 'read', summary: 'Heading outline of every chapter.' },
    { method: 'GET', path: '/api/materials?courseId=', scope: 'read', summary: 'Files in a course knowledge base.' },
    { method: 'GET', path: '/api/material/{courseId}/{sourcePath}', scope: 'read', summary: 'Raw material bytes.' },
    { method: 'POST', path: '/api/retrieve', scope: 'read', body: '{ courseId, query, limit? }', summary: 'Full-text retrieval over course material (hosted only).' },
    { method: 'GET', path: '/api/questions/{courseId}/{chapterId}', scope: 'read', summary: 'Published questions for a chapter plus the caller’s personal extra exercises.' },
    { method: 'GET', path: '/api/practice', scope: 'read', summary: 'Every published question across active courses (large).' },
    { method: 'GET', path: '/api/flashcards/{courseId}', scope: 'read', summary: 'Flashcards by chapter with spaced-repetition state.' },
    { method: 'GET', path: '/api/sr/due', scope: 'read', summary: 'Question-level spaced-repetition cards that are due.' },
    { method: 'GET', path: '/api/mistakes?open=true', scope: 'read', summary: 'Mistake bank (open or all).' },
    { method: 'GET', path: '/api/mocks', scope: 'read', summary: 'Mock session summaries.' },
    { method: 'GET', path: '/api/mocks/{sessionId}', scope: 'read', summary: 'One mock session with every answer.' },
    { method: 'GET', path: '/api/academics', scope: 'read', summary: 'Active academic programme: courses, attempts, events, gates, summary.' },
    { method: 'GET', path: '/api/editorial-programmes', scope: 'read', summary: 'Known bachelor programmes (the catalogue).' },
    { method: 'GET', path: '/api/activity?days=28', scope: 'read', summary: 'Study activity series, streak, and recent events.' },
    { method: 'GET', path: '/api/account/summary', scope: 'read', summary: 'What is stored for the account, per record family.' },
    { method: 'GET', path: '/api/ai/usage', scope: 'read', summary: 'AI allowance and recent requests.' },

    { method: 'POST', path: '/api/grade', scope: 'write', body: '{ courseCode, chapterName, question, attempt, _meta: { courseId, chapterId } }', summary: 'Grade an answer (uses AI allowance); records activity and mistakes.' },
    { method: 'PATCH', path: '/api/items/{itemId}', scope: 'write', body: '{ mastery: 0-4, note? }', summary: 'Set mastery on a study item.' },
    { method: 'POST', path: '/api/sr/review', scope: 'write', body: '{ questionId, quality: 0-5 }', summary: 'Review a question-level flashcard (SM-2).' },
    { method: 'POST', path: '/api/sr/add', scope: 'write', body: '{ questionId }', summary: 'Add a question to the spaced-repetition deck.' },
    { method: 'POST', path: '/api/flashcards/{courseId}/{chapterId}', scope: 'write', body: '{ front, back }', summary: 'Create a personal flashcard.' },
    { method: 'POST', path: '/api/flashcards/{courseId}/{chapterId}/{cardId}/review', scope: 'write', body: '{ quality: 0-5 }', summary: 'Review a flashcard.' },
    { method: 'PUT', path: '/api/flashcards/{courseId}/{chapterId}/{cardId}', scope: 'write', body: '{ front?, back? }', summary: 'Edit a flashcard.' },
    { method: 'DELETE', path: '/api/flashcards/{courseId}/{chapterId}/{cardId}', scope: 'write', summary: 'Delete a flashcard.' },
    { method: 'POST', path: '/api/mistakes/{id}/resolve', scope: 'write', summary: 'Mark a mistake resolved.' },
    { method: 'DELETE', path: '/api/mistakes/{id}', scope: 'write', summary: 'Delete a mistake.' },
    { method: 'POST', path: '/api/mocks', scope: 'write', body: 'session object', summary: 'Store a completed mock session.' },
    { method: 'POST', path: '/api/activity', scope: 'write', body: '{ type: "read", courseId, chapterId, label? }', summary: 'Record that a chapter was read.' },
    { method: 'PUT', path: '/api/academics', scope: 'write', body: '{ workspace, expectedRevision }', summary: 'Save the active academic programme (optimistic concurrency).' },
    { method: 'POST', path: '/api/academics/programmes', scope: 'write', body: '{ programme, university?, academicYear? }', summary: 'Create a programme workspace.' },
    { method: 'PATCH', path: '/api/courses/{courseId}', scope: 'write', body: '{ archived?, order? }', summary: 'Archive or reorder a course for the caller.' },

    { method: 'GET', path: '/api/admin/status', scope: 'admin', summary: 'Active release id and content counts.' },
    { method: 'PUT', path: '/api/admin/courses/{courseId}', scope: 'admin', body: '{ code, name, shortName?, exam?, role?, accent?, knowledgeBase?, visualStyle?, examProfile?, position?, extra? }', summary: 'Create or update a course.' },
    { method: 'DELETE', path: '/api/admin/courses/{courseId}', scope: 'admin', summary: 'Delete a course and everything under it.' },
    { method: 'PUT', path: '/api/admin/courses/{courseId}/chapters/{chapterId}', scope: 'admin', body: '{ name, sourcePath, position?, extra? }', summary: 'Create or update a chapter (sourcePath is the markdown file in the knowledge base).' },
    { method: 'DELETE', path: '/api/admin/courses/{courseId}/chapters/{chapterId}', scope: 'admin', summary: 'Delete a chapter and its questions.' },
    { method: 'GET', path: '/api/admin/courses/{courseId}/materials', scope: 'admin', summary: 'List materials with sizes and hashes.' },
    { method: 'PUT', path: '/api/admin/courses/{courseId}/materials?path={sourcePath}', scope: 'admin', body: '{ content } for text or { base64 } for binary, mediaType?', summary: 'Create or replace a file; text is re-indexed for retrieval.' },
    { method: 'DELETE', path: '/api/admin/courses/{courseId}/materials?path={sourcePath}', scope: 'admin', summary: 'Delete a file.' },
    { method: 'PUT', path: '/api/admin/courses/{courseId}/items/{itemId}', scope: 'admin', body: '{ title, type?, category?, chapterId?, …, position? }', summary: 'Create or update a mastery item.' },
    { method: 'DELETE', path: '/api/admin/courses/{courseId}/items/{itemId}', scope: 'admin', summary: 'Delete a mastery item.' },
    { method: 'PUT', path: '/api/admin/courses/{courseId}/papers/{mock-exam|tutorial}/{paperId}', scope: 'admin', body: '{ label, questionPath?, solutionsPath?, position?, extra? }', summary: 'Register an exam or tutorial paper.' },
    { method: 'DELETE', path: '/api/admin/courses/{courseId}/papers/{type}/{paperId}', scope: 'admin', summary: 'Remove a paper.' },
    { method: 'GET', path: '/api/admin/courses/{courseId}/chapters/{chapterId}/questions', scope: 'admin', summary: 'Published question bank (editorial only, no personal extras).' },
    { method: 'PUT', path: '/api/admin/courses/{courseId}/chapters/{chapterId}/questions', scope: 'admin', body: '{ questions: [ { id, type, question, expected?, options?, … } ] }', summary: 'Replace the whole bank.' },
    { method: 'PUT', path: '/api/admin/courses/{courseId}/chapters/{chapterId}/questions/{questionId}', scope: 'admin', body: 'question object', summary: 'Create or update one question.' },
    { method: 'DELETE', path: '/api/admin/courses/{courseId}/chapters/{chapterId}/questions/{questionId}', scope: 'admin', summary: 'Delete one question.' },
    { method: 'GET', path: '/api/admin/programmes', scope: 'admin', summary: 'Programme catalogue as stored.' },
    { method: 'PUT', path: '/api/admin/programmes/{programmeId}', scope: 'admin', body: 'programme definition (institution, name, degree, versions[…])', summary: 'Create or update a known programme.' },
    { method: 'DELETE', path: '/api/admin/programmes/{programmeId}', scope: 'admin', summary: 'Remove a known programme.' }
  ],
  questionShape: {
    id: 'stable string id',
    type: 'written | calc | tf | mc | pseudocode | code | best-option',
    question: 'markdown; $…$ for math',
    expected: 'model answer (written/calc/pseudocode/code)',
    options: ['for mc / best-option'],
    answer: 'index or value for mc / tf',
    difficulty: 'easy | medium | hard (optional)',
    source: 'provenance label shown to students (optional)'
  }
})
