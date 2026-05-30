# BCS1520 Statistics — Home

**Course:** BCS1520 Statistics | Maastricht University, Year 1, Period 5 (4 ECTS)
**Examiners:** Anirudh Wodeyar, Tim Dick, Niloufar Yousefimanesh, Luuk Verkleij
**Exam:** Friday 2026-05-22, 09:00–11:00. **Closed book. 2 hours. Formula sheet provided. DACS-approved calculator allowed.**

---

## Grade Calculation

Per the syllabus:

| Component | Weight | Notes |
|---|---|---|
| Written Exam | **100%** | Mandatory, 2 hours, closed book + formula sheet |
| Group Assignment | 0% of final grade | Mandatory to have submitted (else NG); result pending — does **not** weight the final grade |

So `Final = Written Exam grade`. Passing norm is **5.5/10**.

> Note: The handoff document considered a 25/75 weighting hypothesis. The official syllabus (`BCS1520_course-syllabus-1.docx`) says Written Exam = 100%. Treat the exam as the only thing that matters for the final number, but **you must have submitted the group assignment or you get NG (not graded)** — confirm this is done.

---

## Exam Structure (from Mock 2024-2025)

**10 graded questions plus Q11 extra space, 110 points total.** Sit time: 120 min ≈ **~65 sec/point**. Mock topic breakdown:

| # | Topic | Pts | Format |
|---|---|---:|---|
| 1 | Multiple choice (a–l, 12 sub-q) | 30 | Mix circular (one answer) and square checkboxes (multi, negative points possible) |
| 2 | Judging statistical claims (odds ratio / relative risk) | 6 | Numeric + interpretation |
| 3 | Conditional probability (Bayes / tree) | 9 | Compute 3 probabilities |
| 4 | Design a research study (analysis plan) | 8 | Written explanation |
| 5 | Confidence intervals + multiple-testing caveat | 12 | Compute 3 CIs + explain α inflation |
| 6 | Normal distribution / CLT (cereal box) | 12 | Compute CI for mean + assess compliance |
| 7 | Measurement caveats | 9 | Multi-select with negative scoring |
| 8 | Correlation / Spearman | 6 | T/F + explain |
| 9 | RCT and causality | 8 | T/F + design an RCT |
| 10 | Pseudo-code / data workflow | 10 | Write pseudo-code (preprocessing, hypothesis test, classification) |
| 11 | Extra space | 0 | Overflow only |

**Strict format rules from the cover page:**
- Write only inside the reserved space. **Anything outside the box will NOT be graded** (no margin notes, no back-of-page).
- Square checkboxes can have multiple answers AND **negative points for wrong answers** (Q7 explicitly).
- Round/circular checkboxes have exactly one answer.
- "Ensure that you properly motivate your answers."
- No pencil. Black or dark blue pen only.

---

## Recognised Question Patterns (from Mock + Tutorials)

This exam **heavily rewards pattern recognition**. Almost every question reduces to one of these recipes:

| Pattern | Recipe | Topic note |
|---|---|---|
| "Relative risk / odds ratio of X given Y" | Build a 2×2 table → `RR = p/q`; `OR = (p/(1-p))/(q/(1-q))` | [[03 Odds Ratios and Relative Risk]] |
| "Headline says X% higher — what's the absolute rate?" | New rate = baseline × (1 + percentage). Absolute extra = new − baseline | [[03 Odds Ratios and Relative Risk]] |
| "Build a probability tree / Bayes" | Tree of conditional branches → $P(A\cap B)$ at each leaf → $P(H\|E) = P(H)P(E\|H) / P(E)$ | [[05 Conditional Probability and Bayes]] |
| "95% CI for a proportion" | $p̂ \pm 1.96 \cdot \sqrt (p̂(1-p̂)/n)$ | [[07 Confidence Intervals]] |
| "95% CI for a mean (σ known)" | $x̄ \pm 1.96 \cdot σ/\sqrt n$ | [[07 Confidence Intervals]] |
| "Is this within specs / does machine adhere?" | Standardise to z-score → look up tail probability → compare to threshold | [[06 Distributions CLT and Sampling]] |
| "H₀ vs Hₐ, conclude at α=0.05" | Pick one-sided vs two-sided, compute Z or T, compare to critical value | [[08 Hypothesis Testing]] |
| "Spearman vs Pearson" | Pearson = linear; Spearman = monotonic on ranks | [[09 Correlation]] |
| "Correlation ≠ causation" | Even 0 correlation does not prove no causality (confounders, non-linear) | [[02 RCTs and Causality]] |
| "Design RCT to test claim X" | Random assignment, control, blinding, define outcome, address confounds | [[02 RCTs and Causality]] |
| "Write pseudo-code to ..." | Preprocess → analyse (group-compare or model) → evaluate (train/test, metrics) | [[10 Pseudo-Code and Data Workflows]] |
| "Measurement caveat in this example" | Pick from: measure becomes target (Goodhart), teaching to the test, observer effect, variable definition drifts, threshold artefacts | [[01 Data Visualization and Measurement]] |

