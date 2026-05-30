# Self Tests — BCS1540 Algorithmic Design

Use these as quick recall checks. If you cannot answer one in 60 seconds, revisit the topic note.

> Answers are at the bottom of each section, separated by a `---`. Cover them while testing.

---

## Greedy

1. What is the greedy rule for **interval selection**?
2. What is the greedy rule for **interval scheduling** (labelling/colouring)?
3. Why does earliest start fail for interval selection?
4. State the exchange proof template in five sentences.
5. Why does Dijkstra require positive edge weights?
6. What's Prim's greedy rule for MST?
7. In the refueling-stops problem, what is the greedy choice?
8. What is a k-partial solution?

---

**Answers:**

1. Pick the next interval (in earliest-finish-time order) if it doesn't conflict with the last selected.
2. Process intervals in earliest-start-time order; assign each to the smallest label whose intervals don't conflict; create a new label only if needed.
3. Counter-example: one giant interval covering all the slot; selecting it forces skipping all the smaller ones.
4. (i) Let G = greedy, OPT = optimal with maximum overlap with G. (ii) Suppose G ≠ OPT, pick first disagreement j. (iii) Show greedy's choice is at least as good as OPT's. (iv) Exchange OPT's choice with greedy's: still valid, same objective, more overlap. (v) Contradiction → G = OPT.
5. With negative edges, a "long" path through a vertex w (with d(w) ≥ d(v)) could end up shorter than v's current distance. Use Bellman-Ford instead.
6. Grow T edge-by-edge; pick the minimum-cost edge connecting a vertex in T to one outside T.
7. From current position, refuel at the furthest reachable station before becoming unable to reach the next one (or the destination).
8. A valid solution to the problem restricted to the first k inputs in the greedy ordering.

---

## Master Theorem

Solve these recurrences. Identify case and state result.

1. $T(n) = 2T(n/2) + n$
2. $T(n) = 6T(n/2) + n$
3. $T(n) = 8T(n/2) + 2^n$
4. $T(n) = 2T(n/4) + \sqrt n$
5. $T(n) = 3T(n/2) + n$ (Karatsuba)
6. $T(n) = T(n/2) + 1$ (binary search)
7. $T(n) = 4T(n/2) + n²$ (matrix multiply-ish)
8. $T(n) = 2T(n/2) + n log n$ (general form needed)

---

**Answers:**

1. a=2, b=2, c=1. n^(log₂ 2) = n. Case 2 → **Θ(n log n)**.
2. a=6, b=2, c=1. n^(log₂ 6) > n. Case 1 → **Θ(n^(log₂ 6))**.
3. f(n) = 2ⁿ, n^(log₂ 8) = n³. 2ⁿ ≫ n³. Case 3 → **Θ(2ⁿ)**.
4. f(n) = √n, n^(log₄ 2) = n^(1/2) = √n. Case 2 → **Θ(√n · log n)**.
5. f(n) = n, n^(log₂ 3) ≈ n^1.585. Case 1 → **Θ(n^(log₂ 3))**.
6. a=1, b=2, c=0. n⁰ = 1, f(n) = 1. Case 2 → **Θ(log n)**.
7. f(n) = n², n^(log₂ 4) = n². Case 2 → **Θ(n² log n)**.
8. General form: f(n) = n log n = n^(log₂ 2) · log¹ n. Case 2 with k=1 → **Θ(n · log² n)**.

---

## Dynamic Programming

1. Define a DP table for max contiguous subarray sum.
2. Write the recurrence for 0-1 Knapsack.
3. What makes Knapsack O(nW) **pseudopolynomial** rather than polynomial?
4. What are the four required parts of a DP exam answer?
5. How do you reconstruct a solution from a DP table?
6. What's the recurrence for LCS?
7. State the TSP DP recurrence and its runtime.
8. Why is DP needed instead of greedy for Knapsack?

---

**Answers:**

1. $OPT[j] = max sum of a contiguous subarray ending at index j$.
2. $OPT[j, Z] = max(OPT[j-1, Z], v_j + OPT[j-1, Z - w_j])$. Base case $OPT[0, Z] = 0$.
3. The input encoding of W is `log W` bits, but the runtime is proportional to W (i.e. 2^(log W)) — exponential in input size, not polynomial.
4. (i) Table definition; (ii) recurrence + correctness; (iii) bottom-up algorithm + runtime; (iv) reconstruction.
5. Walk back through the table from the final cell; at each cell decide which branch of the recurrence was taken (compare values); record the choice; recurse on predecessor index.
6. $L(i,j) = 1 + L(i-1, j-1)$ if `s₁[i] = s₂[j]`, else `max(L(i-1, j), L(i, j-1))`. Base: $L(0, *) = L(*, 0) = 0$.
7. $OPT[S, v] = min { OPT[S - v, u] + c(u, v) : u \in S - v }$. Runtime **O(n² · 2ⁿ)**.
8. Local optima don't compose to global ones — greedy by value/weight ratio can be arbitrarily bad. The optimum requires considering combinations DP enumerates implicitly.

---

## NP-Completeness

1. What two conditions prove a problem NP-complete?
2. What is a certificate for Knapsack?
3. What is a certificate for Hamiltonian Cycle?
4. What does $L₁ \to L₂$ (polynomial-time reduction) mean formally?
5. If L₁ is NP-hard and $L₁ \to L₂$, what can you conclude about L₂?
6. Name three known NP-complete problems besides SAT.
7. What's the difference between NP-hard and NP-complete?
8. What is the Cook-Levin theorem?
9. Why does P = NP imply public-key crypto breaks?
10. How do you convert an optimization problem into a decision problem?

---

**Answers:**

