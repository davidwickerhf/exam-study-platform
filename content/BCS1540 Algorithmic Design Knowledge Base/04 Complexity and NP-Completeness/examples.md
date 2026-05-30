# Worked Examples — Complexity & NP-Completeness

The 6-step proof template for showing a problem $X$ is NP-complete:

1. **Define** $X$ formally (decision version, input, yes/no question).
2. **Show** $X \in \mathsf{NP}$ — describe a polynomial-time verifier that takes a certificate.
3. **Pick a known NP-complete problem** $Y$ to reduce *from*.
4. **Reduction** $Y \leq_P X$: describe a polynomial-time mapping from $Y$-instances to $X$-instances.
5. **Polynomial-time** check on the mapping construction.
6. **Correctness (iff)**: $Y$-instance is yes ⇔ $X$-instance is yes.

---

## 1. 3-SAT ≤ₚ Vertex Cover

**Vertex Cover (decision).** Given graph $G=(V,E)$ and integer $k$, does $G$ have a vertex cover of size $\leq k$?

**In NP.** Verifier: receive set $C \subseteq V$ with $|C| \leq k$; check every edge has an endpoint in $C$. Linear time.

**Reduction from 3-SAT.** Given a 3-CNF formula $\varphi$ with $n$ variables and $m$ clauses:

```
BUILD-G(varphi):
    G = empty graph
    # variable gadget: for each variable x_i, add two vertices x_i and ¬x_i with an edge
    for i in 1..n:
        add edge (x_i, ¬x_i)
    # clause gadget: for each clause (l_a ∨ l_b ∨ l_c), add a triangle on three vertices
    for each clause C_j = (l_a, l_b, l_c):
        add triangle on c_j_a, c_j_b, c_j_c
    # connection: each clause-vertex c_j_x connects to the matching literal vertex
    for each c_j_x in clause j corresponding to literal l_x:
        add edge (c_j_x, l_x)   # literal vertex from variable gadget
    return G, k = n + 2m
```

**Why $k = n + 2m$.** Variable gadgets force at least 1 vertex per edge → $n$. Clause triangles force at least 2 of 3 vertices → $2m$. Total $\geq n + 2m$.

**Polynomial.** $O(n+m)$ edges and vertices.

### Fully worked iff (small instance)

Take $\varphi = (x_1 \lor x_2 \lor \lnot x_3) \land (\lnot x_1 \lor \lnot x_2 \lor x_3)$. So $n=3$, $m=2$, target $k = n + 2m = 7$.

**Construction.**

- Variable gadgets: edges $(x_1, \lnot x_1), (x_2, \lnot x_2), (x_3, \lnot x_3)$ — 6 vertices, 3 edges.
- Clause gadgets: triangles $T_1 = \{a_1, b_1, c_1\}$ for clause 1, $T_2 = \{a_2, b_2, c_2\}$ for clause 2 — 6 vertices, 6 edges.
- Connections: $a_1 \leftrightarrow x_1$, $b_1 \leftrightarrow x_2$, $c_1 \leftrightarrow \lnot x_3$; $a_2 \leftrightarrow \lnot x_1$, $b_2 \leftrightarrow \lnot x_2$, $c_2 \leftrightarrow x_3$ — 6 cross-edges.

Total: 12 vertices, 15 edges.

**Forward (⇒).** Assignment $x_1 = T, x_2 = F, x_3 = T$ satisfies $\varphi$ (clause 1 via $x_1$, clause 2 via $x_3$). Build a cover:
1. From each variable gadget, take the *true*-literal vertex: $\{x_1, \lnot x_2, x_3\}$ — 3 vertices.
2. From each clause triangle, take the two vertices whose connected literal is *false*. In $T_1$ the true literal is $x_1$ (via $a_1$), so take $\{b_1, c_1\}$. In $T_2$ the true literal is $x_3$ (via $c_2$), so take $\{a_2, b_2\}$ — 4 vertices.

Total cover size $3 + 4 = 7 = k$. ✓ Every edge is covered:
- Variable edges: one endpoint (the true literal) is chosen.
- Triangle edges: at least one of the two chosen vertices is an endpoint.
- Cross-edges: either the literal endpoint (true side) is chosen, or the clause-side vertex is chosen.

