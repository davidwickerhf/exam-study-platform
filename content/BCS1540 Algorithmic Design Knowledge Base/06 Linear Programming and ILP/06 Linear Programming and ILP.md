# Topic 6 — Linear Programming and ILP

**Lecture:** L10 (David Mestel)
**Reference:** `Materials/02 Lecture Slides/2026-linearprogramming.pdf`
**Past exam coverage:** 2024 final Q4(d)–(e), 11 points total: formulate an ILP, then explain fractional relaxation.

---

## What the Exam Asks

Expect a problem already described in words. You need to:

1. Define variables.
2. Write the objective.
3. Write constraints.
4. State integrality / binary conditions.
5. Explain fractional relaxation and why it gives a bound for branch-and-bound.

The exam is **not** asking you to solve the LP by hand. It is asking whether you can translate a discrete optimization problem into linear algebra, then describe how the LP relaxation enables a generic bound for branch-and-bound.

The DM recap (slide "Integer Linear Programming") confirms: *"You should be able to formulate problems (optimisation or decision) as ILP, and use the fractional relaxation to make a branch-and-bound algorithm."*

---

## LP vs ILP at a Glance

| | **LP (Linear Program)** | **ILP (Integer Linear Program)** |
|---|---|---|
| Variables | Real-valued ($x \in \mathbb{R}$) | Integer ($x \in \mathbb{Z}$) or binary ($x \in \{0,1\}$) |
| Solvable in poly time? | **Yes** (simplex usually, interior point provably) | **No** (NP-complete) |
| Standard solver | Gurobi / CPLEX / GLPK (run LP under the hood) | Branch-and-bound on top of LP relaxation |
| Expresses NP-complete problems? | No (LP $\in$ P) | Yes — many: Vertex-Cover, Knapsack, 3-SAT, … |

Memory rule: **LP is easy-ish; ILP is where combinatorial hardness hides.**

---

## LP Standard Form

$$
\begin{aligned}
\text{maximise} \quad & c \cdot x \\
\text{subject to} \quad & A x \leq b \\
& x \geq 0
\end{aligned}
$$

i.e. $\max \sum_{i \in V} c_i x_i$ subject to $\sum_{j \in V} a_{ij} x_j \leq b_i$ for each constraint $i \in C$, and $x_i \geq 0$ for each variable.

**Any LP can be put in this form:**

- Minimisation $\to$ maximise $-c \cdot x$.
- Equality $a \cdot x = b$ $\to$ two inequalities $a \cdot x \leq b$ and $-a \cdot x \leq -b$.
- Unconstrained variable $\to$ split as $x = x^+ - x^-$ with both $\geq 0$.

---

## The Simplex Algorithm

Main take-home message: **linear programs can be solved efficiently**.

- Geometrically: the feasible region is a convex polytope. The optimum is attained at a vertex.
- Simplex walks along edges of the polytope, moving to a neighbouring vertex that improves the objective, until no improvement is possible.
- **Usually fast in practice.** Worst-case exponential (Klee-Minty cubes).
- **Interior-point methods** (Karmarkar, etc.) are provably polynomial-time but more complex.

> Either way: **LP $\in$ P**. You don't need to know the simplex algorithm in detail for the exam — just know that LPs are solvable efficiently.

---

## LP Duality

For every "primal" LP there's a corresponding "dual" LP whose optimum value is the same.

**Primal (maximise):**

$$
\begin{aligned}
\text{maximise} \quad & c \cdot x \\
\text{subject to} \quad & A x \leq b \\
& x \geq 0
\end{aligned}
$$

**Dual (minimise):**

$$
\begin{aligned}
\text{minimise} \quad & b \cdot y \\
\text{subject to} \quad & y^\top A \geq c \\
& y \geq 0
\end{aligned}
$$

Each constraint of the primal becomes a variable of the dual, and vice versa.

### Why we care: the "shoe factory" intuition

If the primal is "what to produce to maximise value given resources", the dual is "what prices for the resources make the production indifferent". Each dual variable $y_i$ is the **shadow price** of constraint $i$:

