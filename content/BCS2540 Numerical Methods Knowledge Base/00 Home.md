# BCS2540 Numerical Methods — Home

**Course:** BCS2540 Numerical Methods | Maastricht University, Block 2.5
**Examiners:** Martijn Boussé / Başak Sakçak
**Formula sheet:** provided. Standard calculator permitted. 2 hours.

---

## Grade Calculation

| Component             | Weight  | Notes                                                |
| --------------------- | ------- | ---------------------------------------------------- |
| A1 Final Written Exam | **70%** | **Passing norm: 5.5 — must pass to pass the course** |
| A2 Practical Exam     | 15%     | **0% — not sat**                                     |
| A3 Weekly Quizzes     | 15%     | See estimate below                                   |
| A4 Bonus              | +1 pt   | Tutorial attendance                                  |

Formula (with bonus): `Final = 0.7 × A1 + 0.15 × A2 + 0.15 × A3 + 1`
If you fail A1, your final grade = A1 only, regardless of other components.

---

## Current Grade Situation

### A3 — Quiz Grade Estimate

| Quiz | Topic | Normalized grade | Counts? |
|---|---|---|---|
| Quiz 1 | Algebraic Equations | 7.0 / 10 | Yes |
| Quiz 2 | Differential Equations | 10.0 / 10 | Yes |
| Quiz 3 | Polynomial Interpolation | 9.7 / 10 | Yes |
| Quiz 4 | Numerical Integration | (10.0 / 10) | **No — missed deadline** |
| Quiz 5 | Least-Squares | (10.0 / 10) | **No — missed deadline** |
| Quiz 6 | Eigenvalues & Linear Algebra | 8 pts (grade pending) | Yes |

Quiz 6 raw score: 8 points. Normalized grade unknown — estimated **8/10** (assuming quiz is out of 10, consistent with other quizzes).

**Estimated A3 = (7.0 + 10.0 + 9.7 + 0 + 0 + 8.0) / 6 = 34.7 / 6 ≈ 5.78 / 10**

> If Quiz 6 normalizes to 10/10: A3 = 36.7/6 ≈ 6.12
> If Quiz 6 normalizes to 6/10: A3 = 32.7/6 ≈ 5.45
> The range is roughly **5.5 – 6.1** depending on Quiz 6.

Note: the repair quiz option (assessment plan) is only available if A3 is **between 4.0 and 5.5** and the overall grade is failing. At A3 ≈ 5.78, repair is likely not available.

### A2 — Matlab Practical

**A2 = 0.** This costs 0.15 × 10 = **1.5 grade points** compared to a student who scored 10/10. Effectively, 1.5 points must be recovered entirely from A1.

---

## What You Need on the Written Exam

Formula: `Final = 0.7 × A1 + 0.15 × 0 + 0.15 × A3`

Using A3 = 5.78 (central estimate):

`Final = 0.7 × A1 + 0.867`

### To pass (Final ≥ 6.0):
```
0.7 × A1 + 0.867 ≥ 6.0
0.7 × A1 ≥ 5.133
A1 ≥ 7.33
```

**You need at least 7.4 / 10 on the written exam to pass overall.**

(The hard minimum is A1 ≥ 5.5 to not immediately fail — but 7.33 is the binding constraint.)

### With bonus (+1 pt, if eligible):
```
0.7 × A1 + 0.867 + 1 ≥ 6.0
A1 ≥ 5.90
```
With bonus, you need ~**5.9 / 10** on the written exam. The bonus halves your required exam score.

### Sensitivity to A3

| A3 (final) | A1 needed (no bonus) | A1 needed (with bonus) |
|---|---|---|
| 5.45 (Quiz 6 = 6/10) | **7.40** | **5.97** |
| 5.78 (Quiz 6 = 8/10) | **7.33** | **5.90** |
| 6.12 (Quiz 6 = 10/10) | **7.26** | **5.83** |

**Bottom line: aim for 7.5/10 on the exam to pass comfortably (no bonus), or ~6.0/10 if bonus applies.**

---

## Exam Structure

6 questions — one per topic. Each question has 4–5 sub-parts:
- **Part (a):** Apply the formula. Mechanical computation. Worth most marks.
- **Parts (b–e):** Conceptual follow-up — error analysis, convergence, method selection.

The formula sheet covers every formula you need. **Your job is to know how to use them, not memorise them.**

> Friend's insight: "Figure out how to work with the formulas — break down the meaning of the formula and how to use it, this answers 60% of the questions. The remaining 40% require you to understand the concept. 6 questions for 6 topics, so you can focus on the easier topics."

---

## The 6 Topics

| # | Topic | Difficulty | Exam Q Type | Study Priority |
|---|---|---|---|---|
| 1 | [[01 Algebraic Equations]] | Low-Medium | Newton + Bisection steps, convergence | **1 — Start here** |
| 3 | [[03 Polynomial Interpolation]] | Medium | Divided differences table, nested form, evaluation | **2** |
| 4 | [[04 Numerical Integration]] | Low-Medium | Trapezoid/Simpson application, error estimate | **3** |
| 2 | [[02 Differential Equations]] | Medium | RK method steps (Ralston/RK4), error scaling | **4** |
| 5 | [[05 Least-Squares Approximation]] | Medium-High | Legendre recurrence, q_n evaluation, orthogonality | **5** |
| 6 | [[06 Eigenvalues and Linear Algebra]] | High | QR method iteration, eigenvalue estimation | **6 — tackle last** |

