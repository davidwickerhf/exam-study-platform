# Exam Skills — BCS2540 Numerical Methods

---

## Exam Day Checklist

- Formula sheet is provided — no need to memorise formulas
- Standard calculator permitted (no computer, no Matlab)
- 2 hours, 6 questions — one per topic
- Attempt all 6 — there is no choice
- If stuck on a later sub-part, write what you can and move on
- All computation is by hand with a calculator

---

## How to Use the Formula Sheet Efficiently

The formula sheet is dense. Know exactly where each formula lives:

| Topic | Sheet location |
|---|---|
| Newton's method, Secant | Top-left: "Algebraic equations" |
| RK methods (Euler, Ralston, RK4, Adams) | Top-right: "Differential Equations" |
| Lagrange, divided differences, nested form | Middle-left: "Polynomial Interpolation" |
| Trapezoid, Simpson, Midpoint, Romberg | Bottom-left: "Integration" |
| Legendre, Chebyshev, Fourier | Middle-right: "Least-Squares Approximation" |
| LU, Jacobi, Gauss-Seidel, Conjugate gradient | Bottom-right: "Linear Algebraic Equations" |
| Gram-Schmidt, Power method, QR, Householder | Bottom-right: "Orthogonality and Eigenvalues" |

**Tip:** Before the exam, scan the formula sheet once and locate each section. Do not waste time searching during the exam.

---

## Time Management (2 hours, 6 questions)

Suggested time allocation:

| Q | Topic | Suggested time |
|---|---|---|
| 1 | Algebraic Equations | 15 min |
| 2 | Differential Equations | 20 min |
| 3 | Polynomial Interpolation | 20 min |
| 4 | Numerical Integration | 15 min |
| 5 | Least-Squares | 20 min |
| 6 | Eigenvalues / Linear Algebra | 20 min |
| Buffer | Review + sub-parts skipped | 10 min |

If a question is taking too long, **write a brief answer for the conceptual sub-parts** (they are short) and move on. Come back if time allows.

---

## The Two Types of Sub-Parts

Every question has two types of sub-parts. Treat them differently:

### Type 1 — Computational ("Apply the method")
*Sub-part (a), usually the longest and highest-value part.*

Strategy:
1. Identify which formula to use (look it up on the sheet)
2. Write out each formula variable and what it equals in this problem
3. Compute step by step, showing intermediate values — **partial credit is given**
4. If you make an arithmetic error early, carry it through — you may still get most marks

### Type 2 — Conceptual ("Explain", "Do you expect...", "How would the error change")
*Sub-parts (b), (c), (d), (e) — usually 1–3 lines expected.*

Strategy:
1. These have short, specific answers — don't over-explain
2. Use the key vocabulary: "converges quadratically", "global error $O(h^2)$", "orthogonality", etc.
3. For error questions: state the order, then state the scaling factor (e.g. "halving h reduces error by 4")

---

## Standard Conceptual Answers to Memorise

These come up across multiple questions:

### On error scaling when step size changes
- Method with global error $O(h^p)$: halving $h$ multiplies error by $(1/2)^p$
  - $p=1$ (Euler): error halves
  - $p=2$ (Ralston, Trapezoid): error reduces by 4
  - $p=4$ (RK4, Simpson): error reduces by 16

### On convergence of root-finding methods
- Bisection: linear, guaranteed, error = half bracket width after each step
- Newton: quadratic (near root) — doubles correct digits
- Secant: superlinear (~order 1.618)

### On why a method fails or diverges
- Bisection: only fails if initial bracket has no sign change (no root in interval) or function is discontinuous
- Newton: fails if $f'(p_n) \approx 0$ (division by near-zero) or starting point far from root

### On orthogonality (Q5 standard answer)
"Since $\int P_i P_j = 0$ for $i \neq j$, all cross terms in the expansion of $\int q_n^2$ vanish, leaving only diagonal terms $c_k^2 \int P_k^2$."

### On adaptive methods
"Split the interval where the error estimate exceeds the tolerance and apply the method recursively, accumulating results from sub-intervals that are sufficiently accurate."

### On eigenvalue estimation from QR
"As QR iterates, the off-diagonal entries tend to zero. The diagonal entries converge to the eigenvalues."

---

## Calculator Tips

- You can use the calculator throughout — don't try to do $e^x$ or $\cos(\cdot)$ by hand
- Carry 4 decimal places (the mock says "work in 4dp")
- For divided differences: keep values to at least 3dp or rounding errors accumulate
- Check trace/determinant as a sanity check on eigenvalues

---

## If You Run Out of Time

**Triage priority:**
1. Part (a) of each question — highest marks
2. Part (b) of Q1, Q2, Q4 — usually one sentence about error
3. Part (c) of Q4 (adaptive trapezoid) — short explanation, no computation
4. Part (c) of Q5 (orthogonality) — standard argument, one paragraph

Skip or abbreviate: Q6 part (a) if the matrix computation is taking too long — write the method and first step, and state the principle for reading eigenvalues.
