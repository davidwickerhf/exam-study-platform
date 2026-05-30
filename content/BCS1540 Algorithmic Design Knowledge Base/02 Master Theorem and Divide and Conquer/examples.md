# Worked Examples — Divide & Conquer + Master Theorem

For every recurrence: identify $a$, $b$, $f(n)$; classify the case; state the result.

The Master theorem (for $T(n) = a \cdot T(n/b) + f(n)$, $a \geq 1$, $b > 1$):

- **Case 1.** $f(n) = O(n^{\log_b a - \epsilon})$ for some $\epsilon > 0$: $T(n) = \Theta(n^{\log_b a})$.
- **Case 2.** $f(n) = \Theta(n^{\log_b a} \cdot \log^k n)$ for $k \geq 0$: $T(n) = \Theta(n^{\log_b a} \cdot \log^{k+1} n)$.
- **Case 3.** $f(n) = \Omega(n^{\log_b a + \epsilon})$ AND $a \cdot f(n/b) \leq c \cdot f(n)$ for some $c < 1$: $T(n) = \Theta(f(n))$.

---

## Recurrence Walkthroughs

### Ex 1. $T(n) = 2T(n/2) + n$

$a = 2$, $b = 2$, $f(n) = n$. $\log_b a = 1$. $f(n) = \Theta(n^1) = \Theta(n^{\log_b a})$. **Case 2**, $k=0$. $T(n) = \Theta(n \log n)$. *(Merge sort.)*

### Ex 2. $T(n) = 6T(n/2) + n$

$a=6$, $b=2$, $f(n)=n$. $\log_2 6 \approx 2.585$. $f(n) = O(n^{2.585 - \epsilon})$. **Case 1**. $T(n) = \Theta(n^{\log_2 6})$.

### Ex 3. $T(n) = 8T(n/2) + 2^n$

Master theorem **does not apply**: $f(n) = 2^n$ grows superpolynomially. The recurrence's solution is $\Theta(2^n)$ (substitution: $T(n) = 2 \cdot T(n/2) \cdot 4 + 2^n$ — the $2^n$ term dominates).

### Ex 4. $T(n) = 2T(n/4) + \sqrt{n}$

$a=2$, $b=4$, $f(n)=n^{0.5}$. $\log_4 2 = 0.5$. $f(n) = \Theta(n^{0.5}) = \Theta(n^{\log_b a})$. **Case 2**, $k=0$. $T(n) = \Theta(\sqrt{n} \cdot \log n)$.

### Ex 5. $T(n) = 3T(n/2) + n$ (Karatsuba)

$a=3$, $b=2$, $\log_2 3 \approx 1.585$. $f(n) = n = O(n^{1.585 - \epsilon})$. **Case 1**. $T(n) = \Theta(n^{\log_2 3})$.

### Ex 6. $T(n) = T(n/2) + 1$ (Binary search)

$a=1$, $b=2$, $\log_b a = 0$, $f(n) = 1 = \Theta(n^0)$. **Case 2**, $k=0$. $T(n) = \Theta(\log n)$.

### Ex 7. $T(n) = 4T(n/2) + n^2$

$\log_2 4 = 2$, $f(n) = n^2 = \Theta(n^{\log_b a})$. **Case 2**, $k=0$. $T(n) = \Theta(n^2 \log n)$.

### Ex 8. $T(n) = 2T(n/2) + n \log n$ — Master theorem **does not directly apply**

$\log_2 2 = 1$. $f(n) = n \log n$. Polynomially equal but with a logarithmic factor: this fits the **extended** Case 2 with $k=1$: $T(n) = \Theta(n \log^2 n)$.

### Ex 9. $T(n) = 2T(n/2) + n^2$

$\log_2 2 = 1$, $f(n) = n^2 = \Omega(n^{1+\epsilon})$. Regularity check: $2 \cdot (n/2)^2 = n^2/2 \leq \frac{1}{2} n^2$. **Case 3**. $T(n) = \Theta(n^2)$.

---

## Divide & Conquer Skeletons

### Merge Sort

```
MERGE-SORT(A, lo, hi):
    if lo + 1 >= hi: return
    mid = (lo + hi) / 2
    MERGE-SORT(A, lo, mid)
    MERGE-SORT(A, mid, hi)
    MERGE(A, lo, mid, hi)
```

Runtime: $T(n) = 2T(n/2) + \Theta(n)$ → $\Theta(n \log n)$.

### Binary Search

```
BSEARCH(A, lo, hi, target):
    if lo >= hi: return -1
    mid = (lo + hi) / 2
    if A[mid] == target: return mid
    if A[mid] < target: return BSEARCH(A, mid+1, hi, target)
    return BSEARCH(A, lo, mid, target)
```

Runtime: $T(n) = T(n/2) + \Theta(1)$ → $\Theta(\log n)$.

### Counting Inversions (Merge-based)

```
COUNT-INVERSIONS(A, lo, hi):
    if hi - lo < 2: return 0
    mid = (lo + hi) / 2
    inv = COUNT-INVERSIONS(A, lo, mid)
        + COUNT-INVERSIONS(A, mid, hi)
        + MERGE-AND-COUNT(A, lo, mid, hi)
    return inv
```

Runtime: same as merge sort, $\Theta(n \log n)$.

### Closest Pair of Points (Sketch)

Divide by x-coordinate, recurse left/right, merge by checking the band of width $2\delta$ around the dividing line (sorted by y).

Recurrence: $T(n) = 2T(n/2) + \Theta(n)$ → $\Theta(n \log n)$.

---

## Common Exam Trap

> If $f(n)$ is polylogarithmic faster or slower than $n^{\log_b a}$ (not polynomially separated), Master theorem **doesn't apply** in its strict form. Use the extended version (Case 2 with $\log^{k+1}$) or substitution.