1. (i) L ∈ NP (give certificate + poly-time verifier). (ii) L is NP-hard (reduce a known NP-hard problem to it).
2. A subset S of items, with a verifier that checks $Σ_{i\in S} w_i \leq C$ and $Σ_{i\in S} v_i \geq V$.
3. A permutation of vertices; verifier checks it visits each vertex exactly once and is a cycle in G.
4. A polynomial-time computable function `f` mapping instances of `L₁` to instances of `L₂` such that $l \in L₁ \Leftrightarrow f(l) \in L₂$.
5. L₂ is also NP-hard. (For any M ∈ NP, M → L₁ → L₂, so M → L₂.)
6. Examples: Vertex Cover, Independent Set, Clique, Subset Sum, Knapsack, Hamiltonian Cycle, TSP, 3-Colouring.
7. NP-hard = at least as hard as everything in NP (could be even harder, not necessarily in NP). NP-complete = NP-hard AND in NP — "hardest problems inside NP".
8. CNF-SAT is NP-complete — the first NP-completeness result. Proved by encoding any NP verifier as a Boolean formula. Used as the starting point for almost all other NP-completeness proofs.
9. Public-key crypto relies on certain problems (factoring, discrete log) being hard. If P = NP, all NP problems are solvable in poly time, including those — and similar hardness assumptions fall.
10. Add a threshold parameter T to the input. Decision: "is there a solution with cost ≤ T (or ≥ T)?" Use binary search on T to recover the optimization version.

---

## ILP / Linear Programming

1. Write the ILP for Vertex Cover.
2. What is fractional relaxation?
3. For minimization, is the relaxed LP optimum lower or higher than the ILP optimum?
4. What is LP duality?
5. What is a shadow price?
6. Why is LP in P but ILP NP-complete?
7. Can an LP have no solution?
8. Write an LP constraint that says "if item A is selected then item B must also be selected."

---

**Answers:**

1. ```
   x_v ∈ {0,1} for each v ∈ V
   minimize Σ_v x_v
   subject to x_u + x_v >= 1 for each (u,v) ∈ E
   ```
2. Drop the integrality constraint (e.g. replace $x \in {0,1}$ with $0 \leq x \leq 1$) to obtain an LP. Solvable in polynomial time.
3. Lower (or equal). The LP feasible region is larger, so its minimum is at most the ILP's minimum.
4. Every LP (primal) has a corresponding LP (dual) with the same optimum value. Each primal constraint becomes a dual variable.
5. A dual variable interpretable as the marginal value of one extra unit of the corresponding primal resource. Tells you which constraint to relax to improve the optimum.
6. LP feasible region is convex; the optimum is at a vertex and can be found by edge-walking (simplex) or interior-point methods in polynomial time. Forcing integer values is a combinatorial constraint that makes the problem NP-hard.
7. Yes. The constraints can be infeasible (e.g. $x \leq 1$ AND $x \geq 2$), or the objective can be unbounded in the feasible region (e.g. $max x_1$ with no upper bound on $x_1$). In either case the "optimum" is $\pm \infty$.
8. $x_A \leq x_B$ (if $x_A = 1$, then $x_B \geq 1$, so $x_B = 1$).

---

## Backtracking & Branch-and-Bound

1. Define `dead`, `extend`, and `complete`.
2. What does branch-and-bound add to backtracking?
3. What's a good `bound` function for Knapsack maximization in B&B?
4. How does LP relaxation serve as a bound function?
5. When is backtracking better than DP?
6. Does backtracking change the worst-case runtime of NP-complete problems?
7. What's the analogue of `dead` for B&B?

---

**Answers:**

1. `extend(a, i)`: returns the set of partial solutions obtained by extending `a` with one more decision at slot `i`. `dead(b)`: true if partial solution `b` cannot be extended to a valid full solution. `complete(b)`: true if `b` is already a full valid solution.
2. A `bound` function on partial solutions and a `bestcost` tracker. Prunes any subtree whose `bound` shows it can't beat `bestcost`.
3. Value-so-far plus the fractional Knapsack upper bound on the remaining items (greedy by value/weight ratio).
4. At each search node, solve the LP relaxation of the remaining ILP. Its optimum is a valid bound (upper bound for max, lower for min) on the best full ILP solution extending this partial assignment.
5. When subproblems don't overlap (so DP gains nothing), or the search space is exponential but has good pruning structure (typical for NP-complete problems like SAT, vertex cover).
6. No — still exponential worst-case. It just performs vastly better on typical instances by pruning.
7. The check $bound(b) \geq bestcost$ (for minimization) or $bound(b) \leq bestcost$ (for maximization). When true, prune.

---

## Cross-Topic Conceptual

1. Why is greedy easier to prove correct than DP?
2. Why is the Master Theorem useful for D&C analysis?
3. How is the 4-step DP format different from the 5-step DP roadmap?
4. Could a polynomial DP solve TSP?
5. What's the relationship between NP-completeness and the LP/ILP gap?

---

**Answers:**

1. Greedy proofs have a single template (exchange argument). DP proofs require arguing the recurrence covers all optimal solutions, which is more case-by-case.
2. Most D&C runtimes have the form $T(n) = aT(n/b) + f(n)$ — Master Theorem solves these in 30 seconds with no algebra.
3. The 5-step roadmap (SC's version) adds "Recursive Structure" as an explicit first step before "Table." Functionally equivalent — the 2024 exam used the 4-step version explicitly.
4. No. TSP is NP-complete, so any DP solving it must be at least exponential in the input. The standard DP is **O(n² · 2ⁿ)** — best known.
5. ILP can express NP-complete problems exactly, but its LP relaxation is in P. The integrality gap (LP - ILP) measures how lossy the relaxation is — a large gap means LP bounds are weak.
