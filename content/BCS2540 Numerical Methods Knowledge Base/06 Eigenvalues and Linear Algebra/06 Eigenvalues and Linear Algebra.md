# Topic 6 — Eigenvalues and Linear Algebra

**Exercise sheet:** Exercise Sheet 6
**Formula sheet sections:** "Linear Algebraic Equations", "Orthogonality and Eigenvalues"

---

## What the Exam Asks

From both mock exams, Q6 is always:

1. **(a)** Apply one step of the QR method to a given matrix $A^{(1)}$ (with $A^{(0)}$ and $A^{(1)}$ already computed for you)
2. **(b)** Use the result to estimate the eigenvalues of $A$

The matrix is always small (2×2 in the mock) and you are partially walked through the computation — the exam gives you the QR factorization of the first step to save time.

---

## Core Concept

### Eigenvalues
$\lambda$ is an eigenvalue of $A$ if $Av = \lambda v$ for some non-zero vector $v$.
For a 2×2 matrix, eigenvalues satisfy $\det(A - \lambda I) = 0$.

**But for large matrices**, computing eigenvalues by the characteristic polynomial is unstable. Numerical methods like QR iteration are used instead.

### QR Method for Eigenvalues
The **QR algorithm** iteratively produces matrices $A^{(0)}, A^{(1)}, A^{(2)}, \ldots$ that converge to an upper triangular matrix. The **diagonal entries** of the converged matrix are the eigenvalues.

**One step of QR iteration:**
1. Factorize: $A^{(k)} = Q^{(k)} R^{(k)}$ (QR decomposition)
2. Reverse multiply: $A^{(k+1)} = R^{(k)} Q^{(k)}$

Key property: $A^{(k+1)} = R^{(k)} Q^{(k)} = (Q^{(k)})^T A^{(k)} Q^{(k)}$ — all matrices are **similar** to $A$, so they have the same eigenvalues. As iterations proceed, off-diagonal entries tend to zero.

---

## Formulas from the Sheet — What You Need

