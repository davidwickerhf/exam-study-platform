# Topic 1 — Data, Visualization & Measurement

**Source lectures:** Lecture 1 (What is Data Science?), Lecture 2 (Data Visualization and Summaries)
**Tested by:** Mock Q1d (scatter plot), Q1e (study types), Q1j (visualisation choice), Q1k (variable types), Q7 (measurement caveats)
**Approximate mock points:** ~12

---

## What the Exam Asks

Multi-choice and multi-select questions about:
1. **Variable types** — categorical, continuous, discrete (Q1k)
2. **Visualization choice** — which chart is appropriate (and which is NOT) for given data (Q1j)
3. **Scatter plot reading** — what a shaded region in a scatter plot means (Q1d)
4. **Study design types** — Cohort, RCT, Observational, etc. (Q1e)
5. **Measurement caveats** — Goodhart's Law, teaching-to-the-test, variable definition problems (Q7, with **negative points for wrong selections**)

---

## Variable Types

| Type | Definition | Examples |
|---|---|---|
| **Categorical** (nominal) | Distinct unordered categories | Gender, country, blood type, political party |
| **Ordinal** | Categories with order | Likert scale, education level, T-shirt sizes |
| **Discrete** | Countable numeric values (integers) | Number of children, dice rolls, doctor visits, count of anything |
| **Continuous** | Any value in a range (uncountable) | Height, weight, time, temperature, age |

**Mock Q1k recipe:** read each variable, slot it into one of the four buckets.

> "Gender, age, number of times they visited a doctor" → Categorical, Continuous, Discrete

A common trap: **age** can sometimes be discrete if collected in whole years, but the convention in this course is **continuous** because the underlying variable is on a continuous scale.

---

## Visualization — When to Use What

| Chart | Best for | Avoid when |
|---|---|---|
| **Histogram** | Distribution of one continuous variable, many data points | Few data points |
| **Box plot** | Compare distributions across groups; show median, IQR, outliers | Showing exact distribution shape |
| **Strip chart / dot plot** | Few data points, individual values matter | **Millions of points** — overplots into a smear |
| **Bar chart** | Compare counts/means across categories | Continuous variables (use histogram) |
| **Scatter plot** | Relationship between 2 continuous variables | More than 2 dimensions |
| **Line plot** | Time series or ordered continuous data | Unordered categories |
| **Pie chart** | Proportions of a whole, 2–5 categories | Many categories, comparing across charts |

