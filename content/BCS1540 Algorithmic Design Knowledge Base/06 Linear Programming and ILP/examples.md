# Worked Examples — LP / ILP (Exam Shape)

The BCS1540 exam is **not** asking you to solve an LP by simplex or graphically. It is asking:

1. **Translate** a discrete combinatorial problem (often a known NP-hard one) into an **ILP** — declare variables, objective, constraints.
2. **State the fractional relaxation** of that ILP and what it gives you (a poly-time-solvable bound).
3. **Explain how the relaxation is used inside branch-and-bound** to prune.

That's the entire surface area. Every worked example below ends with a `(a)–(e)` skeleton matching the 2024 final Q4 pattern: decision problem · NP-complete conditions · reduction · ILP · relaxation.

---

## 1. Vertex Cover

**Decision problem.** Given graph $G = (V, E)$ and integer $k$: does $G$ have a vertex cover of size $\leq k$?

**ILP.**

- **Variables.** For each $v \in V$: $y_v \in \{0, 1\}$ (1 = $v$ is in the cover).
- **Objective.** $\min \sum_{v \in V} y_v$
- **Constraints.** For each edge $(u, v) \in E$: $y_u + y_v \geq 1$.

**Fractional relaxation.** Replace $y_v \in \{0, 1\}$ by $0 \leq y_v \leq 1$. Solvable in polynomial time. Gives a **lower bound** on the ILP optimum (the LP feasible region is a *superset*).

**Worked relaxation, tiny graph.** Triangle $K_3$ on $\{1, 2, 3\}$ with all three edges. Integer optimum: pick any 2 vertices, cost 2. LP relaxation: $y_1 = y_2 = y_3 = 1/2$ satisfies every edge ($1/2 + 1/2 \geq 1$) at cost $3/2 = 1.5$. The relaxation lower-bounds the ILP, and rounding $\geq 0.5$ to 1 gives a feasible cover of cost 3 — a **2-approximation** of the optimum.

**How B&B uses it.**

```
BB-VC(G, k):
    incumbent = +infinity
    Q = priority queue of (LP_lower_bound, partial_assignment)
    Q.push((solve_LP_relaxation(G), {}))
    while Q not empty:
        (bound, assignment) = Q.pop()
        if bound >= incumbent: continue                   # PRUNE by bound
        if assignment is fully integer:
            if cost(assignment) < incumbent:
                incumbent = cost(assignment)
            continue
        pick a fractional v in assignment (e.g. y_v = 0.5)
        # branch
        Q.push(solve_LP(G with y_v = 0) ∪ assignment ∪ {y_v = 0})
        Q.push(solve_LP(G with y_v = 1) ∪ assignment ∪ {y_v = 1})
    return incumbent
```

**Why this is a complete answer.** Variables/objective/constraints typed correctly + the relaxation is named + the role of the LP solution as a bound for B&B is explicit. That's full marks.

---

## 2. 3-SAT as ILP

**Decision problem.** Given a 3-CNF formula $\varphi = C_1 \land C_2 \land \ldots \land C_m$: is it satisfiable?

**ILP.**

- **Variables.** For each Boolean variable $x_i$: $z_i \in \{0, 1\}$ (1 = true).
- **Objective.** Any constant — there's nothing to optimise, just feasibility. Convention: $\min 0$.
- **Constraints.** For each clause $C_j$ with literals $\ell_{j,1}, \ell_{j,2}, \ell_{j,3}$:
  $$\text{(positive literal)} \; \ell_{j,k} = x_i \;\Rightarrow\; \text{term} = z_i$$
  $$\text{(negated literal)} \; \ell_{j,k} = \lnot x_i \;\Rightarrow\; \text{term} = 1 - z_i$$
  Constraint: $\text{term}_1 + \text{term}_2 + \text{term}_3 \geq 1$ (at least one literal true).
- **Domain.** $z_i \in \{0, 1\}$.

**Concrete instance.** $\varphi = (x_1 \lor \lnot x_2 \lor x_3) \land (\lnot x_1 \lor x_2 \lor \lnot x_3)$:

$$
\begin{aligned}
z_1 + (1 - z_2) + z_3 &\geq 1 \\
(1 - z_1) + z_2 + (1 - z_3) &\geq 1 \\
z_1, z_2, z_3 &\in \{0, 1\}
\end{aligned}
$$

**Fractional relaxation.** $z_i = 1/2$ satisfies *every* 3-clause (sum of three half-values is $3/2 \geq 1$). The LP relaxation is trivially feasible, so it gives **no useful information about SAT** — the relaxation gap is maximal. This is precisely **why 3-SAT is hard** and the LP relaxation does not yield a poly-time SAT decider; the integrality gap is large.

