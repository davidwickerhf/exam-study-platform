# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a university student preparing intensively for several examinations. They work repeatedly across editorial notes, source PDFs, practice questions, flashcards, mock papers, tutor conversations, mistakes, and personal progress.

## Product Purpose

Wicker Study turns a maintained academic corpus into a private study workspace. Success means the student can find authoritative course material quickly, practise against it, understand what remains weak, and resume their personal study record from any browser.

## Positioning

Editorial course sources and personal learning state remain deliberately separate: the shared corpus is maintained and indexed centrally, while notes, attempts, mastery, and review history belong to the authenticated student. The tutor retrieves from the exact course corpus and retains source/page citations.

## Operating Context

The product is used for long, high-focus desktop study sessions and shorter mobile checks. Core workflows are course orientation, chapter reading, PDF study, exam practice, flashcard review, mistake correction, mock sessions, search, and grounded tutor questions.

## Capabilities and Constraints

- Next.js App Router, React, and TypeScript own routing, public/legal pages,
  authentication, metadata, and the application boundary. The remaining
  vanilla study engine is an isolated migration boundary, not the platform
  architecture.
- Clerk provides authentication and Neon stores editorial and personal data.
- All existing workflows and local lesson sources must remain intact.
- The interface must handle dense academic material without wasting wide-screen space.
- Every signed-in surface is part of the redesign; mixed legacy and new visual systems are unacceptable.
- Accessibility, keyboard navigation, responsive layouts, loading, empty, and error states are required.

## Brand Commitments

The product name is Wicker Study. Its voice is precise, calm, serious, and academic. Refero is a binding research reference for studying real shipped product patterns and flow quality, not a visual template to copy.

## Evidence on Hand

- Five real courses and their maintained source corpus under `content/`.
- 140 PDFs with extracted page text in Neon.
- React progress, practice, tutor, flashcard, mistake, mock-session, and search workflows under `app/app`.
- Current production screenshots supplied by the user demonstrate excessive nesting, duplicated navigation, inconsistent density, and wasted space.

## Product Principles

1. The study material is primary; interface chrome recedes.
2. One navigation model should work across every workflow.
3. Dense information must remain scannable, not become a field of cards.
4. AI answers must stay grounded in retrievable course sources.
5. Personal state must feel continuous, private, and dependable.

## Accessibility & Inclusion

The web interface must preserve semantic structure, visible keyboard focus, readable contrast, reduced-motion behavior, and useful layouts from mobile through large desktop displays.
