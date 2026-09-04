---
name: Wicker Study
description: An academic departure board — Dutch public information design applied to a university degree.
colors:
  canvas: "#f7f7f4"
  surface: "#ffffff"
  surface-subtle: "#f1f2f6"
  surface-accent: "#eceefe"
  assembly-stage: "#f1f2f6"
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
  public-border: "#dfe2ea"
  public-border-strong: "#c8cdd9"
  signal-soft: "#e8eafe"
  on-dark-secondary: "#cbd1df"
  on-dark-tertiary: "#aeb6c8"
  on-dark-accent: "#9ba8ff"
  success: "#147a55"
  warning: "#a56316"
  danger: "#b4233d"
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
  public-display:
    fontFamily: "Archivo Narrow, system-ui, sans-serif"
    fontSize: "clamp(58px, 7.4vw, 106px)"
    fontWeight: 500
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  public-section:
    fontFamily: "Archivo Narrow, system-ui, sans-serif"
    fontSize: "clamp(42px, 5.5vw, 72px)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  public-body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.72
  public-label:
    fontFamily: "Archivo Narrow, system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
  scale:
    column-label: "10.5px"
    micro: "11px"
    label: "12px"
    metadata: "12.5px"
    compact: "13.5px"
    body-small: "14px"
    body-small-strong: "14.5px"
    dense-row: "15px"
    body: "16px"
    section-title: "18px"
    data-large: "21px"
    title: "24px"
    heading: "32px"
    display-small: "42px"
    display: "60px"
rounded:
  flat: "0px"
  control: "6px"
  card: "10px"
  major: "14px"
  artifact: "20px"
  product-stage: "24px"
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
components:
  public-button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
    typography: "{typography.body-small}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  public-button-primary-hover:
    backgroundColor: "{colors.signal-text}"
    textColor: "{colors.on-signal}"
  public-hero-button:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "46px"
  public-button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  public-artifact:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.artifact}"
    padding: "16px"
  public-product-stage:
    backgroundColor: "{colors.assembly-stage}"
    textColor: "{colors.ink}"
    rounded: "{rounded.product-stage}"
    padding: "44px 24px 42px 94px"
  public-course-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.flat}"
    padding: "24px 0"
---

# Design System: Wicker Study

## Overview

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

### Public expression — Study Control Room

**Creative North Star: "The Study Control Room"**

The public system is the outward-facing expression of Dienstregeling: a calm
academic field where the real workspace leads. A poster-scale promise is
framed by exact copies of the period, priorities, practice queue, and activity
widgets. As the visitor scrolls, those fragments converge on their matching
destinations inside a complete Study Itinerary; ruled registers, six product
views, a clear boundary between course material and private learning history,
and a restrained action close continue the story.

Its composition is editorial but operational. White space creates authority;
the hero assembles into a pale tonal frame instead of a cinematic dark reveal;
near-black is reserved for later concentration bands and product interiors.
Signal indigo identifies the live route through the page. The home route avoids
stock student photography, testimonial theatre, and interchangeable feature
cards because the real workspace is the strongest claim the site can make.

**Key Characteristics:**

- Poster-scale narrow typography on a quiet white first viewport.
- Exact copies of four dashboard widgets that map directly into a near-full-width Study Itinerary.
- A quiet field of moving rules, status marks, and study data behind the opening promise; it disappears before the workspace lands.
- Scroll-directed geometric assembly on wide screens; static, readable composition on compact screens.
- A six-mode feature atlas for course material, practice, planning, calendar and Canvas, grounded tutoring, and study continuity.
- Ruled registers and aligned columns for process, capabilities, courses, and trust facts.
- A light tonal assembly stage balanced by warm canvas, white working planes, and selective near-black bands.
- One signal indigo for action, active state, cited evidence, and the connective route.

**The Product Before Promotion Rule.** Public pages prove the system with
coherent interface evidence before they summarize features or ask for trust.

### Brand identity

