# Topic 7 — Confidence Intervals

**Source lectures:** Lecture 7 (Probability and Statistics part 2)
**Tested by:** Mock Q5 (video game proportions, 12 pts: 8 + 4)
**Approximate mock points:** 12

---

## What the Exam Asks

1. **Construct a 95% CI for one or more proportions** using the formula sheet (Q5a)
2. **Explain why the chance "at least one CI misses the true value" exceeds α**, when you build multiple CIs (Q5b — multiple-testing correction)

CI for the mean is tested in [[06 Distributions CLT and Sampling|Topic 6 (Q6a, cereal box)]].

---

## Formulas from the Sheet

### Generic CI
$$\hat{\theta} \pm K \cdot SE$$

where $θ̂$ is a point estimate and `K` is the critical value from the appropriate distribution (typically z or t).

### CI for the mean (σ known)
$$\bar{x} \pm z_{\alpha/2} \cdot \frac{\sigma}{\sqrt{n}}$$

### CI for the mean (σ unknown, large n via CLT)
Replace σ with the sample SD `s`:
$$\bar{x} \pm z_{\alpha/2} \cdot \frac{s}{\sqrt{n}}$$

### CI for a proportion
$$\hat{p} \pm z_{\alpha/2} \sqrt{\frac{\hat{p}(1-\hat{p})}{n}}$$

**Where p̂ comes from:** if 70% of a sample play racing games, `p̂ = 0.70`.

### Critical values
| Confidence | α | z_{α/2} |
|---|---|---|
| 90% | 0.10 | 1.645 |
| **95%** | 0.05 | **1.96** |
| 99% | 0.01 | 2.576 |

---

## Mock Q5a — Three Proportion CIs (8 pts)

> "Survey of 1200 teens: 70% play racing, 65% sports, 61% rhythm. Give a 95% CI for each."

Formula: $p̂ \pm 1.96 \cdot \sqrt (p̂(1−p̂)/n)$

**Racing (p̂ = 0.70, n = 1200):**
- $SE = \sqrt (0.70 × 0.30 / 1200) = \sqrt (0.000175) ≈ 0.01323$
- Margin = $1.96 × 0.01323 ≈ 0.0259$
- CI = `[0.674, 0.726]`

**Sports (p̂ = 0.65, n = 1200):**
- $SE = \sqrt (0.65 × 0.35 / 1200) = \sqrt (0.0001896) ≈ 0.01377$
- Margin = $1.96 × 0.01377 ≈ 0.0270$
- CI = `[0.623, 0.677]`

**Rhythm (p̂ = 0.61, n = 1200):**
- $SE = \sqrt (0.61 × 0.39 / 1200) = \sqrt (0.0001983) ≈ 0.01408$
- Margin = $1.96 × 0.01408 ≈ 0.0276$
- CI = `[0.582, 0.638]`

**Always state the formula and why it applies before computing** — the grading scheme rewards motivation.

---

## Mock Q5b — Multiple-Testing α Inflation (4 pts)

> "Explain why the chance that at least one of your intervals does not contain the true value is greater than the α = 5% we set."

**Conceptual answer:**

Each CI individually has a 5% chance of missing its true parameter. With multiple independent intervals:
- Chance that ALL contain truth = $(1 − α)^k = 0.95³ ≈ 0.857$
- Chance that **at least one misses** = `1 − 0.857 ≈ 14.3%`

So when constructing 3 CIs at α = 0.05 each, the **family-wise error rate** is ~14%, not 5%.

This is the **multiple-testing problem** — also called the **multiple comparisons** problem.

