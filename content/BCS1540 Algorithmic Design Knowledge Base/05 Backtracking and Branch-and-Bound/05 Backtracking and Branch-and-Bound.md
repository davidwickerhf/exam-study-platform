# Topic 5 — Backtracking & Branch-and-Bound

**Lecture:** L9 (David Mestel)
**Reference:** `Materials/02 Lecture Slides/2026-backtrack.pdf`

---

## What the Exam Might Ask

This topic got **expanded** in 2025–26 compared to 2024. The model solutions for the 2024 final include this remark:

> "note that backtracking and branch-and-bound were covered in more detail this year than last year so there could be questions asking e.g. to actually write a backtrack or branch-and-bound algorithm"

**Possible exam questions:**
- Write a backtracking algorithm to solve a given NP-hard problem (e.g. SAT, Vertex-Cover, Knapsack).
- Define `extend`, `dead`, `complete`, and the generic loop for a specific problem.
- Add a `bound` function for branch-and-bound and explain how it prunes.
- Use the LP relaxation as the `bound` function (links to ILP topic).

---

## Why Backtracking?

When a problem is NP-complete (like CNF-SAT), we can't expect a polynomial algorithm. But:

- **Exhaustive search** (try all 2ⁿ assignments) wastes time on assignments that are obviously bad.
- **Backtracking** builds the solution **variable by variable**, **giving up early** whenever the partial assignment cannot be extended to a valid solution.

### Intuition (CNF-SAT example)

If the formula contains the clause $(x₁ + ¬x₂)$, then any assignment with `x₁ = 0` AND `x₂ = 1` makes that clause false → entire formula false. So we can skip all $2^(n-2)$ such assignments.

---

## Generic Backtracking Framework

Define:
- **Partial solution:** an assignment to a subset of decision variables (with the rest "not yet set").
- **`extend(a, i)`:** given a partial solution a and a choice index i (e.g. "which variable to set next"), return the set of partial solutions extending a by one step.
- **`dead(b)`:** true if b is a partial solution that cannot be extended to a valid solution (e.g. already falsifies a clause).
- **`complete(b)`:** true if b is a full valid solution.

**Key correctness property:** for every choice of i, every solution extending a must extend some element of `extend(a, i)`.

### Generic pseudocode

```
solve():
    set X := {a_0}                    // start with empty partial assignment
    while X is nonempty:
        pick a in X and choice i allowed for a
        for b in extend(a, i):
            if dead(b): continue
            if complete(b): return b
            X.add(b)
    return NO
```

### Concrete: SAT backtracking

For CNF-SAT with formula φ:
- Partial solutions: variable assignments where each xᵢ is set to 0, 1, or unset.
- `extend(a, i)` (for unset variable i): two assignments — one with xᵢ = 0, one with xᵢ = 1.
- $contr(a, φ)$: true if a already falsifies some clause of φ.
- `complete(a)`: true if all variables are set.

```
solve(φ):
    set X := {a_0}                    // empty assignment
    while X is nonempty:
        pick a in X and i such that variable i is not set in a
        for b in branch(a, i):
            if contr(b, φ): continue
            if complete(b): return b
            X.add(b)
    return UNSAT
```

### Worked example: Vertex-Cover

Decision problem: does G have a vertex cover of size ≤ k?

- **Partial solution:** for each vertex, "in cover", "not in cover", or "undecided".
- **`extend(a, v)`** (for undecided vertex v): two partial solutions — v ∈ cover, v ∉ cover.
- **`dead(b)`:** (1) cover size > k, or (2) some edge has both endpoints undecided-or-out (impossible to cover later because we'd need to add a vertex from that edge but we've already decided both).
- **`complete(b)`:** all vertices decided AND every edge has at least one endpoint in cover.

### n-Queens problem

Partial solution: a placement of queens on the first k rows. `extend` places one queen in row k+1 (8 choices). `dead`: queen attacks an existing queen. `complete`: queens placed on all n rows without attacks.

---

## Branch-and-Bound (for Optimization Problems)

Backtracking solves **decision problems**. For optimization, we want the **best** complete solution, so:

- Track `bestcost` (the best full solution found so far).
- A **`bound(a)`** function gives a lower bound (for minimization) on the cost of any solution extending a.
- Prune partial solution b if `bound(b) > bestcost` — no solution extending b can beat what we have.