- The Wicker Study mark is the folded `W` in `public/brand-mark.svg`: two outer page strokes and a lighter central fold, contained by the brand-indigo square geometry.
- Use the mark with the live Archivo wordmark “Wicker Study”; never typeset a plain `W` in a coloured tile as a substitute.
- The mark must remain square, must not be recoloured per course, and must retain at least one-eighth of its width as clear space when used without the wordmark.
- Browser, saved-home-screen, and installed-app icons are derived from this same master mark. Do not introduce a separate favicon symbol.
- Named integrations use their actual vendor mark and official brand colour wherever the source itself is being identified; never substitute a generic database or connector glyph. Canvas uses Instructure's open-source Canvas LMS logomark in Canvas red (`#E72429`), while the surrounding product UI remains in Wicker Study's neutral-and-indigo system.

## Colors

The public surface inherits the warm-canvas, near-black-ink, and signal-indigo
world, then adds a tighter border pair and cool on-dark text for miniature
product evidence.

### Primary

- **Signal Indigo** (`colors.signal`): the only public action voice; use it for primary actions, active navigation, live route marks, links, and evidence.

### Neutral

- **Warm Canvas** (`colors.canvas`): the continuous page field outside white hero and footer planes.
- **Working White** (`colors.surface`): navigation, product planes, artifacts, and reading surfaces.
- **Control-Room Ink** (`colors.ink`): headings, the dark capability band, and the live NOW plane inside product evidence.
- **Public Hairlines** (`colors.public-border`, `colors.public-border-strong`): quiet row divisions and decisive outer rules.
- **Cool On-Dark Text** (`colors.on-dark-secondary`, `colors.on-dark-tertiary`): supporting copy and metadata over ink stages.

**The One Signal Rule.** Indigo carries live meaning; do not introduce another
marketing accent or spread it across decorative background acreage.

## Typography

**Display Font:** Archivo Narrow with the system sans-serif fallback.
**Body Font:** Archivo with the system sans-serif fallback.

**Character:** The narrow cut gives the public site the authority of transport
signage and an academic register. The regular cut keeps explanation quiet and
highly legible; there is no separate decorative or serif voice.

### Hierarchy

- **Public display** (`typography.public-display`): the home promise and supporting-route heroes; it may use an italic indigo phrase for one semantic turn.
- **Public section** (`typography.public-section`): major editorial claims, usually held to 10–16 characters per line.
- **Public body** (`typography.public-body`): explanatory copy, held near 48–60 characters per line.
- **Public label** (`typography.public-label`): compact route, status, and register metadata inside evidence compositions.

