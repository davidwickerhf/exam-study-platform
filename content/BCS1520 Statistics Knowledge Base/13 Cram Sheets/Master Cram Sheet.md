# Master Cram Sheet — BCS1520 Statistics

**One-page night-before review.** Memorise these recipes; the formula sheet has the rest.

---

## Formula Sheet — what's already there
- Odds ratio `(p/(1-p))/(q/(1-q))`, Relative risk `p/q`
- Mean, sample SD $\sqrt [(1/(n-1))Σ(xᵢ-x̄)²]$, variance, SE $σ/\sqrt n$
- Pearson correlation; Spearman = Pearson on ranks
- Probability axioms: $P(A^c) = 1−P(A)$, $P(A\cup B) = P(A)+P(B)−P(A\cap B)$, independence $P(A\cap B) = P(A)P(B)$
- Conditional $P(A|B) = P(A\cap B)/P(B)$
- Bayes $P(H|E) = P(E|H)P(H)/P(E)$
- LoTP $P(A) = Σ P(A|Bⱼ)P(Bⱼ)$
- CLT $x̄ \to N(μ, σ²/n)$, $SE = σ/\sqrt n$
- Z critical values: **1.645 (α=0.10), 1.96 (α=0.05), 2.576 (α=0.01)**
- CI for mean $x̄ \pm z_{α/2}\cdot σ/\sqrt n$
- CI for proportion $p̂ \pm z_{α/2}\cdot \sqrt (p̂(1-p̂)/n)$
- Bernoulli E=p, Var=p(1-p); Binomial E=np, Var=np(1-p); Normal E=μ, Var=σ²

## NOT on formula sheet — MEMORISE

| Concept | Value / Rule |
|---|---|
| **68-95-99.7 rule** | μ±1σ=68%, μ±2σ=95%, μ±3σ=99.7% |
| $P(|Z| > 1.25)$ | ≈ 0.21 (21%) — for 1.25 SD questions |
| $P(|Z| > 1.0)$ | ≈ 0.32 (32%) |
| $P(|Z| > 1.5)$ | ≈ 0.13 (13%) |
| $P(|Z| > 2.0)$ | ≈ 0.046 (4.6%) |
| **When to use t** | n < 30 AND σ unknown |
| **Bonferroni** | Use α/k for k tests to keep family-wise rate at α |
| **Z test statistic** | $z = (x̄ − μ₀) / (σ/\sqrt n)$ (one-sample mean) |
| **Reject if** | $|z| > z_{α/2}$ (two-sided) or $z > z_α$ (one-sided) |

---

## Question Pattern → Recipe Cheat-Sheet

| Question phrase | Recipe in 1 line |
|---|---|
| "Relative risk of X" | `RR = p_exposed / p_unexposed` (rates from 2×2) |
| "Odds ratio" | `OR = ad/bc` from 2×2 table |
| "X-fold / X% higher risk" | new rate = baseline × (1 + percentage) |
| "Probability tree / Bayes" | Tree of 1000; rows sum to parents; read leaves |
| "95% CI for proportion" | $p̂ \pm 1.96\cdot \sqrt (p̂(1-p̂)/n)$ |
| "95% CI for mean (σ known)" | $x̄ \pm 1.96\cdot σ/\sqrt n$ |
| "How big n for ±E?" | $n \geq (z\cdot σ/E)²$ |
| "Spec compliance" | Standardise: $z = (X − μ)/σ$, compare to critical |
| "H₀, Hₐ, conclude" | H₀ has `=` and is the claim; Hₐ is directional; reject if $|z| > z_{α/2}$ |
| "p-value" | P(data this extreme \| H₀ true); reject if p < α |
| "Correlation = 0 → causation?" | No — still possible (non-linear, lagged, mixed) |
| "Design RCT" | Population, randomise, intervention/control, outcome+analysis, blinding |
| "Pseudo-code" | Load → preprocess → train/test split → fit → evaluate → baseline |

---

## Multi-choice Gotchas (Q1, Q7)

| Q1 sub | Topic | Answer pattern |
|---|---|---|
| Double-blind | Subjects + doctors don't know; statisticians do | Only "third party knows" |
| Simpson's paradox | Trend reverses when combined | Unequal sub-group sizes drive the reversal |
| 68-95-99.7 | Bell curve | Count = n × tail probability |
| Scatter shade | x-band = vertical, y-band = horizontal | x>y comparison needs diagonal |
| Visualization | Few points→strip; many→hist/box | Strip chart for millions = unreadable |
| CLT applies to | Sample means | NOT raw data, NOT parameters |
| ROC AUC 0.5 | Chance | AUC>0.5 better than chance |
| H₀ formulation | H₀ = claimed value with `=` | Never anchor H₀ on sample mean |
| Variable types | Categorical / Continuous / Discrete | Age = continuous; visit count = discrete |
| Bell-curve mean from pdf | $∫ x\cdot f(x) dx$ | Watch the integration bounds |

**Q7 (square checkboxes, negative points):** only pick what you're sure of. "Governments are not clever" / "too much spread" are usually distractor opinions, not measurement issues.

---

## Bayes Tree Template

Always start with N = 1000 (or 10,000):
```
              N
            /   \
       prior   1-prior
     /     \    /     \
  outcome ...  outcome ...
```
- $P(outcome) = sum of outcome leaves / N$
- $P(prior | outcome) = (matching leaf) / (sum of outcome leaves)$

---

## CI Quick Method

For ANY CI: **estimate ± z_{α/2} × SE**

| Estimate | SE |
|---|---|
| Sample mean (σ known) | $σ/\sqrt n$ |
| Sample mean (σ unknown, n≥30) | $s/\sqrt n$ |
| Proportion p̂ | $\sqrt (p̂(1-p̂)/n)$ |

$z_{α/2}$ for α = 0.05 → **1.96**.

---

## Hypothesis Test Skeleton

1. **H₀: μ = μ₀**, **Hₐ:** {`<`, `>`, $\neq$} μ₀
2. **α** = 0.05
3. **Test stat**: $z = (x̄ − μ₀)/(σ/\sqrt n)$
4. **Critical**: $z_{α/2} = 1.96$ (two-sided) or $z_α = 1.645$ (one-sided)
5. **Reject** if z falls in critical region; otherwise **fail to reject**
6. **Conclude in context**: "At α = 0.05, sufficient/insufficient evidence that ..."

---

## Common Mistakes to Avoid (in priority order)

1. **Writing outside the answer box** → 0 marks for that question
2. **Mixing P(A|B) and P(B|A)**
3. **Using sample mean as H₀**
4. **Forgetting Bonferroni when reporting multiple results**
5. **One-sided when question is neutral**, or vice versa
6. **Using `2` instead of `1.96` for 95% CI**
7. **Confusing OR and RR**
8. **Calling negative correlation "weak"** (magnitude matters, not sign)
9. **Skipping the "motivate your answer" step**
10. **Selecting too many boxes in Q7 (negative scoring)**

---

## Day-Of Quick Steps

1. Cover page: confirm 110 pts, formula sheet present
2. Skim all questions, mark E / M / H
3. Do E questions first (probably Q2, parts of Q1, Q8, Q7)
4. Do M questions next (Q3, Q5, Q6, Q10)
5. Do H questions last (Q4, Q9b)
6. Last 10 min: review unsure answers, fill blanks, verify all CIs are between sensible bounds

**Pass = 5.5/10 = 60.5/110 points.** Bank the easy 60 first; everything after is upside.
