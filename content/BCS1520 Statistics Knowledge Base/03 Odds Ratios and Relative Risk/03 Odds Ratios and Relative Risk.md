# Topic 3 — Odds Ratios and Relative Risk

**Source lectures:** Lecture 3 (RCTs and Causality) — judging statistical claims
**Tested by:** Mock Q2a (expected frequency given OR), Q2b (relative risk from contingency table)
**Approximate mock points:** 6

This is the **easiest 6-point block on the mock**. Drill the formulas, you bank the points.

---

## What the Exam Asks

1. **Apply a relative-risk / odds-ratio number from a headline** to compute the expected frequency in a population (Q2a)
2. **Compute relative risk from a 2×2 contingency table** (Q2b)
3. Sometimes: explain why a headline framing is misleading (absolute vs relative)

---

## Formulas from the Sheet

### Relative Risk (RR)
$$\text{RR} = \frac{p}{q}$$

where:
- `p` = probability of outcome in exposed (treatment) group
- `q` = probability of outcome in unexposed (control) group

**Interpretation:** RR = 2 means exposed group is twice as likely to have the outcome. RR = 1 means no difference. RR < 1 means exposed group has lower risk.

### Odds Ratio (OR)
$$\text{OR} = \frac{p/(1-p)}{q/(1-q)}$$

The ratio of two odds (`p/(1−p)` is "odds of outcome in exposed").

**Interpretation:** OR = 1 means no difference. OR > 1 means exposed group has higher odds. The magnitude is harder to interpret than RR.

### Key relationship
**When the outcome is rare** (e.g., baseline rate < 10%), `OR ≈ RR`.
When the outcome is common, OR is exaggerated relative to RR.

---

## Recipe — From 2×2 Table

A contingency table always looks like:

|                | Outcome (Yes)  | Outcome (No) |
|----------------|----------------|---------------|
| **Exposed**    | a              | b            |
| **Unexposed**  | c              | d            |

Then:
- `p = a/(a+b)` (rate in exposed)
- `q = c/(c+d)` (rate in unexposed)
- `RR = p/q = [a/(a+b)] / [c/(c+d)]`
- `OR = (a/b) / (c/d) = ad/bc`

### Mock Q2b worked example — Cat parasite

|                  | Own Cat | Don't Own Cat |
|------------------|--------:|---------------:|
| Brain cancer     | 171     | 645           |
| No brain cancer  | 114,614 | 378,066       |

- $p = 171 / (171 + 114,614) = 171 / 114,785 = 0.00149$
- $q = 645 / (645 + 378,066) = 645 / 378,711 = 0.00170$
- `RR = 0.00149 / 0.00170 ≈ 0.876` → roughly **0.9** (answer b in mock)

**Interpretation:** Cat owners have ~12% *lower* risk — opposite of what the original "cat parasite causes brain cancer" headline claimed.

---

## Recipe — From a Headline Number

If a headline says "X% increase in risk" or "X-fold increase", you usually want to compute the new rate or the expected frequency.

### Mock Q2a worked example — Cat parasite, applying OR = 1.6

> "Assuming 2 in 100 people get brain cancer in low-prevalence countries. What is the expected frequency in high-prevalence countries? Assume 1.6 is an odds ratio."

Two interpretations:
1. **OR ≈ RR when rare:** Treat 1.6 as a multiplier on the rate. $2/100 × 1.6 = 3.2/100$. **Answer e: 3.2/100**.
2. **Strict OR calculation:** Solve `(p/(1−p)) / (0.02/0.98) = 1.6`. Then $p/(1−p) = 1.6 × (0.02/0.98) = 0.0327$. So $p = 0.0327/(1.0327) ≈ 0.0316$ → 3.16/100 ≈ 3.2/100. **Same answer.**

The fact that both methods agree confirms the rare-outcome approximation. The exam likely expects the multiplicative interpretation.

### Mock-style "X% higher risk" examples (from Odds and Relative Risk tutorial)
- "Energy drinks triple your risk" + baseline 10/1000 = 1% → new rate = **3% = 30/1000** (RR = 3)
- "Cats raise breast cancer risk 15%" + baseline 200/10000 = 2% → new rate = 2% × 1.15 = **2.3% = 230/10000** → 30 extra cases per 10,000
- "Processed meat 20% higher" + baseline 6/100 = 6% → new rate = 6% × 1.2 = **7.2/100** → 12 extra per 1000
- "University 19% higher tumour risk" + baseline 5/10000 → new rate = 5 × 1.19 ≈ **6/10000** → **just 1 extra per 10,000**

