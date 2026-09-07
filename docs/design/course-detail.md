# Course workspace

`/app/courses/[courseId]` is a course workspace with seven sections: Study guides, Exercises, Mock papers, Materials, Attendance, Results and Details. This composition supersedes the former card-wrapped tabs, overview metrics and header study toolbar. The global navigation, Archivo typography, neutral canvas, navy ink and signal-blue actions remain Wicker's established system.

## Composition and navigation

A compact identity header holds the course title, code, available placement/credit facts and next exam date. Feedback and Course options sit beside the back navigation; archive remains in Course options. Below it, a quiet local navigation rail borders one flat white working plane. Study destinations precede academic administration. Section headings, filters and ruled content sit directly on that plane; repeated rows do not acquire enclosing cards.

The desktop rail is 180px, widening to 200px at 1440px. The working plane uses 32px padding, with 48px horizontal padding at 1440px. Course titles scale from 24px to 32px, section titles are 24px, and chapter titles use compact 14px text. At widths below 1024px, navigation becomes a horizontally scrollable tab row with horizontal keyboard semantics and a two-pixel selected rule. The active tab scrolls into view. Desktop tabs use vertical keyboard semantics. At 540px and below, content gutters are 16px and follow-on study actions stack. Main content follows the page scroll; chapters have no inner scroll area.

Tab selection is written to `?tab=`, year selection to `?year=`. Browser Back restores the section and year context, and legacy hash entry remains supported. The exercise session stays mounted after first entry so moving between sections preserves unfinished answers.

## Guides, materials and academic years

Study guides leads with the chosen private guide, its recorded year and chapter count or generation status. When multiple matching guides exist, a labelled selector remembers the chosen guide per course. Open guide is the primary study action; numbered chapter rows link directly into that chapter. Create study guide opens a source/scope sheet with cancellation. Drafts link to generation progress. Shared student guides are separately labelled as not editorially reviewed; maintained editorial chapters remain a distinct register.

The Academic year selector appears for Study guides, Materials and Results, with All years and undated records represented explicitly. It filters private guides, original materials and attempt history. Editorial chapters and course information state that they have no recorded edition; community guide rows retain their own year labels. Exercises and Mock papers explicitly span all course years, and Mock papers has its own Paper year filter. Attendance follows its calendar context rather than suggesting the course-year filter applies.

Materials starts with the original file library, search and relevant kind/module filters. Manage collection opens a separate sheet for Canvas synchronization and editions. Changing course or academic year clears stale material filters and the open preview. An empty selected guide year offers Show all years; it does not imply that no guide exists. Loading, load failure with retry, unfiltered empty and filtered empty remain distinct. The paper library exposes Reload library on failure; paused processing errors are grouped above the rows while originals remain available.

Results shows every sitting within the chosen scope and offers Show all years. Reconciled curriculum identities preserve original attempt codes, names, grades, credits and dates; a later pass does not erase an earlier failure. Missing facts stay missing. The page does not edit grades or attempt records. Academic-only and Canvas-only courses use the same workspace when no editorial chapters exist. Wide history tables retain their own horizontal overflow on small screens.

Collection status combines every accessible Canvas shell in each year, preserves partial/failed jobs, and allows missing years to be queued individually or together. Collection controls remain separate from study actions.

## Course practice and document workspace

Exercises reuse the existing Practice question/filter/answer/session components and aggregate current checked chapter questions, saved personal edits labelled as such, and completed generated sets across the student's course versions and retakes. Identical questions are deduplicated; immutable version/revision/set/question references still determine assessment and attribution. The same questions are available in global Practice. The course scope is fixed, chapters and types are filters, and switching course tabs preserves the current exercise answer. Prior generations are not rewritten or automatically regenerated.

Mock papers load without requiring a generated guide. Paper preparation uses a private owner/programme/course practice workspace and never starts chapter generation. Existing prepared papers retain their source snapshots and remain reusable across course years. Year selection provides the current syllabus context, while the paper library independently browses all accessible years. Original source and generated teaching material keep different labels.

