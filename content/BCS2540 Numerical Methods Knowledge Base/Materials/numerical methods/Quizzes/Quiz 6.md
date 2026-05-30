# Numerical Methods Quiz — Report

**Date:** 15 May 2026
**Topics covered:** Iterative linear solvers (Jacobi, Gauss-Seidel), Gerschgorin discs, Power method, Gram-Schmidt orthogonalisation, QR method
**Score reported so far:** 8 points (out of total — grade pending)

---

## Question 1 — Matching methods to problem classes

**Task:** Match each numerical method to the problem class it solves.

| Method | Problem class |
|---|---|
| Conjugate-Gradient Method | Solving a linear system of equations |
| Power Method | Approximating Eigenvalues |
| Gram-Schmidt Procedure | Orthogonalisation |
| Jacobi Method | Solving a linear system of equations |
| QR Method | Approximating Eigenvalues |

**Notes:**
- CG: iterative solver for large sparse symmetric positive-definite systems.
- Power method: converges to the dominant eigenvalue and its eigenvector.
- Gram-Schmidt: builds an orthogonal (or orthonormal) basis from a linearly independent set.
- Jacobi (linear-system version): classical iterative solver using the diagonal split. Note that "Jacobi eigenvalue method" exists separately for symmetric matrices, but in standard numerical methods courses the unqualified term refers to the linear-system solver.
- QR method: repeated QR decomposition with reassembly `A ← RQ` to expose eigenvalues on the diagonal.

---

## Question 2 — Gauss-Seidel on a lower-triangular system

**Setup:** `Ax = b` where `A` is lower triangular with nonzero diagonal.

**Correct answer:** *The method reduces to forward substitution and produces the exact solution (up to roundoff errors) when x⁽¹⁾ is computed.*

**Reasoning:**

Gauss-Seidel splits `A = L + D + U` (strict lower, diagonal, strict upper) and iterates

$$(L + D)\, x^{(k+1)} = b - U\, x^{(k)}$$

If `A` is lower triangular, then `U = 0`, so the iteration collapses to

$$(L + D)\, x^{(k+1)} = b \;\Longleftrightarrow\; A\, x^{(k+1)} = b$$

This is exactly forward substitution and gives the exact solution after a single sweep, regardless of the initial guess.

**Why the others fail:**
- Diagonal-dominance argument is irrelevant — the iteration matrix is the zero matrix because `U = 0`.
- Positive-definiteness is unrelated; this is a structural simplification.
- "All iterative methods converge for triangular matrices" is false as a general claim.

---

## Question 3 — One Jacobi iteration

**System:**
```
10x₁ +   x₂ +   x₃ = 12
 2x₁ + 10x₂ +   x₃ = 13
 2x₁ +  2x₂ + 10x₃ = 14
```

**Task:** Compute `x₃⁽¹⁾` starting from `x⁽⁰⁾ = (0, 0, 0)`. Report in 1dp.

**Computation:**

$$x_3^{(1)} = \frac{1}{10}(14 - 2x_1^{(0)} - 2x_2^{(0)}) = \frac{14}{10} = 1.40$$

**Answer:** `1.4`

For context, the full first iterate is `x⁽¹⁾ = (1.20, 1.30, 1.40)`.

---

## Question 4 — Convergence of Jacobi vs Gauss-Seidel

**Setup:** Same system as Q3.

**Correct answer:** *Both methods are guaranteed to converge because the matrix A is strictly diagonally dominant.*

**Diagonal-dominance check** (row by row):
- Row 1: |10| = 10 > |1| + |1| = 2 ✓
- Row 2: |10| = 10 > |2| + |1| = 3 ✓
- Row 3: |10| = 10 > |2| + |2| = 4 ✓

**Theorem invoked:** If `A` is strictly diagonally dominant (by rows), then both Jacobi and Gauss-Seidel converge for any initial guess.

Symmetry is not required. The matrix here is in fact non-symmetric, but that is irrelevant.

---

## Question 5 — Gerschgorin discs

**Matrix:**
$$A = \begin{pmatrix} 6 & 3 & -1 \\ 3 & 5 & 2 \\ -1 & 2 & 4 \end{pmatrix}$$

**Gerschgorin's Theorem:** Each eigenvalue lies in at least one disc centred at `aᵢᵢ` with radius `Rᵢ = Σⱼ≠ᵢ |aᵢⱼ|`.

| Row | Centre | Radius | Real interval |
|---|---|---|---|
| 1 | 6 | 4 | [2, 10] |
| 2 | 5 | 5 | [0, 10] |
| 3 | 4 | 3 | [1, 7] |

**Answers from dropdowns:**
- λ₁ ∈ [2, 10]
- λ₂ ∈ [0, 10]
- λ₃ ∈ [1, 7]

**Consistency check:** trace(A) = 15, and the eigenvalues must sum to 15. Each chosen interval contains plausible real values whose sum reaches 15 (matrix is symmetric → eigenvalues are real).

---

## Question 6 — Power method statements

**Setup:** `A` is `n×n` with `|λ₁| > |λ₂| ≥ |λ₃| ≥ ... ≥ |λₙ|`.

**True statements:**

1. ✓ **The power method can be applied to A⁻¹ to determine λₙ.**
   The eigenvalues of `A⁻¹` are `1/λᵢ`. The largest in magnitude is `1/λₙ`, so power iteration on `A⁻¹` converges to that, from which `λₙ` is recovered. This is the **inverse power method**.

2. ✓ **The power method converges to λ₁.**
   Standard result given the strict dominance assumption and a starting vector with a nonzero component along the dominant eigenvector.

**False statements:**

