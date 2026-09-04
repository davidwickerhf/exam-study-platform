---
name: Wicker Study
description: An academic departure board — Dutch public information design applied to a university degree.
colors:
  canvas: "#f7f7f4"
  surface: "#ffffff"
  surface-subtle: "#f1f2f6"
  surface-accent: "#eceefe"
  ink: "#20263a"
  ink-secondary: "#59627b"
  ink-tertiary: "#7d859b"
  border: "#e7e6e1"
  border-strong: "#d5d7e0"
  signal: "#3f51d9"
  signal-text: "#3344c1"
  paper: "#ffffff"
  paper-subtle: "#f1f2f6"
  paper-ink: "#20263a"
  paper-ink-secondary: "#59627b"
  paper-rule: "#e7e6e1"
  paper-link: "#3f51d9"
  on-signal: "#ffffff"
typography:
  display:
    fontFamily: "Archivo Narrow, system-ui, sans-serif"
    fontSize: "60px"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  display-small:
    fontFamily: "Archivo Narrow, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "Archivo Narrow, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.63
  body-small:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
  data:
    fontFamily: "Archivo Narrow, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  scale: ["10.5px", "11px", "12px", "12.5px", "13.5px", "14px", "14.5px", "15px", "16px", "21px", "24px", "32px", "42px", "60px"]
rounded:
  control: "6px"
  card: "10px"
  major: "14px"
  pill: "999px"
  device: "32px"
  device-screen: "23px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "40px"
  8: "48px"
---

# Wicker Study design system

## North star — Dienstregeling

A degree is a timetable, not a dashboard. Wicker Study takes the form the
student's own country uses for dense public truth: the departure board — the
NS platform display, Crouwel's grid, and Total Design's public information
work. Rank comes from scale and position on a grid, never from decoration.

Three rules govern every surface.

1. **One colour.** Signal blue marks what is live and actionable; the ink
   surfaces remain neutral so study material keeps priority.
2. **State is a mark, not a hue.** Recorded, missing, overdue and done are
   carried by marks, weight and position, so every status survives greyscale
   and adds no second colour.
3. **One ruling axis.** The teaching period governs the product. It heads the
   home board with the academic year drawn as a measure, and every screen sits
   somewhere on it.

The signed-in ground is a warm-neutral canvas. White working planes, quiet
gray-violet groupings, near-black navy ink, and soft structural shadows keep
long study sessions calm. The darkest ink is reserved for decisive emphasis,
including the dashboard's current-action plane; indigo remains the live route
through the work.

Archivo carries interface and authored content. **Archivo Narrow carries every
numeral, course code, date and countdown, always tabular**, so columns line up
at any size. Serif type is prohibited across all product surfaces, and
monospace is not used as a costume for "technical" — the narrow cut is the
data voice.

## Brand identity

- The Wicker Study mark is the folded `W` in `public/brand-mark.svg`: two outer page strokes and a lighter central fold, contained by the brand-indigo square geometry.
- Use the mark with the live Manrope wordmark “Wicker Study”; never typeset a plain `W` in a coloured tile as a substitute.
- The mark must remain square, must not be recoloured per course, and must retain at least one-eighth of its width as clear space when used without the wordmark.
- Browser, saved-home-screen, and installed-app icons are derived from this same master mark. Do not introduce a separate favicon symbol.
- Named integrations use their actual vendor mark and official brand colour wherever the source itself is being identified; never substitute a generic database or connector glyph. Canvas uses Instructure's open-source Canvas LMS logomark in Canvas red (`#E72429`), while the surrounding product UI remains in Wicker Study's neutral-and-indigo system.

## Layout

