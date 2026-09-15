# Study guide reader redesign

## Brief and build target
Redesign the web study reader for students moving between explanation, recall and practice. Direct build within Wicker's existing design system: preserve its semantic colors, sans-serif typography, controls and source-evidence interactions.

## Reference lock and decisions
| Decision | Reference | Adaptation and role |
| --- | --- | --- |
| Content-first white reading plane, quiet dividers, generous lesson spacing | GitBook style, Refero 90535b72-e635-4acb-a78f-7c5fc6c95c6c | Primary layout foundation; retain Wicker tokens rather than importing decorative orange or marketing imagery. |
| Strong title and restrained supporting metadata | Goodnotes style, Refero 20a06982-45ea-4df0-ae36-7cb6de2b6a4b | Borrow typography hierarchy only; no cyan marketing CTA. |
| Visible learning sequence and next lesson | Slab University screen, Refero d933ce70-4014-49c0-be91-830a1f03ad28 | Chapter rail and previous/next navigation; no video player because these lessons are text and interactive exercises. |
| Reading progress and ordered chapters | Udemy style, Refero 64bb1262-e0d5-4ca7-b5fc-9d560bd8a552; existing read records | Show actual read count, never inferred mastery. |
| Responsive chapter picker | Existing StudyDesk split-pane constraint | Container-based breakpoint so tutor/reference panels do not crush the lesson. |

Use code-native controls and existing lesson visuals. Reject marketing heroes, added imagery, new palettes, oversized cards, and competing metadata badges. Preserve questions, notes, editing, sources, sharing, revision history and generation controls.

## Expanded study workspace brief
The user's September 15 screenshots explicitly expand this work to the course guide library, materials editions, document split view, mock papers, and both practice entry points. Retain brand tokens; replace the management-first composition with study tasks. Existing content and processing capabilities remain available through secondary controls.

Additional Refero evidence:
- Quizlet collection screen: https://refero.design/pages/3b77ba6c-5989-43d7-97ff-d8235df2299f — visible collections and direct return paths.
- Duolingo lesson entry: https://refero.design/pages/3c296562-ccac-474b-aca4-8e5e0c167d20 — bounded lessons with explicit position; borrow the sequence, not gamification or styling.
- Preply practice flow: https://refero.design/flows/9219 — explain the practice outcome and show progress in context; do not import its mastery formula.

Impeccable Operate/Read guidance owns the implementation audit: familiar labelled controls, prose measure, container-responsive layout, retained working state, clear empty/error recovery. Refero owns reference selection. The user supplied the desired structure directly; this is a code-led extension of the established Wicker system, with no new brand or bitmap assets.

### Flow decisions
- Library: display every matching guide, its read count, and its next unread chapter. Search titles and chapter names. Reading progress is a stored user action, not a mastery score.
- Reader: lesson content leads. Guide maintenance is secondary. Tutor opens beside the reader and retains the chapter context.
- Materials: course editions are visible beside the list. Selecting a document opens beside the list; Expand and Back to split view are labelled.
- Papers: ready sections and page ranges are visible in the library. Preparation remains available in paper details.
- Practice: show the full question bank first, grouped by original paper or generated guide/chapter, following the freely navigable numbered grid in `origin/legacy:public/app.js` (renderMockProgressTracker and renderPracticeProgress). Selecting any question opens a focused answer view with tutor, previous/next, and a return to the overview. Retain drafts and feedback across navigation, hydrate saved assessments, and offer shorter batches only as optional setup. Keep history collapsed. The user explicitly asked for overview without overwhelming the focused study task.

## Validation
- Based on main `b5e6c42` (guide-generation maintenance preserved).
- `npm run verify`: 1,107 tests passed, zero failed/skipped; TypeScript and production build passed.
- Seven targeted browser flows passed: reader navigation, guide library, practice overview, course exercises, original-paper practice and split viewer, paused paper sections, material-to-tutor context. Reader/tutor and material-year capture assertions also passed after final refinements.
- Browser evidence uses deterministic course fixtures and mocked tutor availability; no paid model calls or fresh Canvas collection were run. Saved answer hydration and original-paper inclusion have storage-backed unit coverage.
- Impeccable detector: five advisory type/radius findings, mechanically aligned with the existing scale. No second scan.
- Screenshot artifacts are under `.impeccable/review/study-redesign/` locally; no fabricated mastery or completion data in the product.

## Direction contract — existing-world, code-led extension
### Audience and job
Students study a course, move freely between its chapters and real exam questions, and ask the contextual tutor for help. The initial screen must expose actual content or an actionable library with little setup.
### World and first viewport
Preserve the established Wicker academic workspace: Archivo type, navy ink, indigo actions, quiet white surfaces. No replacement visual world, concept selection or FORM seed was run; this is an explicit existing-world/code-led extension of the user-prescribed structure. No historical seed or approved comp is claimed.
### Visitor path and signature interaction
Visible guide library → chapter reader → focused exercise or adjacent tutor. Question overview → any chosen question → retained answer → return to the full overview. Materials editions and paper sections remain visible.
### System and cross-surface reach
Container-responsive chapters and diagrams fit the tutor split. Secondary Guide options contain history, sources and exam creation; Chapter options contain improvement and review. Course headers and exercise controls compact on phones. Actual stored reading/assessment state owns progress.
### Quality bar and honest risk
Content is readable in the initial mobile reader viewport; mobile materials expose a document row; focused questions show the prompt and start of the answer control together. No overflow at390px. The full bank is intentionally dense because the user requested free navigation. Large real question banks and authenticated hosted AI/Canvas services remain subject to live product use; fixture verification does not assert model quality.
