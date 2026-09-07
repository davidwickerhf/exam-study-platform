---
version: 1
slug: "components-workspace-study-paper-bank-tsx"
primary_target: "components/workspace/study-paper-bank.tsx"
related_targets: ["components/workspace/paper-library.css", "lib/workspace/paper-library.mjs"]
---

# Mock paper library

Operate. Replace the rejected administration-heavy paper list inside the existing course workspace. Preserve Wicker Archivo typography, neutral surfaces, blue actions, original PDF viewer, privacy, stored sets and spending limits.

Reference lock: the previously researched Memorisely style (69d7433e-f1f8-4366-9d4a-a267b85d154c) owns restrained working surfaces/type; Quizlet's task-specific study actions remain secondary. Refero Copy.ai Infobase screen 88804348-97f7-4b89-8074-35e53ac888bb was retrieved and visually inspected for compact list rows with selected-document details and error recovery outside the browsing plane. Do not import its purple palette, permanent third column or marketing controls.

User screenshot is the anti-reference: oversized processing notice, repeated retry/range/options controls and no paper-type structure. First viewport should expose at least four documents at desktop width when there are six. Group exam papers before exercise sheets and optional solutions. Each row shows title, year, one honest readiness line, original viewer, ready practice action and details. No invented paper thumbnails or fake counts.

Paper details owns saved sections, processing reason/retry, page selection and syllabus checking; task forms retain their protected focus. A compact preparation-status action opens all job states. Ready checked questions remain available when another extraction pauses. Manual page subsets are labelled as sections, not whole papers. Search/year filters have explicit reset. Mobile rows wrap actions below the title, and sheets remain scrollable with close reachable.

Motion uses the existing Sheet transitions; no animation or new visual identity is introduced. Original viewing and opening details never launch paid retries.

## Implemented surface

The library uses compact, flat ruled groups in this order: Exam papers, Exercise sheets and Solution files. Solutions are hidden until the toolbar toggle is selected. Within a group, papers sort by descending academic year and then title. Search matches title/year, Paper year filters independently of the course section year, and filtered-empty recovery clears both filters and hides solutions again. Loading, library load failure with Reload library, unfiltered empty and filtered empty have separate states.

Rows use an 84px minimum height with 14px medium-weight titles, 12px year/readiness metadata and quiet file icons. Group labels are 13px with actual visible counts, separated by 24px. The row offers View paper (or View solutions), checked practice when available, and a labelled details action. Missing source access says Original unavailable. Solution rows omit question readiness. Below 768px, actions wrap under the title with the details action at the far edge; search occupies a full toolbar row. Existing tokens, buttons and Sheet primitives supply colour, focus and motion.

Paper selection prefers an explicit saved-set choice, then the completed job's checked set, then another completed set with questions. A newer unfinished or paused job therefore does not suppress an older checked set by default. Readiness says selected pages and the row action says Practise section unless that ready set is the completed whole-paper job. Paper details exposes the saved-set selector and recorded source-page range; an explicitly chosen unfinished set exposes Resume questions.

Paper details owns preparation controls, operation errors, automatic progress, the expandable Why it paused reason, Retry processing and syllabus-fit entry. Preparation status is a compact header action whose count reflects paused jobs first, otherwise active jobs; its sheet lists non-solution papers and opens the selected paper's details. Checked questions and available originals remain usable when another preparation step pauses.

Choose pages to prepare / Prepare another section and Syllabus fit temporarily replace details with a focused form. Back to paper, Escape and sheet dismissal return to the same paper when idle. On an accepted manual preparation request, the form closes and details displays Preparing questions while extraction/review continues; later failures remain in details. A failure before request acceptance remains in the page form. Resume uses Resuming questions in the detail status and Resuming on its button. Syllabus checking keeps its pending state, errors and evidence in the fit form. Busy requests protect form dismissal; sheet bodies scroll independently.

This records the built composition and state ownership, not a fresh live-AI validation result. The global design system, original PDF viewer and reference lock above are unchanged.