<figure class="diag-figure">
  <figcaption>Chart cheat sheet: one example sketch + a typical dataset for every chart type in the table</figcaption>
  <svg viewBox="0 0 760 410" class="diag-svg" role="img" aria-label="Example sketch and best-fit data for each chart type">

    <!-- Row 1, cell 1: Histogram -->
    <g transform="translate(30,20)">
      <line x1="0" y1="125" x2="160" y2="125" class="d-edge"/>
      <line x1="0" y1="125" x2="0" y2="15" class="d-edge"/>
      <rect x="12" y="92"  width="20" height="33" class="d-node-acc"/>
      <rect x="32" y="68"  width="20" height="57" class="d-node-acc"/>
      <rect x="52" y="42"  width="20" height="83" class="d-node-acc"/>
      <rect x="72" y="26"  width="20" height="99" class="d-node-acc"/>
      <rect x="92" y="38"  width="20" height="87" class="d-node-acc"/>
      <rect x="112" y="62" width="20" height="63" class="d-node-acc"/>
      <rect x="132" y="92" width="20" height="33" class="d-node-acc"/>
      <text x="80" y="153" text-anchor="middle" class="d-h-sm">Histogram</text>
      <text x="80" y="168" text-anchor="middle" class="d-sub">Birth weights, n=10 000</text>
    </g>

    <!-- Row 1, cell 2: Box plot -->
    <g transform="translate(215,20)">
      <line x1="0" y1="125" x2="160" y2="125" class="d-edge"/>
      <line x1="0" y1="125" x2="0" y2="15" class="d-edge"/>
      <!-- group A -->
      <line x1="38" y1="40" x2="38" y2="115" class="d-edge-acc"/>
      <rect x="26" y="55" width="24" height="42" class="d-node-acc"/>
      <line x1="26" y1="78" x2="50" y2="78" class="d-edge-acc"/>
      <!-- group B -->
      <line x1="90" y1="30" x2="90" y2="105" class="d-edge-acc"/>
      <rect x="78" y="46" width="24" height="38" class="d-node-acc"/>
      <line x1="78" y1="58" x2="102" y2="58" class="d-edge-acc"/>
      <!-- group C with outlier -->
      <line x1="142" y1="48" x2="142" y2="118" class="d-edge-acc"/>
      <rect x="130" y="70" width="24" height="32" class="d-node-acc"/>
      <line x1="130" y1="86" x2="154" y2="86" class="d-edge-acc"/>
      <circle cx="142" cy="22" r="2.8" class="d-node-dan"/>
      <text x="80" y="153" text-anchor="middle" class="d-h-sm">Box plot</text>
      <text x="80" y="168" text-anchor="middle" class="d-sub">Test scores by class A/B/C</text>
    </g>

    <!-- Row 1, cell 3: Strip / dot plot — points along a 1D number line, jittered when they overlap -->
    <g transform="translate(400,20)">
      <line x1="10" y1="118" x2="150" y2="118" class="d-edge"/>
      <!-- tick marks reinforce "this is a continuous scale, not categories" -->
      <line x1="25"  y1="116" x2="25"  y2="121" class="d-edge"/>
      <line x1="55"  y1="116" x2="55"  y2="121" class="d-edge"/>
      <line x1="85"  y1="116" x2="85"  y2="121" class="d-edge"/>
      <line x1="115" y1="116" x2="115" y2="121" class="d-edge"/>
      <line x1="145" y1="116" x2="145" y2="121" class="d-edge"/>
      <!-- 14 individual measurements at their actual values; stacked vertically when ties -->
      <circle cx="22"  cy="108" r="3" class="d-node-ink"/>
      <circle cx="38"  cy="108" r="3" class="d-node-ink"/>
      <circle cx="50"  cy="108" r="3" class="d-node-ink"/>
      <circle cx="62"  cy="108" r="3" class="d-node-ink"/>
      <circle cx="62"  cy="96"  r="3" class="d-node-ink"/>
      <circle cx="74"  cy="108" r="3" class="d-node-ink"/>
      <circle cx="74"  cy="96"  r="3" class="d-node-ink"/>
      <circle cx="74"  cy="84"  r="3" class="d-node-ink"/>
      <circle cx="86"  cy="108" r="3" class="d-node-ink"/>
      <circle cx="86"  cy="96"  r="3" class="d-node-ink"/>
      <circle cx="98"  cy="108" r="3" class="d-node-ink"/>
      <circle cx="112" cy="108" r="3" class="d-node-ink"/>
      <circle cx="128" cy="108" r="3" class="d-node-ink"/>
      <circle cx="142" cy="108" r="3" class="d-node-ink"/>
      <text x="80" y="153" text-anchor="middle" class="d-h-sm">Strip chart</text>
      <text x="80" y="168" text-anchor="middle" class="d-sub">Reaction times, n=14</text>
    </g>

    <!-- Row 1, cell 4: Bar chart (note the gaps — contrast with histogram) -->
    <g transform="translate(585,20)">
      <line x1="0" y1="125" x2="160" y2="125" class="d-edge"/>
      <line x1="0" y1="125" x2="0" y2="15" class="d-edge"/>
      <rect x="18"  y="55" width="22" height="70" class="d-node-acc"/>
      <rect x="56"  y="36" width="22" height="89" class="d-node-acc"/>
      <rect x="94"  y="70" width="22" height="55" class="d-node-acc"/>
      <rect x="132" y="82" width="22" height="43" class="d-node-acc"/>
      <text x="29"  y="138" text-anchor="middle" class="d-sub" style="font-size:9px">A</text>
      <text x="67"  y="138" text-anchor="middle" class="d-sub" style="font-size:9px">B</text>
      <text x="105" y="138" text-anchor="middle" class="d-sub" style="font-size:9px">C</text>
      <text x="143" y="138" text-anchor="middle" class="d-sub" style="font-size:9px">D</text>
      <text x="80" y="153" text-anchor="middle" class="d-h-sm">Bar chart</text>
      <text x="80" y="168" text-anchor="middle" class="d-sub">Votes per party</text>
    </g>

    <!-- Row 2, cell 1: Scatter plot -->
    <g transform="translate(115,225)">
      <line x1="0" y1="125" x2="160" y2="125" class="d-edge"/>
      <line x1="0" y1="125" x2="0" y2="15" class="d-edge"/>
      <circle cx="18"  cy="112" r="2.5" class="d-node-ink"/>
      <circle cx="32"  cy="100" r="2.5" class="d-node-ink"/>
      <circle cx="46"  cy="92"  r="2.5" class="d-node-ink"/>
      <circle cx="60"  cy="82"  r="2.5" class="d-node-ink"/>
      <circle cx="74"  cy="76"  r="2.5" class="d-node-ink"/>
      <circle cx="88"  cy="62"  r="2.5" class="d-node-ink"/>
      <circle cx="102" cy="52"  r="2.5" class="d-node-ink"/>
      <circle cx="118" cy="40"  r="2.5" class="d-node-ink"/>
      <circle cx="134" cy="28"  r="2.5" class="d-node-ink"/>
      <path d="M 18 114 L 138 26" class="d-edge-acc dashed"/>
      <text x="80" y="153" text-anchor="middle" class="d-h-sm">Scatter plot</text>
      <text x="80" y="168" text-anchor="middle" class="d-sub">Height vs weight</text>
    </g>

    <!-- Row 2, cell 2: Line plot (time series) -->
    <g transform="translate(300,225)">
      <line x1="0" y1="125" x2="160" y2="125" class="d-edge"/>
      <line x1="0" y1="125" x2="0" y2="15" class="d-edge"/>
      <polyline points="8,100 28,82 48,92 68,58 88,72 108,40 128,52 148,28" class="d-edge-acc" fill="none"/>
      <circle cx="8"   cy="100" r="2" class="d-node-acc"/>
      <circle cx="28"  cy="82"  r="2" class="d-node-acc"/>
      <circle cx="48"  cy="92"  r="2" class="d-node-acc"/>
      <circle cx="68"  cy="58"  r="2" class="d-node-acc"/>
      <circle cx="88"  cy="72"  r="2" class="d-node-acc"/>
      <circle cx="108" cy="40"  r="2" class="d-node-acc"/>
      <circle cx="128" cy="52"  r="2" class="d-node-acc"/>
      <circle cx="148" cy="28"  r="2" class="d-node-acc"/>
      <text x="80" y="153" text-anchor="middle" class="d-h-sm">Line plot</text>
      <text x="80" y="168" text-anchor="middle" class="d-sub">Stock price by day</text>
    </g>

    <!-- Row 2, cell 3: Pie chart -->
    <g transform="translate(485,225)">
      <path d="M 80 70 L 80 15 A 55 55 0 0 1 135 70 Z" class="d-node-acc"/>
      <path d="M 80 70 L 135 70 A 55 55 0 0 1 25 70 Z" class="d-node-acc" opacity="0.55"/>
      <path d="M 80 70 L 25 70 A 55 55 0 0 1 80 15 Z" class="d-node-acc" opacity="0.28"/>
      <text x="80" y="153" text-anchor="middle" class="d-h-sm">Pie chart</text>
      <text x="80" y="168" text-anchor="middle" class="d-sub">Budget by category, n=3</text>
    </g>
  </svg>
