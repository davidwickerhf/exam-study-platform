# Topic 4 — Probability Theory

**Source lectures:** Lectures 4 and 5 (Probability Theory I and II)
**Tested by:** Mock Q1f (confidence-limits intuition), Q1l (continuous distribution expectation)
**Approximate mock points:** ~5

This topic is mostly **background for everything else** (Bayes, distributions, CI, hypothesis tests). The mock tests it lightly, but the concepts underpin Q3, Q5, Q6, Q9.

---

## What the Exam Asks

1. Apply probability axioms (union, intersection, complement, independence)
2. Compute expectation of a continuous random variable from its pdf (Q1l)
3. Reason about how sample size affects sampling variation (Q1f)
4. Recognise when two events are independent

---

## Sample Space, Events, Outcomes

- **Sample space `S`** = set of all possible outcomes (e.g., two dice: `{(1,1), (1,2), ..., (6,6)}`)
- **Event `E`** = subset of the sample space
- **$P(E)$** ∈ [0, 1]
- **Complement:** $P(~A) = P(A^c) = 1 − P(A)$

### Set operations
- $A \cup B$ ("or"): occurs if A or B (or both) occur
- $A \cap B$ ("and"): both A and B occur
- $A \cap B = ∅$: mutually exclusive (disjoint)

---

## Probability Axioms (Formula Sheet)

### Union rule
- **Mutually exclusive:** $P(E₁ \cup E₂) = P(E₁) + P(E₂)$ if $E₁ \cap E₂ = ∅$
- **General:** $P(E₁ \cup E₂) = P(E₁) + P(E₂) − P(E₁ \cap E₂)$

### Independence
Two events `E₁`, `E₂` are independent iff:
$$P(E_1 \cap E_2) = P(E_1) \cdot P(E_2)$$

**Independence ≠ mutually exclusive.** If two events are mutually exclusive *and* both have nonzero probability, they are **dependent** (knowing one happened tells you the other didn't).

---

## Discrete Random Variables

A discrete RV `X` has a finite or countable set of values. Specified by a **probability mass function**:
$$P(X = x) = f(x), \qquad \sum_x f(x) = 1$$

### Expectation (mean)
$$E[X] = \mu_X = \sum_x x \cdot P(X = x)$$

### Variance
$$\text{Var}(X) = E[(X - \mu_X)^2] = \sum_x (x - \mu_X)^2 P(X = x)$$

Computational form: $Var(X) = E[X²] − (E[X])²$

### Common discrete distributions
| Distribution | When | E[X] | Var(X) |
|---|---|---|---|
| **Bernoulli(p)** | Single yes/no trial, prob p of success | `p` | `p(1−p)` |
| **Binomial(n, p)** | n independent Bernoulli trials | `np` | `np(1−p)` |

---

## Continuous Random Variables

A continuous RV `X` is specified by a **probability density function** `f(x)`:
- $f(x) \geq 0$
- $∫_{−\infty }^{\infty } f(x) dx = 1$
- $P(a \leq X \leq b) = ∫_a^b f(x) dx$

> Note: $P(X = x) = 0$ for any single point — only intervals have nonzero probability.

<figure class="diag-figure">
  <figcaption>Continuous probability is area under the density, not height at one point</figcaption>
  <svg viewBox="0 0 760 250" class="diag-svg" role="img" aria-label="PDF area and CDF interpretation">
    <path d="M 50 198 L 710 198" class="d-edge"/>
    <path d="M 70 198 L 70 40" class="d-edge"/>
    <path d="M 82 196 C 142 192, 158 164, 194 120 C 230 76, 274 66, 316 108 C 356 148, 388 170, 458 142 C 518 118, 578 124, 676 188" class="d-edge-acc"/>
    <path d="M 220 198 L 220 95 C 250 72, 282 78, 316 108 C 346 138, 372 158, 404 160 L 404 198 Z" class="d-node-acc" opacity="0.65"/>
    <line x1="220" y1="198" x2="220" y2="96" class="d-edge"/>
    <line x1="404" y1="198" x2="404" y2="160" class="d-edge"/>
    <text x="220" y="219" text-anchor="middle" class="d-mono">a</text>
    <text x="404" y="219" text-anchor="middle" class="d-mono">b</text>
    <text x="312" y="92" text-anchor="middle" class="d-h-sm">P(a ≤ X ≤ b)</text>
    <text x="312" y="111" text-anchor="middle" class="d-sub">area = ∫[a,b] f(x) dx</text>
    <circle cx="512" cy="133" r="4" class="d-node-dan"/>
    <line x1="512" y1="198" x2="512" y2="133" class="d-edge-dan dashed"/>
    <text x="580" y="130" class="d-label-danger">single point has area 0</text>
    <text x="580" y="148" class="d-sub">P(X = x) = 0</text>
  </svg>
</figure>

### Cumulative Distribution Function (CDF)
$$F(x) = P(X \leq x) = \int_{-\infty}^x f(t) \, dt$$

$P(a \leq X \leq b) = F(b) − F(a)$.

### Expectation (continuous)
$$E[X] = \int_{-\infty}^{\infty} x \cdot f(x) \, dx$$

### Mock Q1l — Worked example
$f(x) = (7 − 2x)/2$ for $2 \leq x \leq 3$, else 0.

First, verify it's a valid pdf:
$$\int_2^3 \frac{7-2x}{2} dx = \frac{1}{2}\left[7x - x^2\right]_2^3 = \frac{1}{2}[(21-9) - (14-4)] = \frac{1}{2}[12-10] = 1 \checkmark$$

Compute the mean:
$$E[X] = \int_2^3 x \cdot \frac{7-2x}{2} dx = \frac{1}{2}\int_2^3 (7x - 2x^2) dx = \frac{1}{2}\left[\frac{7x^2}{2} - \frac{2x^3}{3}\right]_2^3$$

$$= \frac{1}{2}\left[\left(\frac{63}{2} - 18\right) - \left(14 - \frac{16}{3}\right)\right] = \frac{1}{2}\left[\frac{27}{2} - \frac{26}{3}\right] = \frac{1}{2} \cdot \frac{81 - 52}{6} = \frac{29}{12} \approx 2.417$$

**Answer: b) 2.417.**

