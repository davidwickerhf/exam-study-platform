# Topic 1 — Algebraic Equations (Root Finding)

**Exercise sheet:** Exercise Sheet 1 — Computer Arithmetic & Algebraic Equations
**Formula sheet section:** "Algebraic equations" (top-left of sheet)

---

## What the Exam Asks

From both mock exams, Q1 is always structured as:

1. **(a)** Perform one step of Newton's method from a given starting point
2. **(b)** Is the result within a given interval? Why? (sign check / interval membership)
3. **(c)** Perform one step of bisection to find a smaller bracket
4. **(d)** Perform one step of Newton's method from the new midpoint
5. **(e)** Is the approximation within a given tolerance of the true solution? Give a reason.

The question always gives you an equation f(x) = 0 on an interval [a, b].

---

## Formulas from the Sheet

### Newton's Method
$$p_{n+1} = p_n - \frac{f(p_n)}{f'(p_n)}$$

**Variable meanings:**
- $p_n$ — current approximation (your starting point, e.g. midpoint of interval)
- $f(p_n)$ — value of the function at current point (plug in and compute)
- $f'(p_n)$ — value of the *derivative* of f at current point (you must differentiate f yourself)
- $p_{n+1}$ — next (improved) approximation

**When to use:** You have a starting point and can compute the derivative.

### Secant Method
$$p_{n+1} = p_n - \frac{p_n - p_{n-1}}{f(p_n) - f(p_{n-1})} \cdot f(p_n)$$

**Variable meanings:**
- $p_{n-1}, p_n$ — two previous approximations (given as initial seeds)
- No derivative needed — uses a finite difference approximation of f'

**When to use:** Derivative is hard to compute; you have two initial points.

### Bisection Method
Not on the formula sheet explicitly, but the rule is:
1. Compute midpoint $c = (a + b) / 2$
2. Evaluate $f(c)$
3. If $f(a) \cdot f(c) < 0$, root is in $[a, c]$ → new bracket is $[a, c]$
4. If $f(c) \cdot f(b) < 0$, root is in $[c, b]$ → new bracket is $[c, b]$
5. New bracket width = half the old width

**Guaranteed convergence** as long as f is continuous and f(a), f(b) have opposite signs.

---

## Step-by-Step Procedures

### Newton's Method — one step
Given: equation f(x) = 0, starting point $p_0$

1. Identify $f(x)$ and compute $f'(x)$ (differentiate by hand)
2. Evaluate $f(p_0)$ — plug $p_0$ into f
3. Evaluate $f'(p_0)$ — plug $p_0$ into f'
4. Apply formula: $p_1 = p_0 - f(p_0) / f'(p_0)$
5. Report $p_1$

**Example (mock exam Q1):** $f(x) = e^x - 6x - 2$, start at midpoint of $[0, 4]$, so $p_0 = 2$
- $f'(x) = e^x - 6$
- $f(2) = e^2 - 12 - 2 = 7.389 - 14 = -6.611$
- $f'(2) = e^2 - 6 = 7.389 - 6 = 1.389$
- $p_1 = 2 - (-6.611 / 1.389) = 2 + 4.760 = 6.760$

### Bisection — one step
Given: interval $[a, b]$ where $f(a)$ and $f(b)$ have opposite signs

1. Compute $c = (a + b) / 2$
2. Evaluate $f(c)$
3. Check sign: which sub-interval $[a,c]$ or $[c,b]$ has opposite signs at endpoints?
4. That sub-interval is your new bracket

**Example:** $[0, 4]$, $f(0) = e^0 - 0 - 2 = -1 < 0$, $f(4) = e^4 - 24 - 2 = 54.6 - 26 = 28.6 > 0$
- $c = 2$, $f(2) = -6.611 < 0$
- $f(2) < 0$ and $f(4) > 0$ → root in $[2, 4]$
- New bracket: $[2, 4]$

---

## Standard Conceptual Questions and Answers

### "Is the Newton step within the interval [a, b]?"
Check: is $p_1$ numerically between $a$ and $b$? If not, Newton diverged — the tangent line at $p_0$ crossed the x-axis outside the interval.

### "How do you know which interval to use after bisection?"
You need $f(a) \cdot f(b) < 0$ (opposite signs). This guarantees the Intermediate Value Theorem applies — a root must exist in $[a, b]$ if $f$ is continuous.

### "Do you expect the new approximation to be within tolerance X?"
After bisection, the bracket width is halved. After Newton, estimate: is the new approximation close to a zero crossing? Bisection gives a guaranteed error bound = half the bracket width. Newton does not guarantee a bound unless you're close to the root, but it converges very fast (quadratically) once you are.

### "Convergence rate?"
- **Bisection:** linear — error halves each step
- **Newton:** quadratic — number of correct digits roughly doubles each step
- **Secant:** superlinear — between linear and quadratic (~order 1.618)

### "What can go wrong with Newton's method?"
- If $f'(p_n) \approx 0$, the step size $f/f'$ blows up → divergence
- If starting point is far from root, tangent line may point away from the interval
- May converge to the wrong root if multiple roots exist

---

## Computer Arithmetic (also in Exercise Sheet 1)

This topic also covers floating-point representation and rounding errors. These appear in theory/quiz questions, not usually the main exam question. Key concepts:

- **Absolute error:** $|p - p^*|$
- **Relative error:** $|p - p^*| / |p|$
- **Catastrophic cancellation:** subtracting nearly equal numbers amplifies relative error
- **Nested (Horner) form** reduces floating-point errors in polynomial evaluation

---

## Quick Reference

| Method | Formula | Needs | Convergence |
|---|---|---|---|
| Bisection | $c = (a+b)/2$, check signs | Bracket $[a,b]$ with sign change | Linear, guaranteed |
| Newton | $p_{n+1} = p_n - f/f'$ | Starting point + derivative | Quadratic (near root) |
| Secant | $p_{n+1} = p_n - \frac{p_n-p_{n-1}}{f(p_n)-f(p_{n-1})} f(p_n)$ | Two starting points | Superlinear |