<figure class="diag-figure">
  <figcaption>Multiple CIs: the chance of at least one miss accumulates</figcaption>
  <svg viewBox="0 0 760 220" class="diag-svg" role="img" aria-label="Family-wise error for multiple confidence intervals">
    <defs>
      <marker id="arr-g-ci" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="52" y="58" width="150" height="70" class="d-node-acc"/>
    <text x="127" y="86" text-anchor="middle" class="d-h-sm">CI 1</text>
    <text x="127" y="108" text-anchor="middle" class="d-sub">95% covers truth</text>
    <rect x="226" y="58" width="150" height="70" class="d-node-acc"/>
    <text x="301" y="86" text-anchor="middle" class="d-h-sm">CI 2</text>
    <text x="301" y="108" text-anchor="middle" class="d-sub">95% covers truth</text>
    <rect x="400" y="58" width="150" height="70" class="d-node-acc"/>
    <text x="475" y="86" text-anchor="middle" class="d-h-sm">CI 3</text>
    <text x="475" y="108" text-anchor="middle" class="d-sub">95% covers truth</text>
    <path d="M 202 94 L 224 94" class="d-edge" marker-end="url(#arr-g-ci)"/>
    <path d="M 376 94 L 398 94" class="d-edge" marker-end="url(#arr-g-ci)"/>
    <rect x="588" y="44" width="130" height="98" class="d-node-dan"/>
    <text x="653" y="72" text-anchor="middle" class="d-h-sm">Any miss?</text>
    <text x="653" y="96" text-anchor="middle" class="d-sub">1 − 0.95³</text>
    <text x="653" y="116" text-anchor="middle" class="d-h-sm">≈ 14.3%</text>
    <text x="380" y="178" text-anchor="middle" class="d-label-danger">Three 95% intervals do not jointly give a 95% family guarantee.</text>
  </svg>
</figure>

### Corrections
- **Bonferroni correction:** use $α/k$ for each CI to keep the family-wise rate at α. For k=3, use α' = 0.05/3 ≈ 0.0167 → use z = 2.39 instead of 1.96.
- **Other methods:** Holm-Bonferroni, Benjamini-Hochberg (FDR) — not required for this course.

### Caveat about independence
The intervals here are based on the same survey, so they are **not strictly independent** — the bound above assumes independence and gives an upper estimate of the family-wise rate. For a tight bound, you'd use Bonferroni (which holds regardless of dependence).

**One-line exam answer:** "Each interval misses 5% of the time. Across 3 intervals (assuming independence), the chance that at least one misses is `1 − 0.95³ ≈ 14%`, not 5%. This is the multiple-testing problem and can be addressed by tightening α (e.g., Bonferroni)."

---

## Recipe — When to Use Which CI

| Scenario | Use | Reason |
|---|---|---|
| Mean, σ known | $x̄ \pm z_{α/2} \cdot σ/\sqrt n$ | Z is exact |
| Mean, σ unknown, large n (≥30) | $x̄ \pm z_{α/2} \cdot s/\sqrt n$ | CLT + s ≈ σ |
| Mean, σ unknown, small n (<30) | $x̄ \pm t_{n−1, α/2} \cdot s/\sqrt n$ | t-distribution accounts for σ uncertainty |
| Proportion | $p̂ \pm z_{α/2} \cdot \sqrt (p̂(1−p̂)/n)$ | normal approx of binomial (n large enough) |

**Note:** The t-distribution is not on the formula sheet, but the rule is: small n + unknown σ → use t.

---

## What a CI Actually Means

> "95% CI" does **not** mean "there's a 95% chance the true parameter is in this interval."

The true parameter is fixed (unknown but not random). The interval is random. The correct interpretation:

**"If we repeated this procedure many times, 95% of the resulting intervals would contain the true parameter."**

<figure class="diag-figure">
  <figcaption>CI interpretation: the true parameter is fixed, the interval moves from sample to sample</figcaption>
  <svg viewBox="0 0 760 300" class="diag-svg" role="img" aria-label="Repeated confidence intervals covering a fixed parameter">
    <line x1="380" y1="28" x2="380" y2="268" class="d-edge-acc dashed"/>
    <text x="388" y="22" class="d-label-accent">true parameter θ</text>
    <line x1="295" y1="58" x2="452" y2="58" class="d-edge"/>
    <circle cx="374" cy="58" r="4" class="d-node-acc"/>
    <line x1="330" y1="86" x2="462" y2="86" class="d-edge"/>
    <circle cx="396" cy="86" r="4" class="d-node-acc"/>
    <line x1="252" y1="114" x2="391" y2="114" class="d-edge"/>
    <circle cx="322" cy="114" r="4" class="d-node-acc"/>
    <line x1="342" y1="142" x2="492" y2="142" class="d-edge"/>
    <circle cx="417" cy="142" r="4" class="d-node-acc"/>
    <line x1="230" y1="170" x2="350" y2="170" class="d-edge-dan"/>
    <circle cx="290" cy="170" r="4" class="d-node-dan"/>
    <line x1="318" y1="198" x2="442" y2="198" class="d-edge"/>
    <circle cx="380" cy="198" r="4" class="d-node-acc"/>
    <line x1="362" y1="226" x2="528" y2="226" class="d-edge"/>
    <circle cx="445" cy="226" r="4" class="d-node-acc"/>
    <line x1="276" y1="254" x2="420" y2="254" class="d-edge"/>
    <circle cx="348" cy="254" r="4" class="d-node-acc"/>
    <rect x="42" y="84" width="160" height="76" class="d-node"/>
    <text x="122" y="110" text-anchor="middle" class="d-h-sm">Each interval</text>
    <text x="122" y="128" text-anchor="middle" class="d-sub">is random because</text>
    <text x="122" y="144" text-anchor="middle" class="d-sub">the sample changes</text>
    <rect x="550" y="84" width="166" height="92" class="d-node-dan"/>
    <text x="633" y="110" text-anchor="middle" class="d-h-sm">One miss</text>
    <text x="633" y="128" text-anchor="middle" class="d-sub">does not contain θ</text>
    <text x="633" y="149" text-anchor="middle" class="d-sub">95% refers to the</text>
    <text x="633" y="165" text-anchor="middle" class="d-sub">procedure, not this line</text>
  </svg>