**Exam talking point.** Mentioning that the LP relaxation here is uninformative — and explaining *why* (half-values trivially satisfy 3-clauses) — distinguishes a good answer from a rote one.

---

## 3. 0/1 Knapsack as ILP — with B&B Bound Walkthrough

**Decision problem.** Given items $1..n$ with weights $w_i$, values $v_i$, capacity $W$, target $V$: is there a subset with total weight $\leq W$ and total value $\geq V$?

**ILP (optimisation form).**

- **Variables.** $x_i \in \{0, 1\}$ for each item.
- **Objective.** $\max \sum_i v_i \cdot x_i$
- **Constraints.** $\sum_i w_i \cdot x_i \leq W$, $x_i \in \{0, 1\}$.

**Fractional relaxation.** $0 \leq x_i \leq 1$ — the classic *fractional knapsack*. Solvable in $O(n \log n)$ by sorting items by $v_i / w_i$ descending and taking them whole until the next item overflows, then taking a *fraction* of the next item. Gives an **upper bound** on the ILP optimum.

**Concrete walkthrough.** Items $(v, w) = (60, 3), (100, 5), (120, 4)$, capacity $W = 7$.

Sort by density: $v/w = (20, 24, 30)$ → reorder to item 3, item 2, item 1.

- Take item 3 entirely: value 120, weight 4, remaining capacity 3.
- Try item 2: weight 5 > remaining 3 → take fractionally $3/5$: value += $100 \cdot 3/5 = 60$. Total value $180$.

LP relaxation upper bound = **180**. The actual ILP optimum is the subset $\{1, 3\}$: weight $3 + 4 = 7$, value $60 + 120 = 180$. **In this case the bound is tight**, but in general it's loose by $O(1)$ item value.

**How B&B uses it.**

```
BB-KNAPSACK(items, W):
    sort items by v_i / w_i descending
    incumbent = 0
    Q = stack of subproblems, root = (i=1, val=0, wt=0)
    Q.push(root)
    while Q not empty:
        node = Q.pop()
        bound = node.val + fractional_solve(items[i..n], W - node.wt)
        if bound <= incumbent: continue                    # PRUNE by relaxation
        if node.i > n:
            incumbent = max(incumbent, node.val); continue
        # branch
        if node.wt + w[i] <= W:                            # take item i
            Q.push((i+1, val + v[i], wt + w[i]))
        Q.push((i+1, val, wt))                             # skip item i
    return incumbent
```

**Why this is a complete answer.** Discrete problem stated → ILP variables/objective/constraints typed → LP relaxation named (fractional knapsack) and described as an upper bound → B&B pruning rule expressed in terms of the bound.

---

## 4. Set Cover

**Decision problem.** Given a universe $U$ of $n$ elements, sets $S_1, \ldots, S_m \subseteq U$ with costs $c_j$, integer $k$: is there a subcollection of total cost $\leq k$ whose union covers $U$?

**ILP.**

- **Variables.** $y_j \in \{0, 1\}$ — pick set $j$ or not.
- **Objective.** $\min \sum_j c_j y_j$.
- **Constraints.** For each element $i \in U$: $\sum_{j : i \in S_j} y_j \geq 1$.

**Fractional relaxation.** $0 \leq y_j \leq 1$. Polynomial-time. Lower-bounds the ILP optimum.

**Exam talking point.** The integrality gap for Set Cover can be as bad as $\Theta(\log n)$, but the LP relaxation still yields a $\Theta(\log n)$-approximation algorithm (LP + randomised rounding). Naming this connection is the kind of detail that earns full marks on "explain the role of the relaxation" parts.

---

## 5. Assignment Problem (Totally Unimodular — Special Case)

**Decision problem.** $n$ workers, $n$ tasks, cost matrix $c_{ij}$, threshold $T$: is there an assignment of each worker to exactly one task such that total cost $\leq T$?

**ILP.**

- **Variables.** $x_{ij} \in \{0, 1\}$.
- **Objective.** $\min \sum_{i,j} c_{ij} x_{ij}$.
- **Constraints.**
  $$
  \begin{aligned}
  \sum_j x_{ij} &= 1 \quad \forall i & \text{(each worker exactly one task)}\\
  \sum_i x_{ij} &= 1 \quad \forall j & \text{(each task exactly one worker)}
  \end{aligned}
  $$

**Fractional relaxation.** $0 \leq x_{ij} \leq 1$. **Special property:** the constraint matrix is *totally unimodular*, so the LP relaxation has an **integer optimum** — no rounding or branching needed. The LP solution is the ILP solution. Assignment is therefore in **P**, not NP-hard.

**Exam talking point.** "Total unimodularity ⇒ ILP solvable as LP" is the kind of result you can drop in to distinguish a special case from the general NP-hard ILP. Other examples: bipartite matching, max-flow, shortest path.

---