</figure>

**Mock Q1j recipe:** "What would you definitely **not** want to use to represent baby birth weight data (millions of data points)?" → **Strip chart** (each point would be drawn individually → unreadable smear).

### Reading scatter plots (Q1d)
Shaded vertical band = filter on the x-axis. Shaded horizontal band = filter on the y-axis.

> Q1d had three panels:
> - A: vertical band at husband = 12 → wives where husband has exactly 12 years
> - B: vertical band at husband > 16 → wives where husband has more than 16 years
> - C: horizontal band at wife = 16 → wives with exactly 16 years
>
> The trap: "Wife completed more years of schooling than husband" requires comparing x and y — that's the region **above the diagonal y = x**, which is not what any of the three shaded areas show.

<figure class="diag-figure">
  <figcaption>Scatter plot reading: vertical band, horizontal band, diagonal comparison</figcaption>
  <svg viewBox="0 0 760 250" class="diag-svg" role="img" aria-label="Scatter plot shaded region interpretation">
    <defs>
      <pattern id="stat-dots" width="32" height="28" patternUnits="userSpaceOnUse">
        <circle cx="8" cy="20" r="2" class="d-node-ink"/>
        <circle cx="22" cy="10" r="2" class="d-node-ink"/>
      </pattern>
    </defs>
    <g transform="translate(30,20)">
      <rect x="42" y="20" width="150" height="150" fill="url(#stat-dots)" opacity="0.7"/>
      <rect x="98" y="20" width="30" height="150" class="d-node-acc" opacity="0.65"/>
      <line x1="42" y1="170" x2="192" y2="170" class="d-edge"/>
      <line x1="42" y1="170" x2="42" y2="20" class="d-edge"/>
      <text x="117" y="198" text-anchor="middle" class="d-h-sm">Vertical band</text>
      <text x="117" y="215" text-anchor="middle" class="d-sub">filter on x only</text>
    </g>
    <g transform="translate(278,20)">
      <rect x="42" y="20" width="150" height="150" fill="url(#stat-dots)" opacity="0.7"/>
      <rect x="42" y="86" width="150" height="30" class="d-node-acc" opacity="0.65"/>
      <line x1="42" y1="170" x2="192" y2="170" class="d-edge"/>
      <line x1="42" y1="170" x2="42" y2="20" class="d-edge"/>
      <text x="117" y="198" text-anchor="middle" class="d-h-sm">Horizontal band</text>
      <text x="117" y="215" text-anchor="middle" class="d-sub">filter on y only</text>
    </g>
    <g transform="translate(526,20)">
      <rect x="42" y="20" width="150" height="150" fill="url(#stat-dots)" opacity="0.7"/>
      <polygon points="42,170 192,20 192,170" class="d-node-dan" opacity="0.55"/>
      <line x1="42" y1="170" x2="192" y2="170" class="d-edge"/>
      <line x1="42" y1="170" x2="42" y2="20" class="d-edge"/>
      <line x1="42" y1="170" x2="192" y2="20" class="d-edge-dan"/>
      <text x="117" y="198" text-anchor="middle" class="d-h-sm">Diagonal region</text>
      <text x="117" y="215" text-anchor="middle" class="d-sub">compare y versus x</text>
    </g>
  </svg>
