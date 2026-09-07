---
version: 1
slug: "app-app-courses-courseid-page-tsx"
primary_target: "app/app/courses/[courseId]/page.tsx"
related_targets: ["components/workspace/course-study-versions.tsx","components/workspace/course-material-library.tsx","components/workspace/study-paper-bank.tsx","components/workspace/course-exercises.tsx"]
---

# Course workspace — replacement surface

Mode: Operate. Scope: /app/courses/[courseId] and its seven course sections. Preserve all source permissions, AI budgets, saved answers and the approved PDF viewer.

User rejects the previous card-wrapped tab page as bare, inconsistent and confusing. This is a replacement composition, not another card-spacing pass. Existing app navigation, Archivo typography and signal-blue identity are product constraints.

Research: Refero Memorisely style 69d7433e-f1f8-4366-9d4a-a267b85d154c is the main surface reference: light working plane, sharp hierarchy, compact typography, understated boundaries. Quizlet d6523b05-a53f-4a2a-8829-d65a5c3724e9 contributes task-specific study actions only; its decorative palette and card grid are rejected. Google Education bf4966c6-7f2f-47a2-ac10-8a496c044d5e contributes restrained navigation/action colour roles, not marketing typography.

Product patterns: Preply ab8107cf-e14e-4a90-85fa-3ee0b3d8fb72 supplies compact local course navigation and material-first main content. Brilliant 5bbe2617-09d9-4067-8881-17aee754bd8f supplies a visible chapter sequence with direct entry; gamified locks and invented completion are rejected. Both actual reference screenshots inspected.

First viewport: a short course identity header, then a 180–200px course navigation column and a white main working plane. Study guides shows the chosen guide, private/year context, Open guide, and sequential chapter rows. No redundant result/reading/missing-exam metric strip. No giant card around each section. Navigation groups study work before academic administration.

Signature interaction: choose a guide once, then open a chapter directly. Move to exercises without recreating question controls; switching course sections preserves unfinished answers. Materials begins with the file library; a Manage collection drawer holds sync/year collection tasks. Paper rows preserve original viewing and practice, with repeated processing failures grouped above the library.

Responsive: local navigation becomes a horizontal accessible tab list below 1024px, with keyboard orientation matching the visual layout and the active tab scrolled into view. Year control is explicit on Study guides, Materials and Results; Exercises and Mock papers name their all-years scope. Main content uses one page scroll; no inner chapter scroll. The source viewer remains unchanged.

Decision ledger: local navigation <- Preply; chapter sequence <- Brilliant; flat white content plane + compact hierarchy <- Memorisely; consistent semantic blue and Archivo <- Wicker product constraints; background paper status with explicit retry <- existing queue behaviour; private/editorial distinction <- user requirement.

Seven structures considered: action-first overview, chapter-first outline, task tabs, split study reader, course workspace, module browser, resource library. Impeccable surface seed 224c7f78 dealt workspace, library, outline. Those alternatives were offered via async preference input; no reply at implementation time. Continuing with the recommended workspace under the user's explicit redesign instruction. No user-approved bitmap comp; code-led build.

Implemented contract: guide choice is remembered per course; no guide for a selected year offers Show all years; load failures expose recovery rather than empty content; course/year changes reset material filters. Guide creation and Canvas collection use separate sheets. The original PDF viewer and exercise answer continuity remain intact.

Validation: `npm run verify` passed 810 tests, TypeScript and production build. Three focused browser scenarios passed; the subsequent course scenario passed recovery, keyboard tabs, sheets, Back, mobile first-tab visibility and answer preservation. Reviewer disposition: ship at the reviewed UI scope, with all five findings resolved (orientation, load recovery, stale filters, year scope and filtered empty). A separate mobile bottom-action check confirmed the source action remains clickable above the bottom navigation. Paper-library load retry was code-reviewed only. No new live AI-quality tests were run. See `docs/design/course-detail.md` for retained backend/viewer constraints and validation limits.