## 6. 2024 Final Q4 — Path-Upgrade Problem (Walkthrough)

This is the actual question structure. Memorise the form.

**(a) Decision problem** (5 marks). *Input:* a tree of towns connected by roads, each road has an upgrade cost $c_i$ and a baseline travel time $b_i$ (upgrade halves the time), nobles at $k$ towns, a budget $B$ and a target sum-of-arrival-times $T$. *Question:* is there a subset of road upgrades costing $\leq B$ such that $\sum_{\text{nobles}} (\text{arrival time}) \leq T$?

**(b) Conditions for NP-completeness** (2 marks).

1. The problem is in **NP** — given a candidate upgrade set, verify in polynomial time that its cost is $\leq B$ and the sum of arrival times is $\leq T$.
2. The problem is **NP-hard** — show by reducing a known NP-complete problem to it in polynomial time.

**(c) Reduction from Knapsack.** Given a Knapsack instance (items $w_i, v_i$, capacity $C$, value target $V$):

```
BUILD-INSTANCE(items, C, V):
    build a single path of n+1 towns
    for each item i:
        road i has cost  c_i = w_i
        road i has time  b_i = 2 * v_i
    one noble at the final town
    budget  B = C
    target  T = (sum_i 2 * v_i) - V
    return tree, costs, times, noble, B, T
```

Upgrading road $i$ saves $v_i$ time at cost $w_i$. Finding upgrades with total cost $\leq C$ that save at least $V$ time = original Knapsack. Polynomial construction; iff is by direct equivalence.

**(d) ILP formulation.**

- **Variables.** $u_i \in \{0, 1\}$ for road upgrades; $T_j \geq 0$ for arrival time at town $j$.
- **Objective.** $\min \sum_{j \in \text{nobles}} T_j$.
- **Constraints.**
  $$
  \begin{aligned}
  \sum_i c_i \cdot u_i &\leq B & \text{(budget)} \\
  T_j &\geq \sum_{i \in \text{path}(1, j)} (1 - u_i / 2) \cdot b_i \quad \forall j \in \text{nobles} & \text{(arrival time)}\\
  u_i &\in \{0, 1\} \\
  T_j &\geq 0
  \end{aligned}
  $$

**(e) Fractional relaxation.** Drop $u_i \in \{0, 1\}$ in favour of $0 \leq u_i \leq 1$. The resulting LP is solvable in polynomial time and gives a **lower bound** on the original minimisation problem. Inside branch-and-bound, the LP value of a node lower-bounds any extension — if it is already worse than the current incumbent, the subtree is pruned. Fractional $u_i \in (0, 1)$ values mark the variables to branch on (fix to 0 in one child, 1 in the other).

---

## 7. Common Exam Pitfalls

- **Missing the domain.** Writing $y_v$ without specifying $y_v \in \{0, 1\}$ turns an ILP answer into an LP answer — different problem, often wrong.
- **Forgetting non-negativity** on continuous variables ($T_j \geq 0$).
- **Solving the LP by hand.** Not asked. Simplex / graphical methods are *out of scope* for this paper. Don't burn time on them.
- **Confusing the direction of the bound.** For minimisation, the LP relaxation is a *lower* bound (LP value ≤ ILP value). For maximisation, it's an *upper* bound. Stating this incorrectly costs marks.
- **Vague "use LP relaxation for B&B" without saying how.** The full answer is: solve LP at each B&B node; if the LP value is worse than the incumbent (≤ for max, ≥ for min) the subtree is pruned.
- **Skipping the polynomial-time mapping check** when doing a reduction. The construction must be poly-time *and* the iff must be argued.

---

## 8. Cheat-Sheet — Answer Shape per Sub-Question

| Marks asked for | Skeleton to write |
|---|---|
| "Define decision problem" | Input: \<types\>. Question: yes/no on \<property\> with parameter \<threshold\>. |
| "Show it is in NP" | A verifier receives a candidate \<certificate\>, checks \<properties\> in polynomial time. |
| "Show it is NP-hard" | Polynomial reduction from \<known NP-complete problem\>. Construction + iff direction(s). |
| "Formulate as ILP" | Variables (with type). Objective (min/max). Constraints (each labelled). Domain. |
| "Describe the fractional relaxation" | Drop integrality → LP. Solvable in polynomial time. Gives a lower (min) / upper (max) bound on ILP. |
| "Use it for branch-and-bound" | At each node, solve LP relaxation. If LP value worse than incumbent, prune. Branch on a fractional variable. |

---

## 9. Quick Mnemonic — "VOCDR"

Use it when formulating any ILP under time pressure:

- **V**ariables (with domain)
- **O**bjective (min/max + expression)
- **C**onstraints (labelled)
- **D**omain (integrality, non-negativity)
- **R**elaxation (drop integrality; state the bound direction)