---

## Topic Index

| # | Topic | Mock pts | Difficulty | Study Priority |
|---|---|---:|---|---|
| 1 | [[01 Data Visualization and Measurement]] | ~12 (1d, 1j, 1k, 7a, 7b) | Low | **2** — fast wins |
| 2 | [[02 RCTs and Causality]] | ~10 (1a, 9a, 9b) | Low-Medium | **3** |
| 3 | [[03 Odds Ratios and Relative Risk]] | ~6 (2a, 2b) | Low | **1 — start here, easiest 6 points** |
| 4 | [[04 Probability Theory]] | ~5 (1l, 1f) | Medium | **5** |
| 5 | [[05 Conditional Probability and Bayes]] | 9 (Q3) | Medium | **4 — biggest single-question chunk after Q1** |
| 6 | [[06 Distributions CLT and Sampling]] | ~14 (1c, 1g, Q6) | Medium-High | **6** |
| 7 | [[07 Confidence Intervals]] | 12 (Q5) | Medium | **7** |
| 8 | [[08 Hypothesis Testing]] | ~5 (1i) | Medium | **8 — tested lightly in mock but core lecture topic** |
| 9 | [[09 Correlation]] | 6 (Q8) | Low | **9** |
| 10 | [[10 Pseudo-Code and Data Workflows]] | 10 (Q10) | Low (no syntax checked) | **10 — last; bullet-point style** |

Plus:
- [[11 Exam Skills|Exam Skills]] — how to use the formula sheet, time allocation, multi-choice tactics
- [[University/June Exams/BCS1520 Statistics Knowledge Base/12 Worked Drills/Mock Exam Full Walkthrough|Mock Exam Full Walkthrough]] — every question worked end-to-end
- [[University/June Exams/BCS1520 Statistics Knowledge Base/13 Cram Sheets/Master Cram Sheet|Master Cram Sheet]] — one-page night-before review
- [[University/June Exams/BCS1520 Statistics Knowledge Base/90 Reference Sources/90 Reference Sources|90 Reference Sources]] — index of materials

---

## Study Plan (Friday 2026-05-22 exam)

The friend's principle from BCS2540 applies here too: **the formula sheet covers every formula. Your job is to know how to use them, not memorise them.** The mock is pattern-heavy, so practice patterns over reading chapters.

### Pre-exam blocks available

| Date | Block | Suggested focus |
|---|---|---|
| Sun 17 May | 1h | Topic 3 (Odds/RR — easy 6 pts) + Topic 5 (Bayes — 9 pts) |
| Mon 18 May (after Numerical Methods exam) | 1.5h | Topic 7 (CI) + Topic 6 (CLT/normal) |
| Tue 19 May | 1h | Redo Bayes, CI, RCT mock questions |
| Wed 20 May (after POPL + AD) | 1h | Topic 10 pseudo-code + Topic 2 RCT design |
| Thu 21 May (after IT Management) | 2.5h | **Full mock exam timed-ish + check against grading scheme** |
| Fri 22 May 06:00–08:30 | 2h | Formula sheet walk-through + method selection checklist + glance at [[13 Cram Sheets/Master Cram Sheet|Master Cram Sheet]] |
| Fri 22 May 09:00–11:00 | **EXAM** | |

