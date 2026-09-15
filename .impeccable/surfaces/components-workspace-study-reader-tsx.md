---
version: 1
slug: "components-workspace-study-reader-tsx"
primary_target: "components/workspace/study-reader.tsx"
related_targets: ["components/workspace/study-reader.css", "app/app/study/[versionId]/page.tsx", "components/workspace/study-lesson-story.tsx", "components/workspace/study-lesson-story.css", "components/workspace/course-study-versions.tsx", "components/workspace/study-library.css"]
---

# Study guide library and reader

Read/Operate. Existing-world, code-led extension of Wicker's academic workspace; preserve its palette, Archivo typography, controls, source evidence and private learning state. No new visual-world seed or approved comp is claimed. The reference lock and full direction contract are in `docs/design/study-guide-reader.md`.

## Implemented composition

The library shows every matching guide, searches guide and chapter titles, and exposes stored read counts and next unread chapter entry. Its guide grid grows from one to two columns at 650px of available width and three at 1100px. These are guide collections, not a new card treatment for academic registers.

A compact guide header leads to the white reader. Guide options owns history, sources and exam creation; Chapter options owns review and improvement. Learning goals disclose under What you’ll learn. The chapter title leads without an eyebrow; lesson prose begins within the initial phone viewport. Learn, Summary, Practice and personal notes use one local mode switch. Previous/next chapter controls close the reading flow.

The reader is container-responsive: below 960px a labelled chapter picker opens the searchable outline; at 960px it becomes a 232px contents column. Current chapter uses semantic indigo, a left rule and `aria-current`; unavailable chapters are disabled and labelled Preparing. Selection closes the compact picker, focuses the chapter heading and retains chapter URL context. Progress counts explicit marked-read records only. Titles step from 24px to 32px at the wide reader breakpoint.

Lesson visuals sit inline until their own container reaches 820px, when prose and visual can share two columns. Opening the contextual tutor retains chapter/source context and lets the reader respond to the remaining width. No new imagery, palette or global spacing scale is introduced.

## Review and limits

Fresh reviewer disposition: ship for the four resolved findings—earlier content, mobile material rows and answer controls, removed reader eyebrow, and persisted direction contract. This is scoped review, not whole-site approval. Local captures are under `.impeccable/review/study-redesign/`. Recorded validation and fixture/service limitations are in `docs/design/study-guide-reader.md`; large real banks and hosted AI/Canvas behavior remain outside those fixture claims.
