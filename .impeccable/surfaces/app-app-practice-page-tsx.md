---
version: 1
slug: "app-app-practice-page-tsx"
primary_target: "app/app/practice/page.tsx"
related_targets:
  [
    "app/app/practice/questions-tab.tsx",
    "app/app/practice/shared.tsx",
    "app/app/practice/mocks-tab.tsx",
    "app/app/practice/mistakes-tab.tsx",
    "lib/workspace/practice.mjs",
    "lib/workspace/practice.d.mts",
    "test/v2-practice.test.mjs",
  ]
---

# Practice surface brief

- Build path: comp-led for this surface. The project has no standing `buildPath`; the direction round carried the default `comp` value and the user selected Session Cockpit in-thread after reviewing the options.
- Approval record: Session Cockpit is the approved decision comp at `.impeccable/mocks/decision/practice-session-cockpit.png`. The 1280 × 800 reproduction checkpoint is `.impeccable/review/practice-hero-repro.png`. Finish reviewer disposition: **ship**, with no material fixes.
- Scope: the shared Practice destination and the question-native response instrument reused by Questions, Mistakes, and Mocks. Operate mode.
- Job: let a student configure a sitting once, answer one question without interface noise, understand the result, and move through the session without losing progress when switching between Practice tabs.
- Existing truth: Practice has Questions, Flashcards, Mistakes, and Mocks as local tabs. The bank currently contains 553 questions across five active courses. Question ids repeat across chapters, unknown types and absent difficulty stay honest, and generated placeholder choices must never be presented as answers.
- Refero grounding: the strongest study tools keep the product itself visually dominant, limit active color to the next action, and reduce setup controls after work begins. Wicker applies that calm focus through its own warm ruled-board language rather than copying a consumer-learning aesthetic.
- Chosen direction: Session Cockpit, with a stronger adaptive answer instrument. A compact setup strip states the active course, chapter, type, and result count. One centered working plane owns the source, prompt, answer control, feedback, and full-width session footer. There is no permanent contextual rail.
- Primary actions: configure the question bank, provide an answer in the question-native control, check it, add the item to flashcards, move through the queue, shuffle, or end the sitting.
- Proof: current course/chapter/source/type, current position and filtered total, selected answer or written attempt, grading response, flashcard state, and this sitting's recorded answers.

## Direction contract

- THESIS: Practice is a focused sitting, not a searchable catalogue with an answer field.
- OWN-WORLD: Warm board, one white ruled work plane, near-black ink, indigo only for action and selection, and compact Archivo Narrow instrumentation.
- STORY: Set the scope once, answer one question, check it, and advance without losing the sitting or leaving the page.
- FIRST VIEWPORT: A compact setup instrument sits below the local tabs. One broad question plane fills the remaining board, centers a 900px response column, and anchors session navigation to its full-width footer. The primary action belongs to the answer surface.
- FORM: Session Cockpit, ranked second in seed `ba84d8fd` and selected as the comp-led direction.
- FINISH: shipped direction approved with no material fixes; the reusable pattern is recorded in `DESIGN.md`, and the approved comp and review captures retain their provenance under `.impeccable/`.

## Quality bar

- Composition: the active question must read as the destination, not as a card floating in unused page space. At wide desktop the plane approaches the full 1180px destination measure and owns the remaining viewport height.
- Interaction: written, true/false, single-choice, and multiple-choice controls must each look native to their task while sharing one answer-surface grammar. Checking an answer remains deliberate.
- Restraint: no additional rail, progress decoration, nested cards, gradient, or decorative illustration. Depth comes from ruled ownership and state, not shadow.
- Responsive: mobile reduces setup to one summary row, preserves side-by-side true/false, keeps the primary action adjacent to the response, and reserves the 64px global bottom navigation.
- Provenance: the approved comp, generated alternatives, responsive captures, and reproduction checkpoint remain under `.impeccable/`; all shipping rasters retain embedded prompts.

## Answer instruments

- Written, calculation, pseudocode, and unknown types use a generous labelled response field with a calm inset writing surface. The label and helper copy describe what is expected without inventing length requirements.
- True/false uses two large binary choices. The current selection is explicit in color, iconography, and native pressed state, not color alone.
- Best-option questions use one selectable full-width row per usable option with a stable letter marker. Selecting another row replaces the answer.
- Multi-select questions use independent full-width choice rows with a checkbox and a selected-count instruction. Checking an item never submits automatically.
- If a closed question has fewer than two usable published options, it falls back to the written response field rather than presenting a broken chooser.
- All answer modes serialize to the existing grading envelope as a string; single choices send the selected option, and multi-select sends the selected options in published order.

## Constraints

- Preserve the established Wicker board language: 1180px destination measure, 32px page title, Archivo Narrow for headings and data, warm canvas, flat white planes, 14px major corners, near-black text, and indigo only for action or selection.
- Local Practice tabs remain directly under the page header. Count pills appear only for due or open work.
- Setup is a compact ruled strip, not a stack of nested cards. Once a filtered sitting is underway, it may visually recede but every filter remains reachable.
- Every internal divider spans the full owning plane. Padding belongs inside ruled headers, bodies, and footers; no short middle borders.
- The active question is a single centered canvas. Outline, progress, and tutor affordances may open contextually but never reserve a permanent or resizable inner column.
- The session footer owns Previous, position, Next, Shuffle, and End session. Queue position is stated once.
- Closed-question controls need visible hover, focus-visible, selected, disabled, grading, graded, and error states; keyboard operation must remain native.
- Mobile presents one task: setup condenses, answer rows remain full width, and session navigation stays reachable without horizontally compressing the desktop composition.
- Flashcards, Mistakes, and Mocks retain their working behavior and share the revised destination header and tab grammar.
