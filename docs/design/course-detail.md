# Course detail and attempt history

The existing Wicker dashboard and course register, plus DESIGN.md, are the primary design target. Keep the Archivo/Archivo Narrow roles, neutral canvas, white registers, navy overview panel, thin rules, 12px section corners and blue actions. This is an extension of the product language, not a new visual direction.

Refero research: Raise/Open Collective (`f72e18d0-98f4-4e88-9754-5426589564ea`) reinforces the contained two-column structure, navy text and lightweight borders. Zed (`0550f6a7-e6b1-4fdc-8148-aa437474e082`) contributes compact action hierarchy and restrained accent use only. Their fonts, marketing imagery and other brand tokens are not imported. Course-screen research favored separating content from record management; the existing Wicker tab system is the concrete implementation reference.

The default Study guides view shows personal/community guides and available editorial chapters in one column. Results have their own tab; sync and edition collection live under Materials. An empty editorial store no longer produces a misleading empty-course panel. A full history tab exposes all sittings without implying a failed attempt was erased by a later pass. Material, attendance and course details get their own tabs. Academic-only and Canvas-only courses use the same page even when no chapters exist. Empty, unavailable and loading states remain distinct.

History uses reconciled curriculum identities while preserving original attempt codes, names, grades, credits and dates. Missing facts are displayed as missing, not inferred from today's catalogue. No grades or attempt records are edited by this page. On narrow screens the columns stack, the tab rail scrolls, and the full history table scrolls within its own section.

## Edition selection and collection

Keep the existing course-page reference lock. Add a labelled academic-year selector at course-header level; use the same selection for attempt summaries and original material, with an explicit All years option. The chapter guide and course information remain clearly labelled as shared because the editorial store does not version them by academic year.

The user's request owns the interaction: all accessible Canvas years are discoverable, with collection actions on the course page. Refero Acuity import preview/success screens (`2c65d68c-ca8c-44fa-bcb7-b3e68354884a`, `04c3eda8-9e4d-4854-9e00-3518dd08d9b3`) inform explicit action/status separation and visible success/error feedback. Wicker's quiet ruled registers remain the primary visual target. Collection status is per year, combining every accessible shell in that year; failed/partial jobs remain visible, and missing years can be queued individually or together. No new imagery or color roles.


## Header hierarchy

The user's September 5 header screenshot is the audit target. Course identity leads on its own row: small code, dominant title, quiet placement metadata. A thin divider separates the edition context from the title; the compact labelled selector sits left and study actions sit right. Start/Continue reading is the sole filled primary action, Past papers is secondary, and Archive moves into Course options beside the back navigation. This applies the existing Wicker design lock and keeps course management out of the study-action group. On narrow screens the toolbar wraps into two readable rows.


## Course practice and document workspace — September 7

The course owns Study guides, Exercises, Mock papers, Materials, Attendance, Results and Details. Exercises reuse the existing Practice question/filter/answer/session components and aggregate current checked chapter questions, saved personal edits labelled as such, and completed generated sets across the student's course versions and retakes. Identical questions are deduplicated; immutable version/revision/set/question references still determine assessment and attribution. The same questions are available in global Practice. The course scope is fixed, chapters and types are filters, and switching course tabs preserves the current exercise answer. Prior generations are not rewritten or automatically regenerated.

Mock papers load without requiring a generated guide. Only explicit preparation creates a small owner/programme/course practice workspace; it never starts chapter generation. Existing prepared papers retain their source snapshots and remain reusable across course years. Year selection provides the current syllabus context, while the paper library independently browses all accessible years. Original source and generated teaching material keep different labels.

Document-first reference: Dropbox (`6a0c6fdc-8cc8-4892-990a-59f5dd0251b2`) and Missive (`29eeffa2-325a-4ddb-9b06-a5363fd152f4`) inform compact PDF tools and an optional thumbnail rail. Matter (`06b1c966-a5c2-4e4d-b6da-4da24d66cf87`) informs simultaneous work and source panes; Duolingo (`984ad31c-12ac-437e-95ce-647dc62e9c7a`) reinforces a focused answer area and nearby navigation. Existing Wicker tokens remain authoritative; no external imagery or brand styling is shipped.

A source or tutor opens in a desktop companion pane without an overlay. Opening an original paper directly from its library starts in document focus mode; sources opened during answering retain the split view. Focus document temporarily expands reading; returning restores the question position and answer. Mobile switches between Your work and Document/Tutor without unmounting either. PDF.js provides continuous lazily rasterized pages, selectable text, optional thumbnails, page search, explicit page jumps, fit width/page, zoom, download and fullscreen where appropriate. Searching and rendering incur no AI cost. The original file is downloaded before display; this is lazy rendering, not HTTP range streaming. Graphical-only text search requires text/OCR already present in the PDF.

Validation: 805 unit/integration tests, TypeScript and production build; five focused Chromium scenarios cover source graphics, transcript panels, chapter proposals, original papers/free grading/tutor, and the course exercise bank. Desktop/mobile screenshots inspected. Live provider extraction/grading/fit evaluations remain blocked by the previously observed provider 429; deterministic evaluations do not establish fresh model quality. Generated questions are not yet part of the legacy timed Mock/SM-2 subsystem; course papers and existing generated exam sessions remain available through their supported workflows.

## Automatic paper preparation and consistent course tabs

The September 7 follow-up keeps the approved PDF viewer unchanged and names it `pdf-viewer.tsx` as a shared component. Course materials, original question sources, mock papers, rendered presentations, uploads, transcripts and saved Academic Work all use this implementation. Text extraction engines used for importing are separate from the viewer.

Reference lock: Wicker's existing Archivo typography, navy text, white surfaces, blue actions and 12px boundaries remain primary. Refero Raise (`f72e18d0-98f4-4e88-9754-5426589564ea`) owns surface/action hierarchy; UI (`c14c0a94-1037-449e-bf5b-4cb972656ac7`) contributes compact controls, thin dividers and state labels only. No external font, marketing imagery or decorative cards are added.

| Decision | Evidence and purpose |
| --- | --- |
| Keep course overview height across tabs | User's inconsistency report; navigation should not jump vertically. |
| Guide rows expose chapter links | User's bare Study guides screenshot; make the existing content visible without an extra click. |
| Bordered sections, consistent title scale and quieter filter strips | Existing Materials/Attendance containers and the reference lock. |
| A paper shows processing progress alongside its original | User's automatic-extraction request; waiting is a background state, not a setup form. |
| Keep original year and Canvas placements | User's module/attachment request; retain provenance across retakes. |

Canvas ingestion writes a private durable paper job alongside the indexed source. Existing unchanged files are picked up on the next sync; opening the library also backfills earlier imports through an idempotent POST. The existing signed queue dispatches `pap-` jobs on study capacity, respecting preview-account isolation. Each invocation performs one leased extraction/review step. Page-bounded sections overlap to preserve boundary context; exact duplicate questions are combined into one paper set and conflicting answers/marks block combination. Missing original solutions remain missing. A whole paper uses one billing identity across sections, saved account preferences, and existing allowance/BYOK enforcement. Provider or evidence failures pause until an explicit retry; simply reopening a tab does not repeatedly spend on failed jobs. Partial sections remain accessible and checked originals remain readable.

Canvas files retain every recorded module/assignment placement. The importer follows assignment-description links and structured assignment attachments through Canvas's course file API, deduplicating original downloads. Module names/order and assignment titles survive in snapshot metadata. Materials use module grouping/filtering and show assignment context; previous imports can recover module names from their source paths before resync. Graphical-only questions still require viewing the original; this does not claim OCR or graphical grading.