> If we had one more unit of resource $i$, the primal optimum would increase by approximately $y_i$.

This tells you which constraint to relax to improve the solution — useful in practice and in branch-and-bound branching decisions.

### Strong LP Duality Theorem

**Primal optimum value = Dual optimum value** (whenever both are feasible and bounded).

A direct consequence: any feasible dual solution $y$ gives an upper bound $b \cdot y$ on the primal optimum. This is the basis of certified LP solutions and many proof techniques.

---

## Expressing NP-Hard Problems as ILP

### Vertex Cover

Choose vertices so every edge has at least one endpoint chosen.

$$
\begin{aligned}
x_v &\in \{0, 1\} \quad \text{for each } v \in V \\
\min \quad & \sum_{v \in V} x_v \\
\text{subject to} \quad & x_u + x_v \geq 1 \quad \text{for each edge } (u, v) \in E
\end{aligned}
$$

### Knapsack

Choose items within weight budget to maximise value.

$$
\begin{aligned}
x_i &\in \{0, 1\} \quad \text{for each item } i \\
\max \quad & \sum_i v_i x_i \\
\text{subject to} \quad & \sum_i w_i x_i \leq C
\end{aligned}
$$

### 3-SAT as ILP

Let Boolean variable true $= 1$, false $= 0$. For each clause, at least one literal must be true:

- Clause $(x_i \lor x_j \lor x_k)$: $x_i + x_j + x_k \geq 1$.
- Clause $(x_i \lor x_j \lor \lnot x_k)$: $x_i + x_j + (1 - x_k) \geq 1$, i.e. $x_i + x_j - x_k \geq 0$.
- Clause $(\lnot x_i \lor \lnot x_j \lor \lnot x_k)$: $(1 - x_i) + (1 - x_j) + (1 - x_k) \geq 1$, i.e. $-x_i - x_j - x_k \geq -2$.

Plus $0 \leq x_i \leq 1$ and $x_i \in \mathbb{Z}$.

> **Important.** An (I)LP can have **no feasible solution** (e.g. $x \leq 1$ and $x \geq 2$ simultaneously). In that case the optimum is $+\infty$ (minimisation) or $-\infty$ (maximisation).

### Clique Number (maximum size of a clique)

$$
\begin{aligned}
x_v &\in \{0, 1\} \quad \text{for each } v \in V \\
\max \quad & \sum_{v \in V} x_v \\
\text{subject to} \quad & x_v + x_w \leq 1 \quad \text{for each non-edge } (v, w) \not\in E
\end{aligned}
$$

> Trick: a clique is the complement of an independent set. Vertices in the clique cannot have non-adjacent pairs.

---

## Standard Binary Variable Patterns

For choose / don't-choose decisions: $x_i = 1$ if item / edge / vertex $i$ is selected, $0$ otherwise.

| Phrase | Constraint |
|---|---|
| Budget | $\sum_i c_i x_i \leq B$ |
| Capacity | $\sum_i s_i x_i \leq C$ |
| Cover every edge | $x_u + x_v \geq 1$ for each $(u, v) \in E$ |
| Select at least one from set $S$ | $\sum_{i \in S} x_i \geq 1$ |
| Select at most one | $\sum_{i \in S} x_i \leq 1$ |
| Select exactly one | $\sum_{i \in S} x_i = 1$ |
| If $A$ then $B$ ($A \Rightarrow B$) | $x_A \leq x_B$ |
| Iff ($A \Leftrightarrow B$) | $x_A = x_B$ |

---

## The Importance of Being Integral — and Fractional Relaxation

It's the **integrality constraint** that makes ILP hard. If we drop it, we get an LP — solvable in polynomial time. This is called **fractional relaxation**.

> Removing a constraint **only increases** the set of feasible solutions, so it **only improves** the optimum value.

**Bound direction:**

