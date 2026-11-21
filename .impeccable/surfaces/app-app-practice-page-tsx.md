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

- Current build path: existing-world, code-led extension requested on September 15. The earlier Session Cockpit comp remains historical provenance for the answer instrument, not the current bank-first composition.
- Scope: Questions in global Practice and course Exercises; Flashcards, Mistakes and Mocks retain their existing workflows.
- Job: survey the available questions, choose any question, answer with contextual help, and return without losing work.
- Visual authority: Wicker's existing Archivo typography, warm neutral board, white working surfaces, navy ink and semantic indigo. The current direction and reference lock are in `docs/design/study-guide-reader.md`.

## Direction contract

- THESIS: The full bank supports free navigation; a chosen question receives a focused answer view.
- OWN-WORLD: Preserve Wicker's established academic workspace and question-native controls.
- STORY: Browse original-paper or generated guide/chapter groups → choose any numbered question → answer/check or ask the tutor → previous/next or return to overview with retained work.
- FIRST VIEWPORT: The default overview exposes the matching question groups. The focused mobile view keeps the prompt and start of the answer control together.
- FORM: Existing-world/code-led extension. No new seed or approved bitmap comp is claimed.
- FINISH: Fresh reviewer returned ship for four resolved findings: earlier content, mobile material rows and answer controls, removed reader eyebrow, and persisted direction contract. This is not whole-site approval.

## Quality bar

- Show the full filtered bank initially. Original-paper and generated sources remain explicit; group by paper or guide/chapter and use freely navigable numbered controls.
- Optional setup offers shorter batches. Keep history collapsed. A drafted answer has a dashed map border; a checked answer uses the secondary surface and primary text; current selection uses solid indigo with contrasting text.
- The focused answer plane uses a response measure capped at 900px, question-native controls, contextual tutor access, previous/next, and a return to the overview.
- Preserve drafts and feedback across navigation and hydrate saved assessments. Reading progress and checked states never imply mastery.
- At compact container widths, reduce body and header spacing so the prompt and response begin together. Keep labelled actions reachable and native keyboard/focus behavior intact.
- Evidence and validation limits: `docs/design/study-guide-reader.md`; local captures: `.impeccable/review/study-redesign/`. Deterministic fixture tests do not establish hosted AI quality or large-bank usability.

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
- Setup is optional and remains reachable from the bank and focused question flow.
- Every internal divider spans the full owning plane. Padding belongs inside ruled headers, bodies, and footers; no short middle borders.
- The active question is a single centered canvas. Outline, progress, and tutor affordances may open contextually but never reserve a permanent or resizable inner column.
- Focused question navigation owns Previous, position and Next, with a visible return to overview; changing questions preserves the working answer.
- Closed-question controls need visible hover, focus-visible, selected, disabled, grading, graded, and error states; keyboard operation must remain native.
- Mobile presents one task: setup condenses, answer rows remain full width, and session navigation stays reachable without horizontally compressing the desktop composition.
- Flashcards, Mistakes, and Mocks retain their working behavior and share the revised destination header and tab grammar.