- The application is a warm board shell. Its desktop sidebar opens at 248px and restores a saved resized width within 224–320px. Expanded, it shows the brand, search, grouped navigation, and the account block; collapsed, it becomes a 48px icon rail with labels and search hidden and destination tooltips available. The header trigger or `Cmd/Ctrl+B` reopens it at the retained expanded width; a fresh mount starts expanded. Study holds Home, Courses, Practice, Updates, and Tutor; Plan holds Planning and Calendar; Manage exposes Admin only to administrators. On compact screens the same sidebar opens as a sheet, while a five-item bottom bar keeps Home, Courses, Practice, Planning, and Account available and search sits in the sticky top bar. Mistakes, mocks, and flashcards are local tabs inside Practice, never global items.
- `/app/setup` is a focused, full-screen exception to that shell. The workspace sidebar, sticky mobile header, and bottom navigation are all absent; a small brand bar and the always-visible whole-flow “Skip for now” action are the only surrounding chrome. Four numbered phases span the page above the work area. There is no StudyMap or decorative inline SVG. At the desktop breakpoint, the Source register occupies the 20rem right column and aligns with the top of the broad active task plane; below that breakpoint, it follows the task plane in document order. Its privacy assurance remains a separate helper below the bordered register rather than becoming another register row.
- Setup uses the same near-black emphasis as Home's “Now” plane for the active task header only. Inputs remain white working surfaces, while indigo is reserved for action, focus, and selection; dark-filled inputs are not part of the control language.
- Onboarding copy makes no completion-time promise and uses direct sentences without em dashes.
- Setup is deterministic and server-state-led: programme, electives, Academic Work, transcript, academic calendar, timetable, then Canvas, grouped as Study plan, Academic record, Schedule, and Canvas. A source becomes done only when the server confirms it; electives remain blocked until a programme exists, and each save or deferral advances to the first remaining actionable step. The whole-flow skip enters an honestly empty workspace without inference, while “Do this later” records only that one optional source as deferred, leaves academic data unchanged, and keeps it reachable from the source register. Finishing normally becomes available as soon as the required programme is saved.
- Every destination opens with a 32px title in the narrow cut and one line of secondary copy above a single rule. There are no eyebrows: a small tracked-caps label is a column header on a table or a section label in navigation, never a kicker stacked above a heading. Local tabs (Practice, Planning, Account) sit directly under that header as a flat row with one rule. Primary section titles inside a destination are 18px and carry no rule of their own, so two dividers never stack; compact status and context widgets use 16px headings.
- Regions are structured by full-span rules and space before they become containers. Page dividers reach the edges of their page band; section heads, toolbars, rows and footers carry edge-to-edge dividers inside their owning working plane while their content keeps its own padding. Operational widgets are flat, white, bordered planes with the shared 14px major-plane corner. The shared soft sheet shadow is reserved for supporting depth and the singular near-black emphasis sheet; rows remain flat and nested card stacks remain prohibited.
- Home is the **Study Itinerary**. A compact date and period header ends in a W1–WN measure: the current week carries solid indigo, elapsed weeks carry a faded signal, future weeks carry the neutral rule, and an exam label appears only when the selected course exam or exam week falls inside the displayed period. At the two-column desktop breakpoint this band remains fixed while the route and status rail scroll independently; smaller layouts retain one document scroll below the sticky band to avoid nested mobile scroll regions. The broad left column begins with a ruled four-metric band for credits, courses passed, streak, and weekly sessions above the single route: a dark NOW plane followed by at most two deduplicated NEXT/LATER stops drawn from assignments, course exams, and maintained institution milestones. Its one-pixel indigo rail is centered through the circular stop markers; when there are no future stops, the connecting rail is omitted rather than decorative. The narrower right column holds evidenced priorities, the study queue, browser-read course progress, and the period activity heatmap.
- When the onboarding source of truth reports outstanding setup steps, Home places one dismissible reminder above Priorities. It names the number of missing steps, identifies the next actionable step, and deep-links into that setup step. Dismissal is stored per workspace and exact outstanding-step signature, so unchanged work stays dismissed while newly changed coverage may be surfaced again. The reminder is absent when setup is complete and never duplicates inside the NOW plane.
- The Home activity heatmap covers only the maintained teaching-period dates from `context.start` through `context.end`. It uses the same ruled register as the other status widgets: a full-width header, a compact W1–WN grid, and a full-width footer carrying the exam note and intensity key. Monday-to-Sunday 10px cells span the available register width without becoming chart furniture. The first in-period course exam is marked, falling back to the maintained in-period exam week only when no course exam exists. Past activity uses five neutral-to-indigo intensity levels, today is outlined, and future dates are unfilled rather than reported as inactivity. Its complete visual grid, weekday guides, and legend are `aria-hidden`; a screen-reader-only ordered list exposes one localized state label for every maintained period date. Loading uses the reserved skeleton and failure uses an explicit unavailable state.
- Home priorities may claim only what the timetable, connected Canvas submission state, or confirmed course assessment rules support. Each source reports loading, connected/verified, absent, or unavailable independently; unavailable data is never presented as clear, and empty priority copy is scoped to the sources currently connected. Priority rows expose source, state, due context, detail, and destination when available.
- Canvas material collection is an explicit permission separate from the encrypted Canvas connection. When enabled, each user's catalogue and observed courses refresh daily by default; active work is deduplicated per user and course, and a terminal failure receives a six-hour cooldown by default before automatic requeue. Each completed course refresh versions its sources, indexes retrievable chunks, and runs the obligation scan against that user's evidence.
- Canvas priority extraction is narrow and provenance-preserving. It selects obligation-bearing passages, ranks syllabus and requirement material above supplementary slides and pages, and keeps chunk references on every attendance rule and assessment component. The scan is cached by per-user course binding and evidence hash with `confirmed`, `needs-review`, or `not-found` state. A published human-confirmed profile remains authoritative; otherwise only a confirmed scan may create rule-backed Home obligations.
- Canvas assignments reconcile conservatively with confirmed assessment components by compatible kind and substantive title overlap. A match becomes one priority with both sources named; a date mismatch remains one actionable Canvas row explicitly marked as a rule conflict, and weak generic-word matches remain separate. Conflicting or unsupported extracted claims stay `needs-review`, surface in Setup, and are withheld as rule-backed obligations until resolved.
- Practice is one destination with local tabs under its page header: Questions, Flashcards, Mistakes, Mocks. Tab labels carry a count pill when there is due or open work; the header line summarises what is waiting.
- Study activity is recorded server-side (answers, flashcard reviews, mocks, resolved mistakes, chapters read) and powers the streak, weekly totals, and the feed on Home and in Account. Nothing in the ledger derives from editorial material.
- Calendar (`#/calendar`) is a first-class destination built on FullCalendar: month, week, day, and agenda views over one unified feed (exam attempts, personal events, the institution calendar, saved timetable feeds). A search field, category chips, and a course filter narrow every view and the "Coming up" aside together; selecting a date opens a detail panel with study, edit/remove, and import actions; personal events are added from the page header. Calendar is never nested under Planning.
- Exam dates recorded in Planning flow outward: they order the course ledger, appear as countdowns on Home and in each course header, and never have to be re-entered.
- Dashboard, Courses, and comparable operational board or register destinations use a fluid content measure capped at 1280px, with 16px phone, 24px tablet, and 32px desktop gutters. A wider canvas is an exception for content-heavy workspaces that demonstrably need it, not the operational default.
- The dashboard is an operational overview, not a marketing page. Its summary is compact and the course ledger begins within the first viewport.
- Courses appear as ruled rows with aligned columns. Repeated academic records never become a floating card grid.
- A register-led overview may pair a broad content desk with a resizable context rail when the rail directly explains or filters the register. At the two-column desktop breakpoint, the Courses rail is sticky, persists its width, supports pointer and keyboard resizing from 256–400px, and protects at least 660px for the register. Below that breakpoint the separator disappears and the rail follows the register in one document flow. This pattern does not authorize permanent rails inside reading or practice.
- Course pages use a compact identity header, local horizontal tabs, an at-a-glance heatmap, and a ruled chapter register.
- Reading and chapter practice use one centered primary canvas. Outline, progress, and the grounded tutor are contextual drawers that never reserve permanent columns. A chapter has one local mode switch; course-level tabs do not repeat inside it.
- Mobile is a distinct quick-study mode, not a stacked desktop view. It uses bottom primary navigation, an action-led home, single-task reading/practice screens, and contextual outline/tools sheets.
- Auth, mistakes, flashcards, mock sessions, search, forms, dialogs, empty states, loading states, and errors inherit the same spacing, surface, and control system.
- Public pages use a product-led editorial layout: direct value proposition,
  a real workspace composition, ruled course register, explicit AI boundary,
  privacy proof, and a restrained action close. Decorative student photography
  and generic education marketing patterns are excluded.
