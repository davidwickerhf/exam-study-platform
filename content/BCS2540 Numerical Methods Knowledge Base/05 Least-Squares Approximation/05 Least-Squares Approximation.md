# Topic 5 — Least-Squares Approximation

**Exercise sheet:** Exercise Sheet 5
**Formula sheet sections:** "Least-Squares Approximation" + "Legendre polynomials" + "Chebyshev polynomials" + "Fourier series"

---

## What the Exam Asks

From both mock exams, Q5 is:

1. **(a)** Use the Legendre recurrence to compute $P_k(x)$ for $k = 0, 1, 2, 3, 4$ at a given value $x$
2. **(b)** Compute $q_n(x) = \sum_{k=0}^n c_k P_k(x)$ at that same $x$ (coefficients $c_k$ are given)
3. **(c)** Explain conceptually why orthogonality leads to a simple formula for the square integral
4. **(d)** Compute $\int_{-1}^1 q_n(x)^2\,dx$ using the orthogonality result

This is one of the more formula-heavy topics, but parts (a) and (b) are completely mechanical once you know the Legendre recurrence.

---

## Core Concept

Instead of interpolating (passing through every data point), **least-squares approximation** finds the "best fit" function that minimizes the total squared error. For continuous approximation on $[-1,1]$, we expand in an orthogonal basis — the Legendre polynomials.

**Why orthogonal bases?** When the basis functions $\phi_i$ are orthogonal ($\int \phi_i \phi_j = 0$ for $i \neq j$), the formula for the coefficients $c_k$ decouples — each $c_k$ can be computed independently from the others.

---

## Formulas from the Sheet

### Legendre Polynomials — Recurrence
$$P_0(x) = 1, \quad P_1(x) = x$$
$$P_k(x) = \left(2 - \frac{1}{k}\right) x P_{k-1}(x) - \left(1 - \frac{1}{k}\right) P_{k-2}(x)$$

**Equivalently written as:**
$$P_k(x) = \frac{(2k-1)}{k} x P_{k-1}(x) - \frac{(k-1)}{k} P_{k-2}(x)$$

**Variable meanings:**
- $P_k(x)$ — the $k$th Legendre polynomial, evaluated at a specific $x$ value
- The recurrence builds each polynomial from the previous two

**Orthogonality:**
$$\int_{-1}^1 P_i(x) P_j(x)\,dx = 0 \quad \text{for } i \neq j$$
$$\int_{-1}^1 P_k(x)^2\,dx = \frac{2}{2k+1}$$

### Least-Squares Coefficients (orthogonal basis)
$$c_k = \frac{\int_{-1}^1 P_k(x) f(x)\,dx}{\int_{-1}^1 P_k(x)^2\,dx}$$