**Backward (⇐).** Suppose $G$ has a cover $C$ with $|C| \leq 7$. Variable gadgets are 3 disjoint edges → need $\geq 1$ per gadget = 3 vertices. Clause triangles are 2 disjoint triangles → need $\geq 2$ per triangle = 4 vertices. So $|C| \geq 7$, forcing exactly one vertex per variable gadget and exactly two per triangle.

Define the assignment: in each variable gadget, set the chosen literal to **true**. (Well-defined: exactly one of $\{x_i, \lnot x_i\}$ is in $C$.) For each clause triangle, one vertex (say $a_j$) is the *unchosen* one. Its cross-edge to a literal vertex $\ell$ must still be covered — but the clause side isn't in $C$, so the literal side $\ell$ is in $C$. Thus $\ell$ was set to true, satisfying clause $j$. Every clause has a true literal → $\varphi$ is satisfied. ✓

**Polynomial.** The construction is $O(n+m)$ and the proof above uses only counts and the cover property — no super-poly work.

---

---

## 2. Vertex Cover ≤ₚ Independent Set

**Key fact.** $S$ is an independent set ⇔ $V \setminus S$ is a vertex cover.

**Reduction.** Given $(G, k)$ for Vertex Cover, output $(G, |V| - k)$ for Independent Set.

**Iff.** $G$ has VC of size $\leq k$ ⇔ $G$ has IS of size $\geq |V| - k$.

---

## 3. Independent Set ≤ₚ Clique

**Construction.** Given $G$, build $\overline{G}$ (the complement). Output $(\overline{G}, k)$.

**Why.** An independent set in $G$ is a clique in $\overline{G}$.

---

## 4. Subset Sum ≤ₚ Partition

**Subset Sum.** Given $\{a_1, \ldots, a_n\}$ and target $T$: is there a subset summing to $T$?

**Partition.** Given $\{a_1, \ldots, a_n\}$: is there a partition into two equal-sum halves?

**Reduction.** Add two large items $x = 2S - T$ and $y = S + T$ (where $S = \sum a_i$). The new total is $S + x + y = 4S$, half is $2S$. A subset summing to $2S$ in the new instance must include exactly one of $x, y$, with the corresponding original-side sum being $T$ or $S - T$.

---

## 5. Hamiltonian Cycle ≤ₚ Traveling Salesman (Decision)

**TSP (decision).** Given complete weighted graph $G$ and integer $k$: is there a tour visiting every vertex once with total weight $\leq k$?

**Reduction.** Given $G$ for Hamiltonian Cycle on $|V| = n$:
1. Build complete graph $G'$ on the same vertex set.
2. Edge weight in $G'$: $1$ if the edge exists in $G$, $2$ otherwise.
3. Set $k = n$.

**Iff.** $G$ has a Hamiltonian cycle ⇔ $G'$ has a tour of weight $\leq n$ (since any tour visits exactly $n$ edges, weight $n$ requires every edge to be weight $1$, i.e., to exist in $G$).

---

## 6. Runtime Statement Cheat Sheet

| Algorithm                            | Runtime                  | Notes                                          |
|--------------------------------------|--------------------------|------------------------------------------------|
| Sort (comparison)                    | $\Theta(n \log n)$       | Lower bound for comparison-based sorts.        |
| Dijkstra (binary heap)               | $O((V+E) \log V)$        | Positive weights only.                         |
| Bellman-Ford                         | $O(VE)$                  | Handles negative edges, detects negative cycles. |
| Floyd-Warshall                       | $\Theta(V^3)$            | All-pairs shortest paths.                      |
| Prim / Kruskal MST                   | $O(E \log V)$            | With heap / union-find.                        |
| 0/1 Knapsack                         | $\Theta(nW)$             | Pseudo-polynomial (W is the value).            |
| Subset Sum                           | $\Theta(nT)$             | Pseudo-polynomial.                             |
| LCS / Edit distance                  | $\Theta(nm)$             |                                                |
| SAT (brute force)                    | $\Theta(2^n \cdot m)$    | Exponential — no known poly-time algorithm.    |

---

## 7. Common Trap

> "**Solving** an instance in $O(2^n)$" is not the same as "**Recognising** the problem as NP-hard." Membership in NP requires a verifier; hardness requires a reduction. Always show both for completeness.
