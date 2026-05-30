# Topic 2 — Master Theorem & Divide and Conquer

**Lectures:** L3 Master Theorem (David Mestel) + L4 Divide and Conquer (Steven Chaplick)
**Reference:** `Materials/02 Lecture Slides/lecture3-mastertheorem.pdf`, `cs1540-week2-part2_flattened.pdf`
**Tutorial:** `Materials/04 Tutorial Exercises/Week2-part2-*.pdf`

---

## What the Exam Asks

From the 2024 final, Q2 is always:

- **(a)(b)(c) — 3 recurrences at 4 pts each = 12 pts total.** Apply Master Theorem and give a **brief** justification.

Each sub-part is a one-line answer: identify case, state the result. The mock examples were:

- $T(n) = 6 T(n/2) + n \to$ Case 1 (recursive work wins), $T(n) = \Theta(n^{\log_2 6})$.
- $T(n) = 8 T(n/2) + 2^n \to$ Case 3 (recombination wins), $T(n) = \Theta(2^n)$.
- $T(n) = 2 T(n/4) + \sqrt{n} \to$ Case 2 (both match), $T(n) = \Theta(\sqrt{n} \log n)$.

> Strategy: **drill the comparison and case selection**. This is the most mechanical 12 points on the exam.

---

## The Master Theorem (Simple Form — Memorise)

Given a recurrence of the form

$$T(n) = a T(n/b) + \Theta(n^c) \quad \text{for } n \geq d, \qquad T(n) = 1 \quad \text{for } n < d$$

where $a \geq 1$, $b > 1$, $c \geq 0$. Compare $c$ with $\log_b a$:

| Case | Condition | Result |
|---|---|---|
| **1 — recursive work wins** | $c < \log_b a$ | $T(n) = \Theta(n^{\log_b a})$ |
| **2 — they match** | $c = \log_b a$ | $T(n) = \Theta(n^c \cdot \log n)$ |
| **3 — recombination wins** | $c > \log_b a$ | $T(n) = \Theta(n^c)$ |

**Equivalent comparison:** compare $b^c$ with $a$. (Since $c = \log_b a \Leftrightarrow b^c = a$.)

---

## The Master Theorem (General Form)

Given $T(n) = a T(n/b) + f(n)$. Compare $f(n)$ with $n^{\log_b a}$:

| Case | Condition on $f(n)$ | Result |
|---|---|---|
| **1** | $f(n) = O(n^{\log_b a - \varepsilon})$ for some $\varepsilon > 0$ | $T(n) = \Theta(n^{\log_b a})$ |
| **2** | $f(n) = \Theta(n^{\log_b a} \cdot \log^k n)$ for some $k \geq 0$ | $T(n) = \Theta(n^{\log_b a} \cdot \log^{k + 1} n)$ |
| **3** | $f(n) = \Omega(n^{\log_b a + \varepsilon})$ for some $\varepsilon > 0$ | $T(n) = \Theta(f(n))$ |

**The $\varepsilon$ intuition.** $f(n)$ must beat $n^{\log_b a}$ by a **polynomial** factor, not just a log factor. So $f(n) = n^{\log_b a} \cdot \sqrt{n}$ is case 3, but $f(n) = n^{\log_b a} \cdot n^{1/n}$ is **not** case 1 (the gap shrinks to nothing).

> **It is possible none of the three cases applies** — e.g. $f(n) = n^{\log_b a} / \log n$ falls between case 1 and case 2.

---

## Three Steps to Apply the Master Theorem

1. **Write the recurrence in the form $T(n) = a T(n/b) + f(n)$.** Identify $a$, $b$, and $f(n)$.
2. **Compute the threshold $n^{\log_b a}$** and compare with $f(n)$.
3. **Pick the case and write down the result.**

### Worked example: Mergesort

$$T(n) = 2 T(n/2) + \Theta(n)$$

- $a = 2$, $b = 2$, $c = 1$.
- $\log_b a = \log_2 2 = 1$.
- $f(n) = n^1$, $n^{\log_b a} = n^1$ — they match (with $k = 0$).
- **Case 2:** $T(n) = \Theta(n \log n)$.

### Worked example: Binary search

$$T(n) = T(n/2) + \Theta(1)$$

- $a = 1$, $b = 2$, $c = 0$.
- $\log_b a = \log_2 1 = 0$.
- $n^{\log_b a} = n^0 = 1$, $f(n) = 1$ — they match.
- **Case 2:** $T(n) = \Theta(\log n)$.

### Worked example: Karatsuba

$$T(n) = 3 T(n/2) + \Theta(n)$$

- $a = 3$, $b = 2$, $c = 1$.
- $\log_b a = \log_2 3 \approx 1.585$.
- $c = 1 < 1.585$ — **Case 1:** $T(n) = \Theta(n^{\log_2 3}) \approx \Theta(n^{1.585})$.

### Worked example: Mock Q2(a)

$$T(n) = 6 T(n/2) + n$$

- $a = 6$, $b = 2$, $c = 1$.
- $\log_b a = \log_2 6 > 2 > 1 = c$.
- **Case 1:** $T(n) = \Theta(n^{\log_2 6})$.

### Worked example: Mock Q2(b)

$$T(n) = 8 T(n/2) + 2^n$$

