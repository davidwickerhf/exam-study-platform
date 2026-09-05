# Course detail and attempt history

The existing Wicker dashboard and course register, plus DESIGN.md, are the primary design target. Keep the Archivo/Archivo Narrow roles, neutral canvas, white registers, navy overview panel, thin rules, 12px section corners and blue actions. This is an extension of the product language, not a new visual direction.

Refero research: Raise/Open Collective (`f72e18d0-98f4-4e88-9754-5426589564ea`) reinforces the contained two-column structure, navy text and lightweight borders. Zed (`0550f6a7-e6b1-4fdc-8148-aa437474e082`) contributes compact action hierarchy and restrained accent use only. Their fonts, marketing imagery and other brand tokens are not imported. Course-screen research favored separating content from record management; the existing Wicker tab system is the concrete implementation reference.

The default Study view keeps chapters and mastery in the main column and a recent-attempt register beside them. A full history tab exposes all sittings without implying a failed attempt was erased by a later pass. Material, attendance and course details get their own tabs. Academic-only and Canvas-only courses use the same page even when no chapters exist. Empty, unavailable and loading states remain distinct.

History uses reconciled curriculum identities while preserving original attempt codes, names, grades, credits and dates. Missing facts are displayed as missing, not inferred from today's catalogue. No grades or attempt records are edited by this page. On narrow screens the columns stack, the tab rail scrolls, and the full history table scrolls within its own section.

## Edition selection and collection

Keep the existing course-page reference lock. Add a labelled academic-year selector at course-header level; use the same selection for attempt summaries and original material, with an explicit All years option. The chapter guide and course information remain clearly labelled as shared because the editorial store does not version them by academic year.

The user's request owns the interaction: all accessible Canvas years are discoverable, with collection actions on the course page. Refero Acuity import preview/success screens (`2c65d68c-ca8c-44fa-bcb7-b3e68354884a`, `04c3eda8-9e4d-4854-9e00-3518dd08d9b3`) inform explicit action/status separation and visible success/error feedback. Wicker's quiet ruled registers remain the primary visual target. Collection status is per year, combining every accessible shell in that year; failed/partial jobs remain visible, and missing years can be queued individually or together. No new imagery or color roles.


## Header hierarchy

The user's September 5 header screenshot is the audit target. Course identity leads on its own row: small code, dominant title, quiet placement metadata. A thin divider separates the edition context from the title; the compact labelled selector sits left and study actions sit right. Start/Continue reading is the sole filled primary action, Past papers is secondary, and Archive moves into Course options beside the back navigation. This applies the existing Wicker design lock and keeps course management out of the study-action group. On narrow screens the toolbar wraps into two readable rows.
