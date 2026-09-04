---
version: 1
slug: "app-app-tutor-page-tsx"
primary_target: "app/app/tutor/page.tsx"
related_targets:
  [
    "app/app/tutor/loading.tsx",
    "lib/tutor-agent.mjs",
    "lib/tutor-store.mjs",
    "lib/study-briefing.mjs",
    "lib/retrieval-store.mjs",
    "lib/priority-evidence.mjs",
    "lib/workspace/practice.mjs",
    "lib/workspace/planning-settings.mjs",
    "server.mjs",
    "test/study-briefing.test.mjs",
    "test/tutor-markdown.test.mjs",
  ]
---

# Tutor surface brief

- Build path: comp-led for this surface. The user approved Situation Desk in-thread after reviewing three generated directions, then explicitly asked it to inherit Tutor Workbench's designed explanations and teaching elements.
- Approval record: the structural reference is `.impeccable/mocks/decision/tutor-situation-desk.png`. The answer-treatment reference is `.impeccable/mocks/decision/tutor-workbench.png`; it is supporting direction, not a second approved topology.
- Scope: the workspace-wide Tutor destination plus the contextual Tutor entry point opened from a course, lecture, chapter, assignment, announcement, or timetable item. Operate mode.
- Job: help a student understand academic material and make safe decisions by combining course content, requirements, announcements, deadlines, timetable, academic calendar, progress, and remembered plans, then offer useful study actions without taking them before explicit consent.
- Existing truth: Wicker already has Tutor conversation storage, study briefing data, Canvas announcements and assignments, course and Canvas retrieval, citation formatting, and evidence-backed priority profiles. The current Tutor tool surface does not yet combine those sources and cannot create practice sets or stage planning changes.
- Refero grounding: contextual assistant panels work when the surrounding document remains primary, and source-heavy answers benefit from progressive disclosure. Wicker applies those patterns through its own ruled academic-board language, with evidence collapsed beneath the relevant answer and an action docket appearing only when there is something concrete to approve.
- Chosen direction: Situation Desk owns the structure. Tutor Workbench supplies the answer grammar: clear conceptual explanations, diagrams where useful, worked examples, comparisons, checks for understanding, and practice-set proposals embedded in the response rather than flattened into chat prose.
- Primary actions: ask a question, widen or narrow the current context lens, inspect evidence, continue an explanation, generate exercises or a practice set, review a proposed plan, approve selected actions, dismiss proposals, and manage remembered plans.
- Proof: every consequential claim identifies its source class and can reveal claim-level citations; every proposed mutation states exactly what will change; every executed mutation records explicit approval and provides a reversible result where the underlying system permits it.

## Direction contract

- THESIS: Tutor is an academic situation desk with the teaching craft of a workbench, not a generic chatbot or a second dashboard.
- OWN-WORLD: Warm board, broad white answer sheet, navy ink, indigo only for scope and consent, full-span rules, compact instrument labels, and no nested card stacks.
- STORY: Ask from anywhere, see what Tutor understood, receive a designed explanation or consequence brief, inspect its evidence, and approve only the actions worth taking.
- FIRST VIEWPORT: The global Wicker sidebar remains. The main workspace gives roughly three quarters to the conversation and teaching surface. A contextual action docket occupies the remaining quarter only when proposals exist. The fixed composer states whether Tutor is workspace-wide or carrying a route-aware lens.
- FORM: Situation Desk, ranked fifth in seed `433dd774`, enriched by Tutor Workbench's answer design at the user's direction.
- FINISH: preserve the structural clarity of the approved Situation Desk comp without copying its example facts literally; all attendance, deadline, recording, and group-work claims must come from connected evidence.

## Answer grammar

- Start with the direct answer or decision consequence. Do not narrate retrieval work before helping the student.
- Material explanations may use headings, numbered reasoning, equations, tables, small semantic diagrams, worked examples, counterexamples, and short checks for understanding. The format follows the topic rather than a single reusable prose template.
- Cross-source questions become concise briefs grouped by consequence: must act, should coordinate, already covered, and unknown or needs verification. Absence questions must check timetable events against attendance rules, group obligations, assessments, announcements, and existing plans.
- Practice proposals state course, topic scope, question mix, difficulty basis, estimated duration, and destination before consent.
- Planning proposals state the affected dates, existing commitments, proposed moves or additions, conflicts, and whether each operation is reversible.
- Evidence remains collapsed by default beneath the relevant answer. Its label includes the source count and any unresolved conflict. Expanded evidence maps claims to source title, location, retrieved excerpt, freshness, and verification status.
- Citations are visible as compact inline markers or claim marks, but full citation details live in the evidence disclosure rather than a permanently open source rail.

## Scope and memory model

- Conversations opened from the Tutor page are workspace-wide by default.
- A Tutor opened from a course or learning object carries an explicit removable lens such as `BCS1540 · Greedy Algorithms`. That lens boosts the current material and supplies conversational awareness; it never prevents Tutor from checking other courses or workspace sources.
- The composer always states the effective lens and whether wider workspace checks are available. A student can widen or narrow scope before sending.
- Durable plans are typed, bounded memories, not arbitrary chat summaries. An absence memory records its date or recurrence, availability window, reason only when supplied, affected planning behavior, provenance, and edit/delete controls.
- Tutor may propose remembering a plan during conversation, but persistence occurs only after the student approves the exact memory.
- Preferences and long-lived plans belong in the existing memory/history management surface and remain inspectable, editable, and forgettable.

## Action and consent model

- Read-only retrieval and reasoning require no extra confirmation.
- Any action that creates, changes, sends, schedules, remembers, or removes something first enters a proposal state.
- The action docket appears only while proposals exist. Each row names the object, destination, consequence, and reversibility. Selection is explicit and accessible without relying on color.
- `Review actions` opens the final consent state. Approval may be per action; rejecting one must not discard the rest.
- Creating a private practice set, adding or moving a personal planning block, and remembering availability may be executed after approval. Messages to instructors, classmates, or groups are outside the initial Tutor action scope unless a later integration and separate confirmation flow are designed.
- After execution, the docket becomes a compact receipt with links to the created practice set or planning entry and an undo control where supported.

## Constraints

- Preserve the established Wicker destination measure, typography, warm canvas, flat white planes, 14px major corners, near-black text, and indigo action hierarchy.
- Every internal divider spans the full owning region. Padding belongs inside ruled headers, bodies, rows, and footers; no short middle borders.
- The answer remains primary. The action docket is narrower, quieter, and conditional; it must never become a permanent duplicate of Home priorities.
- Assistant answers are document-like blocks, not speech bubbles. User turns may stay compact.
- Do not fabricate certainty. Missing or conflicting timetable, Canvas, syllabus, or course-rule evidence must be named in the answer and surfaced in the evidence panel.
- Keep claim evidence distinct from model explanation. General explanations may cite the relevant course material; obligations and deadlines require traceable workspace evidence.
- Route context is visible and removable. Scope changes cannot happen invisibly.
- The composer remains reachable while the answer column and action docket scroll independently on desktop. Mobile becomes one column: answer, evidence, proposed actions, then composer.
- Use semantic HTML and accessible disclosure, selection, focus, and status controls. Diagrams require text alternatives and must not carry essential meaning through color alone.
- No gradients, glass, decorative AI imagery, nested card mosaics, permanently expanded citations, or autonomous action execution.
