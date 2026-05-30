# Topic 6 — Distributions, CLT and Sampling

**Source lectures:** Lecture 6 (Probability and Statistics part 1), Lecture 7 (part 2)
**Tested by:** Mock Q1c (bell curve, 1.25 SDs), Q1g (CLT applies to what), Q6 (cereal box — CI + standards compliance, 12 pts)
**Approximate mock points:** ~14

This is the largest practical-question topic in the exam. The cereal box question (Q6, 12 pts) is the **highest-value single question on the mock** besides multi-choice.

---

## What the Exam Asks

1. Use the **68-95-99.7 rule** for the normal distribution (Q1c)
2. Identify what the **CLT** applies to (Q1g)
3. **Compute a confidence interval** for the mean using the Z-score (Q6a)
4. **Standardise to a Z-score and look up a tail probability** to check if a process meets a spec (Q6b)

---

## The Normal Distribution

A continuous distribution $N(μ, σ²)$ where:
- $μ$ = mean (centre)
- $σ$ = standard deviation (spread)
- $Var(X) = σ²$

The pdf is bell-shaped, symmetric around $μ$.

### The 68-95-99.7 rule (not on the formula sheet — memorise)
For a normal distribution:
| Interval | Probability covered |
|---|---|
| $μ \pm 1σ$ | 68% |
| $μ \pm 2σ$ | 95% |
| $μ \pm 3σ$ | 99.7% |

So:
- ~16% of values are below $μ − σ$ (and 16% above $μ + σ$)
- ~2.5% below $μ − 2σ$ (and 2.5% above)
- ~0.15% below $μ − 3σ$

<figure class="diag-figure">
  <figcaption>Normal distribution: 68-95-99.7 rule and tail areas</figcaption>
  <svg viewBox="0 0 760 270" class="diag-svg" role="img" aria-label="Normal distribution empirical rule">
    <path d="M 55 210 L 705 210" class="d-edge"/>
    <path d="M 70 210 C 126 208, 152 198, 190 172 C 228 146, 250 98, 300 58 C 350 18, 410 18, 460 58 C 510 98, 532 146, 570 172 C 608 198, 634 208, 690 210" class="d-edge-acc"/>
    <path d="M 302 210 C 330 72, 430 72, 458 210 Z" class="d-node-acc" opacity="0.62"/>
    <path d="M 235 210 C 258 136, 288 78, 302 58 C 330 72, 430 72, 458 58 C 472 78, 502 136, 525 210 Z" class="d-node" opacity="0.40"/>
    <path d="M 170 210 C 200 185, 218 156, 235 120 C 258 136, 288 78, 302 58 C 330 72, 430 72, 458 58 C 472 78, 502 136, 525 120 C 542 156, 560 185, 590 210 Z" class="d-node" opacity="0.25"/>
    <line x1="380" y1="210" x2="380" y2="34" class="d-edge dashed"/>
    <line x1="302" y1="210" x2="302" y2="58" class="d-edge dashed"/>
    <line x1="458" y1="210" x2="458" y2="58" class="d-edge dashed"/>
    <line x1="235" y1="210" x2="235" y2="120" class="d-edge dashed"/>
    <line x1="525" y1="210" x2="525" y2="120" class="d-edge dashed"/>
    <line x1="170" y1="210" x2="170" y2="190" class="d-edge dashed"/>
    <line x1="590" y1="210" x2="590" y2="190" class="d-edge dashed"/>
    <text x="380" y="236" text-anchor="middle" class="d-mono">μ</text>
    <text x="302" y="236" text-anchor="middle" class="d-mono">−1σ</text>
    <text x="458" y="236" text-anchor="middle" class="d-mono">+1σ</text>
    <text x="235" y="236" text-anchor="middle" class="d-mono">−2σ</text>
    <text x="525" y="236" text-anchor="middle" class="d-mono">+2σ</text>
    <text x="170" y="236" text-anchor="middle" class="d-mono">−3σ</text>
    <text x="590" y="236" text-anchor="middle" class="d-mono">+3σ</text>
    <text x="380" y="95" text-anchor="middle" class="d-h-sm">68%</text>
    <text x="380" y="142" text-anchor="middle" class="d-h-sm">95%</text>
    <text x="380" y="186" text-anchor="middle" class="d-h-sm">99.7%</text>
    <text x="116" y="203" text-anchor="middle" class="d-sub">0.15%</text>
    <text x="644" y="203" text-anchor="middle" class="d-sub">0.15%</text>
  </svg>
</figure>

### Z-score (standardisation)
$$Z = \frac{X - \mu}{\sigma}, \qquad Z \sim N(0, 1)$$

Once you've standardised, you can use the standard normal table (or memorised quantiles) to look up probabilities.

