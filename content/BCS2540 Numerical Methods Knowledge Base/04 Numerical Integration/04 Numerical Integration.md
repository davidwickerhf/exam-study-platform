# Topic 4 — Numerical Integration (and Differentiation)

**Exercise sheet:** Exercise Sheet 4 / Exercise Sheet — Numerical Differentiation
**Formula sheet sections:** "Integration", "Differentiation"

---

## What the Exam Asks

From both mock exams, Q4 is:

1. **(a)** Apply the trapezoid rule with $n$ subintervals to estimate an integral — compute to 4dp
2. **(b)** Use the error formula to estimate error over specific sub-intervals — is it within a tolerance?
3. **(c)** Explain (conceptually) how to use the adaptive trapezoid method to improve accuracy

The problem is always: compute $\int_a^b f(x)\, dx$ to a given accuracy.

---

## Core Concept

Most integrals cannot be solved analytically. Numerical integration approximates $\int_a^b f(x)\, dx$ by splitting $[a,b]$ into $n$ subintervals of width $h = (b-a)/n$ and applying a simple rule to each.

---

## Formulas from the Sheet — Integration

### Trapezoid Rule
$$T_n(f; a, b) = h\left[\tfrac{1}{2}f(x_0) + f(x_1) + f(x_2) + \cdots + f(x_{n-1}) + \tfrac{1}{2}f(x_n)\right]$$
$$\text{Error: } \int_a^b f(x)\,dx - T(f;P) = -(b-a)\frac{h^2}{12}f''(\xi)$$

**Variable meanings:**
- $h = (b-a)/n$ — subinterval width
- $x_k = a + kh$ — the $k$th node, $k = 0, 1, \ldots, n$
- Half-weight on endpoints $x_0 = a$ and $x_n = b$; full weight on all interior points
- Error depends on $f''(\xi)$ at some unknown point — approximate using max of $|f''|$

### Midpoint Rule
$$M_n(f; a, b) = h\left[f(x_{1/2}) + f(x_{3/2}) + \cdots + f(x_{n-1/2})\right]$$
$$\text{Error: } (b-a)\frac{h^2}{24}f''(\xi)$$
- Evaluates $f$ at midpoints of each subinterval
- Error is half that of the trapezoid rule!

### Simpson's Rule
$$S_n(f; a, b) = \tfrac{1}{3}h\left[f(x_0) + 4f(x_1) + 2f(x_2) + 4f(x_3) + \cdots + 2f(x_{n-2}) + 4f(x_{n-1}) + f(x_n)\right]$$
$$\text{Error: } -(b-a)\frac{h^4}{180}f^{(4)}(\xi)$$
- Pattern of weights: 1, 4, 2, 4, 2, ..., 4, 1 (multiplied by $h/3$)
- **Requires $n$ to be even**
- Much more accurate than trapezoid: error is $O(h^4)$

### Romberg Integration
$$R_{k,0} = T_{2^k}; \qquad R_{k,j} = R_{k,j-1} + \frac{R_{k,j-1} - R_{k-1,j-1}}{4^j - 1}$$
- Builds a table by combining trapezoid estimates at different step sizes
- Each column of the table is more accurate than the last
- $R_{k,1}$ corresponds to Simpson's rule

### Adaptive Trapezoid Rule
Error estimate:
$$\left|\int_a^b f\,dx - T_2(f; a, b)\right| \approx \frac{1}{3}\left|T_2(f; a, b) - T_1(f; a, b)\right|$$
- Compare trapezoid estimates with $n=1$ and $n=2$
- If error too large, split interval and apply rule recursively on each half

---

## Step-by-Step Procedure: Trapezoid Rule

Given: $\int_a^b f(x)\,dx$, use $n$ subintervals.

1. Compute $h = (b-a)/n$
2. List the nodes: $x_k = a + kh$ for $k = 0, 1, \ldots, n$
3. Evaluate $f$ at each node
4. Apply the formula: endpoints get weight $1/2$, interior points get weight $1$
5. Multiply the sum by $h$

**Mock exam example:** $I = \int_0^{1.2} \cos(x^2)\,dx$, $n = 4$

- $h = 1.2/4 = 0.3$
- Nodes: $x_0 = 0.0,\ x_1 = 0.3,\ x_2 = 0.6,\ x_3 = 0.9,\ x_4 = 1.2$
- $f(x) = \cos(x^2)$, evaluate:
  - $f(0.0) = \cos(0) = 1.0000$
  - $f(0.3) = \cos(0.09) = 0.9960$
  - $f(0.6) = \cos(0.36) = 0.9356$
  - $f(0.9) = \cos(0.81) = 0.6892$
  - $f(1.2) = \cos(1.44) = 0.1367$