- `/sign-in` is a dedicated access surface with the account action on a white
  working plane and a dark product-proof plane. The public home never doubles
  as the authentication gate.
- Account replaces Settings at `#/account` with four tabs. API access: personal keys (name, scopes, one-time secret, revoke) and agent/MCP setup snippets. Profile: identity register, study-record facts, and the activity ledger. AI usage: allowance meters in two columns plus a table of recent requests. Data & privacy: a storage table (each record family, count, size, whether a reset clears it), export, reset study data (keeps account, plan, and usage ledger), erase everything (keeps sign-in), and the isolated account-deletion danger panel. Resets and deletion require a typed confirmation in a focused modal.
  Export is a normal account action; deletion is isolated in a bordered danger
  zone and requires a typed confirmation in a focused modal or mobile sheet.
- Academic Planning is one destination with a local tab row for Overview,
  Courses, Documents, Progress, Planner, and Settings. Documents accepts
  transcripts, exam schedules, timetables, academic calendars, and .ics feeds at
  any time; the reader proposes a change set (results, exam dates, new courses,
  events) that the student ticks and applies — nothing changes silently.
  Each source is cross-checked against the active selected-course ledger.
  Unselected source courses, scheduled completed courses, and disagreeing facts
  are explicit unchecked decisions; source omissions are informational and
  never remove a selected course.
  Institution-wide calendar dates maintained editorially appear read-only in
  the Calendar destination with an "Add to my plan" action. Courses holds the curriculum ledger, programme-structure choices,
  and per-course editing (expanded in place beneath the row); Progress holds
  credits, GPA, and requirements. These views remain peers inside the
  destination; do not reproduce them as global navigation or separate
  dashboard cards.