**The Narrow Authority Rule.** Large public statements, numerals, dates, route
labels, and preview data use Archivo Narrow; explanatory prose and controls use
Archivo.

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
- Canvas material collection is an explicit, default-off permission separate from the encrypted Canvas connection. Enabling it requires a second, explicit choice between private retrieval, the default, and community sharing. Community sharing creates a candidate only: another account cannot retrieve that material until a rights review has accepted its contribution record. When collection is enabled, each user's catalogue and observed courses refresh daily by default; active work is deduplicated per user and course, and a terminal failure receives a six-hour cooldown by default before automatic requeue. Each completed course refresh versions its sources, indexes retrievable chunks, and runs the obligation scan against that user's evidence.
- Canvas priority extraction is narrow and provenance-preserving. It selects obligation-bearing passages, ranks syllabus and requirement material above supplementary slides and pages, and keeps chunk references on every attendance rule and assessment component. The scan is cached by per-user course binding and evidence hash with `confirmed`, `needs-review`, or `not-found` state. A published human-confirmed profile remains authoritative; otherwise only a confirmed scan may create rule-backed Home obligations.
- Canvas assignments reconcile conservatively with confirmed assessment components by compatible kind and substantive title overlap. A match becomes one priority with both sources named; a date mismatch remains one actionable Canvas row explicitly marked as a rule conflict, and weak generic-word matches remain separate. Conflicting or unsupported extracted claims stay `needs-review`, surface in Setup, and are withheld as rule-backed obligations until resolved.
- Practice uses the **Session Cockpit** pattern: one destination with Questions, Flashcards, Mistakes, and Mocks as local tabs under the shared page header. Tab labels carry a count pill only when due or open work exists, while the header line summarises what is waiting. Questions begins with a compact ruled setup instrument, then gives the remaining board to one full-width white question plane with a centered 900px response column. The response instrument owns its answer actions and adapts natively to written, true/false, single-choice, and multiple-choice questions; session navigation stays in the plane's full-width footer. On mobile, setup condenses to one summary row and the page reserves 64px for global bottom navigation. Practice never gains a permanent or resizable inner rail.
- Study activity is recorded server-side (answers, flashcard reviews, mocks, resolved mistakes, chapters read) and powers the streak, weekly totals, and the feed on Home and in Account. Nothing in the ledger derives from editorial material.
- Calendar (`#/calendar`) is a first-class destination built on FullCalendar: month, week, day, and agenda views over one unified feed (exam attempts, Wicker events, the institution calendar, saved timetable feeds, and Canvas). A compact left rail owns the mini-calendar, source visibility, subscription management, and attendance summary; the mini-calendar is a full-width white rail section rather than a tinted inset card, and the source selector follows familiar calendar software with grouped “My calendars” and “Connected calendars” lists, one-line names, small colour-and-check visibility toggles, and management actions kept behind a row menu. It does not turn sources into two-line connection records or show event counts beside every calendar. The right Day Desk owns the selected date or event. On desktop both rails have a true 1px full-height divider, can be resized by dragging, can be collapsed and visibly reopened, and restore their saved width. Personal events are created, edited, and removed in the Wicker calendar from the page header. Calendar is never nested under Planning.
- Exam dates recorded in Planning flow outward: they order the course ledger, appear as countdowns on Home and in each course header, and never have to be re-entered.
- Dashboard, Courses, and comparable operational board or register destinations use a fluid content measure capped at 1280px, with 16px phone, 24px tablet, and 32px desktop gutters. A wider canvas is an exception for content-heavy workspaces that demonstrably need it, not the operational default.
- The dashboard is an operational overview, not a marketing page. Its summary is compact and the course ledger begins within the first viewport.
- Updates follows design contract `updates-canvas-dispatch-ad40c9d9`: a near-black Canvas Briefing strip precedes a Two-Pane Dispatch inside the shared 1280px board. Announcements, Assignments, Materials, and Courses are URL-addressable local tabs. On desktop, the scan list and detail pane scroll independently below the fixed page context; on smaller screens they become one document flow and selection brings the detail into view. Toolbars, list rows, pane headers, fact bands, and footers use full-bleed internal rules while their content retains its own padding. The actual Canvas mark and Canvas red identify the source only; they never become product action or status styling.
- Updates connects Canvas in place with a secure origin and Personal Access Token rather than diverting the task. The selected Canvas origin is carried through hub refreshes and material requests, including institution-specific origins. The connection and optional material-indexing permissions remain independently manageable in Settings after setup.
- Updates never turns an incomplete Canvas response into a plausible zero. Truncated counts carry an open-ended marker, unavailable parts say unavailable, and partial briefings and empty results name their limited evidence. “New since last visit” compares announcements against the prior visit watermark and advances that watermark only after a successful, complete announcement response.
- Courses appear as ruled rows with aligned columns. Repeated academic records never become a floating card grid.
- A register-led overview may pair a broad content desk with a resizable context rail when the rail directly explains or filters the register. At the two-column desktop breakpoint, the Courses rail is sticky, persists its width, supports pointer and keyboard resizing from 256–400px, and protects at least 660px for the register. Below that breakpoint the separator disappears and the rail follows the register in one document flow. This pattern does not authorize permanent rails inside reading or practice.
- Course pages use a compact identity header, local horizontal tabs, an at-a-glance heatmap, and a ruled chapter register.
- Reading and chapter practice use one centered primary canvas. Outline, progress, and the grounded tutor are contextual drawers that never reserve permanent columns. A chapter has one local mode switch; course-level tabs do not repeat inside it.
- Mobile is a distinct quick-study mode, not a stacked desktop view. It uses bottom primary navigation, an action-led home, single-task reading/practice screens, and contextual outline/tools sheets.
- Auth, mistakes, flashcards, mock sessions, search, forms, dialogs, empty states, loading states, and errors inherit the same spacing, surface, and control system.
- Public pages use a product-led editorial layout: direct value proposition,
  a real workspace composition, ruled course register, explicit AI boundary,
  privacy explanation, and a restrained action close. Decorative student photography
  and generic education marketing patterns are excluded.