### QR Factorization via Givens Rotation (2×2 case)
For a 2×2 matrix $A = \begin{pmatrix} a & b \\ c & d \end{pmatrix}$, construct $Q$ as a rotation:
$$G = \begin{pmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{pmatrix} = \begin{pmatrix} a' & -b' \\ b' & a' \end{pmatrix}$$
where $a' = a/r$, $b' = c/r$, $r = \sqrt{a^2 + c^2}$ (normalization of first column).

Then $Q = G^T$ and $R = G A$, so that $A = Q R$.

### Householder Reflections (for larger matrices)
$$H = I - 2vv^T/v^Tv$$
Used to zero out entries below the diagonal, producing the $R$ factor in QR. The formula sheet gives the construction for the upper Hessenberg form.

---

## Step-by-Step Procedure: One QR Step (2×2)

**Given:** $A^{(1)} = \begin{pmatrix} a & b \\ c & d \end{pmatrix}$

**Step 1: Find the QR factorization $A^{(1)} = Q^{(1)} R^{(1)}$**

To zero out the (2,1) entry using a Givens rotation:
- Let $r = \sqrt{a^2 + c^2}$ (norm of first column)
- $\cos\theta = a/r$, $\sin\theta = c/r$
- The rotation $G = \begin{pmatrix} \cos\theta & \sin\theta \\ -\sin\theta & \cos\theta \end{pmatrix}$ applied to $A^{(1)}$ from the left gives $R^{(1)} = G A^{(1)}$
- Then $Q^{(1)} = G^T = \begin{pmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{pmatrix}$

**Step 2: Compute $A^{(2)} = R^{(1)} Q^{(1)}$**

Multiply $R^{(1)}$ (upper triangular) by $Q^{(1)}$ (rotation).

**Mock exam example:** $A^{(1)} = \begin{pmatrix} 6.1036 & 0.7586 \\ 0.7586 & 1.8966 \end{pmatrix}$

**Find $r$ and rotation angles:**
- First column: $[6.1036,\ 0.7586]$
- $r = \sqrt{6.1036^2 + 0.7586^2} = \sqrt{37.254 + 0.5755} = \sqrt{37.829} = 6.1506$
- $\cos\theta = 6.1036 / 6.1506 = 0.9924$
- $\sin\theta = 0.7586 / 6.1506 = 0.1233$

**Compute $R^{(1)} = G A^{(1)}$:**
$$G = \begin{pmatrix} 0.9924 & 0.1233 \\ -0.1233 & 0.9924 \end{pmatrix}$$

Row 1 of $R$: $[0.9924 \cdot 6.1036 + 0.1233 \cdot 0.7586,\quad 0.9924 \cdot 0.7586 + 0.1233 \cdot 1.8966]$
$= [6.058 + 0.0935,\quad 0.7530 + 0.2339] = [6.1515,\ 0.9869]$

Row 2 of $R$: $[-0.1233 \cdot 6.1036 + 0.9924 \cdot 0.7586,\quad -0.1233 \cdot 0.7586 + 0.9924 \cdot 1.8966]$
$= [-0.7526 + 0.7528,\quad -0.0936 + 1.8820] = [0.0002 \approx 0,\ 1.7884]$

**Compute $A^{(2)} = R^{(1)} Q^{(1)}$** where $Q^{(1)} = G^T$:
$$Q^{(1)} = \begin{pmatrix} 0.9924 & -0.1233 \\ 0.1233 & 0.9924 \end{pmatrix}$$

$A^{(2)} = \begin{pmatrix} 6.1515 & 0.9869 \\ 0 & 1.7884 \end{pmatrix} \begin{pmatrix} 0.9924 & -0.1233 \\ 0.1233 & 0.9924 \end{pmatrix}$

Row 1: $[6.1515 \cdot 0.9924 + 0.9869 \cdot 0.1233,\quad 6.1515(-0.1233) + 0.9869 \cdot 0.9924]$
$= [6.1048 + 0.1217,\quad -0.7585 + 0.9794] = [6.2265,\ 0.2209]$

Row 2: $[0 \cdot 0.9924 + 1.7884 \cdot 0.1233,\quad 0 \cdot (-0.1233) + 1.7884 \cdot 0.9924]$
$= [0.2205,\ 1.7748]$

---

## Reading Eigenvalues from QR Iterates

As QR iterates, $A^{(k)}$ converges to upper triangular. The **diagonal entries** converge to the eigenvalues.

After two steps ($A^{(2)}$ computed above), the off-diagonal entries are getting smaller. The estimated eigenvalues are the diagonal entries:
$$\lambda_1 \approx 6.2265, \quad \lambda_2 \approx 1.7748$$

**Check:** eigenvalues of a 2×2 satisfy $\lambda_1 + \lambda_2 = \text{trace}(A) = 5 + 3 = 8$ ✓ ($6.2265 + 1.7748 \approx 8.0$) and $\lambda_1 \lambda_2 = \det(A) = 15 - 4 = 11$ ✓ ($6.2265 \times 1.7748 \approx 11.05$).

---

## Other Linear Algebra Topics (formula sheet — may appear in theory/quiz)

### Conditioning
$$K(A) = \|A\| \cdot \|A^{-1}\|$$
Measures sensitivity of $Ax = b$ to perturbations in $b$:
$$\frac{\|x - \tilde{x}\|}{\|x\|} \leq K(A) \frac{\|b - A\tilde{x}\|}{\|b\|}$$
Large condition number → ill-conditioned system → small changes in $b$ cause large changes in $x$.

### Iterative Solvers for $Ax = b$

| Method | Update rule | Convergence |
|---|---|---|
| Jacobi | $x_i^{(n+1)} = (b_i - \sum_{j\neq i} a_{ij} x_j^{(n)}) / a_{ii}$ | Diagonal dominance |
| Gauss-Seidel | Same but uses updated $x_j^{(n+1)}$ as soon as available | Faster than Jacobi |
| SOR | Gauss-Seidel with over-relaxation parameter $\omega$ | Optimal $\omega$ gives fastest convergence |

### LU Factorization
$PA = LU$. Solve $Ax = b$ by forward substitution ($Ly = Pb$) then back substitution ($Ux = y$).

### Power Method
Finds the **largest** eigenvalue iteratively:
1. Start with random $x^{(0)}$
2. $y^{(n)} = A x^{(n)}$
3. $x^{(n+1)} = y^{(n)} / \|y^{(n)}\|$
4. $\lambda_{\max} \approx y^{(n)}_i / x^{(n)}_i$ (ratio converges)

**Inverse power method** finds the eigenvalue closest to a shift $\mu$ by applying the power method to $(A - \mu I)^{-1}$.

---

## Standard Conceptual Questions and Answers

### "After QR iteration, how do you read off eigenvalues?"
When $A^{(k)}$ has converged (off-diagonal entries ≈ 0), the diagonal entries are the eigenvalues. For a 2×2 matrix after a few steps, the diagonal entries approximate the two eigenvalues.

### "Why does QR iteration work?"
Each $A^{(k+1)} = (Q^{(k)})^T A^{(k)} Q^{(k)}$ is similar to $A$ (same eigenvalues). The iterates converge to upper triangular form (Schur decomposition) under mild conditions.

### "What is the difference between QR factorization and QR iteration?"
- **QR factorization:** a one-time decomposition $A = QR$ (Q orthogonal, R upper triangular)
- **QR iteration:** repeating the factorize-and-swap process $A^{(k)} = Q^{(k)}R^{(k)}$, $A^{(k+1)} = R^{(k)}Q^{(k)}$ until convergence
