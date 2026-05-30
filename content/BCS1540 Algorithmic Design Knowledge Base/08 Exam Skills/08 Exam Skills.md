# Exam Skills — BCS1540 Algorithmic Design

Closed-book, 2 hours, no calculator. This exam rewards templates and readable structure.

---

## Time Budget

If the exam resembles the 2024 final:

| Question | Topic | Points | Time |
|---|---|---:|---:|
| Q1 | Greedy + proof | 12 | 18 min |
| Q2 | Master Theorem | 12 | 12 min |
| Q3 | Dynamic Programming | 18 | 28 min |
| Q4 | NP-completeness + ILP | 28 | 45 min |
| Buffer | review / rescue | — | 17 min |

Do not get trapped in the reduction. Bank Master Theorem and the easy parts of Q4 first if necessary.

---

## Universal Answer Rules

- Always define variables and table entries explicitly.
- Use pseudocode, not Java.
- State runtime at the end of every algorithm.
- Correctness proof can be short, but must name the invariant or exchange idea.
- If stuck, write the template and fill what you know. Partial credit is real in this course.

---

## Greedy Proof Template

```
Let G be the greedy solution.
Let OPT be an optimal solution with maximum overlap with G.
Assume G != OPT.
Let j be the first position where they differ.
By the greedy rule, G's choice is at least as good as OPT's choice.
Exchange OPT's choice for G's choice.
The result is still feasible, still optimal, and has more overlap with G.
Contradiction.
Therefore G is optimal.
```

This is the default. Adapt wording to intervals, edges, stops, or paths.

---

## Master Theorem Template

For $T(n) = aT(n/b) + f(n)$:

1. Compute $n^(log_b a)$.
2. Compare $f(n)$ to that.
3. State case and answer.

Examples:

- `f` smaller -> $\Theta (n^(log_b a))$
- `f` same -> $\Theta (n^(log_b a) log n)$
- `f` larger -> $\Theta (f(n))$

Write one sentence of justification for each recurrence.

---

## Dynamic Programming 4-Step Format

Always answer in this structure:

1. **Table definition:** $OPT[...]$ means exactly what?
2. **Recurrence:** formula + why these cases cover all optima.
3. **Bottom-up algorithm:** loop order + runtime.
4. **Reconstruction:** how to recover actual solution, not only value.

If you only remember one thing: **table meaning comes before recurrence.**

---

## NP-Completeness Template

```
1. Show L ∈ NP:
   certificate = ...
   verifier checks ... in polynomial time.

2. Show L is NP-hard:
   reduce from known NP-complete problem X.
   Given instance I of X, construct f(I) for L.
   Prove I is YES iff f(I) is YES.

Therefore L is NP-complete.
```

For selection-with-budget problems, try reducing from Knapsack or Subset-Sum.

---

## ILP Template

```
x_i = 1 iff choice i is made.
objective: maximize/minimize ...
budget/capacity constraints
coverage/feasibility constraints
x_i ∈ {0,1}
```

For fractional relaxation:

```
replace x_i ∈ {0,1} by 0 <= x_i <= 1
```

Then say: relaxation has more feasible solutions, so it gives a bound for branch-and-bound.

---

## Rescue Strategy

If you freeze:

1. Master Theorem first: cheap points.
2. Greedy pseudocode even without perfect proof.
3. DP table + recurrence even if reconstruction is shaky.
4. Q4(a) decision problem and Q4(b) NPC conditions are easy points.
5. ILP variables + objective + integrality before complicated constraints.