- Public heroes may lift a small number of exact product fragments above the
  quiet page field. These fragments use a deliberate 20px radius and restrained
  offset depth; that softer artifact treatment does not replace the tighter
  radii used by the workspace itself.
- On wide screens the four product fragments are motion inputs, not ambient
  decoration. Scroll progress moves each fragment to the measured centre of its
  matching priority, exam, activity, or practice-queue destination while the promise
  recedes and the complete product frame resolves beneath it. There is no idle
  drift in the shipped sequence.
- Public product previews step from the warm page canvas into a solid pale
  tonal stage, then into white and warm-grey workspace planes. Near-black stays
  inside the live NOW route and later concentration bands. Indigo is reserved
  for live route state, actions, and citations; example data is identified in
  plain language and must remain internally coherent.
- The public home opens on a centered poster statement inside a cool-white field
  of animated rules, status marks, and data labels derived from the workspace.
  The field fades fully before the assembled screen becomes readable. On
  wide screens, four small product artifacts sit around that statement; the
  hero remains sticky over a 205vh scroll range while those four fragments
  assemble into the corresponding destinations of the full Study Itinerary.
  The resulting light tonal frame is inset from the viewport and capped at 1400px.
- The feature atlas is one controlled comparison surface with six modes: Course
  material, Practice, Planning, Calendar & Canvas, Tutor, and Study
  record. Tabs keep a single visible panel, support arrow-key traversal, and
  pair a plain example-account notice with each product view.
- Primary editorial bands and supporting public routes cap at 1280px. Desktop
  gutters are at least 24px; the compact-phone gutter is 16px. Section rhythm
  expands fluidly between 96px and 160px instead of introducing decorative
  separators or extra containers.
- At 820px, the hero stops being sticky and becomes a deliberate static
  composition: promise first, then the priority and practice-queue fragments, then the
  product frame. Exam and activity fragments are omitted, the preview drops its
  sidebar and secondary status rail, and the product index becomes horizontal.
  At 560px, actions become full-width, the light product stage bleeds to the
  viewport edges, and wide registers become one-column rows without changing
  their order. Feature modes use a visible two-by-three tab grid while nonessential
  miniature rails and columns progressively disappear.
- `/about` and `/courses` use the same reading-route grammar: a broad narrow-cut
  claim paired with restrained explanatory copy, then ruled registers or one
  decisive dark plane. They do not imitate the home hero composition.

**The Mobile Evidence Rule.** Compact layouts replace scroll assembly with a
static source-to-destination composition and remove secondary miniature detail
before shrinking it below legibility; the remaining proof stays coherent and
keeps the same source-to-action order.
- `/sign-in` is a dedicated access surface with the account action on a white
  working plane and a dark product-proof plane. The public home never doubles
  as the authentication gate.
- Settings is a main Manage destination with Connections, API access, AI usage, and Data & privacy. On desktop, its compact local tab list occupies a separate 208px full-height ruled rail; on mobile, the same destinations become a horizontal local tab row. Canvas and timetable connections share one compact register with Connection, Status, Details, Activity, and Actions columns; the shared column is Activity because Canvas reports credential use while timetable reports synchronization, so it must not be mislabeled “Last sync.” Setup expands only when requested. Profile remains behind the account menu. Data & privacy includes export, study reset, full erasure, and typed confirmation for destructive actions.
  Export is a normal account action; deletion is isolated in a bordered danger
  zone and requires a typed confirmation in a focused modal or mobile sheet.