- $T_4 = 0.3 \cdot [\tfrac{1}{2}(1.0000) + 0.9960 + 0.9356 + 0.6892 + \tfrac{1}{2}(0.1367)]$
- $= 0.3 \cdot [0.5000 + 0.9960 + 0.9356 + 0.6892 + 0.0684]$
- $= 0.3 \cdot 3.1892 = 0.9568$

---

## Step-by-Step Procedure: Error Estimation

Given: trapezoid error formula $\int f\,dx - T(f;P) = -(b-a)\tfrac{h^2}{12}f''(\xi)$

To **bound** the error over an interval $[c,d]$ with step size $h$:
1. Find a bound for $|f''(x)|$ on $[c,d]$ — either by inspection or told
2. Error $\leq (d-c) \cdot \tfrac{h^2}{12} \cdot \max |f''|$

**Mock exam example:** $f(x) = \cos(x^2)$, estimate error on $[0, 0.6]$ and $[0.6, 1.2]$ with $h = 0.3$

Compute $f''(x)$:
- $f'(x) = -\sin(x^2) \cdot 2x$
- $f''(x) = -2\sin(x^2) - 4x^2\cos(x^2)$

On $[0, 0.6]$: $x \leq 0.6$, $x^2 \leq 0.36$, so $|f''| \leq 2|\sin(0.36)| + 4(0.36)|\cos(0)| \approx 2(0.352) + 1.44 = 2.144$
Error $\leq 0.6 \cdot \tfrac{(0.3)^2}{12} \cdot 2.144 = 0.6 \cdot 0.0075 \cdot 2.144 = 0.00965 \approx 0.010$ — borderline

On $[0.6, 1.2]$: $x$ up to 1.2, $x^2$ up to 1.44, $|f''|$ is larger. Error will exceed 0.01 here.

**Standard conclusion:** "The error on $[0.6, 1.2]$ is expected to exceed the accuracy bound, so adaptive refinement is needed in that sub-interval."

---

## Standard Conceptual Questions and Answers

### "How does the adaptive trapezoid method work?"

1. Apply $T_1$ (one subinterval) over $[a,b]$
2. Apply $T_2$ (two subintervals) over $[a,b]$
3. Use error estimate: $|error| \approx \tfrac{1}{3}|T_2 - T_1|$
4. If error $>$ tolerance, split $[a,b]$ at midpoint and apply the same procedure recursively on $[a, (a+b)/2]$ and $[(a+b)/2, b]$
5. Sum up the contributions from sub-intervals where tolerance is met

This concentrates computation where $f$ is oscillatory or changes rapidly, rather than using the same step size everywhere.

### "How does error scale if h is halved?"
- Trapezoid: global error $O(h^2)$ → halving $h$ reduces error by factor of 4
- Simpson: global error $O(h^4)$ → halving $h$ reduces error by factor of 16

### "Why is Simpson's rule better than Trapezoid?"
Simpson's rule is exact for polynomials up to degree 3 (despite using degree-2 piecewise parabolas), while trapezoid is exact only for degree 1. The error is $O(h^4)$ vs $O(h^2)$.

---

## Numerical Differentiation (also on formula sheet)

These formulas approximate derivatives using function values at nearby points.

| Formula | Expression | Error |
|---|---|---|
| 2-point forward | $f'(x) \approx (f(x+h) - f(x))/h$ | $O(h)$ |
| 3-point centred | $f'(x) \approx (f(x+h) - f(x-h))/(2h)$ | $O(h^2)$ |
| 3-point forward | $f'(x) \approx (-3f(x) + 4f(x+h) - f(x+2h))/(2h)$ | $O(h^2)$ |
| 5-point centred | $f'(x) \approx (f(x-2h) - 8f(x-h) + 8f(x+h) - f(x+2h))/(12h)$ | $O(h^4)$ |
| Second derivative | $f''(x) \approx (f(x+h) - 2f(x) + f(x-h))/h^2$ | $O(h^2)$ |

**Key insight:** Centred differences are always more accurate than one-sided differences for the same number of function evaluations.

---

## Quick Reference

| Rule | Weight pattern | Error order |
|---|---|---|
| Trapezoid | $\tfrac{1}{2}, 1, 1, \ldots, 1, \tfrac{1}{2}$ times $h$ | $O(h^2)$ |
| Midpoint | $1, 1, \ldots, 1$ at midpoints times $h$ | $O(h^2)$ |
| Simpson | $1, 4, 2, 4, \ldots, 4, 1$ times $h/3$ | $O(h^4)$ |
