# Mock Exam Full Walkthrough

Source: `mock_exam.pdf` / `mock2526 (2).pdf` — both contain the same 6 questions.
Use this as a self-test: cover the answers and attempt each question, then check.

---

## Q1 — Algebraic Equations

**Problem:** Find a root of $f(x) = e^x - 6x - 2 = 0$ on $[0, 4]$.

### (a) One step of Newton's method from midpoint of $[0, 4]$

Midpoint: $p_0 = 2$

- $f'(x) = e^x - 6$
- $f(2) = e^2 - 12 - 2 = 7.389 - 14 = -6.611$
- $f'(2) = e^2 - 6 = 7.389 - 6 = 1.389$
- $p_1 = 2 - (-6.611/1.389) = 2 + 4.760 = \mathbf{6.760}$

### (b) Is 6.760 within $[0, 4]$?

**No.** $6.760 > 4$, so the Newton step jumped outside the interval. This happens because at $p_0 = 2$, the function is negative ($f(2) < 0$) and the derivative is small, so the tangent line crosses zero far to the right.

### (c) One step of bisection from $[0, 4]$

- $f(0) = 1 - 0 - 2 = -1 < 0$
- $f(4) = e^4 - 24 - 2 = 54.598 - 26 = 28.598 > 0$
- Midpoint: $c = 2$
- $f(2) = -6.611 < 0$
- $f(2) < 0$ and $f(4) > 0$ → root in $[2, 4]$
- New bracket: **$[2, 4]$**

### (d) One step of Newton from midpoint of $[2, 4]$

Midpoint: $p_0 = 3$

- $f(3) = e^3 - 18 - 2 = 20.086 - 20 = 0.086$
- $f'(3) = e^3 - 6 = 20.086 - 6 = 14.086$
- $p_1 = 3 - (0.086/14.086) = 3 - 0.0061 = \mathbf{2.994}$

This result is within $[2, 4]$ ✓

### (e) Is 2.994 within 0.1 of the true solution?

**Yes.** The bisection bracket is $[2, 4]$, width 2. After one bisection, the error is bounded by 1. Newton's method, once close to the root (here $f(3) \approx 0$, very close), converges quadratically. The step was tiny ($0.006$), strongly suggesting convergence. Further, $f(2.994) \approx 0$, confirming proximity.

---

## Q2 — Differential Equations

**Problem:** $dy/dt = \tfrac{1}{t-1} - y^2$, $y(2) = 1.4$. Find $y(3)$ using Ralston's method, $h = 0.5$.

Number of steps: $(3 - 2)/0.5 = 2$

### Step 1: $t_0 = 2$, $w_0 = 1.4$, $h = 0.5$

$f(t, w) = \frac{1}{t - 1} - w^2$

- $k_1 = h \cdot f(2, 1.4) = 0.5 \cdot (1 - 1.96) = 0.5 \cdot (-0.96) = -0.480$
- $t + \tfrac{2}{3}h = 2.333$, $w + \tfrac{2}{3}k_1 = 1.4 - 0.320 = 1.080$
- $f(2.333, 1.080) = \tfrac{1}{1.333} - 1.080^2 = 0.750 - 1.166 = -0.416$
- $k_2 = 0.5 \cdot (-0.416) = -0.208$
- $w_1 = 1.4 + \tfrac{1}{4}(-0.480 + 3(-0.208)) = 1.4 + \tfrac{1}{4}(-0.480 - 0.624) = 1.4 - 0.276 = \mathbf{1.124}$

### Step 2: $t_1 = 2.5$, $w_1 = 1.124$, $h = 0.5$

- $k_1 = 0.5 \cdot f(2.5, 1.124) = 0.5 \cdot (\tfrac{1}{1.5} - 1.124^2) = 0.5 \cdot (0.667 - 1.263) = 0.5 \cdot (-0.596) = -0.298$
- $t + \tfrac{2}{3}h = 2.833$, $w + \tfrac{2}{3}k_1 = 1.124 - 0.199 = 0.925$
- $f(2.833, 0.925) = \tfrac{1}{1.833} - 0.925^2 = 0.546 - 0.856 = -0.310$
- $k_2 = 0.5 \cdot (-0.310) = -0.155$
- $w_2 = 1.124 + \tfrac{1}{4}(-0.298 + 3(-0.155)) = 1.124 + \tfrac{1}{4}(-0.298 - 0.465) = 1.124 - 0.191 = \mathbf{0.933}$

**$y(3) \approx 0.933$**

### (b) How does error change if $h = 0.25$?

Ralston's method has global error $O(h^2)$. Halving $h$ reduces the global error by a factor of $4$.

---

## Q3 — Polynomial Interpolation

**Problem:** data $(x_i, y_i)$: $(2.0, 0.40)$, $(1.5, 1.00)$, $(1.0, 1.82)$, $(3.0, 0.03)$. Given $f[x_0,x_1] = -1.200$, $f[x_1,x_2] = -1.640$.