A source or tutor opens in a desktop companion pane without an overlay. Opening an original paper directly from its library starts in document focus mode; sources opened during answering retain the split view. Focus document temporarily expands reading; returning restores the question position and answer. Mobile switches between Your work and Document/Tutor without unmounting either. PDF.js provides continuous lazily rasterized pages, selectable text, optional thumbnails, page search, explicit page jumps, fit width/page, zoom, download and fullscreen where appropriate. Searching and rendering incur no AI cost. The original file is downloaded before display; this is lazy rendering, not HTTP range streaming. Graphical-only text search requires text/OCR already present in the PDF.

The shared viewer is `pdf-viewer.tsx`. Course materials, original question sources, mock papers, rendered presentations, uploads, transcripts and saved Academic Work use this implementation. Import text-extraction engines remain separate from the viewer. This course composition preserves the approved viewer.

## Paper preparation and source provenance

Canvas ingestion writes a private durable paper job alongside the indexed source. Existing unchanged files are picked up on the next sync; opening the library also backfills earlier imports through an idempotent POST. The existing signed queue dispatches `pap-` jobs on study capacity, respecting preview-account isolation. Each invocation performs one leased extraction/review step. Page-bounded sections overlap to preserve boundary context; exact duplicate questions are combined into one paper set and conflicting answers/marks block combination. Missing original solutions remain missing. A whole paper uses one billing identity across sections, saved account preferences, and existing allowance/BYOK enforcement. Provider or evidence failures pause until an explicit retry; simply reopening a tab does not repeatedly spend on failed jobs. Partial sections remain accessible and checked originals remain readable.

Canvas files retain every recorded module/assignment placement. The importer follows assignment-description links and structured assignment attachments through Canvas's course file API, deduplicating original downloads. Module names/order and assignment titles survive in snapshot metadata. Materials use module grouping/filtering and show assignment context; previous imports can recover module names from their source paths before resync. Graphical-only questions still require viewing the original; this does not claim OCR or graphical grading.

## Reference decisions

Refero Memorisely (`69d7433e-f1f8-4366-9d4a-a267b85d154c`) informs the light working plane, compact hierarchy and understated boundaries. Preply (`ab8107cf-e14e-4a90-85fa-3ee0b3d8fb72`) informs compact course navigation and material-first content; Brilliant (`5bbe2617-09d9-4067-8881-17aee754bd8f`) informs direct chapter entry. Quizlet (`d6523b05-a53f-4a2a-8829-d65a5c3724e9`) contributes task-specific study actions, and Google Education (`bf4966c6-7f2f-47a2-ac10-8a496c044d5e`) reinforces restrained action colour roles. Wicker owns typography, colours and components. Decorative palettes, gamified locks and invented completion are not part of this course surface.

The document workspace reference remains Dropbox (`6a0c6fdc-8cc8-4892-990a-59f5dd0251b2`) and Missive (`29eeffa2-325a-4ddb-9b06-a5363fd152f4`) for compact PDF tools, Matter (`06b1c966-a5c2-4e4d-b6da-4da24d66cf87`) for simultaneous work/source panes, and Duolingo (`984ad31c-12ac-437e-95ce-647dc62e9c7a`) for focused answering. No external imagery or brand styling ships.

## Validation and boundaries

The current implementation passed `npm run verify`: 810 unit/integration tests, TypeScript and production build. Three focused browser scenarios passed, followed by the course scenario covering load recovery, keyboard tabs, sheets, browser Back, mobile first-tab visibility and answer preservation. The reviewed UI scope received a ship disposition after orientation, load recovery, stale filters, year scope and filtered-empty corrections. A separate mobile bottom-action check confirmed the source action remains clickable above the bottom navigation. Paper-library load retry was code-reviewed but not independently exercised in the browser.

No new live AI-quality evaluation was run for this composition. Earlier live extraction/grading/fit checks encountered provider 429 responses; deterministic checks do not establish fresh model quality. Generated questions are not part of the legacy timed Mock/SM-2 subsystem; course papers and existing generated exam sessions retain their supported workflows.