- For **maximisation** (e.g. Knapsack): $\text{LP}_{\text{opt}} \geq \text{ILP}_{\text{opt}}$ — the LP gives an **upper bound**.
- For **minimisation** (e.g. Vertex Cover): $\text{LP}_{\text{opt}} \leq \text{ILP}_{\text{opt}}$ — the LP gives a **lower bound**.

### Vertex Cover example

Consider a triangle (3 vertices, 3 edges). The LP relaxation:

$$
\begin{aligned}
\min \quad & x_1 + x_2 + x_3 \\
\text{subject to} \quad & x_1 + x_2 \geq 1 \\
& x_2 + x_3 \geq 1 \\
& x_3 + x_1 \geq 1 \\
& x_i \geq 0
\end{aligned}
$$

The LP optimum is $1.5$, achieved at $x = (0.5, 0.5, 0.5)$. But this is not a valid vertex cover (you can't pick half a vertex!). The true integer optimum is $2$ — any two vertices.

So $\text{LP} = 1.5 \leq \text{ILP} = 2$. The LP told us the integer optimum can't be less than $1.5$, so we know $\text{ILP} \geq 2$ (since it's an integer).

---

## Branch-and-Bound Using LP Relaxation

Generic ILP solving recipe:

1. **Solve the LP relaxation** of the ILP (or of a sub-ILP with some variables fixed).
2. If the LP solution is **integer-valued**, we're done — that's the optimal ILP solution for this subtree.
3. If the LP optimum is **already worse than the best integer solution found**, prune this subtree.
4. Otherwise, pick a fractional variable (e.g. one closest to $0.5$) and **branch**: create two sub-ILPs, one with that variable fixed to $0$, one fixed to $1$ (or to floor / ceil for non-binary).

LP relaxation provides:

- a **bound** for pruning,
- a **branching guide** (which variable to branch on next),
- a **rounding heuristic** (round the LP solution to get a feasible ILP point quickly).

> "This is **not guaranteed to run in polynomial time** — but it's often quite good in practice." (Mestel, lecture)

See [[05 Backtracking and Branch-and-Bound]] for the generic B&B template.

---

## Mock Q4(d) — Road Upgrade ILP Template

Problem: roads form a tree rooted at capital town $1$. Upgrading road $i$ costs $c_i$ and halves its travel time $b_i$. Budget $B$. Nobles live at towns $N_1, \ldots, N_k$. Minimise the sum of arrival times to nobles.

**Variables.**

- $u_i \in \{0, 1\}$ for each road $i$: $1$ if road $i$ is upgraded.
- $T_j \geq 0$ for each town $j$: time for decree to reach town $j$.

**Objective.**

$$\min \; T_{N_1} + T_{N_2} + \ldots + T_{N_k}$$

**Budget.**

$$\sum_i c_i u_i \leq B$$

**Path-time constraints.** For each town $j$, let $P(j)$ be the unique path from capital to $j$.

$$T_j \geq \sum_{i \in P(j)} \left(1 - \frac{u_i}{2}\right) b_i$$

(If $u_i = 0$, road $i$ takes $b_i$; if $u_i = 1$, road $i$ takes $b_i / 2$.)

**Bounds and integrality.**

$$
\begin{aligned}
0 &\leq u_i \leq 1 \\
u_i &\in \mathbb{Z} \\
T_j &\geq 0 \\
T_1 &= 0
\end{aligned}
$$

### Fractional relaxation (Q4(e))

Drop $u_i \in \mathbb{Z}$, keep $0 \leq u_i \leq 1$. The relaxed problem allows "partially upgrading" a road (not physically meaningful, but mathematically useful).

Since this is a **minimisation** problem, the LP relaxation gives a **lower bound** on the true ILP optimum:

$$\text{LP}_{\text{opt}} \leq \text{ILP}_{\text{opt}}$$

In branch-and-bound: at each node we solve the LP relaxation. If the LP optimum is already greater than the best integer solution we've found, prune. Otherwise pick a fractional $u_i$ (close to $0.5$) and branch on $u_i = 0$ vs $u_i = 1$.

---

## Exam Answer Skeleton