---

## Sample Size and Sampling Variation (Mock Q1f)

> "5 more red marbles than blue, drawn with replacement, win if red > blue. 100 vs 200 draws — which gives better chance of winning?"

This tests intuition about **how spread shrinks with `n`**.

Let `p` = probability of red on a single draw (some value > 0.5 because there are 5 more reds — though we don't know total count). With replacement, each draw is an independent Bernoulli(p). After `n` draws:
- $E[reds] = np$, $E[blues] = n(1−p)$
- The proportion `p̂ = reds/n` has $SE = \sqrt (p(1−p)/n)$, which **decreases as `n` increases**

You win if `reds > blues`, equivalent to `p̂ > 0.5`. Since `p > 0.5`, this is more likely the more concentrated `p̂` is around `p` (i.e., the smaller the SE).

So **more draws = narrower distribution around `p` = higher chance `p̂ > 0.5`**.

> **But wait:** the formula sheet hint mentions confidence limits. With **only 100 draws** the SE is wider — meaning the **actual outcome** can swing more, including swinging to the *favourable* side (`p̂ ≫ 0.5`) more often.
>
> Yet for a *true* advantage (`p > 0.5`), large `n` always makes `p̂ > 0.5` more likely. With small `n`, there's more variance — symmetric around `p` — so you might get a result *below* 0.5 more often than with large `n`.

**Answer: a) Choice 2 (200 draws)** — the more you sample, the more reliably you observe your true edge.

---

## Conceptual Gotchas

- **Disjoint vs independent:** disjoint events with positive probability are **dependent** (knowing A happened tells you B did not).
- **Union of non-mutually-exclusive:** subtract the intersection to avoid double-counting ($P(A\cup B) = P(A) + P(B) − P(A\cap B)$).
- **For continuous RVs, $P(X = c) = 0$** — exactly. Probability is over intervals.
- **A valid pdf must integrate to 1**, even on the unbounded real line.
- **Independence is symmetric:** $P(A\cap B) = P(A)P(B)$ ⇔ $P(A|B) = P(A)$ ⇔ $P(B|A) = P(B)$.
- **Expectation is linear:** $E[aX + bY] = aE[X] + bE[Y]$ even if X, Y dependent.
- **Variance is NOT linear:** `Var(aX) = a²Var(X)`. Variance of sum requires independence: `Var(X+Y) = Var(X) + Var(Y)` only if independent.

---

## Quick Reference

| Concept | Formula |
|---|---|
| Complement | $P(A^c) = 1 − P(A)$ |
| Union (general) | $P(A\cup B) = P(A) + P(B) − P(A\cap B)$ |
| Independence | $P(A\cap B) = P(A)P(B)$ |
| Discrete expectation | $E[X] = Σ x\cdot P(X=x)$ |
| Continuous expectation | $E[X] = ∫ x\cdot f(x) dx$ |
| Variance | $Var(X) = E[X²] − (E[X])²$ |
| CDF | $F(x) = P(X \leq x) = ∫_{−\infty }^x f(t) dt$ |
| Bernoulli | E = p, Var = p(1−p) |
| Binomial | E = np, Var = np(1−p) |
