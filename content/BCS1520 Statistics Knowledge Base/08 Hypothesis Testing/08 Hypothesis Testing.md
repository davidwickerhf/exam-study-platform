# Topic 8 — Hypothesis Testing

**Source lectures:** Lecture 8 (Hypothesis Testing)
**Tested by:** Mock Q1i (formulating H₀ / Hₐ), Q1h (ROC AUC interpretation)
**Approximate mock points:** ~5 in mock, but a core lecture topic — could expand in real exam

The mock tests hypothesis testing only lightly (one MC question), but Lecture 8 is dedicated to it and the tutorial has 12 worked exercises. The real exam may weight it more — **don't underestimate this topic**.

---

## What the Exam Asks

1. **Formulate H₀ and Hₐ** correctly given a research claim (Q1i)
2. **Pick one-sided vs two-sided test**
3. **Compute a test statistic** (z or t) and **compare to a critical value**
4. **Interpret a p-value**
5. **Interpret model evaluation metrics** like ROC AUC (Q1h)

---

## The Hypothesis Testing Recipe

Every hypothesis test follows this template:

1. **State H₀ and Hₐ**
   - `H₀` is the **null** (status quo, no difference). Always contains `=`.
   - `Hₐ` (or `H₁`) is the **alternative** (what we're testing for). Contains `<`, `>`, or $\neq$.

2. **Pick significance level α** (default 0.05)

3. **Choose the test statistic** based on:
   - Comparing a mean to a value? → Z (if σ known or n large) or t (if σ unknown and n small)
   - Comparing two means? → two-sample t-test
   - Comparing proportions? → z-test for proportions
   - Comparing distributions? → chi-square (not in this course)

4. **Compute the realised test statistic**:
   $$z = \frac{\bar{x} - \mu_0}{\sigma/\sqrt{n}} \quad \text{or} \quad t = \frac{\bar{x} - \mu_0}{s/\sqrt{n}}$$

5. **Compare to critical value(s) or compute p-value**:
   - **Critical region (reject H₀ if z falls in it):**
     - One-sided $Hₐ: μ > μ₀$: reject if $z > z_α$
     - One-sided $Hₐ: μ < μ₀$: reject if $z < −z_α$
     - Two-sided $Hₐ: μ \neq μ₀$: reject if $|z| > z_{α/2}$
   - **p-value:** probability of observing a result this extreme **if H₀ is true**. Reject H₀ if $p < α$.

6. **State conclusion in context** — e.g., "There is sufficient evidence at α = 0.05 to conclude that the average response time is less than 3.5 minutes."

---

## Mock Q1i Recipe — Formulating H₀ and Hₐ

> "Article says freshmen spend 7.5 hrs/week at parties. Administrator doesn't believe it's that high (her sample mean = 6.6). Which hypothesis aligns?"

Two principles:
1. **H₀ always contains the claim being tested** (`=`) — usually the status quo or the article's claim
2. **Hₐ reflects what the new study is trying to demonstrate** — here, "less than 7.5"

So:
- $H₀: μ = 7.5$ (the article's claim)
- $Hₐ: μ < 7.5$ (one-sided — admin believes it's lower)

**Answer: c) H₀ = 7.5 AND Hₐ: less than 7.5.**

### Common formulation traps
- **Don't anchor H₀ on the sample mean.** H₀ is what you're testing **against**, not what you observed. (Answer b and d use the sample mean — those are wrong.)
- **The direction of Hₐ comes from what's being claimed/suspected**, not from which mean is bigger in the data.
- **$H₀: μ \neq μ₀$** is never valid — H₀ must include equality.

---

## One-Sided vs Two-Sided

| Hₐ phrasing | Test type | Reject H₀ when... |
|---|---|---|
| "μ > μ₀" (higher) | One-sided, right tail | $z > z_α$ |
| "μ < μ₀" (lower) | One-sided, left tail | $z < −z_α$ |
| "μ ≠ μ₀" (different) | Two-sided | $|z| > z_{α/2}$ |

**Critical values for α = 0.05:**
- One-sided: 1.645
- Two-sided: 1.96

<figure class="diag-figure">
  <figcaption>Critical regions: one-sided test spends α in one tail; two-sided splits α across both tails</figcaption>
  <svg viewBox="0 0 760 270" class="diag-svg" role="img" aria-label="One-sided and two-sided hypothesis test critical regions">
    <g transform="translate(20,18)">
      <line x1="38" y1="190" x2="340" y2="190" class="d-edge"/>
      <path d="M 46 190 C 86 188, 112 160, 146 100 C 178 42, 222 42, 254 100 C 288 160, 314 188, 334 190" class="d-edge-acc"/>
      <path d="M 272 190 C 288 160, 314 188, 334 190 Z" class="d-node-dan" opacity="0.65"/>
      <line x1="272" y1="190" x2="272" y2="128" class="d-edge-dan dashed"/>
      <text x="190" y="222" text-anchor="middle" class="d-h-sm">One-sided: Hₐ μ &gt; μ₀</text>
      <text x="272" y="116" text-anchor="middle" class="d-sub">zα = 1.645</text>
      <text x="312" y="172" text-anchor="middle" class="d-label-danger">α</text>
    </g>
    <g transform="translate(400,18)">
      <line x1="38" y1="190" x2="340" y2="190" class="d-edge"/>
      <path d="M 46 190 C 86 188, 112 160, 146 100 C 178 42, 222 42, 254 100 C 288 160, 314 188, 334 190" class="d-edge-acc"/>
      <path d="M 46 190 C 76 188, 95 174, 112 148 L 112 190 Z" class="d-node-dan" opacity="0.65"/>
      <path d="M 268 148 C 286 174, 306 188, 334 190 L 268 190 Z" class="d-node-dan" opacity="0.65"/>
      <line x1="112" y1="190" x2="112" y2="148" class="d-edge-dan dashed"/>
      <line x1="268" y1="190" x2="268" y2="148" class="d-edge-dan dashed"/>
      <text x="190" y="222" text-anchor="middle" class="d-h-sm">Two-sided: Hₐ μ ≠ μ₀</text>
      <text x="112" y="136" text-anchor="middle" class="d-sub">−1.96</text>
      <text x="268" y="136" text-anchor="middle" class="d-sub">+1.96</text>
      <text x="82" y="176" text-anchor="middle" class="d-label-danger">α/2</text>
      <text x="304" y="176" text-anchor="middle" class="d-label-danger">α/2</text>
    </g>
  </svg>
</figure>

**Rule:** if the research question contains a directional word ("more than", "less than", "decreased", "improved"), use **one-sided**. If it's neutral ("different from", "changed"), use **two-sided**.

---

## Z-test vs t-test

| n | σ known? | Test | Critical |
|---|---|---|---|
| large (≥30) | known | Z | z-table |
| large (≥30) | unknown | Z (via CLT, use s ≈ σ) | z-table |
| small (<30) | known | Z | z-table |
| small (<30) | unknown | **t (n−1 df)** | **t-table** |

The exam most often tests Z (CLT applies). t-tests appear when small samples are explicitly given.

> Note: the **t-table is not on the formula sheet** — only z-quantiles 1.645, 1.96, 2.576. If t is needed, you either need it from memory (not feasible) or the question gives it.

---

## p-Value Interpretation

The p-value is **the probability of seeing data this extreme (or more) if H₀ is true**.

- **Small p (< α):** evidence against H₀ — reject
- **Large p (≥ α):** insufficient evidence — fail to reject

### Common p-value misinterpretations to avoid
- ❌ "p is the probability H₀ is true" — Wrong. H₀ is either true or false; p is about the data.
- ❌ "1 − p is the probability Hₐ is true" — Wrong.
- ❌ "Failing to reject H₀ means H₀ is true" — Wrong. We just lack evidence to reject.
- ❌ "Rejecting H₀ means we proved Hₐ" — Wrong. We have evidence consistent with Hₐ.

### Correct one-line interpretations
- p = 0.03 → "Under H₀, the probability of seeing data this extreme is 3%. Since 3% < 5% (our α), we reject H₀."
- p = 0.20 → "Under H₀, this data is not unusual (20% chance). We fail to reject H₀."

---

## Worked Example (from Hypothesis Testing Tutorial Ex 1)

> "New pain reliever: standard takes 3.5 min (σ=2.1). Test n=50, x̄=3.1, s=1.5. Does new drug work faster at α=0.05?"

1. H₀: μ = 3.5; Hₐ: μ < 3.5 (one-sided, looking for faster = lower)
2. α = 0.05; one-sided → critical region $(−\infty , −1.645]$
3. Test statistic: σ unknown, but n=50 is large → use Z with s:
   $z = (3.1 − 3.5) / (1.5/\sqrt 50) = −0.4 / 0.2121 = −1.886$
4. `−1.886 < −1.645` → falls in critical region → **reject H₀**
5. Conclusion: "Sufficient evidence at α = 0.05 that the new drug works faster on average."

---

## Type I and Type II Errors

| | H₀ true | H₀ false |
|---|---|---|
| **Reject H₀** | Type I error (false alarm) — prob = α | Correct (power = 1 − β) |
| **Fail to reject H₀** | Correct | Type II error (miss) — prob = β |

- α (Type I rate) is what you set.
- β (Type II rate) depends on the true effect size and sample size.
- **Power = 1 − β.** More data → more power → smaller β.

---

## ROC and AUC (Mock Q1h)

For a binary classifier:
- **ROC curve:** plot True Positive Rate vs False Positive Rate as you vary the decision threshold
- **AUC** = area under the ROC curve

| AUC | Interpretation |
|---|---|
| 1.0 | Perfect classifier |
| > 0.5 | Better than chance |
| **0.5** | **Chance — model is no better than random guessing** |
| < 0.5 | Worse than chance (could flip labels) |

> Mock Q1h: "AUC = 0.5. This means: ..."
> **Answer: b) Chance level of classifiability.**

<figure class="diag-figure">
  <figcaption>ROC and AUC: chance sits on the diagonal, better classifiers bow toward the top-left</figcaption>
  <svg viewBox="0 0 760 300" class="diag-svg" role="img" aria-label="ROC curve and AUC interpretation">
    <line x1="82" y1="238" x2="330" y2="238" class="d-edge"/>
    <line x1="82" y1="238" x2="82" y2="42" class="d-edge"/>
    <line x1="82" y1="238" x2="330" y2="42" class="d-edge-dan dashed"/>
    <path d="M 82 238 C 116 146, 178 82, 330 42" class="d-edge-acc"/>
    <text x="206" y="270" text-anchor="middle" class="d-sub">False positive rate</text>
    <text x="42" y="144" text-anchor="middle" class="d-sub" transform="rotate(-90 42 144)">True positive rate</text>
    <text x="252" y="112" class="d-label-accent">better than chance</text>
    <text x="212" y="170" class="d-label-danger">AUC = 0.5 diagonal</text>

    <rect x="430" y="58" width="240" height="164" class="d-node"/>
    <text x="550" y="90" text-anchor="middle" class="d-h-sm">AUC reading</text>
    <text x="466" y="120" class="d-sub">1.0 → perfect</text>
    <text x="466" y="144" class="d-sub">0.5 → random guessing</text>
    <text x="466" y="168" class="d-sub">&lt;0.5 → worse than chance</text>
    <text x="466" y="192" class="d-sub">Threshold changes move along ROC</text>
  </svg>
</figure>

Other terms:
- **Sensitivity** (true positive rate) — fraction of actual positives correctly identified
- **Specificity** (true negative rate) — fraction of actual negatives correctly identified
- **Accuracy** — fraction of all correct predictions
- **Precision** — fraction of predicted positives that are correct

---

## Conceptual Gotchas

- **H₀ is what you assume true to compute the p-value.** It includes the `=` sign.
- **Failing to reject H₀ is not the same as proving H₀.** Statistics can never "prove" the null.
- **Statistical significance ≠ practical significance.** Tiny effects with huge samples can be "significant" but irrelevant.
- **p-values are continuous, not binary.** α = 0.05 is a convention; p = 0.049 vs p = 0.051 is essentially the same evidence.
- **Multiple testing inflates Type I rate.** Same as for CIs. Bonferroni applies.
- **CI ↔ test equivalence:** if 0 (or μ₀) is outside the 95% CI, you'd reject H₀ at α = 0.05 (two-sided).
- **One-sided tests are more powerful** for the directional hypothesis but only valid if the direction was decided **before** seeing data.

---

## Quick Reference

| Question type | Recipe |
|---|---|
| Formulate H₀ and Hₐ | H₀ contains `=` and the claim; Hₐ is the directional alternative |
| One-sided or two-sided? | Directional words → one-sided; "different from" → two-sided |
| Reject H₀? | Compare test stat to z_α (one-sided) or z_{α/2} (two-sided), OR compare p-value to α |
| Z-test stat (one-sample mean) | $z = (x̄ − μ₀) / (σ/\sqrt n)$ or $s/\sqrt n$ |
| Use t instead of z when... | n < 30 AND σ unknown |
| AUC = 0.5 means... | Chance — model is no better than random |
| p-value definition | P(data this extreme | H₀ true) — NOT P(H₀ true) |
| Type I error | Reject true H₀ — prob = α |
| Type II error | Accept false H₀ — prob = β |
