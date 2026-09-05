# Course detail and attempt history

The existing Wicker dashboard and course register, plus DESIGN.md, are the primary design target. Keep the Archivo/Archivo Narrow roles, neutral canvas, white registers, navy overview panel, thin rules, 12px section corners and blue actions. This is an extension of the product language, not a new visual direction.

Refero research: Raise/Open Collective (`f72e18d0-98f4-4e88-9754-5426589564ea`) reinforces the contained two-column structure, navy text and lightweight borders. Zed (`0550f6a7-e6b1-4fdc-8148-aa437474e082`) contributes compact action hierarchy and restrained accent use only. Their fonts, marketing imagery and other brand tokens are not imported. Course-screen research favored separating content from record management; the existing Wicker tab system is the concrete implementation reference.

The default Study view keeps chapters and mastery in the main column and a recent-attempt register beside them. A full history tab exposes all sittings without implying a failed attempt was erased by a later pass. Material, attendance and course details get their own tabs. Academic-only and Canvas-only courses use the same page even when no chapters exist. Empty, unavailable and loading states remain distinct.

History uses reconciled curriculum identities while preserving original attempt codes, names, grades, credits and dates. Missing facts are displayed as missing, not inferred from today's catalogue. No grades or attempt records are edited by this page. On narrow screens the columns stack, the tab rail scrolls, and the full history table scrolls within its own section.