### (a) Full divided differences table

| $x_i$ | $f[x_i]$ | 1st order | 2nd order | 3rd order |
|---|---|---|---|---|
| $x_0 = 2.0$ | $0.40$ | | | |
| $x_1 = 1.5$ | $1.00$ | $-1.200$ | | |
| $x_2 = 1.0$ | $1.82$ | $-1.640$ | $\mathbf{0.440}$ | |
| $x_3 = 3.0$ | $0.03$ | $\mathbf{-0.895}$ | $\mathbf{0.497}$ | $\mathbf{0.057}$ |

Calculations:
- $f[x_2, x_3] = (0.03 - 1.82)/(3.0 - 1.0) = -1.79/2 = -0.895$
- $f[x_0,x_1,x_2] = (-1.640 - (-1.200))/(1.0 - 2.0) = (-0.440)/(-1.0) = 0.440$
- $f[x_1,x_2,x_3] = (-0.895 - (-1.640))/(3.0 - 1.5) = 0.745/1.5 = 0.497$
- $f[x_0,x_1,x_2,x_3] = (0.497 - 0.440)/(3.0 - 2.0) = 0.057$

### (b) Nested form

Coefficients: $a_0 = 0.40$, $a_1 = -1.200$, $a_2 = 0.440$, $a_3 = 0.057$

$$p(x) = 0.40 + (x - 2.0)\bigl(-1.200 + (x - 1.5)\bigl(0.440 + (x - 1.0)(0.057)\bigr)\bigr)$$

### (c) Estimate $y$ at $x = 2.5$

Working from inside out:
1. $0.440 + (2.5 - 1.0)(0.057) = 0.440 + 0.0855 = 0.5255$
2. $-1.200 + (2.5 - 1.5)(0.5255) = -1.200 + 0.5255 = -0.6745$
3. $0.40 + (2.5 - 2.0)(-0.6745) = 0.40 - 0.3373 = \mathbf{0.063}$

---

## Q4 — Numerical Integration

**Problem:** Compute $I = \int_0^{1.2} \cos(x^2)\,dx$ to accuracy 0.01.

### (a) Trapezoid rule, $n = 4$

$h = 1.2/4 = 0.3$, nodes: $0.0, 0.3, 0.6, 0.9, 1.2$

| $x$ | $f(x) = \cos(x^2)$ |
|---|---|
| $0.0$ | $1.0000$ |
| $0.3$ | $\cos(0.09) = 0.9960$ |
| $0.6$ | $\cos(0.36) = 0.9356$ |
| $0.9$ | $\cos(0.81) = 0.6892$ |
| $1.2$ | $\cos(1.44) = 0.1367$ |

$$T_4 = 0.3 \cdot \left[\tfrac{1}{2}(1.0000) + 0.9960 + 0.9356 + 0.6892 + \tfrac{1}{2}(0.1367)\right]$$
$$= 0.3 \cdot [0.5000 + 0.9960 + 0.9356 + 0.6892 + 0.0684] = 0.3 \times 3.1892 = \mathbf{0.9568}$$

### (b) Error estimate on $[0, 0.6]$ and $[0.6, 1.2]$

Error formula: $|\text{error}| \approx (b-a) \cdot \tfrac{h^2}{12} \cdot \max|f''|$

$f(x) = \cos(x^2)$, $f'(x) = -2x\sin(x^2)$, $f''(x) = -2\sin(x^2) - 4x^2\cos(x^2)$

On $[0, 0.6]$: $\max|f''| \approx |f''(0.6)| = |{-2\sin(0.36) - 4(0.36)\cos(0.36)}| = |{-0.703 - 1.340}| = 2.043$
Error $\leq 0.6 \cdot (0.3)^2/12 \cdot 2.043 = 0.6 \cdot 0.0075 \cdot 2.043 = 0.00919 < 0.01$ ✓

On $[0.6, 1.2]$: $\max|f''|$ is larger (oscillates more), $|f''(1.2)| = |-2\sin(1.44) - 4(1.44)\cos(1.44)| \approx |-1.979 + 0.535| = 1.444$ ... but the product of terms grows: error $\approx 0.6 \cdot 0.0075 \cdot (\text{larger bound})$.
In practice, the error on $[0.6, 1.2]$ is expected to **exceed** 0.01, requiring refinement.

### (c) Adaptive trapezoid method (conceptual)

1. Apply $T_1$ to $[a,b]$, then $T_2$ to $[a,b]$
2. Estimate error: $|error| \approx \tfrac{1}{3}|T_2 - T_1|$
3. If $|error| >$ tolerance, split $[a,b]$ at midpoint; apply the same procedure recursively on each half
4. Accumulate contributions from sub-intervals that meet the tolerance

This concentrates computation in regions where $f$ changes rapidly (here, near $x = 1.2$ where $\cos(x^2)$ oscillates quickly).

---

## Q5 — Least-Squares Approximation