### Generic pseudocode

```
solve():
    set X := {a_0}
    set bestcost := INFINITY
    set bestsol := NIL
    while X is nonempty:
        pick a in X and i allowed for a
        for b in extend(a, i):
            if bound(b) >= bestcost: continue       // prune
            if complete(b):
                if cost(b) < bestcost:
                    bestcost := cost(b)
                    bestsol := b
            else:
                X.add(b)
    return bestcost, bestsol
```

### Designing `bound`

Possible bounds for minimization:
- **Cost so far** — trivial lower bound (assumes free completion).
- **Cost so far + cheap lower bound on completion** — better.
- **For Knapsack (maximization):** value so far + fractional Knapsack on remaining items (greedy by value/weight). Provides an upper bound on what could be achieved.
- **For Vertex-Cover:** greedy maximum matching size; we need at least one vertex per matching edge.
- **For ILP-formulated problems:** LP fractional relaxation gives a bound (links to next topic).

---

## The Bound–Branch Loop with LP

The classic combination (covered in linear programming lecture):

1. Express the optimization problem as an ILP.
2. Run branch-and-bound where:
   - At each node, solve the **LP relaxation** of the remaining ILP (drop integrality).
   - Bound = the LP optimum (a valid bound since LP ≥ ILP for maximization).
   - If the LP solution is already integral, we're done with this subtree.
   - Otherwise, pick a variable with fractional LP value (e.g. closest to 0.5) and **branch** on it: one child fixes it to floor, the other to ceiling.

This is the standard approach in commercial ILP solvers (Gurobi, CPLEX). The LP relaxation gives tight bounds for many problems.

---

## Standard Conceptual Questions and Answers

### "When should I use backtracking instead of DP?"
DP works when subproblems overlap and have polynomial-size state. Backtracking works when the search space is exponential and we can prune aggressively. For NP-hard problems with no good DP (e.g. SAT, hard graph problems), backtracking is the default.

### "How does backtracking improve over brute force?"
By detecting infeasibility **early** — pruning a whole subtree of the search space as soon as we know it can't lead to a solution.

### "What makes a good `bound` function?"
Tight (close to the true optimum of extensions) and cheap (fast to compute). Trade-off: a tighter bound prunes more but takes longer per node. LP relaxation is often a good sweet spot.

### "Does backtracking always terminate?"
Yes if the search tree is finite (e.g. finite number of variables, finite choices). For continuous problems, you need other techniques.

### "Worst-case runtime?"
Still exponential. Backtracking and B&B are heuristic accelerations — they don't change the worst-case complexity, but they perform vastly better in practice on most real instances.

---

## Quick Reference

| Concept | Backtracking | Branch-and-Bound |
|---|---|---|
| Used for | Decision problems | Optimization problems |
| Pruning by | `dead(b)` (infeasibility) | $bound(b) \geq bestcost$ (provably worse) |
| Standard `bound` for ILP | n/a | LP fractional relaxation |
| Termination | Exhausts X or finds solution | Finite tree, exhausts X |
| Worst-case time | Still exponential | Still exponential |

### Backtracking exam template

```
solve():
    X := {a_0}
    while X not empty:
        pick a, pick choice i
        for b in extend(a, i):
            if dead(b): continue
            if complete(b): return b
            X.add(b)
    return NO
```

### B&B exam template

```
solve():
    X := {a_0}; bestcost := INF
    while X not empty:
        pick a, pick choice i
        for b in extend(a, i):
            if bound(b) >= bestcost: continue
            if complete(b) and cost(b) < bestcost:
                bestcost := cost(b); bestsol := b
            else: X.add(b)
    return bestsol
```

---

## Practice Problems

- Sudoku solver (lecture exercise)
- Tutorial Week 4 — backtracking, B&B, ILP exercises
- Goodrich & Tamassia C-18.2, C-18.3, C-18.4
- The 2024 model solutions explicitly suggest writing a backtracking or B&B algorithm could be a question this year

> **Friend's exam template:** "Define partial solution. Define extend, dead, complete. Write the generic loop. For B&B, add cost and bound. Use LP relaxation as bound if ILP-formulable."
