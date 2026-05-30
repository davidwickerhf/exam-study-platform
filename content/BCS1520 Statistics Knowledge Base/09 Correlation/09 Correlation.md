# Topic 9 — Correlation

**Source lectures:** Lecture 2 (data summaries); Lecture 3 (causality)
**Tested by:** Mock Q8 (Spearman vs Pearson, 6 pts: 2 + 4)
**Approximate mock points:** 6

---

## What the Exam Asks

1. **Decide if a statement about correlation is true or false** (Q8a)
2. **Explain why Spearman differs from Pearson** in interpreting that statement (Q8b)
3. Often: distinguish correlation from causation (cross-topic with [[02 RCTs and Causality]])

---

## Pearson Correlation

From the formula sheet:
$$\rho = \frac{\text{cov}(X, Y)}{\sigma_X \sigma_Y} = \frac{\frac{1}{n} \sum (x_i - \bar{x})(y_i - \bar{y})}{\sigma_X \sigma_Y}$$

**Range:** −1 ≤ ρ ≤ 1
- `ρ = 1`: perfect positive **linear** relationship
- `ρ = 0`: no linear relationship
- `ρ = −1`: perfect negative **linear** relationship

**Key word:** **linear**. Pearson only captures straight-line association.

### Sample formula expanded
$$r = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum (x_i - \bar{x})^2} \cdot \sqrt{\sum (y_i - \bar{y})^2}}$$

You almost never compute this by hand on the exam — it would be tedious. But you might be asked to **interpret** a number.

---

## Spearman Correlation

$$\text{Spearman} = \text{Pearson}(\text{rank}(X), \text{rank}(Y))$$

You **rank** the X values (smallest → 1, largest → n) and rank the Y values, then compute Pearson on the ranks.

### Why it matters
Spearman captures **any monotonic relationship**, not just linear:
- Pearson sees `y = x²` (on positive x) as moderately positive (linear approximation)
- Spearman sees `y = x²` as a **perfect +1** (rankings match exactly)

<figure class="diag-figure">
  <figcaption>Pearson sees linear association; Spearman sees monotonic ordering</figcaption>
  <svg viewBox="0 0 760 270" class="diag-svg" role="img" aria-label="Pearson versus Spearman scatter examples">
    <g transform="translate(18,22)">
      <line x1="40" y1="190" x2="218" y2="190" class="d-edge"/>
      <line x1="40" y1="190" x2="40" y2="36" class="d-edge"/>
      <circle cx="60" cy="172" r="3" class="d-node-ink"/><circle cx="78" cy="158" r="3" class="d-node-ink"/><circle cx="98" cy="146" r="3" class="d-node-ink"/><circle cx="118" cy="129" r="3" class="d-node-ink"/><circle cx="138" cy="110" r="3" class="d-node-ink"/><circle cx="158" cy="94" r="3" class="d-node-ink"/><circle cx="178" cy="72" r="3" class="d-node-ink"/><circle cx="198" cy="58" r="3" class="d-node-ink"/>
      <line x1="56" y1="174" x2="202" y2="52" class="d-edge-acc dashed"/>
      <text x="129" y="224" text-anchor="middle" class="d-h-sm">Linear positive</text>
      <text x="129" y="241" text-anchor="middle" class="d-sub">Pearson and Spearman high</text>
    </g>
    <g transform="translate(276,22)">
      <line x1="40" y1="190" x2="218" y2="190" class="d-edge"/>
      <line x1="40" y1="190" x2="40" y2="36" class="d-edge"/>
      <circle cx="58" cy="174" r="3" class="d-node-ink"/><circle cx="78" cy="168" r="3" class="d-node-ink"/><circle cx="98" cy="158" r="3" class="d-node-ink"/><circle cx="118" cy="144" r="3" class="d-node-ink"/><circle cx="138" cy="124" r="3" class="d-node-ink"/><circle cx="158" cy="98" r="3" class="d-node-ink"/><circle cx="178" cy="70" r="3" class="d-node-ink"/><circle cx="198" cy="42" r="3" class="d-node-ink"/>
      <path d="M 56 176 C 104 166, 156 104, 202 40" class="d-edge-acc dashed"/>
      <text x="129" y="224" text-anchor="middle" class="d-h-sm">Monotonic curved</text>
      <text x="129" y="241" text-anchor="middle" class="d-sub">Spearman stronger than Pearson</text>
    </g>
    <g transform="translate(534,22)">
      <line x1="40" y1="190" x2="218" y2="190" class="d-edge"/>
      <line x1="40" y1="190" x2="40" y2="36" class="d-edge"/>
      <circle cx="60" cy="76" r="3" class="d-node-ink"/><circle cx="80" cy="120" r="3" class="d-node-ink"/><circle cx="100" cy="156" r="3" class="d-node-ink"/><circle cx="120" cy="176" r="3" class="d-node-ink"/><circle cx="140" cy="176" r="3" class="d-node-ink"/><circle cx="160" cy="156" r="3" class="d-node-ink"/><circle cx="180" cy="120" r="3" class="d-node-ink"/><circle cx="200" cy="76" r="3" class="d-node-ink"/>
      <path d="M 58 76 C 96 196, 164 196, 202 76" class="d-edge-acc dashed"/>
      <text x="129" y="224" text-anchor="middle" class="d-h-sm">Non-monotonic</text>
      <text x="129" y="241" text-anchor="middle" class="d-sub">correlation can miss structure</text>
    </g>
  </svg>