**Problem:** $q_n(x) = \sum_k c_k P_k(x)$, given $c_k$ for $k=0,\ldots,5$: $[0.3086, 0.2193, -0.0842, -0.1233, -0.0267, 0.0262]$

### (a) Legendre polynomials at $x = 0.7$

- $P_0(0.7) = 1$
- $P_1(0.7) = 0.7$
- $P_2(0.7) = \tfrac{3}{2}(0.49) - \tfrac{1}{2} = 0.235$
- $P_3(0.7) = \tfrac{5}{3}(0.7)(0.235) - \tfrac{2}{3}(0.7) = 0.2742 - 0.4667 = -0.1925$
- $P_4(0.7) = \tfrac{7}{4}(0.7)(-0.1925) - \tfrac{3}{4}(0.235) = -0.2366 - 0.1763 = -0.4129$

### (b) Compute $q_4(0.7)$

$$q_4(0.7) = 0.3086(1) + 0.2193(0.7) + (-0.0842)(0.235) + (-0.1233)(-0.1925) + (-0.0267)(-0.4129)$$
$$= 0.3086 + 0.1535 - 0.0198 + 0.0237 + 0.0110 = \mathbf{0.4770}$$

### (c) Orthogonality explanation

Expanding $q_n^2 = (\sum_i c_i P_i)(\sum_j c_j P_j)$ and integrating:
$$\int_{-1}^1 q_n^2 = \sum_{i,j} c_i c_j \int_{-1}^1 P_i P_j\,dx$$

By orthogonality, $\int P_i P_j = 0$ for $i \neq j$, so all cross terms vanish:
$$= \sum_k c_k^2 \int_{-1}^1 P_k^2\,dx = \sum_k c_k^2 \cdot \frac{2}{2k+1}$$

### (d) Compute $\int_{-1}^1 q_2(x)^2\,dx$

$$= c_0^2 \cdot \frac{2}{1} + c_1^2 \cdot \frac{2}{3} + c_2^2 \cdot \frac{2}{5}$$
$$= (0.3086)^2 \cdot 2 + (0.2193)^2 \cdot \tfrac{2}{3} + (-0.0842)^2 \cdot \tfrac{2}{5}$$
$$= 0.09523 \cdot 2 + 0.04809 \cdot 0.6667 + 0.00709 \cdot 0.4$$
$$= 0.19046 + 0.03206 + 0.00284 = \mathbf{0.22536}$$

---

## Q6 — Eigenvalues / QR Method

**Problem:** $A^{(0)} = \begin{pmatrix}5 & 2 \\ 2 & 3\end{pmatrix}$. After one QR step: $A^{(1)} = \begin{pmatrix}6.1036 & 0.7586 \\ 0.7586 & 1.8966\end{pmatrix}$.

### (a) Apply one QR step to $A^{(1)}$

**Find rotation to zero out (2,1) entry:**
- $r = \sqrt{6.1036^2 + 0.7586^2} = \sqrt{37.254 + 0.5755} = \sqrt{37.829} \approx 6.1506$
- $\cos\theta = 6.1036/6.1506 \approx 0.9924$, $\sin\theta = 0.7586/6.1506 \approx 0.1233$

**$G = \begin{pmatrix}0.9924 & 0.1233 \\ -0.1233 & 0.9924\end{pmatrix}$**

**$R^{(1)} = G \cdot A^{(1)}$:**
- Row 1: $[0.9924(6.1036) + 0.1233(0.7586),\ \ 0.9924(0.7586) + 0.1233(1.8966)] = [6.152,\ 0.987]$
- Row 2: $[-0.1233(6.1036) + 0.9924(0.7586),\ \ -0.1233(0.7586) + 0.9924(1.8966)] = [0,\ 1.788]$

**$Q^{(1)} = G^T = \begin{pmatrix}0.9924 & -0.1233 \\ 0.1233 & 0.9924\end{pmatrix}$**

**$A^{(2)} = R^{(1)} \cdot Q^{(1)}$:**
- Row 1: $[6.152(0.9924) + 0.987(0.1233),\ \ 6.152(-0.1233) + 0.987(0.9924)] = [6.105 + 0.122,\ -0.758 + 0.979] = [6.227,\ 0.221]$
- Row 2: $[1.788(0.1233),\ \ 1.788(0.9924)] = [0.220,\ 1.774]$

$$A^{(2)} \approx \begin{pmatrix}6.227 & 0.221 \\ 0.220 & 1.774\end{pmatrix}$$

### (b) Estimated eigenvalues

The off-diagonal entries are getting smaller ($0.221$ vs $0.7586$ after step 1). Diagonal entries converge to eigenvalues:
$$\lambda_1 \approx 6.23, \quad \lambda_2 \approx 1.77$$

**Verification:** $\lambda_1 + \lambda_2 \approx 8 = \text{trace}(A)$ ✓, $\lambda_1 \lambda_2 \approx 11 = \det(A)$ ✓
