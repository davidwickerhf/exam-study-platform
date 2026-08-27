---
name: Wicker Study
description: A calm, compact academic workspace for university course study and exam preparation.
colors:
  canvas: "#f7f7f4"
  surface: "#ffffff"
  surface-subtle: "#f1f2f6"
  surface-accent: "#eceefe"
  ink: "#20263a"
  ink-secondary: "#59627b"
  ink-tertiary: "#7d859b"
  border: "#dfe2ea"
  border-strong: "#c8cdd9"
  brand: "#3f51d9"
  brand-hover: "#3344c1"
  brand-soft: "#e8eafe"
  selection: "#d9ddff"
  auth-muted: "#cbd1df"
  success: "#147a55"
  warning: "#a56316"
  danger: "#b4233d"
  preview-rail: "#8991aa"
  on-dark-secondary: "#cbd1df"
  on-dark-tertiary: "#aeb6c8"
  on-dark-accent: "#9ba8ff"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  heading:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.63
  body-small:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
  data:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
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

## North star

Wicker Study is a modern academic instrument: calm enough for long reading sessions, compact enough for exam work, and consistent enough that students always understand where they are. It combines Quizlet's efficient educational information architecture with Syllabus's crisp editorial geometry, translated into an original, more official university-course product language.

The application uses one sans-serif voice throughout. Manrope carries interface and authored course content; IBM Plex Mono is reserved for measurements, identifiers, scores, dates, and progress values. Serif type is prohibited across all product surfaces.

## Layout

- A 64px global utility bar is the only global navigation layer on desktop; it becomes 56px on compact screens.
- Standard pages use a fluid canvas capped at 1440px, with 24–40px responsive page gutters.
- The dashboard is an operational overview, not a marketing page. Its summary is compact and the course ledger begins within the first viewport.
- Courses appear as ruled rows with aligned columns. Repeated academic records never become a floating card grid.
- Course pages use a compact identity header, local horizontal tabs, an at-a-glance heatmap, and a ruled chapter register.
- Reading and practice pages use a three-region desktop workspace: 190–240px outline, flexible primary content, and 250–320px study tools.
- Mobile is a distinct quick-study mode, not a stacked desktop view. It uses bottom primary navigation, an action-led home, single-task reading/practice screens, and contextual outline/tools sheets.
- Auth, mistakes, flashcards, mock sessions, search, forms, dialogs, empty states, loading states, and errors inherit the same spacing, surface, and control system.
- Public pages use a product-led editorial layout: direct value proposition,
  a real workspace composition, ruled course register, explicit AI boundary,
  privacy proof, and a restrained action close. Decorative student photography
  and generic education marketing patterns are excluded.
- `/sign-in` is a dedicated access surface with the account action on a white
  working plane and a dark product-proof plane. The public home never doubles
  as the authentication gate.
- Settings uses a compact ruled register for account facts and allowances.
  Export is a normal account action; deletion is isolated in a bordered danger
  zone and requires a typed confirmation in a focused modal or mobile sheet.
- Academic Planning is one destination with a sticky, horizontally scrollable
  local tab row for Overview, Courses, Curriculum, Calendar, Credits,
  Requirements, Planner, and Planning settings. These views remain peers inside
  the destination; do not reproduce them as global navigation or separate
  dashboard cards.
- Planning uses the academic-ledger grammar at editing density: programme facts,
  course attempts, requirements, dated events, scenarios, and derived results
  are aligned in ruled rows or compact tables. Secondary creation forms may sit
  on the subtle grouped surface, but the records themselves remain flat and
  directly editable.
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

- Do not reintroduce serif fonts, oversized dashboard heroes, permanent sidebars, duplicate course navigation, gradients, glass, or decorative paper textures.
- Do not use per-course accent colors for global UI. Course color may identify a course icon or local datum only.
- Do not invent one-off spacing, radii, shadows, or colors outside the documented tokens.
- Do not hide dense information inside nested containers when a ruled list or table is clearer.
- Do not present planning records as a spacious card gallery, split the local
  tabs into competing navigation systems, or remove cohort/privacy context from
  derived credits, GPA, requirements, dates, or scenario outcomes.
