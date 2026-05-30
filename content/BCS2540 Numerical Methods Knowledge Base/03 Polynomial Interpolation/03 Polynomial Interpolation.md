# Topic 3 — Polynomial Interpolation

**Exercise sheet:** Exercise Sheet 3
**Formula sheet section:** "Polynomial Interpolation"

---

## What the Exam Asks

From both mock exams, Q3 is always structured as:

1. **(a)** Compute the divided differences table (some entries given to save time)
2. **(b)** Write down the nested (Horner) form of the interpolating polynomial
3. **(c)** Evaluate the polynomial at a given point x, showing intermediate steps

The exam always provides the data as a table of $(x_i, y_i)$ pairs.

---

## Core Concept

Given $n+1$ data points $(x_0, y_0), (x_1, y_1), \ldots, (x_n, y_n)$, there is exactly one polynomial $p$ of degree $\leq n$ that passes through all of them. This is the **interpolating polynomial**.

We build it using divided differences, then write it in nested form for efficient evaluation.

---

## Formulas from the Sheet

### Divided Differences — Recurrence Relation
$$f[x_i, \ldots, x_j] = \frac{f[x_{i+1}, \ldots, x_j] - f[x_i, \ldots, x_{j-1}]}{x_j - x_i}$$

**Variable meanings:**
- $f[x_i]$ — the 0th-order divided difference = $y_i$ (just the function value)
- $f[x_i, x_j]$ — 1st-order divided difference: slope between two points
- $f[x_i, x_j, x_k]$ — 2nd-order: further divided differences, used as polynomial coefficients
- The denominators are always the "outer" x values: $x_j - x_i$

### Nested Form
Let $a_k = f[x_0, \ldots, x_k]$. Then:
$$p(x) = a_0 + (x - x_0)\bigl(a_1 + (x - x_1)\bigl(a_2 + \cdots + (x - x_{n-2})(a_{n-1} + (x - x_{n-1})a_n)\bigr)\bigr)$$

**Variable meanings:**
- $a_k$ — the $k$th diagonal of the divided differences table (the "leading" divided difference at each order)
- $x_0, x_1, \ldots, x_{n-1}$ — the node values used as offsets in the nested form (in order)

### Lagrange Form (alternative representation — less commonly used in exams)
$$p(x) = \sum_{i=0}^n y_i l_i(x), \quad l_i(x) = \prod_{\substack{j=0 \\ j \neq i}}^n \frac{x - x_j}{x_i - x_j}$$

---

## Step-by-Step Procedure

### Step 1 — Build the divided differences table

Layout (for 4 points $x_0, x_1, x_2, x_3$):

| $x_i$ | $f[x_i]$ | 1st order | 2nd order | 3rd order |
|---|---|---|---|---|
| $x_0$ | $y_0$ | | | |
| $x_1$ | $y_1$ | $f[x_0,x_1]$ | | |
| $x_2$ | $y_2$ | $f[x_1,x_2]$ | $f[x_0,x_1,x_2]$ | |
| $x_3$ | $y_3$ | $f[x_2,x_3]$ | $f[x_1,x_2,x_3]$ | $f[x_0,x_1,x_2,x_3]$ |

**How to fill each cell:**
$$f[x_i, x_j] = \frac{f[x_j] - f[x_i]}{x_j - x_i} = \frac{y_j - y_i}{x_j - x_i}$$
$$f[x_i, x_j, x_k] = \frac{f[x_j, x_k] - f[x_i, x_j]}{x_k - x_i}$$

The **diagonal** (top of each column) gives the coefficients $a_0, a_1, a_2, a_3$.

### Step 2 — Identify coefficients $a_k$

The $a_k$ values are always the **top entry of each column**:
- $a_0 = f[x_0] = y_0$
- $a_1 = f[x_0, x_1]$
- $a_2 = f[x_0, x_1, x_2]$
- $a_3 = f[x_0, x_1, x_2, x_3]$

### Step 3 — Write the nested form

$$p(x) = a_0 + (x - x_0)\bigl(a_1 + (x - x_1)\bigl(a_2 + (x - x_2) \cdot a_3\bigr)\bigr)$$

Substitute in the actual values of $a_k$ and $x_0, x_1, x_2$.

### Step 4 — Evaluate at a given x

Work from the inside out:
1. Start with innermost: $v_3 = a_3$
2. $v_2 = a_2 + (x - x_2) \cdot v_3$
3. $v_1 = a_1 + (x - x_1) \cdot v_2$
4. $v_0 = a_0 + (x - x_0) \cdot v_1$
5. Result: $p(x) = v_0$