- $a = 8$, $b = 2$, $f(n) = 2^n$.
- $n^{\log_b a} = n^{\log_2 8} = n^3$.
- $2^n$ is "way bigger" than $n^3$ (super-polynomially) — **Case 3:** $T(n) = \Theta(2^n)$.

### Worked example: Mock Q2(c)

$$T(n) = 2 T(n/4) + \sqrt{n}$$

- $a = 2$, $b = 4$, $f(n) = \sqrt{n} = n^{1/2}$.
- $n^{\log_b a} = n^{\log_4 2} = n^{1/2}$.
- They match ($k = 0$) — **Case 2:** $T(n) = \Theta(\sqrt{n} \cdot \log n)$.

---

## Other Methods (When Master Theorem Doesn't Apply)

### Iterative Substitution

Repeatedly substitute the recurrence into itself, look for a pattern, then solve for the depth using the base case.

```
T(n) = 2T(n/2) + n
     = 2(2T(n/4) + n/2) + n = 4T(n/4) + 2n
     = 4(2T(n/8) + n/4) + 2n = 8T(n/8) + 3n
     ...
     = 2^i T(n/2^i) + i·n
Set n/2^i = 1  ⟹  i = log_2 n
T(n) = n·T(1) + n log n = O(n log n)
```

Then **verify**: plug the guessed solution back into the recurrence and check it works.

### Recursion Tree

Draw all calls as a tree. Sum the work at each level, multiply by the number of levels. For mergesort: each level does $O(n)$ work, $\log n$ levels $\to O(n \log n)$. Good for intuition; less rigorous than Master Theorem.

### Guess and Check

Guess $T(n) = n \log n + n$ for mergesort, verify by substitution:

$$2 T(n/2) + n = 2 \left(\frac{n}{2} \log \frac{n}{2} + \frac{n}{2}\right) + n = n \log n - n + n + n = n \log n + n \;\checkmark$$

---

## Divide & Conquer Algorithms Covered

| Algorithm | Recurrence | Solution |
|---|---|---|
| Mergesort | $T(n) = 2 T(n/2) + n$ | $\Theta(n \log n)$ |
| Binary search | $T(n) = T(n/2) + 1$ | $\Theta(\log n)$ |
| Linear-time select (median of medians) [GT 9.2, CLRS 9.3] | $T(n) = T(n/5) + T(7n/10) + n$ (not master-friendly) | $\Theta(n)$ |
| Karatsuba integer multiplication | $T(n) = 3 T(n/2) + n$ | $\Theta(n^{\log_2 3}) \approx \Theta(n^{1.585})$ |
| Convex hull (split + merge bridges) | $T(n) = 2 T(n/2) + n$, plus initial $\Theta(n \log n)$ sort | $\Theta(n \log n)$ |
| Closest pair of points | $T(n) = 2 T(n/2) + n$ | $\Theta(n \log n)$ |
| Black-box convex minimisation (golden-section) | $T(n) = T(0.62 n) + 1$ | $\Theta(\log n)$ |

### Karatsuba — the classic D&C improvement

To multiply two $n$-bit numbers $I = I_H \cdot 2^{n/2} + I_L$, $J = J_H \cdot 2^{n/2} + J_L$:

Naïve approach (4 recursive multiplications): $T(n) = 4 T(n/2) + n \to \Theta(n^2)$.

**Karatsuba trick.** The middle term $I_L J_H + I_H J_L$ can be computed from **3** sub-multiplications instead of 4 by computing $(I_H + I_L)(J_H + J_L) - I_H J_H - I_L J_L$. This gives $T(n) = 3 T(n/2) + n \to \Theta(n^{\log_2 3})$.

---

## Standard Conceptual Questions and Answers

### "What's the runtime of mergesort?"

$T(n) = 2 T(n/2) + n \to$ Master Theorem case 2 $\to \Theta(n \log n)$.

### "Why doesn't iterative substitution always work?"

Some recurrences don't have a clean closed-form pattern, or the algebra gets nasty. Master Theorem handles these mechanically when they fit the form.

### "Why does the Master Theorem need polynomial gaps (the $\varepsilon$)?"

Without a polynomial gap, the comparison between $f(n)$ and $n^{\log_b a}$ doesn't dominate enough to push the sum into case 1 or 3 cleanly — there's a "gap" of cases the theorem doesn't cover.

### "What if I have $T(n) = T(n/2) + T(n/3) + n$?"

Master Theorem doesn't apply (uneven splits). Use the recursion tree or Akra-Bazzi (not examinable). For this specific one: sub-problems shrink by $1/2 + 1/3 = 5/6$ at each level, so it's geometric and converges to $\Theta(n)$.

---

## Quick Reference Card

> **Master Theorem in 30 seconds:**
>
> $T(n) = a T(n/b) + f(n)$. Let $p = \log_b a$.
>
> - $f(n) \ll n^p \to T(n) = \Theta(n^p)$ (case 1, recursion wins)
> - $f(n) \approx n^p \cdot \log^k n \to T(n) = \Theta(n^p \cdot \log^{k+1} n)$ (case 2, equal)
> - $f(n) \gg n^p \to T(n) = \Theta(f(n))$ (case 3, recombination wins)

---

## Practice Problems

- 2024 mock Q2 (three recurrences)
- Tutorial Week 2 part 2 exercises
- Goodrich & Tamassia R-11.1, C-11.3, C-11.4
- CLRS 4.5-1, 4.5-3, 4.5-4, 4-1, 4-2, 4-3
