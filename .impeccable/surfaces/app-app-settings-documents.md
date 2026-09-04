---
version: 1
slug: "app-app-settings-documents"
primary_target: "app/app/settings/page.tsx"
related_targets: ["app/app/account/page.tsx", "app/app/account/connections-tab.tsx", "app/app/documents/page.tsx", "components/workspace/workspace-shell.tsx", "lib/academic-document-register.mjs", "lib/academic-snapshots.mjs", "server.mjs"]
---

# Settings and Documents surface brief

- Scope: the account/settings surface plus a new `/app/documents` destination for every authenticated student. Operate mode.
- Job: put every external live connection in one predictable place, while giving students direct ownership of uploaded academic records and their version history.
- Existing truth: Canvas credentials are account-scoped and encrypted; timetable feeds are programme-scoped live connections; Academic Work and other document uploads produce programme-scoped derived records, but original PDFs and images are deliberately not retained. Removing a saved version does not rewrite changes already applied to the academic plan.
- Refero grounding: Linear and Gemini use one settings location with explicit vendor rows and connection states; DocuSign and Craft keep revision activity attached to the selected document instead of scattering it across cards.
- Primary actions: connect or manage Canvas and timetable from Settings; upload, replace, inspect versions, compare progression, and remove a selected academic record from Documents.
- Proof: connected origins, credential-use or feed-refresh activity, snapshot kind/source label/printed date/created date, derived course rows and totals, differences between adjacent versions, and separate proposed/selected/applied impact counts. No sample status may ship as live data.
- Chosen direction: Record & Revision Desk. On desktop, Settings places a compact local tab list inside a separate 208px full-height ruled rail; mobile returns those destinations to a horizontal local tab row. The content plane begins beside that rail with a compact connection register. Documents uses a flat full-height source register with an edge-aligned selected-record inspector; uploads open in a focused modal rather than reserving empty page space.

## Shipped inventory

- `/app/settings`: main Manage destination for Connections, API access, AI usage, and Data & privacy.
- `/app/documents`: programme-scoped document register with persistent source-type rows, dated versions, Academic Work progression, and granular confirmed removal.
- `/app/account`: profile-only destination retained behind the account menu.
- `/api/academics/document-records`: derived metadata, impact, and version register; Academic Work history also returns the derived course rows required for adjacent-version inspection, while original documents remain browser-only.

## Constraints

- Preserve the established Wicker board language: 1280px measure, 32px page title, Archivo Narrow for headings and data, warm canvas, flat white planes, 14px major corners, near-black emphasis only where decisive, and indigo only for action or selection.
- All internal dividers span the full owning plane. Content padding sits inside ruled headers, rows, toolbars and footers, never around a short floating line.
- The shared connection register uses Connection, Status, Details, Activity, and Actions columns. Activity means Canvas credential use for Canvas rows and last synchronization for timetable rows; do not call the shared column “Last sync.”
- Settings is the only connection-management location. Planning may link to it but must not own separate Canvas or timetable controls.
- Documents is a first-class item under Manage and is visible to every student. Admin remains role-gated.
- Upload history is programme-scoped. Persist derived metadata, summaries, impact, and Academic Work course rows needed to compare adjacent saved readings; never retain the original PDFs or images, and label that privacy boundary honestly.
- Document impact must distinguish the total proposals read, the proposals selected by the student, and the changes actually applied. Never collapse proposed, selected, and applied into one count or use one as proof of another.
- Version actions must be granular and reversible where possible. A destructive version or document removal needs explicit confirmation and may not silently change the current academic plan.
- Transcript progression must be visual and factual: credits earned, courses passed and weighted average over dated snapshots, with unknown values distinct from zero.
- Empty, loading, error, connected, refreshing, stale, disconnected, unchanged-upload and conflict states remain explicit.
- Mobile uses one document flow and reachable actions, not horizontally compressed desktop panes.