---

## Worked Example (Mock Exam Q3)

Data:
| $x_i$ | 2.0 | 1.5 | 1.0 | 3.0 |
|---|---|---|---|---|
| $y_i$ | 0.40 | 1.00 | 1.82 | 0.03 |

So: $x_0 = 2.0$, $x_1 = 1.5$, $x_2 = 1.0$, $x_3 = 3.0$, $y_0 = 0.40$, $y_1 = 1.00$, $y_2 = 1.82$, $y_3 = 0.03$

**Given:** $f[x_0, x_1] = -1.200$, $f[x_1, x_2] = -1.640$

**Compute missing 1st-order entry:**
$$f[x_2, x_3] = \frac{0.03 - 1.82}{3.0 - 1.0} = \frac{-1.79}{2.0} = -0.895$$

**Compute 2nd-order entries:**
$$f[x_0, x_1, x_2] = \frac{f[x_1, x_2] - f[x_0, x_1]}{x_2 - x_0} = \frac{-1.640 - (-1.200)}{1.0 - 2.0} = \frac{-0.440}{-1.0} = 0.440$$

$$f[x_1, x_2, x_3] = \frac{f[x_2, x_3] - f[x_1, x_2]}{x_3 - x_1} = \frac{-0.895 - (-1.640)}{3.0 - 1.5} = \frac{0.745}{1.5} = 0.497$$

**Compute 3rd-order entry:**
$$f[x_0, x_1, x_2, x_3] = \frac{f[x_1, x_2, x_3] - f[x_0, x_1, x_2]}{x_3 - x_0} = \frac{0.497 - 0.440}{3.0 - 2.0} = \frac{0.057}{1.0} = 0.057$$

**Coefficients:** $a_0 = 0.40$, $a_1 = -1.200$, $a_2 = 0.440$, $a_3 = 0.057$

**Nested form:**
$$p(x) = 0.40 + (x - 2.0)\bigl(-1.200 + (x - 1.5)\bigl(0.440 + (x - 1.0) \cdot 0.057\bigr)\bigr)$$

**Evaluate at $x = 2.5$:**
- innermost: $0.440 + (2.5 - 1.0)(0.057) = 0.440 + 0.0855 = 0.5255$
- next: $-1.200 + (2.5 - 1.5)(0.5255) = -1.200 + 0.5255 = -0.6745$
- outermost: $0.40 + (2.5 - 2.0)(-0.6745) = 0.40 - 0.3373 = 0.0628$

---

## Standard Conceptual Questions and Answers

### "What is the error in polynomial interpolation?"

From the formula sheet:
$$f(x) - p(x) = \frac{1}{(n+1)!} f^{(n+1)}(\xi) \prod_{i=0}^n (x - x_i)$$
for some $\xi$ in the interval. The error depends on:
1. The $(n+1)$th derivative of $f$ — if $f$ is smooth, this is small
2. The product $\prod(x - x_i)$ — how far $x$ is from the nodes

### "Why use Chebyshev nodes instead of equally-spaced nodes?"

Equally-spaced nodes can cause **Runge's phenomenon** — wild oscillations near the endpoints of the interval for high-degree polynomials.

Chebyshev nodes minimize $\max_x |\prod(x - x_i)|$ over $[a,b]$, giving the tightest error bound:
$$|f(x) - p(x)| \leq \frac{(b-a)^{n+1}}{2^{2n+1}(n+1)!} \max_\xi |f^{(n+1)}(\xi)|$$

Compare to the equally-spaced bound where the denominator has $4n^{n+1}$ — Chebyshev gives a much smaller factor.

### "What is the connection between divided differences and derivatives?"

From the formula sheet: $f[x_0, \ldots, x_n] = f^{(n)}(\xi)/n!$ for some $\xi$. So the $n$th divided difference approximates the $n$th derivative divided by $n!$.

---

## Quick Reference

| Task | Formula / Procedure |
|---|---|
| 0th-order divided diff | $f[x_i] = y_i$ |
| 1st-order | $f[x_i, x_j] = (y_j - y_i)/(x_j - x_i)$ |
| Higher-order | $f[x_i,\ldots,x_j] = (f[x_{i+1},\ldots,x_j] - f[x_i,\ldots,x_{j-1}])/(x_j - x_i)$ |
| Coefficients $a_k$ | Top diagonal of divided differences table |
| Nested evaluation | Work from inside out: $v = a_n$; loop: $v = a_k + (x - x_k) \cdot v$ |