- Academic Planning is one destination with a local tab row for Overview,
  Courses, Progress, Planner, and Settings. Documents is a main Manage destination
  with a record-and-revision desk. It accepts transcripts, exam schedules,
  timetables, academic calendars, and .ics feeds at
  any time; the reader proposes a change set (results, exam dates, new courses,
  events) that the student ticks and applies — nothing changes silently.
  Each source is cross-checked against the active selected-course ledger.
  Unselected source courses, scheduled completed courses, and disagreeing facts
  are explicit unchecked decisions; source omissions are informational and
  never remove a selected course.
  Version history persists programme-scoped derived metadata, summaries, and
  Academic Work course rows so adjacent saved readings can be inspected
  truthfully; original PDFs and images are read but never retained. Document
  impact records keep proposed, selected, and applied counts distinct because
  selecting a proposal does not prove that it was applied.
  Institution-wide calendar dates maintained editorially appear read-only in
  the Calendar destination with a "Copy to Wicker calendar" action. The copy is an editable personal calendar event; it does not silently change the academic plan. Courses holds the curriculum ledger, programme-structure choices,
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

## Elevation & Depth

The public system is flat by default. Full-span rules, tonal shifts, and the
alternation between warm canvas, white planes, a pale assembly stage, and
selective near-black bands establish most depth. Shadows are reserved for
product artifacts, the framed Study Itinerary, and feature-atlas miniatures
because those elements show the product itself. The assembly stage is an opaque
cool-neutral plane so its small interface text remains crisp during and after
the transition. Blur is not used in the hero or public header.

### Shadow Vocabulary

- **Artifact rest** (`0 20px 25px -5px rgba(32,38,58,.10), 0 8px 10px -6px rgba(32,38,58,.08)`): the four product fragments around the home promise.
- **Product frame** (`0 20px 54px rgba(32,38,58,.10), 0 2px 8px rgba(32,38,58,.06)`): the Study Itinerary inside the light tonal assembly stage.
- **Feature miniature** (`0 28px 60px rgba(32,38,58,.10)`): the active product view inside the six-mode atlas.

**The Earned Lift Rule.** Only faithful product evidence lifts from the page;
course rows, capability rows, trust facts, and editorial copy remain ruled and
flat.

## Shapes

Public shape follows a strict scale. Navigation links and registers are square;
controls use `rounded.control`; product panels use `rounded.card`; major stages
use `rounded.major`. The softer `rounded.artifact` silhouette belongs only to
the four floating hero fragments, `rounded.product-stage` belongs only to the
desktop assembly frame, and `rounded.pill` is limited to the home hero actions,
progress tracks, and compact evidence tags.

**The Artifact Exception Rule.** The 20px artifact curve signals a product
fragment held above the page; it must not spread to ordinary content sections,
course rows, or workspace controls.

## Components

### Public site chrome

The 72px header uses the real folded mark, a two-line Archivo wordmark, and a
single two-pixel indigo rule for the active destination. Text destinations stay
square and unfilled; “Open workspace” is the sole filled action. At the compact
breakpoint, navigation moves into the menu trigger rather than squeezing into a
second line.

### Buttons and text links

Primary public buttons are indigo with white text, a 40px default height, and a
6px corner. The home hero uses a 46px pill variant for the same action. Secondary
buttons stay white with a strong hairline, while editorial text links remain
indigo and move only their arrow on hover. All variants use a two-pixel indigo
focus outline with a three-pixel offset.

### Product artifacts and Study Itinerary

Hero artifacts reuse the same components as the assembled period, priorities,
practice queue, and activity widgets. On wide screens they are geometrically
paired to those destinations and translate into place as scroll progress
advances. They do not scale, rotate, blur, or retain a transformed resting
state. The promise crossfades upward while the full frame rises into place.
Reduced-motion mode
replaces this choreography with a single threshold crossfade between the static
promise/fragments and the assembled frame. Compact layouts do not run the
assembly: they present a static, ordered composition instead. The Study
Itinerary is the signature view: a pale tonal stage, a four-step route index,
the workspace shell, and a plain example-account note.

### Feature atlas

