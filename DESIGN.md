---
name: Wicker Study
description: A calm academic reading room for course study, practice, and private progress.
colors:
  oxblood: "#8b2635"
  oxblood-deep: "#651a27"
  institutional-navy: "#12233f"
  navy-soft: "#1d3150"
  cool-ink: "#17243a"
  secondary-ink: "#667084"
  warm-stock: "#f3f0e8"
  reading-leaf: "#fffdf8"
  field-paper: "#e9e5dc"
  rule: "#d7d4ca"
  danger: "#9d342c"
  success: "#397052"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(3rem, 5.4vw, 4.875rem)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(1.75rem, 3vw, 2.375rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.6875rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "IBM Plex Sans, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  reading:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.09375rem"
    fontWeight: 500
    lineHeight: 1.72
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Sans, Segoe UI, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.16em"
  data:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.05em"
rounded:
  square: "0px"
  folio: "2px"
  control: "3px"
  nav: "4px"
  folio-mark: "2px 2px 9px 2px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  section: "30px"
  leaf: "42px"
  display: "54px"
components:
  button-primary:
    backgroundColor: "{colors.institutional-navy}"
    textColor: "{colors.reading-leaf}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.oxblood}"
    textColor: "{colors.reading-leaf}"
    rounded: "{rounded.control}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cool-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
    height: "34px"
  input:
    backgroundColor: "{colors.reading-leaf}"
    textColor: "{colors.cool-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.cool-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "11px 14px"
  navigation-active:
    backgroundColor: "rgba(255,255,255,0.10)"
    textColor: "{colors.reading-leaf}"
    typography: "{typography.body}"
    rounded: "0 4px 4px 0"
    padding: "10px 12px"
    height: "42px"
  reading-card:
    backgroundColor: "{colors.reading-leaf}"
    textColor: "{colors.cool-ink}"
    typography: "{typography.reading}"
    rounded: "{rounded.square}"
    padding: "20px"
---

# Design System: Wicker Study

## Overview

**Creative North Star: "University-Press Digital Reading Room"**

Wicker Study is a durable academic instrument rather than a conventional dashboard. Its interface borrows the composure of a university press catalogue and the utility of a supervised reading room: source material is visually primary, navigation behaves like a folio index, and personal progress appears as a precise marginal record.

The system is editorial, compact, and restrained. Warm paper fields, decisive typographic contrast, fine rules, and rare institutional color organize dense material without turning every datum into a card. Refero informs the discipline of selecting proven interaction patterns for each workflow; its gallery interface is not a visual template.

**Key Characteristics:**

- Editorial hierarchy carried by type, rules, and whitespace rather than decorative containers.
- One light institutional masthead plus a contextual folio margin only when an outline is necessary.
- Dense registers and ledgers for progress, mistakes, mock history, and course navigation.
- Controlled reading measures with quiet marginal study tools.
- Oxblood used sparingly for action, location, and focus; navy carries institutional structure.

## Colors

The palette pairs warm library stock with cool institutional ink, using oxblood as a rare authored mark.

### Primary

- **Institutional Navy:** Permanent navigation, primary actions, table headings, and structural anchors.
- **Oxblood Editorial Mark:** Active rules, focus, authored course identity, and high-value action states.

### Secondary

- **Deep Oxblood:** Pressed and emphatic action states.
- **Navy Soft:** Supporting dark chrome and subdued institutional surfaces.

### Neutral

- **Cool Ink:** Primary interface copy and high-contrast body text.
- **Secondary Ink:** Metadata, explanatory copy, and low-emphasis controls.
- **Warm Stock:** Application background and contextual rail paper.
- **Reading Leaf:** Primary reading canvases, forms, and content surfaces.
- **Field Paper:** Tonal grouping for selectors, legends, and quiet secondary regions.
- **Rule:** Dividers, table structure, and input boundaries.

### Named Rules

**The Rare Mark Rule.** Oxblood identifies action, location, or authorship; it never washes large decorative areas.

**The Paper Hierarchy Rule.** Reading Leaf holds authored material, Warm Stock holds the workspace, and Field Paper groups controls or metadata.

## Typography

**Display Font:** Source Serif 4 (with Georgia fallback)  
**Body Font:** IBM Plex Sans (with Segoe UI fallback)  
**Label/Mono Font:** IBM Plex Mono

**Character:** Source Serif 4 gives course titles and long-form material the authority of an academic edition. IBM Plex Sans keeps controls compact and modern, while Plex Mono is reserved for identifiers, percentages, timestamps, and other exact records.

### Hierarchy

- **Display** (600, fluid 48–78px, 0.98 line-height): Page and course identity; keep the measure short and allow the title to lead the surface.
- **Headline** (600, fluid 28–38px, 1 line-height): Major register and section headings.
- **Title** (600, 27px, 1.15 line-height): Course rows, chapter titles, and consequential component headings.
- **Reading** (500, 17.5px, 1.72 line-height): Authored chapter text at a maximum measure of 70ch.
- **Body** (400, 16px, 1.65 line-height): Interface explanation and supporting prose.
- **Label** (600, 11px, 0.16em tracking, uppercase): Eyebrows and folio categories, never paragraphs.
- **Data** (500, role-dependent size): Percentages, chapter numbers, dates, and source identifiers with tabular numerals.

### Named Rules

**The Three Voices Rule.** Serif explains and names, sans-serif operates, and mono records; do not swap their jobs for novelty.

**The Reading Measure Rule.** Authored prose stops at 70ch even when the application uses the full viewport.

## Layout

The desktop shell uses an 82px light institutional masthead above a fluid working canvas. Ordinary pages use the full application width, while chapter and practice views become five-column workspaces inside that canvas: contextual outline, divider, primary leaf, divider, tutor margin. Reading content remains capped inside the fluid center.

Composition follows a 4px base rhythm with recurring 8px, 12px, 16px, 22px, 30px, 42px, and 54px steps. Dashboard courses are horizontal register rows; course progress is a six-column ledger; stand-alone practice histories are ruled lists and tables. At laptop widths, course labels collapse before the task area. At 820px and below, the masthead becomes a compact 60px icon bar, contextual margins disappear, and primary content stacks. Tabs remain single-line and scroll horizontally instead of wrapping.

**The Masthead Rule.** Global navigation stays in the horizontal institutional masthead; only task-local outlines qualify for a contextual margin.

**The Full Workspace Rule.** Cap reading measure, not application width. Wide screens should improve comparison and tool access rather than add blank margins.

## Elevation & Depth

The system is flat by default. Fine rules and changes between Warm Stock, Field Paper, and Reading Leaf establish most hierarchy. Broad, low-contrast shadows are limited to major folios, authentication, focused reading cards, and dialogs; rows and ordinary content containers remain unshadowed.

### Shadow Vocabulary

- **Folio:** Broad institutional lift for page heroes and major composed surfaces.
- **Folio Small:** Quiet lift for focused reading or review surfaces.
- **Dialog:** Deep separation over a darkened, softly blurred overlay.
- **Focus Ring:** A translucent oxblood halo around keyboard-focused fields and controls.

### Named Rules

**The Flat Ledger Rule.** Repeated information is divided by rules, never lifted into a grid of floating cards.

## Shapes

The form language is near-square and print-derived. Major surfaces use square or 2px corners, controls use 3px corners, and navigation may round only its trailing edge at 4px. The Wicker folio mark is the single asymmetrical recurring silhouette. Circles are reserved for status pips or truly circular indicators.

Borders are generally one-pixel rules. A two- to five-pixel top rule may announce a folio, course, dialog, or active reading surface; it is structural, not decorative.

**The Folio Edge Rule.** Ordinary containers do not become soft rounded cards; curvature belongs to controls and the authored Wicker mark.

## Components

### Buttons

- **Shape:** Compact and gently squared (3px radius), with a minimum height of 34px.
- **Primary:** Institutional Navy with Reading Leaf text; hover changes to Oxblood and rises by 1px.
- **Hover / Focus:** State transitions take 150–180ms; keyboard focus uses the visible oxblood halo. Pressed controls settle down by 1px.
- **Ghost / Secondary:** Transparent or paper-toned with an explicit rule; destructive actions use Danger only when the consequence is real.

### Chips

- **Style:** Near-square paper controls with a one-pixel rule and compact sans-serif labels.
- **State:** Selected exam chips invert to Institutional Navy; inactive chips remain transparent so the selected paper is unambiguous.

### Cards / Containers

- **Corner Style:** Square for ledgers and reading cards; 2px only on major folios.
- **Background:** Reading Leaf for authored or focused content, transparent for repeated register rows.
- **Shadow Strategy:** Flat at rest; only the major folio or focused single-card task may lift.
- **Border:** Horizontal rules create grouping. Accent top rules identify authored or active surfaces.
- **Internal Padding:** Usually 18–24px for dense rows and 30–54px for major leaves.

### Inputs / Fields

- **Style:** Reading Leaf background, Rule boundary, compact 3px corners, and a 44px target where the field stands alone.
- **Focus:** The boundary shifts to Oxblood and gains a translucent focus halo.
- **Error / Disabled:** Error copy and borders use Danger; disabled controls reduce emphasis without removing their label.

### Navigation

The masthead is Reading Leaf with cool labels and a quiet bottom rule. Hover adds a restrained navy wash without movement; active location uses an oxblood underline. At mobile widths, course labels and private-state detail hide while essential icon controls remain operable.

### Course Register

Courses, chapters, mistakes, and mock records use ruled ledger rows with aligned typographic columns. Hover may reveal a narrow inset oxblood mark, but the row never becomes a detached card.

### Reading Workspace

The contextual outline and tutor tools sit on Warm Stock, separated from the Reading Leaf by hairline rules. Authored prose occupies the center at a controlled measure, and PDFs use the same primary-leaf hierarchy rather than a separate visual system.

## Do's and Don'ts

### Do:

- **Do** make authored material the largest, quietest, and most readable surface.
- **Do** use ruled rows and aligned columns for repeated academic records.
- **Do** preserve exact source, chapter, page, percentage, and timestamp data in the mono voice.
- **Do** use the full desktop width while protecting the 70ch reading measure.
- **Do** provide visible keyboard focus, reduced-motion behavior, and a purposeful compact mobile masthead.

### Don't:

- **Don't** rebuild dense workflows as equal rounded cards or nested bordered panels.
- **Don't** reintroduce a permanent dark sidebar or a second global course navigator.
- **Don't** use Oxblood as decorative background acreage or navy as an indiscriminate content fill.
- **Don't** mix serif, sans-serif, and mono roles arbitrarily.
- **Don't** copy Refero's own gallery appearance; use it to study proven product flow patterns.