- Planning uses the academic-ledger grammar at editing density: programme facts,
  course attempts, requirements, dated events, scenarios, and derived results
  are aligned in ruled rows or compact tables grouped by study year. Records
  are read-first: a row expands to reveal its editor, only one editor is open
  at a time, and destructive actions live inside that editor as quiet text
  links. Creation forms are collapsed composers opened from the page header,
  sitting on the subtle grouped surface.
- Every signed-in utility page (dashboard, practice, mistakes, flashcards,
  mocks, settings, planning) opens with the same flat page header: a 32px
  title, one line of secondary copy, an optional monospace meter at right, and
  a strong hairline beneath. Page titles never sit inside a bordered card.
- Planning data is explicitly private and programme/cohort-specific. Keep the
  account-privacy marker visible in each planning view, describe derived values
  as consequences of the student's own record, and never imply that the shared
  editorial course catalogue defines a student's curriculum or official dates.
- Planning progressively collapses from multi-column registers and side forms to
  a single-column flow. Tabs scroll horizontally; wide tables may overflow; form
  grids stack; record actions remain reachable with touch-sized targets. Preserve
  record order and editing context rather than turning mobile rows into cards.
- Authored prose is capped at 74ch, but the application canvas is not artificially narrowed.

## System rules

- Canvas is warm-neutral `#f7f7f4`; white is the primary working surface; subtle gray-violet groups secondary tools and rails.
- Ink is near-black navy. Brand indigo is reserved for primary actions, links, active navigation, focus, and meaningful progress—not decorative acreage.
- Use only the 4/8/12/16/24/32/40/48px spacing scale. Controls are 32, 40, or 48px tall.
- Inputs and buttons use 6px corners, ordinary cards use 10px, and major planes use 14px.
- Use borders and tonal changes before shadows. Repeated rows are flat. No gradients, glass decoration, heavy shadows, or nested card stacks.
- Every interaction has hover, disabled, loading/error where applicable, and visible keyboard focus. Browser selection and scrollbars use the system palette.
- Phone layouts prioritize resume, due flashcards, open mistakes, timed practice, course access, and focused reading. Dense heatmaps, course management, and simultaneous tool panels progressively disclose rather than leading the flow.
- Primary actions use brand indigo, white text, 6px radius, and 40px default height. Secondary actions use a white/transparent surface and strong hairline border.
- Tables use subtle headers, 12px labels, 14px body, tabular numerals, and horizontal overflow on mobile.
- **The Coverage Truth Rule.** Source coverage reports the share of current courses represented in each real source family and retains the covered/total count for assistive technology. Per-course material coverage measures only the two retrievable channels—indexed Canvas material and maintained-library chapters—with each available channel contributing half; name the numerator or channels so the percentage never implies syllabus completeness, readiness, or study progress. Unknown and unavailable remain distinct from zero.
- Planning summaries use a ruled four-cell strip with IBM Plex Mono values;
  status and risk color communicate meaning only. Planning editors use the
  established 40px fields, 6px control corners, visible indigo focus, 10–14px
  grid gaps, and hairline row divisions instead of nested panels.