### Memorised z-quantiles (from the formula sheet)
| α | z_{α/2} | z_{1−α/2} | Used for |
|---|---|---|---|
| 0.10 | −1.645 | 1.645 | 90% CI |
| **0.05** | **−1.96** | **1.96** | **95% CI** — the default |
| 0.01 | −2.576 | 2.576 | 99% CI |

For one-sided tests, the threshold is $z_α$ (not $z_{α/2}$):
- $z_{0.05} = 1.645$ (one-sided at α=0.05)
- $z_{0.025} = 1.96$ (one-sided at α=0.025, or two-sided at α=0.05)

---

## Mock Q1c — 68-95-99.7 in Action

> "26 test scores with mean 50, SD 10. Assume bell curve. How many scores are 1.25 SDs or more away from the mean?"

Bell curve assumption: scores ~ N(50, 100), so |Z| > 1.25 has probability... look up the tail.

For Z ~ N(0,1):
- $P(|Z| > 1.25) = 2 × P(Z > 1.25)$
- From the standard normal table, $P(Z > 1.25) ≈ 0.106$ (since $P(Z \leq 1.25) ≈ 0.894$)
- $P(|Z| > 1.25) ≈ 0.212$

Expected count: $26 × 0.212 ≈ 5.5 \to ≈ 6 observations$. **Answer: b) 6 observations.**

> **Without a Z-table on the formula sheet** (only 1.645, 1.96, 2.576 are listed), you have to either:
> 1. Bring memory of $P(|Z| > 1.25) ≈ 0.21$, or
> 2. Use the DACS calculator's normal-CDF function, or
> 3. Interpolate from the 68-95-99.7 rule (this would only give a rough estimate)

**Practical exam tip:** be familiar with a few extra z-values:
- $P(|Z| > 0.5) ≈ 0.617$ → 62%
- $P(|Z| > 1.0) ≈ 0.317$ → 32%
- $P(|Z| > 1.25) ≈ 0.21$ → 21%
- $P(|Z| > 1.5) ≈ 0.134$ → 13%
- $P(|Z| > 2.0) ≈ 0.046$ → 5%

---

## Central Limit Theorem (CLT)

**Statement (from the formula sheet):**
$$\lim_{n \to \infty} \bar{x} \sim N\left(\mu, \frac{\sigma}{\sqrt{n}}\right)$$

where $SE = σ/\sqrt n$ is the **standard error of the mean**.

**Translation:**
- Take a population with **any** distribution (mean $μ$, SD $σ$)
- Take a sample of size `n`, compute the sample mean `x̄`
- Repeat (conceptually) many times
- The distribution of `x̄` is **approximately normal** with mean $μ$ and SD $σ/\sqrt n$ — provided `n` is large enough

<figure class="diag-figure">
  <figcaption>Central Limit Theorem: raw data may be skewed, sample means become normal and narrower</figcaption>
  <svg viewBox="0 0 760 260" class="diag-svg" role="img" aria-label="Central Limit Theorem visualization">
    <line x1="46" y1="200" x2="214" y2="200" class="d-edge"/>
    <path d="M 54 198 C 70 188, 82 132, 100 92 C 120 48, 158 68, 174 108 C 192 152, 196 184, 208 198" class="d-edge-dan"/>
    <text x="130" y="226" text-anchor="middle" class="d-h-sm">Population</text>
    <text x="130" y="242" text-anchor="middle" class="d-sub">can be skewed</text>

    <rect x="286" y="54" width="188" height="48" class="d-node"/>
    <text x="380" y="76" text-anchor="middle" class="d-h-sm">Take many samples</text>
    <text x="380" y="94" text-anchor="middle" class="d-sub">compute x̄ each time</text>
    <path d="M 220 132 L 282 82" class="d-edge" marker-end="url(#arr-g-clt)"/>
    <path d="M 478 82 L 538 132" class="d-edge" marker-end="url(#arr-g-clt)"/>
    <defs>
      <marker id="arr-g-clt" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>

    <line x1="546" y1="200" x2="714" y2="200" class="d-edge"/>
    <path d="M 550 200 C 586 198, 600 148, 628 98 C 654 52, 686 148, 710 200" class="d-edge-acc"/>
    <path d="M 596 200 C 608 142, 648 74, 674 200 Z" class="d-node-acc" opacity="0.45"/>
    <text x="630" y="226" text-anchor="middle" class="d-h-sm">Sampling distribution</text>
    <text x="630" y="242" text-anchor="middle" class="d-sub">x̄ ≈ Normal, SE = σ/√n</text>
  </svg>
</figure>

### What CLT applies to (Mock Q1g)
The CLT is about the distribution of **sample means** (or sample sums), **not**:
- The raw data (could be anything)
- The population parameters (these are fixed, not random)
- The root mean squared error (different concept)

**Answer to Q1g: c) Sample means.**

### Rule of thumb for "n large enough"
- If the population is roughly normal, even small `n` works
- If the population is skewed or has outliers, $n \geq 30$ is the conventional cutoff
- For very skewed populations, you may need $n \geq 100$ or more