(The exam gives you the $c_k$ values directly — you don't need to compute these integrals.)

### Square Error for Orthogonal Functions
$$\int_{-1}^1 (f(x) - g(x))^2\,dx = \int_{-1}^1 f(x)^2\,dx - \sum_{k=0}^n \alpha_k c_k^2$$

where $\alpha_k = \int_{-1}^1 P_k(x)^2\,dx = \tfrac{2}{2k+1}$

---

## Step-by-Step Procedure: Legendre Recurrence

**Given:** value $x$ (e.g. $x = 0.7$), compute $P_0(x), P_1(x), P_2(x), P_3(x), P_4(x)$

1. $P_0 = 1$ (always)
2. $P_1 = x$ (always — just the x-value)
3. $P_2 = (2 - 1/2) x P_1 - (1 - 1/2) P_0 = \tfrac{3}{2} x^2 - \tfrac{1}{2}$
4. $P_3 = (2 - 1/3) x P_2 - (1 - 1/3) P_1 = \tfrac{5}{3} x P_2 - \tfrac{2}{3} P_1$
5. $P_4 = (2 - 1/4) x P_3 - (1 - 1/4) P_2 = \tfrac{7}{4} x P_3 - \tfrac{3}{4} P_2$

**Example at $x = 0.7$:**
- $P_0(0.7) = 1$
- $P_1(0.7) = 0.7$
- $P_2(0.7) = \tfrac{3}{2}(0.49) - \tfrac{1}{2} = 0.735 - 0.5 = 0.235$
- $P_3(0.7) = \tfrac{5}{3}(0.7)(0.235) - \tfrac{2}{3}(0.7) = \tfrac{5}{3}(0.1645) - \tfrac{2}{3}(0.7) = 0.2742 - 0.4667 = -0.1925$
- $P_4(0.7) = \tfrac{7}{4}(0.7)(-0.1925) - \tfrac{3}{4}(0.235) = -0.2366 - 0.1763 = -0.4129$

### Step-by-Step: Evaluate $q_n(x)$

**Given:** $c_k$ values for $k = 0, \ldots, n$, and $P_k(x)$ just computed

$$q_n(x) = c_0 P_0(x) + c_1 P_1(x) + c_2 P_2(x) + \cdots + c_n P_n(x)$$

Simply substitute and sum:

**Example at $x = 0.7$, $n = 4$, with $c_0 = 0.3086$, $c_1 = 0.2193$, $c_2 = -0.0842$, $c_3 = -0.1233$, $c_4 = -0.0267$:**

$$q_4(0.7) = 0.3086(1) + 0.2193(0.7) + (-0.0842)(0.235) + (-0.1233)(-0.1925) + (-0.0267)(-0.4129)$$
$$= 0.3086 + 0.1535 - 0.0198 + 0.0237 + 0.0110 = 0.4770$$

### Step-by-Step: Square Integral

**Compute $\int_{-1}^1 q_n(x)^2\,dx$** using:
$$\int_{-1}^1 q_n(x)^2\,dx = \sum_{k=0}^n c_k^2 \int_{-1}^1 P_k(x)^2\,dx = \sum_{k=0}^n c_k^2 \cdot \frac{2}{2k+1}$$

**Example for $n = 2$:** (compute $\int_{-1}^1 q_2(x)^2\,dx$)
- $k=0$: $c_0^2 \cdot \tfrac{2}{1} = (0.3086)^2 \cdot 2 = 0.09523 \cdot 2 = 0.19046$
- $k=1$: $c_1^2 \cdot \tfrac{2}{3} = (0.2193)^2 \cdot 0.6667 = 0.04809 \cdot 0.6667 = 0.03206$
- $k=2$: $c_2^2 \cdot \tfrac{2}{5} = (-0.0842)^2 \cdot 0.4 = 0.00709 \cdot 0.4 = 0.00284$
- Total: $0.19046 + 0.03206 + 0.00284 = 0.22536$

---

## Standard Conceptual Questions and Answers

### "Why does orthogonality give a simple formula for $\int q_n^2\,dx$?"

When you expand $q_n(x) = \sum_k c_k P_k(x)$ and square it:
$$q_n(x)^2 = \sum_i \sum_j c_i c_j P_i(x) P_j(x)$$

Integrating over $[-1, 1]$:
$$\int_{-1}^1 q_n^2\,dx = \sum_i \sum_j c_i c_j \int_{-1}^1 P_i P_j\,dx$$

By orthogonality, $\int P_i P_j = 0$ whenever $i \neq j$. So only the diagonal terms ($i = j$) survive:
$$= \sum_k c_k^2 \int_{-1}^1 P_k^2\,dx = \sum_k c_k^2 \cdot \frac{2}{2k+1}$$

**This is the standard exam answer — memorise the argument, not just the result.**

### "What are Chebyshev polynomials and when are they used?"
- $T_0 = 1$, $T_1 = x$, $T_{k+1}(x) = 2x T_k(x) - T_{k-1}(x)$
- Also orthogonal, but with weight function $w(x) = 1/\sqrt{1-x^2}$
- Used when you need to minimize the maximum pointwise error (Chebyshev nodes minimise the interpolation error product $\prod(x - x_i)$)
- Legendre is for $L^2$ minimisation (square error); Chebyshev for $L^\infty$ minimisation

### "Linear least-squares fitting — what do the formulas mean?"
Given data $(x_1, y_1), \ldots, (x_m, y_m)$, fit $g(x) = ax + b$ by minimizing $\sum (y_i - g(x_i))^2$.

The formula sheet gives:
$$a = \frac{\overline{XY} - \bar{X}\bar{Y}}{\overline{X^2} - \bar{X}^2}, \quad b = \bar{Y} - a\bar{X}$$
where $\bar{X} = \tfrac{1}{m}\sum x_i$, $\bar{Y} = \tfrac{1}{m}\sum y_i$, $\overline{XY} = \tfrac{1}{m}\sum x_i y_i$, $\overline{X^2} = \tfrac{1}{m}\sum x_i^2$

---

## Quick Reference

| Task | Key formula |
|---|---|
| Legendre recurrence | $P_k = (2 - 1/k)xP_{k-1} - (1 - 1/k)P_{k-2}$ |
| Norm of $P_k$ | $\int_{-1}^1 P_k^2\,dx = 2/(2k+1)$ |
| Evaluate $q_n(x)$ | $q_n = \sum_k c_k P_k(x)$ |
| Square integral | $\int q_n^2 = \sum_k c_k^2 \cdot 2/(2k+1)$ |
| LS coefficient | $c_k = \int P_k f\,dx / \int P_k^2\,dx$ |