```
Variables:
  x_i = 1 iff <choice i is selected>
  T_j = <continuous quantity, e.g. travel time to j>

Objective:
  maximise / minimise <linear function of variables>

Constraints:
  Budget / capacity:
    <linear inequality>
  Feasibility / coverage:
    <linear inequality per element of input>
  Problem-specific (e.g. path constraints):
    <linear inequality>
  Integrality:
    x_i ∈ {0,1}
  Non-negativity:
    T_j >= 0

Fractional relaxation:
  Replace x_i ∈ {0,1} by 0 <= x_i <= 1.
  Since we removed a constraint, the LP feasible region contains all integer-valued solutions.
  So LP optimum is at least as good as the ILP optimum:
    - for maximisation: LP >= ILP (upper bound)
    - for minimisation: LP <= ILP (lower bound)
  This bound is useful for pruning in branch-and-bound: if the LP optimum
  cannot beat the best integer solution found so far, prune the subtree.
```

---

## Standard Conceptual Questions and Answers

### "Why is LP in P but ILP NP-complete?"

LP has a convex feasible region — local search (simplex / interior point) finds the global optimum. ILP forces the optimum to lie at integer points; this is combinatorial and equivalent to solving subset-selection problems, which are NP-complete.

### "What is the simplex algorithm?"

It walks along edges of the LP feasible polytope, vertex-to-vertex, increasing the objective each step until no neighbour improves. Worst-case exponential but usually fast in practice.

### "What is LP duality?"

Every LP (primal) has a corresponding LP (dual). Their optima are equal. The dual variables are shadow prices on the primal's constraints.

### "What's a shadow price?"

The amount the primal optimum would change if we relaxed (increased the right-hand side of) constraint $i$ by one unit. Useful for sensitivity analysis.

### "Why does fractional relaxation help with NP-hard problems?"

The LP relaxation is solvable in polynomial time and gives a bound on the ILP optimum. In branch-and-bound, this bound prunes subtrees that can't lead to better solutions. Often dramatically faster than naive search.

### "Can an LP have no solution?"

Yes. The feasible region can be empty (constraints contradict). Or the objective can be unbounded in the feasible region. Either way the optimum is $\pm \infty$.

### "When does LP give the same answer as ILP?"

When the LP optimum happens to be at an integer-valued vertex of the polytope. This happens for problems with **totally unimodular** constraint matrices (e.g. bipartite matching). For Vertex Cover on a triangle it does **not**: LP $= 1.5$, ILP $= 2$.

---

## Quick Reference

| Phrase | ILP move |
|---|---|
| Choose item $i$ | $x_i \in \{0, 1\}$ |
| Within budget | $\sum_i c_i x_i \leq B$ |
| Cover every edge | $x_u + x_v \geq 1$ |
| Exactly one option | $\sum_i x_i = 1$ |
| At most one option | $\sum_i x_i \leq 1$ |
| If $A$ then $B$ | $x_A \leq x_B$ |
| Fractional relaxation | replace binary with $0 \leq x_i \leq 1$ |
| LP bound for minimisation | $\text{LP} \leq \text{ILP}$ (lower bound) |
| LP bound for maximisation | $\text{LP} \geq \text{ILP}$ (upper bound) |

---

## Practice Problems

- 2024 mock Q4(d)–(e) — Road upgrades ILP + fractional relaxation
- Tutorial Week 4 — Backtracking / B&B / (I)LP exercises
- Goodrich & Tamassia R-26.1, R-26.3, R-26.7, R-26.12, R-26.13, A-26.3, C-26.10, C-26.13, A-26.5, A-26.6
- CLRS 29.1-4, 29.2-1, 29.2-6, 29.2-7
- Exercise: express Vertex-Cover, Clique, 3-SAT as ILPs (lecture exercises)

> **Friend's exam template:** "Variables. Objective. Budget. Coverage. Integrality. Then: replace $x \in \{0,1\}$ by $0 \leq x \leq 1$, more feasible = better optimum = bound for B&B."