### Why CLT matters
It justifies treating sample-mean-based statistics (confidence intervals, hypothesis tests) as normal even when we don't know the population distribution.

---

## Standard Error vs Standard Deviation

| Term | What it measures | Formula |
|---|---|---|
| **SD (population)** $σ$ | Spread of individual observations in the population | Given or known |
| **Sample SD** `s` | Spread of individual observations in a sample | $s = \sqrt [(1/(n−1)) Σ (xᵢ − x̄)²]$ |
| **SE of the mean** | Spread of the sample mean across repeated samples | $σ/\sqrt n$ (or $s/\sqrt n$ when σ unknown) |

**Don't confuse them.** SE = SD/√n, so SE → 0 as n grows. SD does not.

---

## Mock Q6 — Cereal Box (12 pts)

> "Filling machine, normally distributed, known σ = 4 grams, sample of 16 boxes, sample mean 211g. (a) 95% CI for mean. (b) Does it meet spec ≤ 5/1000 boxes under 200g?"

### Q6a — 95% CI for the mean (4 pts)

Use the formula sheet's CI for a mean (σ known):
$$\bar{x} \pm z_{\alpha/2} \cdot \frac{\sigma}{\sqrt{n}}$$

- `x̄ = 211`, $σ = 4$, $n = 16$, $z_{0.025} = 1.96$
- SE = $4 / \sqrt 16 = 4 / 4 = 1$
- Margin = $1.96 × 1 = 1.96$
- 95% CI = `[211 − 1.96, 211 + 1.96] = [209.04, 212.96]`

### Q6b — Does the machine meet the spec? (8 pts)

The spec: at most 5/1000 boxes under 200g, i.e., $P(X < 200) \leq 0.005$.

The machine fills with $X ~ N(μ = 211, σ² = 16)$. Standardise:
$$Z = \frac{200 - 211}{4} = -2.75$$

Look up $P(Z < −2.75)$:
- From memory: $P(Z < −2.576) = 0.005$ exactly (that's the 99% CI quantile)
- $P(Z < −2.75) < 0.005$

So **yes, the machine meets the spec** (in fact, exceeds it).

> The mock grading scheme phrases this as: "P(Z < z) ≤ 0.005 requires z ≤ −2.576. Since −2.75 < −2.576, the requirement is met."

---

## Other Useful Distributions

| Distribution | When used in this course |
|---|---|
| **Bernoulli(p)** | Single yes/no trial |
| **Binomial(n, p)** | Count of successes in n trials |
| **Normal(μ, σ²)** | Continuous data, sample means via CLT |
| **t-distribution** | Sample mean when σ unknown AND n small (typically n < 30) |
| **Uniform(a, b)** | All values equally likely on [a, b] |

The **t-distribution** has heavier tails than normal. As $n \to \infty$, t → normal. Only used implicitly in this course (not on the formula sheet) but you should know "if `n < 30` and σ unknown → use t".

---

## Conceptual Gotchas

- **The CLT is about the sample mean, not the raw data.** Sample mean → normal regardless of original distribution shape.
- **SD vs SE:** SD measures individual spread; SE measures how precisely we estimate the mean. SE shrinks with √n; SD does not.
- **Z-score sign matters:** $Z = (X − μ)/σ$. A negative Z means below the mean. The tail probability $P(Z < z)$ is what's tabulated.
- **The normal distribution is symmetric**, so $P(Z < −a) = P(Z > a) = 1 − P(Z < a)$.
- **For a 95% CI, the multiplier is 1.96, not 2** — using 2 is a rough approximation. Use 1.96 unless asked otherwise.
- **$σ known vs unknown$** changes the formula: σ known → z-score; σ unknown + small n → t-statistic with n−1 df.
- **Variance scales with `n` for sums, with `1/n` for means.** $Var(Σ Xᵢ) = nσ²$; $Var(x̄) = σ²/n$ → $SE = σ/\sqrt n$.

---

## Quick Reference

| Concept | Formula |
|---|---|
| Standardise | $Z = (X − μ)/σ$, Z ~ N(0,1) |
| SE of mean | $σ/\sqrt n$ (or $s/\sqrt n$ if σ unknown) |
| CLT | $x̄ \to N(μ, σ²/n)$ as $n \to \infty$ |
| 68-95-99.7 | $μ \pm 1σ \to 68%$, $\pm 2σ \to 95%$, $\pm 3σ \to 99.7%$ |
| Critical z's | 1.645 (90%), **1.96 (95%)**, 2.576 (99%) |
| CI for mean (σ known) | $x̄ \pm z_{α/2} \cdot σ/\sqrt n$ |
| CI for proportion | $p̂ \pm z_{α/2} \cdot \sqrt (p̂(1−p̂)/n)$ |
| When CLT applies | Sample means (not raw data, not parameters) |
| When to use t | σ unknown AND n < 30 |