</figure>

---

## Study Design Types

| Type | What it does | Causal claims? |
|---|---|---|
| **Observational study** | Measure variables as they occur in the wild | No (only association) |
| **Prospective cohort study** | Follow a group forward in time, observe outcomes | Limited (still has confounders) |
| **Retrospective cohort study** | Look backward at people who already had the outcome | Limited |
| **Case-control study** | Compare people with vs without the outcome | Limited |
| **Randomized controlled experiment (RCT)** | Random assignment to treatment vs control | **Yes** — gold standard |
| **Double-blind RCT** | RCT where neither subject nor doctor knows the assignment (statisticians do) | Yes — minimises placebo + observer bias |

**Mock Q1e recipe:** "Which is not a real way to collect data?" → **Lurking Factor Experiment** (made up; "lurking variable" is a confounder, not an experiment type).

**Mock Q1a recipe:** Double-blind = neither subjects nor doctors know who is in treatment vs control; **only the statisticians know**.

---

## Measurement Caveats (Mock Q7 — 9 pts, NEGATIVE scoring)

Multi-select questions where wrong answers cost points. **Be conservative — only pick what you're sure of.**

### Goodhart's Law / "Measure becomes the target"
When a measure is used as a target, it stops being a good measure.

> Q7a: "Napoleon taxed homes by window count, so poor neighbourhoods built houses without windows." This is:
> - ✓ **A measure becoming the target** (windows were the target, behaviour changed to game it)
> - ✓ **"Teaching to the test"** (same phenomenon in education — when test scores are the metric, teachers optimise to the test rather than education)
> - ✓ **Measurements can be wrong** (the measurement no longer captures what it was supposed to: house size)
> - ✗ "Governments are not very clever" (subjective opinion, not a measurement problem — risk negative points if selected)