</figure>

Subtle, but the exam may test this in multi-choice. Avoid the wording "probability the parameter is in this interval".

---

## CI ↔ Hypothesis Test Connection

A 95% CI and a 5% two-sided hypothesis test give the same conclusion:
- If the null hypothesised value $μ₀$ falls **outside** the CI → reject H₀
- If $μ₀$ falls **inside** the CI → fail to reject H₀

> Mock-style example (CI tutorial, Exercise 6): "90% CI for concurrent users is [36.2, 39.2]. Does the data provide evidence that mean > 35?"
> Yes — 35 is below the lower bound, so we'd reject H₀: μ = 35 at α = 0.10 (one-sided 0.05).

---

## Sample Size Calculation

Sometimes asked: "how large should `n` be to get margin of error ≤ E?"

For a mean (σ known):
$$\text{Margin} = z_{\alpha/2} \cdot \frac{\sigma}{\sqrt{n}} \leq E$$
$$n \geq \left(\frac{z_{\alpha/2} \cdot \sigma}{E}\right)^2$$

> Example (CI tutorial Ex 4b): "92% CI within ±0.25 minutes, σ = 3.6. Find n."
> 92% → z = 1.75. $n \geq (1.75 × 3.6 / 0.25)² ≈ 636$.

For a proportion:
$$n \geq \left(\frac{z_{\alpha/2}}{E}\right)^2 \cdot \hat{p}(1 - \hat{p})$$

Worst case (`p̂ = 0.5`): $n \geq (z/(2E))²$.

---

## Conceptual Gotchas

- **A CI is about the parameter, not future observations.** Don't confuse with prediction intervals.
- **The interval has fixed width** for a given α, n, σ — narrower with more data, wider for higher confidence.
- **For a proportion CI, `p̂(1−p̂)` is maximised at p̂ = 0.5** — CIs for proportions near 50% are widest.
- **A wider CI is more "confident" in the trivial sense** (it definitely contains the truth) but **less informative** — you've gained certainty at the cost of precision.
- **Sample size scales quadratically with precision** — halving the margin requires 4× the sample.
- **For very small p̂ (or close to 1), the normal approximation breaks down** — exact methods like Clopper-Pearson exist but aren't tested here.
- **A 95% CI from one sample is NOT "right 95% of the time"** — it's either right or wrong, you just don't know which. The "95%" is about the long-run frequency of the procedure.

---

## Quick Reference

| Question phrasing | Recipe |
|---|---|
| "95% CI for a mean, σ known" | $x̄ \pm 1.96 \cdot σ/\sqrt n$ |
| "95% CI for a mean, σ unknown, large n" | $x̄ \pm 1.96 \cdot s/\sqrt n$ |
| "95% CI for a proportion" | $p̂ \pm 1.96 \cdot \sqrt (p̂(1−p̂)/n)$ |
| "How big must n be for ±E margin?" | $n \geq (z\cdot σ/E)²$ |
| "Multiple CIs — does α inflate?" | Yes, family-wise rate = 1 − (1−α)^k. Use Bonferroni (α/k) if you care about family-wise. |
| "How to interpret a CI?" | "If we repeated the procedure, 95% of the intervals would cover the true value" — NOT "95% chance the truth is in this interval." |
