# Exam Skills — BCS1520

How to actually sit a closed-book, formula-sheet-allowed, 2-hour, 110-point statistics paper.

---

## Time Allocation (120 min, 110 pts)

| Activity | Time | Cumulative |
|---|---|---|
| Read cover page + skim all 10 questions, mark easy ones | 5 min | 5 |
| Q1 multiple choice (30 pts, 12 sub-q) | ~15 min | 20 |
| Q2 odds/RR (6 pts) | 5 min | 25 |
| Q3 Bayes tree (9 pts) | 10 min | 35 |
| Q4 research design (8 pts) | 10 min | 45 |
| Q5 CI for proportions (12 pts) | 12 min | 57 |
| Q6 cereal box CLT (12 pts) | 12 min | 69 |
| Q7 measurement (9 pts) | 5 min | 74 |
| Q8 correlation (6 pts) | 6 min | 80 |
| Q9 RCT design (8 pts) | 12 min | 92 |
| Q10 pseudo-code (10 pts) | 18 min | 110 |
| Buffer + review | 10 min | 120 |

**Rule of thumb:** ~65 sec per point. If you're spending more than 90 sec/point on a question, move on.

---

## First 5 Minutes — The Triage

1. **Read the cover page.** Confirm 110 points / 22 pages / writing rules.
2. **Skim every question.** Mark each question with a quick code:
   - **E** (easy): you know the recipe and can score full marks
   - **M** (medium): you can probably solve with some work
   - **H** (hard): defer to the end
3. **Do all E questions first.** Bank guaranteed marks.
4. **Then M questions.** Then H last.

This protects against running out of time on a hard question and missing easy points elsewhere.

---

## Multi-Choice Tactics (Q1, Q7)

### Circular checkboxes (Q1, Q9a)
- **Exactly one answer.** No partial credit, no negative points.
- Use elimination: cross out clearly wrong answers, then choose between the survivors.
- If genuinely uncertain, guess — there's no penalty.

### Square checkboxes (Q7, possibly more)
- **Multiple may be correct AND negative points for wrong answers.**
- **Strategy: only pick what you're confident in.** A 50/50 guess has expected value ≤ 0 if there are negative points.
- The grading scheme on the mock shows examples: 3 correct out of 5 with one wrong likely scores `3 − 1 = 2`, not `3`. **Don't overcommit.**

---

## Formula Sheet — Use It Aggressively

The formula sheet has every formula you need. **Always look first** before trying to remember.

### Formula sheet contents (memorise this layout)
1. Odds ratio, relative risk
2. Mean, SD, variance, SE
3. Pearson correlation, Spearman
4. Probability axioms (complement, union, intersection, independence)
5. Conditional probability, Bayes, LoTP
6. CDF, expectation, variance definitions
7. Bernoulli, Binomial, Normal (E and Var only)
8. CLT statement
9. Z-score with α = 0.1, 0.05, 0.01 critical values
10. CI for mean (σ known)
11. CI for proportion

### What's NOT on the sheet (must remember)
- **68-95-99.7 rule** for normal distribution
- **Other z-values** like P(Z > 1.25) ≈ 0.106
- **t-distribution critical values** (course says "use t for n < 30 and σ unknown" — but no table)
- **Bonferroni correction** (just $α/k$)
- **Test statistic formulas:** $z = (x̄ − μ₀)/(σ/\sqrt n)$ and analogous t

---

## Calculator Strategy

DACS-approved calculator allowed. **If you don't own one, don't bring a different one — that's fraud per the syllabus.**

### What to compute on the calculator
- Square roots (e.g., √(p̂(1−p̂)/n))
- Divisions and multiplications (CIs, ratios)
- Powers (e.g., 0.95³)
- Exponentials (rare — usually only for continuous-distribution integrations)

### What NOT to rely on
- Probably no built-in z-tables or t-tables on basic DACS calculators — confirm yours before exam day
- Symbolic integration (the few integration questions like Q1l should be done by hand)

---

## Showing Work — The "Motivation" Rule

The cover page says: **"Ensure that you properly motivate your answers."**

This means:
- For a CI: write the formula, identify each variable, plug in numbers, then state the interval
- For a hypothesis test: state H₀, Hₐ, α, test statistic chosen + why, computed value, comparison to critical, conclusion in context
- For an explanation question: structure as a paragraph with at least 2–3 distinct points
- For multi-choice: if there's space, write a one-sentence reason (especially if you're picking among close options)