### Variable definition problems (Q7b)
When you define a variable to measure something, you can run into:
- **Definition drift over context/time** — "obese" defined differently across countries
- **Operationalisation gaps** — the measurement doesn't actually capture the construct (e.g., "intelligence" via IQ test)
- **Inability to abstract** — some real-world phenomena resist numeric encoding
- **Threshold artefacts** — forcing a continuous thing into categories creates discontinuities (e.g., "poor" if income < $X)

> Q7b: "spread too wide" was a **distractor** — variance is a property of data, not a definitional problem. Skip that one.

---

## Data Summaries

From the formula sheet:
- **Mean:** $\bar{x} = \dfrac{1}{n}\sum_{i=1}^{n} x_i$
- **Standard deviation:** $s = \sqrt{\dfrac{1}{n-1}\sum_{i=1}^{n}(x_i - \bar{x})^2}$ — note **n−1**, not n (sample SD)
- **Variance:** $s^2$
- **Standard error of the mean:** $\mathrm{SE} = \dfrac{s}{\sqrt{n}}$

**Discrimination point:** the formula uses `n−1` for sample SD (Bessel's correction). The course occasionally uses `n` in derivations (e.g., the correlation formula on the sheet uses `1/n` and $1/\sqrt n$ factors in both numerator and denominator, so the `1/n` factors cancel).

---

## Conceptual Gotchas

- **"Continuous" includes time and amounts**, not just measurements with decimals. Number of doctor visits is **discrete** (you can't visit 1.7 times).
- **Histogram vs bar chart:** histograms touch (continuous x-axis), bar charts have gaps (categorical x-axis).
- **Observational studies cannot establish causality**, no matter how big the sample (confounders).
- **Selection bias** is when your sample is non-representative. Famous example: Literary Digest 1936 poll predicted Landon would win (sampled telephone owners → wealthy → Republican-leaning).
- **Survivorship bias:** only studying things that survived. Famous example: WW2 plane armour — armour the bullet holes on returning planes, but the holes show where planes can survive being hit. Armour the unhit areas instead.
- **Simpson's paradox:** trend reverses when groups are combined (mock Q1b: women admitted at higher rates in each department but lower overall). Caused by **lurking variable** = which department people applied to.

---

## Quick Reference

| If question asks about... | Recipe |
|---|---|
| Variable type | Categorical / Ordinal / Discrete (countable) / Continuous (uncountable) |
| Which chart for many continuous points | Histogram (not strip chart, not box plot for shape) |
| Reading shaded scatter plot region | Vertical band = x-filter; horizontal band = y-filter; diagonal needed for x-vs-y comparisons |
| "Which is NOT a study design?" | Anything with a made-up term (e.g., "Lurking Factor Experiment") |
| Window-tax / teaching-to-test / metric-gaming | Goodhart's Law / measure-becomes-target |
| Variable definition problems | Drift, operationalisation gap, threshold artefacts |
