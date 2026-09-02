---
name: Wicker Study
description: An academic departure board — Dutch public information design applied to a university degree.
colors:
  canvas: "#0d0f13"
  surface: "#131720"
  surface-subtle: "#191e29"
  surface-accent: "#1b2547"
  ink: "#eceef1"
  ink-secondary: "#98a0af"
  ink-tertiary: "#767e8d"
  border: "#262c39"
  border-strong: "#39414f"
  signal: "#2b54ff"
  signal-text: "#8ba0ff"
  paper: "#f4f3ef"
  paper-subtle: "#e8e7e1"
  paper-ink: "#14171d"
  paper-ink-secondary: "#545a66"
  paper-rule: "#d5d3cb"
  paper-link: "#1f3ad6"
  on-signal: "#ffffff"
typography:
  display:
    fontFamily: "Archivo Narrow, system-ui, sans-serif"
    fontSize: "60px"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.035em"
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
  control: "4px"
  card: "8px"
  major: "12px"
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

A degree is a timetable, not a dashboard. Wicker Study refuses the study-app
arrangement of same-size metric cards over an off-white ground and takes the
form the student's own country uses for dense public truth: the departure
board — the NS platform display, Crouwel's grid, Total Design's public
information work. Rank comes from scale and position on a grid, never from a
box.

Three rules govern every surface.

1. **One colour.** A saturated signal blue marks what is live, and is never
   spent on decoration. Nothing else on the surface is tinted — there is no
   success green, no warning amber, no danger red.
2. **State is a mark, not a hue.** Recorded, missing, overdue and done are
   carried by marks, weight and position, so every status survives greyscale
   and adds no second colour.
3. **One ruling axis.** The teaching period governs the product. It heads the
   home board with the academic year drawn as a measure, and every screen sits
   somewhere on it.

The ground is ink. Anything read at length — a tutor's answer, the setup
assistant's question, a chapter — is laid on the board as a **punched paper
window**: true paper, dark ink, and the only element on the surface that casts
a shadow.

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

## Layout

- The application is a board shell: a 236px ink sidebar on desktop (brand, search field, grouped navigation — Study: Home, Courses, Practice; Plan: Planning, Calendar — and an account block with avatar initials at the foot) beside a scrolling canvas column capped at 1180px. On compact screens the sidebar becomes a five-item bottom bar (Home, Courses, Practice, Planning, Account) and search moves into page headers. Mistakes, mocks, and flashcards are local tabs inside Practice, never global items.
- Every destination opens with a title in the narrow cut and one line of secondary copy above a single rule. There are no eyebrows: a small tracked-caps label is a column header on a table or a section label in navigation, never a kicker stacked above a heading. Local tabs (Practice, Planning, Account) sit directly under that header as a flat row with one rule. Section titles inside a destination are 18px and carry no rule of their own, so two dividers never stack.
- Regions are bounded by a rule and separated by space, never by a card. A box inside a box is the pattern this world exists to refuse; the punched paper window is the only element with an edge and a shadow.
- Home is the board. It opens with the teaching period set large in the narrow cut, the academic year drawn beneath it as a measure of blocks with the current one carrying the signal, then what is next in date order — date, what, course, days away — with one signal rule under the live row. A greeting is not information and no longer heads the page. Queue figures (cards due, open mistakes, streak, week) are a single line of measures, not four cards. Below that sit a "continue where you left off" block, the activity ledger (28-day bar chart, weekly totals, recent events), the course ledger ordered by exam proximity, and an aside with upcoming exams, quick-start actions, and programme facts. Courses is the ledger with archive and reorder controls.
- Practice is one destination with local tabs under its page header: Questions, Flashcards, Mistakes, Mocks. Tab labels carry a count pill when there is due or open work; the header line summarises what is waiting.
- Study activity is recorded server-side (answers, flashcard reviews, mocks, resolved mistakes, chapters read) and powers the streak, weekly totals, and the feed on Home and in Account. Nothing in the ledger derives from editorial material.
- Calendar (`#/calendar`) is a first-class destination built on FullCalendar: month, week, day, and agenda views over one unified feed (exam attempts, personal events, the institution calendar, saved timetable feeds). A search field, category chips, and a course filter narrow every view and the "Coming up" aside together; selecting a date opens a detail panel with study, edit/remove, and import actions; personal events are added from the page header. Calendar is never nested under Planning.
- Exam dates recorded in Planning flow outward: they order the course ledger, appear as countdowns on Home and in each course header, and never have to be re-entered.
- Standard pages use a fluid canvas capped at 1440px, with 24–40px responsive page gutters.
- The dashboard is an operational overview, not a marketing page. Its summary is compact and the course ledger begins within the first viewport.
- Courses appear as ruled rows with aligned columns. Repeated academic records never become a floating card grid.
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
  mocks, settings, planning) opens with the same flat page header: a 28px
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
- Inputs and buttons use 4px corners, ordinary cards use 8px, and major frames use 12px.
- Use borders and tonal changes before shadows. Repeated rows are flat. No gradients, glass decoration, heavy shadows, or nested card stacks.
- Every interaction has hover, disabled, loading/error where applicable, and visible keyboard focus. Browser selection and scrollbars use the system palette.
- Phone layouts prioritize resume, due flashcards, open mistakes, timed practice, course access, and focused reading. Dense heatmaps, course management, and simultaneous tool panels progressively disclose rather than leading the flow.
- Primary actions use brand indigo, white text, 4px radius, and 40px default height. Secondary actions use a white/transparent surface and strong hairline border.
- Tables use subtle headers, 12px labels, 14px body, tabular numerals, and horizontal overflow on mobile.
- Planning summaries use a ruled four-cell strip with IBM Plex Mono values;
  status and risk color communicate meaning only. Planning editors use the
  established 40px fields, 4px control corners, visible indigo focus, 10–14px
  grid gaps, and hairline row divisions instead of nested panels.
- **The Personal Ledger Rule.** Curriculum, attempts, events, requirements, and
  scenarios reflect the active programme record. Link study material by course
  code only; never silently merge editorial and personal academic truth.
- **The One Planning Destination Rule.** All planning workflows share one local
  horizontal tab system and one compact page frame. Preserve a clear active tab
  and the user's place when moving between planning views.
- Miniature product compositions may use 9–11px simulated-interface type;
  these sizes are reserved for non-interactive visual proof and never for
  actual controls or reading content. Public display type may scale fluidly
  from 36–84px while retaining the same Manrope weight and tracking system.
- The 23px/32px radii are reserved for the simulated phone device and screen.
  Product panels and controls continue to use the 4px/8px/12px radius scale.

## Do not

- Do not reintroduce serif fonts, oversized dashboard heroes, permanent or resizable study rails, raw source paths, duplicate course navigation, gradients, glass, or decorative paper textures.
- Do not use per-course accent colors for global UI. Course color may identify a course icon or local datum only.
- Do not invent one-off spacing, radii, shadows, or colors outside the documented tokens.
- Do not hide dense information inside nested containers when a ruled list or table is clearer.
- Do not present planning records as a spacious card gallery, split the local
  tabs into competing navigation systems, or remove cohort/privacy context from
  derived credits, GPA, requirements, dates, or scenario outcomes.