**Partial credit is usually generous.** Even if you get a numerical answer wrong, showing the right method earns most of the marks.

---

## Common Exam Errors to Avoid

1. **Writing outside the reserved box** — gets you zero on that question. Use Q11 (extra space) for overflow and **mark which question you're answering**.
2. **Using pencil** (only black/dark blue pen accepted).
3. **Communicator within reach / wearing a watch** — explicit cover page rule.
4. **Confusing P(A|B) with P(B|A)** in Bayes problems.
5. **Anchoring H₀ on the sample mean** instead of the claimed population mean.
6. **Using one-sided when the question implies two-sided** (or vice versa).
7. **Forgetting `n−1` for sample SD** — though the formula sheet has it right, manual computation often slips.
8. **Multi-choice over-selection** when negative points are possible.
9. **Quoting a relative risk without absolute context** (e.g., "20% higher" when baseline is 5/10000 → still only 1 extra case).
10. **Confusing variance and standard deviation** (SD = √Var; SE = SD/√n).

---

## Format-Specific Rules from the Cover Page

- 22 pages total. Don't skip pages — the scanner uses them as anchors.
- Tick the bubbles for your student ID on the cover (top-right table).
- **In NO circumstance write on or near the QR code** at the bottom of the page.
- "Answers that cannot be read easily cannot be graded" — write clearly.
- You must return all pages, even blank ones.

---

## Method Selection Decision Tree

This is the most useful mental tool for the exam. When you see a question, ask:

```
What is the question asking about?
├── A ratio (RR or OR)?
│   → 2×2 table → RR = p/q, OR = ad/bc
├── A probability of an event given another?
│   → Conditional / Bayes / tree
├── An interval estimate (mean or proportion)?
│   → CI formula (mean: x̄ ± z·σ/√n; proportion: p̂ ± z·√(p̂(1-p̂)/n))
├── Whether some claim is supported by data?
│   → Hypothesis test (define H₀, Hₐ, compute z, compare to critical)
├── Whether the spec is met?
│   → Standardise to Z, look up tail probability, compare to threshold
├── Relationship between two variables?
│   → Correlation (Pearson if linear, Spearman if monotonic/robust)
├── Causality?
│   → RCT design or "correlation ≠ causation" disclaimer
├── How to handle / analyse data?
│   → Pseudo-code workflow (preprocess → analyse → evaluate)
```

---

## Tactical Tips by Question Type

### Q3 — Bayes
**Always build the tree first.** It takes 30 seconds, prevents algebra errors, and answers all sub-parts from one structure. Use 1000 or 10,000 as the starting population for whole-number leaves.

### Q5 — Confidence intervals
State formula → identify variables → plug in → bound. Three CIs takes 6 minutes if you stay disciplined. Always **mention the multiple-testing issue** in (b) — that's where most points hide.

### Q6 — CLT
The two sub-parts use the same logic. Q6a is the recipe; Q6b is the same recipe in reverse (given a tail probability requirement, check if the z falls below the critical).

### Q9b — RCT design
Four ingredients in order: **population → randomisation → intervention/control → outcome + analysis**. Mention blinding explicitly. Mention pre-registration if you can.

### Q10 — Pseudo-code
**Don't write Python syntax.** Write bulleted English steps. Cover: load, preprocess (missing values, encoding), analyse (with motivated method), evaluate (metric or test), interpret.

---

## Day-Before Checklist

- [ ] DACS calculator + extra batteries
- [ ] Student ID + exam ticket
- [ ] Black or dark blue pen (2+)
- [ ] Water + a snack (allowed?) — check the cover page rules of the venue
- [ ] Earplugs if you find them helpful
- [ ] Sleep — diminishing returns past midnight
- [ ] Group assignment was submitted (else NG regardless of exam)

## Morning-of Checklist

- [ ] Eat breakfast (cognition matters)
- [ ] Re-read the [[University/June Exams/BCS1520 Statistics Knowledge Base/13 Cram Sheets/Master Cram Sheet]] one time only — don't try to learn anything new
- [ ] Arrive 15 min early
- [ ] Phone OFF (not silent — OFF) and out of reach. **A watch counts as a communication device — leave it home.**