### Phase 1 — Pattern fluency (highest return)
Drill the 12 recipes in the table above using the worked solutions:
- Mock exam → [[University/June Exams/BCS1520 Statistics Knowledge Base/12 Worked Drills/Mock Exam Full Walkthrough|Mock Exam Full Walkthrough]]
- Conditional probability tutorial → see [[05 Conditional Probability and Bayes]]
- Confidence limits tutorial → see [[07 Confidence Intervals]]
- Hypothesis testing tutorial → see [[08 Hypothesis Testing]]

**Goal:** Given any mock-style question, you can name the recipe within 30 seconds.

### Phase 2 — Concept anchoring (for multi-choice and explanations)
For each topic, the note lists "Conceptual gotchas" — short Q&A. These are the things multi-choice exploits.

### Phase 3 — Triage (if time runs out)
Topics 3 (Odds/RR), 5 (Bayes tree), 7 (CI) are the most mechanically tractable big-point questions. Topics 4 (continuous distributions / integration) and 10 (pseudo-code) can be deprioritised since they reward structure over deep mastery.

---

## Day-Of Checklist

- [ ] DACS-approved calculator (not your phone, not a programmable one — if unsure, leave it home and compute by hand using the z-values printed on the formula sheet)
- [ ] Black or dark blue pen + spare
- [ ] Student ID and exam ticket
- [ ] **Confirm group assignment was submitted** (NG otherwise — irrespective of exam grade)
- [ ] Arrive 15 min early
- [ ] Read the cover page rules (write inside boxes only, no margin notes)
- [ ] First action on opening the exam: skim all 10 questions, mark the easiest 3 to do first

---

## Notes on the Formula Sheet

The formula sheet (`Materials/00 Exam Critical/Formula Sheet 2026.pdf`) gives you:

- Odds ratio, relative risk, mean, SD, variance, standard error
- Pearson correlation; Spearman = Pearson on ranks
- Probability axioms (incl. complement, union, independence)
- Conditional probability, Bayes' rule, Law of Total Probability
- Cumulative distribution / expectation / variance definitions
- Bernoulli (E=p, Var=p(1−p)), Binomial (E=np, Var=np(1−p)), Normal (E=μ, Var=σ²)
- CLT: $lim x̄ ~ N(μ, σ/\sqrt n)$, SE = σ/√n
- Z-score, plus **memorised z-quantiles**: 1.645 (α=0.10), 1.96 (α=0.05), 2.576 (α=0.01)
- CI for mean: $x̄ \pm z_{α/2} \cdot σ̂/\sqrt n$
- CI for proportion: $p̂ \pm z_{α/2} \cdot \sqrt (p̂(1−p̂)/n)$

**Not on the sheet (must remember):**
- 68-95-99.7 rule for the normal distribution
- t-distribution critical values (`tn−1` for small samples) — the rule is "if `n < 30` and σ unknown → use t"
- Independence test rules (chi-square): not formally tested in mock
- Pseudo-code conventions (pandas-style)

---

## Reference Materials

`Materials/` is organised study-first:

- `Materials/00 Exam Critical/` — formula sheet, mock exam, grading scheme, syllabus (grab these first)
- `Materials/01 Lectures/` — Lectures 1–8 in chronological order
- `Materials/02 Exercises by Topic/` — tutorial exercises grouped by knowledge-base topic number, exercise + solution paired in the same folder
- `Materials/03 Python Tutorials/` — Jupyter notebooks (not exam-critical; exam is paper-only)
- `Materials/99 Reference/` — supporting materials (chart chooser, etc.)

See [[University/June Exams/BCS1520 Statistics Knowledge Base/90 Reference Sources/90 Reference Sources|90 Reference Sources]] for a per-file guide.
