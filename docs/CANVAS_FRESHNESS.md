# Canvas material change checks

Active course editions follow the existing calendar-aware Canvas discovery runner. A new edition is collected once under the student's collection consent. Subsequent scheduled jobs check metadata at the configured update interval (30 minutes by default); they do not download documents, extract questions, run embeddings or call an AI model. They flag changes for the student to collect from the course page. Paused collection, disabled automatic refresh, completed programmes and inactive editions are respected. Manual checks have a five-minute cooldown, and the existing queue uniqueness and worker lease prevent overlapping jobs for the same student/course binding.

The course notice persists across its tabs and is scoped to the selected academic year. It shows new, changed and no-longer-listed items, partial coverage, and checking/scraping states. “Update materials” uses the existing importer with `force:false`, preserving unchanged originals and indexes. A successful full scrape advances the baseline; simply checking or queuing a refresh does not acknowledge changes. No automatic deletion takes place.

## Evidence and limits

Each comparison replays the requesting student's latest completed full-import API checkpoints as its baseline. Another contributor's binding timestamp, a failed import or a priority-only scan cannot acknowledge that student's changes. Baselines are not established from a fresh live check, which could silently absorb changes that were never scraped. Older imports without checkpoints need one full refresh to establish comparison coverage.

The bounded collector uses Canvas's paginated JSON listings for files, assignments, announcements, discussions, pages, quizzes and modules, plus the rich-text syllabus. It compares selected content fields, dates, IDs and hashes. Module item lists are fetched only if inline items are incomplete. Files linked from assignments, announcements, the syllabus or modules but missing from the Files listing receive individual metadata reads. File bytes and external links are never fetched. Refreshed signed download URLs and discussion reply counters do not count as material edits. Full listing comparison catches edits to older announcements; a recent-publication date filter would miss them.

Limits per course check: 48 HTTP requests, 8 MiB JSON, 75 seconds total and 12 seconds per request. Oversized, restricted or failed categories report incomplete coverage and retain previously observed changes; they never imply “current” or deletion. The limit is intentionally conservative and may leave very large courses partially checked. This is metadata detection, not byte verification: changes that Canvas does not expose through these metadata fields, external websites, and individual quiz-question changes without overview metadata changes are outside the check. Attachment links buried in page bodies are collected during full scraping, but this lightweight pass uses page update metadata rather than fetching every page body.

Private summaries (titles, changed categories, checked time and source baseline ID) are stored under `user_documents/canvas-freshness`, isolated by user and Canvas binding. No token or full source body is added to that summary. Existing checkpoint retention and account deletion rules apply.

API: `GET /api/integrations/canvas/freshness?courseCode=BCS2120&academicYear=2026-2027` reads saved status. `POST` with `{bindingId}` requests a metadata check through the existing worker. Neither accepts arbitrary Canvas resource URLs.

Official Canvas reference: [Files](https://canvas.instructure.com/doc/api/files.html), [Modules](https://canvas.instructure.com/doc/api/modules.html), [Discussion topics](https://canvas.instructure.com/doc/api/discussion_topics.html). These endpoints return paginated metadata; no universal course-material `updated_since` endpoint is assumed.

## Verification

Unit fixtures cover metadata revisions, attachment replacement, old-announcement edits, pagination, missing inline module items, checkpoint replay, missing baselines, restricted endpoints, bounded requests/bytes, and preservation/acknowledgement semantics. Browser fixtures cover a course notice across tabs, manual checking, a non-forced material refresh, pending states, mobile fit and completed refresh presentation. Hosted scheduling and real external changes require deployed-worker acceptance; synthetic fixtures do not prove institution-specific Canvas coverage.