The last example is the punchline: **a "significant" 19% relative risk is meaningless when the baseline is tiny.**

---

## Absolute vs Relative Risk Framing

This is a classic exam motivation question.

| Framing | Sounds | Why |
|---|---|---|
| **Relative**: "20% higher chance" | Big | Multiplier feels large regardless of baseline |
| **Absolute**: "extra 12 cases per 1000" | Small (usually) | Anchored to real frequency |
| **Number Needed to Harm (NNH)**: "1 extra case per X people exposed" | Smallest | Reciprocal of absolute difference |

<figure class="diag-figure">
  <figcaption>Relative risk can sound large while absolute risk stays small</figcaption>
  <svg viewBox="0 0 760 250" class="diag-svg" role="img" aria-label="Relative versus absolute risk framing">
    <line x1="80" y1="196" x2="690" y2="196" class="d-edge"/>
    <line x1="80" y1="196" x2="80" y2="45" class="d-edge"/>
    <text x="80" y="220" text-anchor="middle" class="d-sub">0</text>
    <text x="690" y="220" text-anchor="middle" class="d-sub">1000 people</text>

    <rect x="118" y="74" width="260" height="38" class="d-node"/>
    <rect x="118" y="74" width="16" height="38" class="d-node-dan"/>
    <text x="394" y="99" class="d-h-sm">Baseline: 20 cases / 1000</text>

    <rect x="118" y="138" width="260" height="38" class="d-node"/>
    <rect x="118" y="138" width="19" height="38" class="d-node-dan"/>
    <text x="394" y="163" class="d-h-sm">20% higher risk: 24 cases / 1000</text>

    <path d="M 138 112 L 138 138" class="d-edge-dan" marker-end="url(#arr-dan-rr)"/>
    <defs>
      <marker id="arr-dan-rr" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-dan"/>
      </marker>
    </defs>
    <rect x="520" y="82" width="160" height="76" class="d-node-acc"/>
    <text x="600" y="108" text-anchor="middle" class="d-h-sm">Relative framing</text>
    <text x="600" y="129" text-anchor="middle" class="d-sub">20% higher</text>
    <text x="600" y="145" text-anchor="middle" class="d-sub">sounds big</text>
    <rect x="520" y="168" width="160" height="46" class="d-node"/>
    <text x="600" y="193" text-anchor="middle" class="d-h-sm">Absolute framing</text>
    <text x="600" y="209" text-anchor="middle" class="d-sub">4 extra / 1000</text>
  </svg>
</figure>

**Standard exam answer:** "Relative framing is more alarming/sensational because it ignores baseline rate. Absolute framing (extra cases per 1000) is more honest because it lets the reader judge practical significance."

---

## Conceptual Gotchas

- **RR and OR have different formulas — don't mix them up under exam stress.** RR = ratio of *rates*; OR = ratio of *odds*.
- **Odds vs probability:** odds = `p/(1−p)`. Probability of 50% = odds of 1:1. Probability of 75% = odds of 3:1.
- **OR is symmetric across outcome/exposure swap** but RR is not. (This is why epidemiologists use OR for case-control studies where exposure rates are fixed.)
- **A ratio of 1 means no effect**, not zero. RR = 0 would mean the outcome never happens in the exposed group.
- **Confidence intervals matter** — an OR of 2 with CI [0.5, 8] is not significant. Headlines often omit the CI.
- **Magnitude of OR ≠ magnitude of effect.** OR of 1.6 in a rare disease ≈ 1.6× more cases; OR of 1.6 in a common disease (50% baseline) means RR ≈ 1.3 (much smaller absolute change).

---

## Quick Reference

| Quantity | Formula | What it means |
|---|---|---|
| Probability/rate `p` | `cases / (cases + non-cases)` | Risk in a group |
| Odds | `p / (1−p)` | Ratio of yes to no |
| **Relative Risk (RR)** | `p_exposed / p_unexposed` | Risk multiplier |
| **Odds Ratio (OR)** | `(p₁/(1−p₁)) / (p₂/(1−p₂))` = `ad/bc` | Odds multiplier |
| Absolute risk difference | `p_exposed − p_unexposed` | Extra cases per unit population |
| Number Needed to Harm | `1 / (p_exposed − p_unexposed)` | Population needed to see 1 extra case |

**Rule of thumb:** `OR ≈ RR` when baseline < 10%.
