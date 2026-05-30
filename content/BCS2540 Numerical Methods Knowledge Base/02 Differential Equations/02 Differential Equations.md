# Topic 2 — Differential Equations (ODE Solvers)

**Exercise sheet:** Exercise Sheet 2
**Formula sheet section:** "Differential Equations" (top-right of sheet)

---

## What the Exam Asks

From both mock exams, Q2 is always:

1. **(a)** Apply a specific RK method (usually Ralston's 2nd-order) for a given number of steps with step size h, computing y at a target t value
2. **(b)** How would the error change if step size h were halved?

You are always given: a differential equation $dy/dt = f(t, y)$, an initial condition $y(t_0) = y_0$, a step size $h$, and a target value of $t$.

---

## Core Concept

An ODE $dy/dt = f(t, y)$, $y(t_0) = y_0$ cannot always be solved analytically. Numerical methods build up approximate solution values $w_i \approx y(t_i)$ step by step from the initial condition.

At each step:
- You are at time $t_i$ with approximate value $w_i$
- You compute intermediate slopes (the $k$ values)
- You use a weighted combination of those slopes to get $w_{i+1}$

---

## Formulas from the Sheet — Key Methods

### Euler's Method (simplest, lowest accuracy)
$$w_{i+1} = w_i + h_i f(t_i, w_i)$$
- Local error: $O(h^2)$
- Uses one slope evaluation at the current point

### Ralston's 2nd-Order Method (most common in exams)
$$k_{i,1} = h_i f(t_i, w_i)$$
$$k_{i,2} = h_i f\!\left(t_i + \tfrac{2}{3}h_i,\; w_i + \tfrac{2}{3}k_{i,1}\right)$$
$$w_{i+1} = w_i + \tfrac{1}{4}(k_{i,1} + 3k_{i,2})$$
- Local error: $O(h^3)$
- Two slope evaluations per step

**Variable meanings:**
- $h_i$ — step size (often constant, written just as $h$)
- $t_i$ — current time value
- $w_i$ — current approximation of $y(t_i)$
- $f(t, w)$ — the right-hand side of the ODE (given in the problem)
- $k_{i,1}$ — scaled slope at the start of the interval
- $k_{i,2}$ — scaled slope at 2/3 of the way through the interval
- $w_{i+1}$ — new approximation at $t_{i+1} = t_i + h$

### Classical 4th-Order Runge-Kutta (RK4) — for reference
$$k_{i,1} = h_i f(t_i, w_i)$$
$$k_{i,2} = h_i f\!\left(t_i + \tfrac{1}{2}h_i,\; w_i + \tfrac{1}{2}k_{i,1}\right)$$
$$k_{i,3} = h_i f\!\left(t_i + \tfrac{1}{2}h_i,\; w_i + \tfrac{1}{2}k_{i,2}\right)$$
$$k_{i,4} = h_i f(t_i + h_i,\; w_i + k_{i,3})$$
$$w_{i+1} = w_i + \tfrac{1}{6}(k_{i,1} + 2k_{i,2} + 2k_{i,3} + k_{i,4})$$
- Local error: $O(h^5)$, global error $O(h^4)$
- Four slope evaluations per step — very accurate

---

## Step-by-Step Procedure: Ralston's Method

Given: $dy/dt = f(t, y)$, $y(t_0) = w_0$, step size $h$, find $y$ at $t = T$.

**Step 0:** Determine how many steps needed: $n = (T - t_0) / h$

**Each step $i = 0, 1, \ldots, n-1$:**

1. Compute $k_1 = h \cdot f(t_i, w_i)$
2. Compute $k_2 = h \cdot f\!\left(t_i + \tfrac{2}{3}h,\; w_i + \tfrac{2}{3}k_1\right)$
3. Compute $w_{i+1} = w_i + \tfrac{1}{4}(k_1 + 3k_2)$
4. Update: $t_{i+1} = t_i + h$

**Mock exam example:** $dy/dt = \tfrac{1}{t-1} - y^2$, $y(2) = 1.4$, $h = 0.5$, find $y(3)$

Number of steps: $(3 - 2) / 0.5 = 2$ steps

**Step 1** ($t_0 = 2$, $w_0 = 1.4$):
- $f(t, w) = \tfrac{1}{t-1} - w^2$
- $k_1 = 0.5 \cdot f(2, 1.4) = 0.5 \cdot (1 - 1.96) = 0.5 \cdot (-0.96) = -0.480$
- $t_i + \tfrac{2}{3}h = 2 + \tfrac{1}{3} = 2.333$
- $w_i + \tfrac{2}{3}k_1 = 1.4 + \tfrac{2}{3}(-0.480) = 1.4 - 0.320 = 1.080$
- $k_2 = 0.5 \cdot f(2.333, 1.080) = 0.5 \cdot (\tfrac{1}{1.333} - 1.166) = 0.5 \cdot (0.750 - 1.166) = 0.5 \cdot (-0.416) = -0.208$
- $w_1 = 1.4 + \tfrac{1}{4}(-0.480 + 3 \cdot (-0.208)) = 1.4 + \tfrac{1}{4}(-0.480 - 0.624) = 1.4 + \tfrac{1}{4}(-1.104) = 1.4 - 0.276 = 1.124$

**Step 2** ($t_1 = 2.5$, $w_1 = 1.124$): repeat the same process to get $w_2 \approx y(3)$

---

## Standard Conceptual Questions and Answers

### "How does the error change if h is halved?"

The answer depends on the **local error order** of the method:

| Method | Local error | Global error | Halve h → error scales by |
|---|---|---|---|
| Euler | $O(h^2)$ | $O(h)$ | $\times 1/2$ |
| Ralston 2nd order | $O(h^3)$ | $O(h^2)$ | $\times 1/4$ |
| Heun / Kutta 3rd order | $O(h^4)$ | $O(h^3)$ | $\times 1/8$ |
| Classical RK4 | $O(h^5)$ | $O(h^4)$ | $\times 1/16$ |

**Standard answer for Ralston (2nd order):** "Ralston's method has global error $O(h^2)$. Halving $h$ reduces the number of steps needed by half but halves $h$, so the global error scales as $(h/2)^2 = h^2/4$. The error is reduced by a factor of 4."

### "Why use a multi-stage method instead of Euler?"
Higher-order methods evaluate the slope at multiple points within the interval, giving a better approximation of the average slope over the step. This dramatically reduces the error for the same step size.

### "What is the difference between local and global error?"
- **Local error:** error introduced in a single step, assuming previous $w_i$ is exact
- **Global error:** accumulated error over all steps from $t_0$ to $T$
- Global error = $O(h^p)$ if local error = $O(h^{p+1})$

### "Adams-Bashforth vs Runge-Kutta — what's the difference?"
- RK methods are **one-step** (only need $w_i$ to compute $w_{i+1}$)
- Adams methods are **multi-step** (need several previous values $w_i, w_{i-1}, w_{i-2}, \ldots$)
- Adams-Bashforth is **explicit** (no $w_{i+1}$ on the right side)
- Adams-Moulton is **implicit** (uses $w_{i+1}$ on the right side → requires solving for it)

### "What is the Backward Euler method, and when is it useful?"
$$w_{i+1} = w_i + h_i f(t_{i+1}, w_{i+1})$$
Implicit (solve for $w_{i+1}$). Useful for **stiff** ODEs where explicit methods require very small $h$ to stay stable.

### "How do I do linear stability analysis?"
Use the test equation from Exercise Sheet 2:
$$y' = -\lambda y,\qquad \lambda > 0.$$

For any method, apply the formula sheet method to this test equation and rewrite the result as:
$$w_{i+1}=R(z)w_i,\qquad z=h\lambda.$$

The method is stable when:
$$|R(z)|\leq 1.$$

**Exam memory system:**
- First find the multiplier $R(z)$.
- Then impose $|R(z)|\leq 1$.
- The allowed values of $z=h\lambda$ give the stability region/radius.

Common results for $y'=-\lambda y$:

| Method | Formula-sheet method gives | Stability condition |
|---|---|---|
| Euler | $w_{i+1}=(1-z)w_i$ | $|1-z|\leq 1$, so $0\leq z\leq 2$ |
| Backward Euler | $w_{i+1}=\dfrac{1}{1+z}w_i$ | stable for all $z\geq 0$ |
| Implicit trapezoidal | $w_{i+1}=\dfrac{1-z/2}{1+z/2}w_i$ | stable for all $z\geq 0$ |

**Conceptual answer:** explicit methods can become unstable if $h\lambda$ is too large. Implicit methods such as backward Euler are useful for stiff ODEs because they remain stable for much larger step sizes.

---

## All Methods at a Glance

| Method | Steps | Local error | Explicit? |
|---|---|---|---|
| Euler | 1 | $O(h^2)$ | Yes |
| Ralston 2nd order | 2 | $O(h^3)$ | Yes |
| Heun 3rd order | 3 | $O(h^4)$ | Yes |
| Kutta 3rd order | 3 | $O(h^4)$ | Yes |
| Classical RK4 | 4 | $O(h^5)$ | Yes |
| 2-stage Adams-Bashforth | multi | $O(h^3)$ | Yes |
| 3-stage Adams-Bashforth | multi | $O(h^4)$ | Yes |
| 2-stage Adams-Moulton | multi | $O(h^4)$ | No (implicit) |
| Backward Euler | 1 | $O(h^2)$ | No (implicit) |

The formula sheet has the full formulas for all of these.