- ✗ "Converges even if |λ₁| = |λ₂|" — strict dominance is required; equal magnitudes cause oscillation or rotation (e.g. complex-conjugate pairs).
- ✗ "Computes all eigenvalues simultaneously" — it produces only the dominant eigenvalue/eigenvector. Full spectrum requires QR algorithm or deflation.

---

## Question 7 — One step of the power method (eigenvalue estimate)

**Setup:**
$$A = \begin{pmatrix} 6 & 3 \\ 3 & 5 \end{pmatrix}, \quad x^{(0)} = \begin{pmatrix} 1 \\ 1 \end{pmatrix}$$

Work in 4dp, report in 2dp.

**Step 1:** `Ax⁽⁰⁾ = (9, 8)ᵀ`.

**Step 2 — Rayleigh quotient:**

$$\lambda \approx \frac{(x^{(0)})^T A x^{(0)}}{(x^{(0)})^T x^{(0)}} = \frac{9 + 8}{1 + 1} = \frac{17}{2} = 8.5000$$

**Answer reported:** `8.50`

**Verification:** True eigenvalues from `λ² − 11λ + 21 = 0` are `(11 ± √37)/2 ≈ 8.5414` and `2.4586`. The estimate 8.50 is already within 0.05 of the true dominant eigenvalue after a single step.

**Caveat to flag if marked wrong:** Some texts use the max-component-ratio convention (`9/1 = 9.00`) or infinity-norm ratio (also `9.00`). If the course's lecture notes define the power-method eigenvalue estimate differently, the expected answer could be `9.00`. Worth checking against the lecture slides.

---

## Question 8 — Gram-Schmidt orthogonalisation (not orthonormalisation)

**Matrix:**
$$A = \begin{pmatrix} 1 & 2 \\ 1 & 5 \end{pmatrix}, \quad a_1 = \begin{pmatrix} 1 \\ 1 \end{pmatrix},\; a_2 = \begin{pmatrix} 2 \\ 5 \end{pmatrix}$$

**Step 1:** `b₁ = a₁ = (1, 1)ᵀ`.

**Step 2:** Subtract projection of `a₂` onto `b₁`.

- `a₂ · b₁ = 2 + 5 = 7`
- `b₁ · b₁ = 1 + 1 = 2`
- Projection: `(7/2)(1, 1)ᵀ = (7/2, 7/2)ᵀ`
- `b₂ = a₂ − proj = (2 − 7/2, 5 − 7/2)ᵀ = (−3/2, 3/2)ᵀ`

**Orthogonality check:** `b₁ · b₂ = −3/2 + 3/2 = 0` ✓

**Answer:**
$$B = \begin{pmatrix} 1 & -3/2 \\ 1 & 3/2 \end{pmatrix}$$

---

## Question 9 — Gram-Schmidt on linearly dependent vectors

**Correct answer:** *You will get a zero vector as one of vᵢ vectors.*

**Reasoning:** If `aₖ ∈ span{a₁, ..., aₖ₋₁} = span{v₁, ..., vₖ₋₁}`, then the Gram-Schmidt subtraction removes exactly `aₖ` itself, leaving `vₖ = 0`.

**Distinction worth noting:** Division by zero only occurs at the *normalisation* step (`vₖ / ‖vₖ‖`) if you proceed to orthonormalise. The orthogonalisation procedure itself uses already-known nonzero `vᵢ · vᵢ` values in projection denominators, so the failure mode in pure orthogonalisation is the zero vector, not a division-by-zero.

**Quick example:** `a₁ = (1, 0)`, `a₂ = (2, 0)`. Then `v₁ = (1, 0)`, `v₂ = (2, 0) − 2(1, 0) = (0, 0)`. ✓

---

## Question 10 — MATLAB QR method (code completion)

**Task:** Apply two QR iterations to `A = [6 3; 3 5]`.

**Completed code:**
```matlab
A=[6 3; 3 5];

for i=1:2
    [Q,R]=qr(A);
    A=R*Q;
end
```

**Three blanks filled:**
1. Loop upper limit: `2`
2. QR decomposition call: `[Q,R]=qr(A)`
3. Reassembly: `R*Q`

**Why this works:** Since `A_k = Q_k R_k`, the update `R_k Q_k = Q_kᵀ A_k Q_k` is a similarity transformation, preserving eigenvalues. Iterating drives `A_k` toward upper-triangular form, exposing eigenvalues on the diagonal.

---

## Summary table

| Q | Topic | Answer | Confidence |
|---|---|---|---|
| 1 | Method ↔ problem class matching | CG/Jacobi → linear systems; Power/QR → eigenvalues; GS → orthogonalisation | High |
| 2 | Gauss-Seidel on lower-triangular A | Reduces to forward substitution at x⁽¹⁾ | High |
| 3 | One Jacobi iteration, x₃⁽¹⁾ | 1.4 | High |
| 4 | Jacobi & GS convergence on diag-dominant A | Both converge | High |
| 5 | Gerschgorin intervals | [2,10], [0,10], [1,7] | High |
| 6 | Power method true statements | Apply to A⁻¹ for λₙ; converges to λ₁ | High |
| 7 | Power method eigenvalue estimate | 8.50 (Rayleigh quotient) | High, with caveat |
| 8 | Gram-Schmidt orthogonal matrix | [[1, −3/2], [1, 3/2]] | High |
| 9 | Gram-Schmidt on dependent vectors | Get a zero vector | High |
| 10 | MATLAB QR iteration code | `for i=1:2`, `[Q,R]=qr(A)`, `A=R*Q` | High |

**Possible point of contention:** Q7 — if the course defines the one-step power method estimate as a component ratio rather than the Rayleigh quotient, the expected answer could be `9.00` rather than `8.50`. Worth verifying against lecture notes.