- **The Personal Ledger Rule.** Curriculum, attempts, events, requirements, and
  scenarios reflect the active programme record. Link study material by course
  code only; never silently merge editorial and personal academic truth.
- **The One Planning Destination Rule.** All planning workflows share one local
  horizontal tab system and one compact page frame. Preserve a clear active tab
  and the user's place when moving between planning views.
- **The Conflict-Only Assistant Rule.** Setup controls and server state own the
  ordinary flow. Wicker appears only beside a reported source conflict, asks
  only for the distinguishing fact, and never receives credentials or original
  documents; without a conflict, the assistant route refuses the turn.
- **The Revocation Rule.** Turning off Canvas material collection records the
  revocation, cancels pending imports, prevents new automatic scans, removes
  derived priority scans from workspace use, and returns community candidates
  to private or withdrawn status. Existing stored private material is not
  silently deleted; deletion remains a separate account-data action.
- Miniature product compositions may use 9–11px simulated-interface type;
  these sizes are reserved for non-interactive visual proof and never for
  actual controls or reading content. Public display type may scale fluidly
  from 36–84px while retaining the same Manrope weight and tracking system.
- The 23px/32px radii are reserved for the simulated phone device and screen.
  Product panels and controls continue to use the 6px/10px/14px radius scale.

## Do not

- Do not reintroduce serif fonts, oversized dashboard heroes, permanent or resizable contextual study rails inside reading or practice, raw source paths, duplicate course navigation, gradients, glass, or decorative paper textures. The resizable workspace navigation sidebar is the intentional exception.
- Do not use per-course accent colors for global UI. Course color may identify a course icon or local datum only.
- Do not invent one-off spacing, radii, shadows, or colors outside the documented tokens.
- Do not hide dense information inside nested containers when a ruled list or table is clearer.
- Do not present planning records as a spacious card gallery, split the local
  tabs into competing navigation systems, or remove cohort/privacy context from
  derived credits, GPA, requirements, dates, or scenario outcomes.