The feature atlas is a six-mode tabbed workspace view, not a grid of feature
cards. Course material, Practice, Planning, Calendar & Canvas, Tutor, and Study
record share one light tonal stage; selecting a tab reveals the corresponding
screen without compositing it over the previous screen. The active tab is
indicated by a two-pixel indigo rule, arrow keys traverse the tablist, and the
example-account note remains visible above every mode. On phones, all six modes
remain visible in a two-by-three grid while sidebars, secondary columns, and feed
detail simplify before type is reduced.

**The Representative Evidence Rule.** Miniature product structure, source
relationships, and state logic must stay faithful to the shipped workspace.
Names, dates, excerpts, counts, and citations used for illustration must be
labelled as representative; published platform facts must be verified and must
not be presented as if they came from a student's live account.

### Registers and boundary panels

Course, capability, contact, comparison, and operating-model content uses
aligned ruled rows. Hover may shift an interactive row by 8–12px, but does not
turn it into a card. The shared-course/private-history boundary is a single
split major plane: a soft indigo thesis block beside two white evidence columns.

### Shared system rules

- Canvas is warm-neutral `#f7f7f4`; white is the primary working surface; subtle gray-violet groups secondary tools and rails.
- Ink is near-black navy. Brand indigo is reserved for primary actions, links, active navigation, focus, and meaningful progress—not decorative acreage.
- Use only the 4/8/12/16/24/32/40/48px spacing scale. Controls are 32, 40, or 48px tall.
- Inputs and buttons use 6px corners, ordinary cards use 10px, and major planes use 14px.
- Use borders and tonal changes before shadows. Repeated rows are flat. Do not use gradients, glass decoration, heavy shadows, or nested card stacks. The public assembly frame is a solid cool-neutral plane.
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
  actual controls or reading content. Public display type uses Archivo Narrow
  and scales fluidly through the `typography.public-display` and
  `typography.public-section` roles.
- The 23px/32px radii are reserved for the simulated phone device and screen.
  Product panels and controls continue to use the 6px/10px/14px radius scale.

## Do's and Don'ts

### Do

- **Do** lead public claims with real, internally coherent product evidence.
- **Do** preserve the promise → Study Itinerary → three-step explanation → six workspace views → capabilities → course register → privacy boundary → action-close sequence on the home page.
- **Do** map each desktop hero fragment to its matching destination in the assembled preview; the motion must explain priority, exam, activity, and practice-queue convergence rather than merely add movement.
- **Do** keep transformed interface text crisp: no blur, no backdrop filter, no scale, and no transformed resting state.
- **Do** keep all six feature-atlas modes in a single accessible tab system with the plain example-account note visible for every mode.
- **Do** keep signal indigo rare and semantic across actions, route state, links, focus, and evidence.
- **Do** collapse secondary preview detail at compact widths before reducing simulated interface type below the documented range.
- **Do** honor `prefers-reduced-motion` with a direct crossfade between the static hero composition and the assembled frame, while removing geometric travel and route-draw animation.

### Don't

- Do not reintroduce serif fonts, oversized dashboard heroes, permanent or resizable contextual study rails inside reading or practice, raw source paths, duplicate course navigation, gradients, glass, or decorative paper textures. The resizable workspace navigation sidebar is the intentional exception.
- Do not use per-course accent colors for global UI. Course color may identify a course icon or local datum only.
- Do not invent one-off spacing, radii, shadows, or colors outside the documented tokens.
- Do not hide dense information inside nested containers when a ruled list or table is clearer.
- Do not present planning records as a spacious card gallery, split the local
  tabs into competing navigation systems, or remove cohort/privacy context from
  derived credits, GPA, requirements, dates, or scenario outcomes.
- **Don't** replace the home proof with stock student photography, testimonial theatre, generic feature cards, or abstract AI imagery.
- **Don't** apply the floating 20px artifact silhouette or its shadow to ordinary public sections.
- **Don't** reintroduce ambient fragment drift or a dark hero stage; the shipped signature is scroll-directed convergence into a light tonal frame.
- **Don't** invent preview data that contradicts the dates, course names, counts, or route state shown elsewhere in the same composition.
