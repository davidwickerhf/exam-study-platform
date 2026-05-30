# Master Cram Sheet — BCS1540 Algorithmic Design

Read this right before the exam. It is a template sheet, not a textbook.

---

## Greedy

Greedy rule = local best choice while building one solution.

Proof = exchange:

```
G = greedy solution.
OPT = optimal solution with max overlap with G.
Let j = first disagreement.
Swap OPT's choice with G's choice.
Still feasible, same/better objective, more overlap.
Contradiction.
```

Common rules:

- interval selection: earliest finish
- interval scheduling labels: earliest start
- MST: cheapest edge crossing cut
- Dijkstra: closest unsettled vertex, positive weights only
- refueling stops: go as far as possible before refueling

---

## Master Theorem

For $T(n)=aT(n/b)+f(n)$, compare $f(n)$ to $n^(log_b a)$.

| Case | Condition | Result |
|---|---|---|
| 1 | `f` polynomially smaller | $\Theta (n^(log_b a))$ |
| 2 | $f = \Theta (n^(log_b a) log^k n)$ | $\Theta (n^(log_b a) log^(k+1)n)$ |
| 3 | `f` polynomially larger | $\Theta (f(n))$ |

Fast values:

- `log_2 2 = 1`
- `log_2 4 = 2`
- `log_2 8 = 3`
- `log_4 2 = 1/2`

---

## Dynamic Programming

Four-step answer:

1. Table: $OPT[i]$ / $OPT[i,j]$ means ...
2. Recurrence.
3. Bottom-up fill + runtime.
4. Reconstruction.

Classic recurrences:

```
Max subarray:
OPT[j] = max(X[j], X[j] + OPT[j-1])

Weighted interval:
OPT[i] = max(OPT[i-1], value_i + OPT[p(i)])

0-1 knapsack:
OPT[i,W] = max(OPT[i-1,W], v_i + OPT[i-1,W-w_i])

LCS:
if x_i = y_j: OPT[i,j] = 1 + OPT[i-1,j-1]
else: OPT[i,j] = max(OPT[i-1,j], OPT[i,j-1])
```

---

## NP-Completeness

To prove `L` NP-complete:

1. $L \in NP$: certificate + polynomial verifier.
2. NP-hard: reduce from known NPC problem.

Known NPC problems:

- SAT / 3-SAT
- Vertex Cover
- Independent Set / Clique
- Subset Sum
- Knapsack
- Hamiltonian Cycle / TSP
- 3-Colouring

Reduction skeleton:

```
Given instance I of known NPC problem X,
construct instance f(I) of target problem L.
I is YES => f(I) is YES.
f(I) is YES => I is YES.
Construction is polynomial.
```

---

## ILP / Fractional Relaxation

Binary variable:

```
x_i = 1 iff choice i selected
```

Patterns:

- budget: $sum cost_i x_i \leq B$
- cover edge `(u,v)`: $x_u + x_v \geq 1$
- exactly one: $sum x_i = 1$
- at most one: $sum x_i \leq 1$
- if A then B: $x_A \leq x_B$

Fractional relaxation:

```
x_i ∈ {0,1}  ->  0 <= x_i <= 1
```

Gives a bound because the relaxed feasible region is larger.

---

## Backtracking / Branch-and-Bound

Backtracking:

```
partial solution
extend(a)
dead(a)
complete(a)
```

Branch-and-bound adds:

```
bestcost
bound(a)
prune if bound(a) cannot beat bestcost
```

LP relaxation can be the bound for ILP branch-and-bound.