---

## Study Plan

Given limited time, the strategy is: **master the formula application first** (part a of every question = ~60% of marks), then learn the conceptual answers for 3–4 topics.

### Phase 1 — Formula fluency (highest return)
Work through the "Step-by-step procedure" section of each topic note.
Practice by doing part (a) of each mock exam question without looking at the answer.

**Goal:** Given a formula from the sheet, you can plug in numbers and compute the next iterate correctly.

### Phase 2 — Conceptual understanding (for follow-up questions)
For each topic, learn the answers to the standard conceptual questions listed in each topic note.
These include: error order, what happens when h is halved, why a method might fail, etc.

### Phase 3 — Triage (if time is short)
Topics 1, 3, 4 have the most formulaic, mechanically tractable questions.
Topics 5 and 6 are harder and more conceptual — do them last or skip if time is critically short.

### Recommended session order
1. Read [[01 Algebraic Equations]] — do mock Q1 by hand
2. Read [[03 Polynomial Interpolation]] — do mock Q3 by hand
3. Read [[04 Numerical Integration]] — do mock Q4 by hand
4. Read [[02 Differential Equations]] — do mock Q2 by hand
5. Read [[05 Least-Squares Approximation]] — do mock Q5 by hand
6. Read [[06 Eigenvalues and Linear Algebra]] — do mock Q6 by hand
7. [[University/June Exams/BCS2540 Numerical Methods Knowledge Base/11 Worked Drills/Mock Exam Full Walkthrough]] — check your answers against the worked solutions

---

## Study Progress Checklist

### Topic 1 — Algebraic Equations
- [ ] Conceptual: Newton vs Bisection convergence (linear vs quadratic)
- [ ] Conceptual: Secant method — superlinear (~1.618), no derivative needed
- [ ] Conceptual: When Newton fails (f'≈0, or started far from root)
- [ ] Conceptual: Bisection error bound = half bracket width
- [ ] Conceptual: Why bisection always works (IVT + sign change)
- [ ] Formula: Newton — $p_{n+1} = p_n - f(p_n)/f'(p_n)$
- [ ] Formula: Bisection — midpoint + sign check
- [ ] Formula: Secant — two-point finite difference approximation of f'
- [ ] Mock Q1 done by hand (all 5 parts)

### Topic 3 — Polynomial Interpolation
- [ ] Conceptual: what interpolation is and why we need it
- [ ] Conceptual: divided differences table — how to build it
- [ ] Conceptual: nested (Horner) form — how to evaluate efficiently
- [ ] Formula: divided differences recurrence
- [ ] Formula: Newton's interpolating polynomial in nested form
- [ ] Mock Q3 done by hand

### Topic 4 — Numerical Integration
- [ ] Conceptual: Trapezoid rule — error order O(h²)
- [ ] Conceptual: Simpson's rule — error order O(h⁴)
- [ ] Conceptual: Romberg — combining trapezoid results to cancel error
- [ ] Conceptual: adaptive methods — split where error is large
- [ ] Conceptual: what happens when h is halved (error scaling)
- [ ] Formula: Trapezoid rule
- [ ] Formula: Simpson's rule
- [ ] Formula: Romberg table
- [ ] Mock Q4 done by hand

### Topic 2 — Differential Equations
- [ ] Conceptual: what an ODE is, what we're approximating
- [ ] Conceptual: Euler method — error order O(h)
- [ ] Conceptual: Ralston method — error order O(h²)
- [ ] Conceptual: RK4 — error order O(h⁴)
- [ ] Conceptual: what happens when h is halved
- [ ] Conceptual: stability vs accuracy — a method can be accurate in principle but unstable for too-large \(h\)
- [ ] Conceptual: linear stability test equation \(y'=-\lambda y\)
- [ ] Conceptual: stability of Euler, backward Euler, and implicit trapezoidal method
- [ ] Formula: Euler step
- [ ] Formula: Ralston (2-stage RK) — k1, k2, weighted average
- [ ] Formula: RK4 — k1, k2, k3, k4
- [ ] Formula: stability factor \(w_{i+1}=R(z)w_i\), stable when \(|R(z)|\leq 1\)
- [ ] Mock Q2 done by hand

### Topic 5 — Least-Squares Approximation
- [ ] Conceptual: difference between interpolation and approximation
- [ ] Conceptual: orthogonality — why cross terms vanish
- [ ] Conceptual: Legendre polynomials — 3-term recurrence
- [ ] Formula: Legendre recurrence $P_{n+1}(x)$
- [ ] Formula: least-squares coefficients $c_k$
- [ ] Mock Q5 done by hand

### Topic 6 — Eigenvalues and Linear Algebra
- [ ] Conceptual: what an eigenvalue is
- [ ] Conceptual: power method — component ratio convergence
- [ ] Conceptual: QR iteration — diagonal converges to eigenvalues
- [ ] Formula: QR factorization step
- [ ] Formula: Givens rotation
- [ ] Mock Q6 done by hand

---

## Reference Materials

- `90 Reference Sources/` — all PDFs (lecture notes, exercise sheets, formula sheet, mock exams)
- Formula sheet: `FormulaSheet.pdf`
- Mock exams: `mock_exam.pdf`, `mock2526 (2).pdf` (same questions, useful as practice)
- Exercise sheets per topic: Exercise Sheets 1–6 + partial answers