</figure>

### When Spearman ≈ Pearson
For roughly linear, evenly-spread data, the two are similar. They diverge when:
- The relationship is monotonic but non-linear
- There are outliers (Spearman is more robust — extreme values just become rank 1 or rank n)

---

## Mock Q8 Walkthrough

> "Pearson r = −0.80, Spearman r = −0.75. **Statement:** Below-mean values of the dependent variable are associated with below-mean values of the independent variable. True or false?"

Negative correlation means: **as X goes up, Y goes down**, on average. Equivalently:
- **Above-mean X** → tends to associate with **below-mean Y**
- **Below-mean X** → tends to associate with **above-mean Y**

The statement says below-X ↔ below-Y. That's the **positive** association pattern. With negative correlation, the relationship is opposite.

**Answer: 8a) False.**

### Why Spearman matters in the explanation (Q8b)

Both Pearson (−0.80) and Spearman (−0.75) are strongly negative — so the relationship is **monotonic and decreasing**, not just linearly decreasing. The fact that Spearman is close to Pearson (and both negative) confirms:
- The underlying relationship really is "as X increases, Y decreases" (not an artefact of a few outliers)
- The slight gap (−0.80 vs −0.75) suggests the relationship is reasonably linear (otherwise Spearman would be much stronger in absolute value)

**Sample answer (Q8b, 4 pts):**

> The statement is false. The negative correlation (both Pearson r = −0.80 and Spearman r = −0.75) means below-mean values of X tend to associate with **above-mean** values of Y, not below-mean. The Spearman rank correlation matters here because it confirms the relationship is monotonic (not just locally linear) — both measures are strongly negative, so the inverse relationship is robust and not driven by outliers. If Spearman were near 0 while Pearson was strongly negative, it would suggest a few outliers were driving the linear fit; if Spearman were much more negative than Pearson, it would suggest a non-linear but monotonic decrease.

---

## Properties of Correlation

| Property | Pearson | Spearman |
|---|---|---|
| Captures linear association | ✓ | (only as linearity is also monotonic) |
| Captures non-linear monotonic | ✗ | ✓ |
| Robust to outliers | ✗ | ✓ |
| Needs interval/ratio data | ✓ | only ordinal |
| Range | [−1, 1] | [−1, 1] |
| Invariant to monotonic transforms (e.g., log) | ✗ | ✓ |

### What correlation does NOT tell you
- **Causation** — see [[02 RCTs and Causality]]. Correlation can come from confounders, reverse causation, or coincidence.
- **Functional form** — $r = 0.7$ doesn't tell you the slope of the line
- **Effect size** — depends on units of measurement
- **Anything about a single observation** — correlation is a population-level statistic

### Famous example: Anscombe's Quartet
Four datasets with identical Pearson $r = 0.816$ but radically different shapes:
1. Linear with noise
2. Clear non-linear (parabola)
3. Linear with one influential outlier
4. Vertical cluster with one outlier creating apparent correlation

**Moral:** always plot your data. Correlation alone is misleading.

---

## Independence vs Zero Correlation

**Independent random variables ⇒ Pearson correlation = 0.**

**Pearson correlation = 0 does NOT imply independence.** Classic counter-example: `Y = X²` with `X ~ N(0, 1)`:
- $Cov(X, Y) = E[X³] − E[X]E[X²] = 0 − 0 = 0$
- So Pearson `r = 0`
- But Y is completely determined by X — they're not independent at all

This is the formal version of "correlation only captures linear association".

---

## Correlation and Causation (cross-topic)

The standard exam line:
- **Correlation ≠ causation** — there might be a confounder Z driving both X and Y
- **No correlation ≠ no causation** — relationship might be non-linear, or causal effects might cancel
- **Only RCTs (or rigorous causal inference) establish causation**

See [[02 RCTs and Causality]] for the full treatment.

---

## Conceptual Gotchas

- **Sign matters:** `r = −0.9` is a **strong** correlation. Don't say "weak" because it's negative.
- **Magnitude convention** (loose): `|r| < 0.3` weak, `0.3–0.7` moderate, `>0.7` strong. **Highly domain-dependent.**
- **The same r can mean wildly different things** — see Anscombe's Quartet.
- **Correlation is symmetric:** `corr(X, Y) = corr(Y, X)`. Regression is not.
- **Spearman is a "non-parametric" alternative** — no distributional assumption on X or Y.
- **Don't confuse `r²` with `r`** — `r²` is variance explained (0–1), `r` is correlation (−1 to 1).
- **A correlation can be exactly 0 even when there's a strong relationship** — Y = X² is the textbook example.

---

## Quick Reference

| Concept | Formula / Rule |
|---|---|
| Pearson correlation | $r = cov(X,Y) / (σ_X \cdot σ_Y)$ |
| Spearman correlation | $r_s = Pearson(rank(X), rank(Y))$ |
| Range | [−1, 1] for both |
| Spearman vs Pearson | Pearson = linear; Spearman = monotonic + robust to outliers |
| When Spearman > Pearson (in abs) | Non-linear monotonic relationship |
| When they agree | Approximately linear, evenly-spread data |
| Correlation = 0 implies independence? | No — only if data is jointly normal. In general, no. |
| Independence implies r = 0? | Yes |
