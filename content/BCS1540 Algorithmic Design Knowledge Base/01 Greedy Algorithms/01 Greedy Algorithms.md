# Topic 1 — Greedy Algorithms

**Lectures:** L1 + L2 (Steven Chaplick)
**Reference (lecture slides):** `Materials/02 Lecture Slides/cs1540-week1-intro-greedy_flattened.pdf`
**Reference (textbook):** Goodrich & Tamassia §10, CLRS §16
**Tutorial:** `Materials/04 Tutorial Exercises/Week1-*.pdf`

---

## What the Exam Asks

From the 2024 final, Q1 is always structured as:

1. **(a) [~8 pts]** Write a greedy algorithm in pseudocode + a brief high-level English description of the main idea.
2. **(b) [~4 pts]** Prove that the algorithm is optimal. The proof technique depends on the template: **exchange argument** (Templates 2, 3, 5), **exhaustion** (Template 1), or **induction** (Template 4). See [Proof Styles by Template](#proof-styles-by-template).

The problem is always an optimisation problem with a natural greedy rule (e.g. interval scheduling, route planning, scheduling stops, packing).

> Strategy: pattern-match the problem to one of the **five** canonical greedy templates (earliest-start, earliest-finish, min-cost-edge, closest-vertex, **furthest-reach-cover**). Adapt the algorithm, then prove optimality using the **proof style matching that template** — see [Proof Styles by Template](#proof-styles-by-template). The styles are: exhaustion (1), exchange-with-Case-1-collapse (2), exchange-via-cycle-swap (3), induction (4), exchange-with-one-direction-impossible (5).
>
> **Recognition cue:** if the problem says *"every input must be reached / covered / served"* (e.g., refueling to cross a corridor, towers covering all houses, guards covering all paintings), you're in **Template 5 (Interval Covering)** — not Template 2. Selection/packing problems pick a subset; covering problems must reach all elements.

---

## What a Greedy Algorithm Is

A **greedy algorithm** iteratively builds **one** single solution by making the choice that seems best given what we did so far (the *greedy rule*). Used for **optimisation problems**: a set of configurations + an objective function, where we want to maximise or minimise the objective.

**Standard skeleton:**

```
solution := empty
order the input by some key
for each input element in order
    if adding the element keeps the partial solution valid
        add it to the solution
return solution
```

Key concepts (used in the exchange proof):

- **Greedy rule:** the local choice we make at each step (e.g. "pick the interval with the earliest finish time among those that fit")
- **$k$-partial solution:** a valid solution to the problem restricted to the first $k$ elements (in the greedy ordering)

---

## The Five Canonical Algorithms

### 1. Interval Scheduling (a.k.a. Task Scheduling) — [GT 10.2]

**Input:** $n$ intervals $(s_1, f_1), \ldots, (s_n, f_n)$ with $s_i < f_i$.
**Goal:** Assign each interval a label $f : \{1, \ldots, n\} \to \{1, \ldots, k\}$ such that no two intervals with the same label overlap, minimising $k$.

**Greedy rule:** process intervals in order of **earliest start time**; assign each to the smallest label whose intervals so far don't conflict, creating a new label only if needed.

**Correctness.** Suppose greedy uses $k$ labels. At the moment greedy created label $k$, there must have been $k - 1$ already-busy labels — meaning $k - 1$ other intervals are overlapping at that point. Together with the new one, that's $k$ mutually overlapping intervals, so any optimal solution must use $\geq k$ labels. Hence greedy is optimal.

### 2. Interval Selection (a.k.a. Activity Selection) — [CLRS 16.1]

**Input:** $n$ intervals with start / finish times.
**Goal:** Select a maximum-size subset of non-overlapping intervals.

**Greedy rule:** process intervals in order of **earliest finish time**; select the next interval if it fits (i.e. its start $\geq$ finish time of the last selected); otherwise discard.

**Correctness (exchange argument).** Let $f$ = greedy output, $f^*$ = optimal solution that has the **maximum number of Yes's in common with $f$**. Suppose $f \neq f^*$. Let $i$ = first interval where they differ. Two cases:

- **Case 1: $i \in f$, $i \notin f^*$.** Since $f^*$ is valid and $i$ has the earliest finish time among compatible intervals, we can swap whatever interval $f^*$ picked at this position with $i$ without breaking validity ($i$ finishes no later). The new solution has the same size but more in common with $f$ — contradiction.
- **Case 2: $i \notin f$, $i \in f^*$.** Then greedy must have skipped $i$ because it conflicted with something already picked. But greedy and $f^*$ agreed on all earlier picks, so this would also conflict in $f^*$ — contradiction.

### 3. Minimum Spanning Tree — [GT §15, CLRS §23]

**Input:** connected weighted graph $G = (V, E)$, edge costs $c : E \to \mathbb{R}$.
**Goal:** find a spanning tree $T$ minimising $\sum_{e \in T} c(e)$.

**Greedy rule (Prim's):** grow $T$ edge-by-edge, always adding the minimum-cost edge that keeps $T$ a tree (connects a new vertex to $T$).

**Correctness (exchange argument).** Let $T$ = greedy output, $T^*$ = MST with max edges in common with $T$. If $T \neq T^*$, let $e$ = first edge greedy added that's not in $T^*$. Adding $e$ to $T^*$ creates a cycle. That cycle must contain an edge $e'$ that crosses the same cut as $e$ but has cost $\geq c(e)$ (else greedy would have picked $e'$ instead). Swap $e$ for $e'$ in $T^*$: still a spanning tree, cost $\leq T^*$, and now has $e$ in common with $T$ — contradiction.

### 4. Dijkstra's Algorithm (Single-Source Shortest Paths) — [CLRS §24]

**Input:** directed graph $G = (V, E)$ with **positive** edge weights $w : E \to \mathbb{R}_{> 0}$. Starting vertex $s \in V$.
**Goal:** find a shortest path from $s$ to every other vertex.

**Greedy rule:** maintain a shortest-path tree $T$ rooted at $s$. Extend $T$ by adding the vertex outside $T$ that has the smallest known distance from $s$.

**Correctness (induction).** By induction $T$ is a subtree of a shortest-path tree of $G$ from $s$. Base case: $T = \{s\}$. Inductive step: when we add vertex $v$ via edge $(u, v)$ with current distance $d(v) = d(u) + w(u, v)$, any alternative path to $v$ must leave $T$ via some other vertex $w$ with $d(w) \geq d(v)$ (since $v$ was the closest), and then use only positive-weight edges, so total $\geq d(w) \geq d(v)$. Hence the greedy distance is optimal.

> **Why positive weights matter.** With negative edges, a "long" path through $w$ could end up shorter. Use Bellman-Ford instead.

### 5. Interval Covering / Art Gallery Guarding — [GT 10.4, A-10.1] [CLRS 16.2-5]

**Input:** $n$ points (e.g., paintings, houses, refueling stops) at positions $x_1 \leq x_2 \leq \ldots \leq x_n$ on a 1D line, and a coverage radius $r$ (or a reach $t$).
**Goal:** place the **minimum number of markers** (guards, towers, stops) so that every point is within distance $r$ of some marker (or every consecutive gap is within reach $t$).

**Greedy rule:** at the **leftmost uncovered point** $x_i$, place a marker at $x_i + r$ — the furthest position that still covers $x_i$. Skip past all points now covered (those at distance $\leq r$ to the right of the marker). Repeat.

> **Equivalent framing for "minimise stops to cross a corridor"** (the 2024 mock Q1): from the current position, jump to the **furthest reachable** next stop. This is the same algorithm in different clothing — every point of the corridor must be reached/covered.

**Correctness (exchange argument).** Let $G$ = greedy output, OPT = an optimal solution with max commonality with $G$. Suppose $G \neq \text{OPT}$. Let $j$ = first marker where they disagree.

- **Case 1: $j \in \text{OPT}$, $j \notin G$.** Greedy placed marker $j^*$ at this step. By the greedy rule, $j^*$ is at position $\geq j$ on the line (greedy placed it as far right as possible while covering the leftmost uncovered point). The next OPT marker $\ell$ was reachable from $j$, so reachable from $j^*$ too. Replace $j$ with $j^*$ in OPT: still valid, same count, more commonality — contradiction.
- **Case 2: $j \in G$, $j \notin \text{OPT}$.** Greedy placed $j$ because the prior marker couldn't reach further. OPT's marker at this step must therefore be at position $\leq j$. Swap OPT's marker with $j$: still valid, more commonality — contradiction.

> **The 2024 final exam Q1 (interstellar refueling) was an instance of this template** — not a variant of Template 2 (Interval Selection).

---

## Pseudocode Reference

### Interval Scheduling / Partitioning

```
sort intervals by start time                       // O(n log n)
rooms := empty            // each room tracks its lastFinish time
for each interval I in sorted order:
    if some room R has R.lastFinish <= I.start:
        assign I to R
        R.lastFinish := I.finish
    else:
        open a new room R with R.lastFinish := I.finish
return rooms
```

> **Naïve runtime:** $O(n^2)$ — scanning all rooms for each interval.
> **Priority-queue runtime:** $O(n \log n)$ — keep a min-heap of rooms keyed by `lastFinish`. At each interval, check `heap.min`: if $\leq I.\text{start}$, pop and re-push with new finish; else open a new room (push). $\log n$ per interval.

### Interval Selection

```
sort intervals by finish time
selected := empty
lastFinish := -infinity
for i := 1 to n
    if s_i >= lastFinish
        selected.add(i)
        lastFinish := f_i
return selected
```

### Prim's MST

```
T := {arbitrary start vertex s}
edges := empty
while T != V
    pick edge (u,v) of minimum cost with u in T, v not in T
    edges.add((u,v))
    T.add(v)
return edges
```

### Dijkstra

```
dist[s] := 0; dist[v] := infinity for all other v
parent[v] := nil for all v
T := empty
while T != V
    pick v not in T minimizing dist[v]
    T.add(v)
    for each edge (v,u) with u not in T
        if dist[v] + w(v,u) < dist[u]
            dist[u] := dist[v] + w(v,u)
            parent[u] := v
return dist, parent
```

### Interval Covering / Art Gallery Guarding

```
sort points by position (often already sorted: x_1 <= x_2 <= ... <= x_n)
markers := empty
i := 1
while i <= n
    place marker at position x_i + r       // furthest position covering x_i
    markers.add(x_i + r)
    while i <= n and x_i <= (last marker position) + r
        i := i + 1                          // skip past all covered points
return markers
```

> Runtime: $O(n)$ after sorting (sorting itself is $O(n \log n)$; if input is pre-sorted, total is $O(n)$).
>
> For the "refueling" variant (minimise stops to cross a corridor): replace "place marker at $x_i + r$" with "from current position $p$, find the furthest station $x_j$ such that $x_j \leq p + t$; add $x_j$ to stops; set $p := x_j$."

---

## Proof Styles by Template

**There is no single "exchange argument" that fits all greedy proofs.** Each template uses one of four styles. Pick the right style for the problem family — using the wrong style turns into a mess.

| Template | Proof style | Key move | Difficulty |
|---|---|---|---|
| 1 — Interval Scheduling/Partitioning | **Exhaustion** | Lower-bound argument: $k$ overlapping items force $k$ rooms | Easiest |
| 2 — Interval Selection | **Exchange (Case 1 collapses)** | Case 1 impossible by greedy rule; Case 2 swaps via earliest finish | Medium |
| 3 — Prim's MST | **Exchange via cycle swap** | Add greedy's edge to OPT, find heavier cycle edge, swap | Medium |
| 4 — Dijkstra | **Induction** | Invariant: $T$ is a subtree of a shortest-path tree | Medium |
| 5 — Interval Covering | **Exchange (one direction impossible)** | Greedy is "furthest right" — OPT can't exceed; only one case is real | Medium |

The mnemonic **MAX-OVERLAP → FIRST-DISAGREE → TWO-SWAPS → CONTRADICT** describes the general exchange structure (Styles 2, 3, 5), but **not exhaustion (Style 1) or induction (Style 4)**. Don't force the exchange template onto problems that don't use it.

### Style A — Exhaustion (Template 1)

> **No OPT-with-max-commonality. No cases. No swaps.** Just a direct lower bound.

```
1. Let k = number of rooms / labels / colours greedy used.
2. Identify the moment greedy opened the k-th room. At that moment,
   greedy was processing some element X, and ALL k-1 existing rooms
   were busy (lastFinish > X.start; otherwise greedy would have reused).
3. So at that moment, k elements were mutually overlapping (k-1
   ongoing + the new X).
4. Any valid schedule must place these k mutually overlapping
   elements in k distinct rooms.
5. Therefore any valid schedule uses ≥ k rooms.
6. Greedy uses k. Hence greedy is optimal.
```

**When to use:** problem says *"minimum rooms / labels / colours / platforms / frequencies"* for items that may overlap.

### Style B — Exchange, Case 1 collapses (Template 2)

```
1. Let G = greedy output. Let OPT = optimal solution with maximum
   number of elements in common with G. Suppose G ≠ OPT.
2. Let j = smallest input-array index where G and OPT disagree
   (indices in the sorted-by-finish-time order).
3. Case 1 (j ∈ OPT, j ∉ G): Greedy skipped j, so j conflicts with
   one of greedy's prior picks. But OPT agreed on those prior picks,
   so j also conflicts with OPT's prior picks. But OPT contains j —
   contradiction. CASE 1 IMPOSSIBLE.
4. Case 2 (j ∈ G, j ∉ OPT): Let k be OPT's first pick with index > j.
   By the greedy rule (earliest finish time), finish(j) ≤ finish(k).
   Swap k for j in OPT: still valid (j compatible with prior picks,
   and finish(j) ≤ finish(k) means j compatible with later picks).
   OPT' is valid, same size, more commonality — contradiction.
5. Therefore G = OPT, so G is optimal.
```

**When to use:** problem says *"maximum compatible subset / activities / non-overlapping"* — packing/selection problems.

### Style C — Exchange via cycle swap (Template 3)

```
1. Let T = greedy output. Let T* = MST with maximum edges in common
   with T. Suppose T ≠ T*.
2. Let e = first edge greedy added that is not in T*.
3. Adding e to T* creates a cycle. That cycle must contain some
   edge e' that crosses the same cut as e.
4. By greedy's rule (picked e via min-cost edge from T's frontier),
   c(e) ≤ c(e').
5. Swap e for e' in T*: still a spanning tree (e closes the cycle, e'
   broke connectivity but e replaces it across the cut), cost ≤ c(T*),
   more commonality with T — contradicts T*'s max-commonality.
6. Therefore T = T*, so T is an MST.
```

**When to use:** problem says *"connect everything with minimum total cost"* — graph spanning problems.

### Style D — Induction (Template 4)

```
1. Invariant: at every step, the set T of settled vertices, together
   with the parent edges from Dijkstra, forms a subtree of a
   shortest-path tree of G rooted at s.
2. Base case: T = {s}. Trivially a subtree.
3. Inductive step: suppose invariant holds before adding vertex v.
   Greedy adds v via edge (u, v) with dist[v] = dist[u] + w(u, v).
   Any alternative path from s to v must leave T at some vertex w.
   Then dist[w] ≥ dist[v] (else greedy would have settled w first).
   Edge weights are positive, so the rest of the path adds ≥ 0.
   Total ≥ dist[v]. Hence the greedy distance to v is the shortest.
4. By induction, when all vertices are settled, T is a shortest-path
   tree of G from s.
```

**When to use:** *"shortest path from a single source"* — and you have non-negative edge weights.

### Style E — Exchange, one direction impossible (Template 5)

```
1. Let G = greedy output. Let OPT = optimal solution with maximum
   number of markers in common with G. Suppose G ≠ OPT.
2. Let j = first marker position where they disagree.
   Let x_i = leftmost point not yet covered by the markers G and OPT
   agreed on prior to step j. Both G's and OPT's j-th markers must
   cover x_i.
3. By greedy's rule, G placed its marker at position x_i + r (furthest
   position covering x_i). So OPT's marker is at position p ≤ x_i + r.
4. Real case (p < x_i + r):
   Replace OPT's marker with G's: still covers x_i, extends coverage
   further right, and any point lost to the left of x_i is already
   covered by prior (shared) markers. OPT' has more commonality —
   contradiction.
5. Other direction (p > x_i + r) impossible: OPT's marker would not
   cover x_i.
6. Therefore G = OPT, so G is optimal.
```

**When to use:** problem says *"minimum stops / guards / towers / sensors to cover/reach all on a line"* — covering problems.

> **Practical tip on exam:** if you can't see immediately whether Case 1 collapses or which direction is impossible, **write both cases defensively**. Worst case you do redundant work. Best case you save time and look sharp.

---

## Worked Examples (full exam-style answers)

### Worked Example 1 — Template 1 (Classroom Allocation)

**Problem.** $n$ classes with start/finish times $(s_i, f_i)$. Assign each class to a classroom (each classroom hosts one class at a time). Minimise the number of classrooms.

**(a) Algorithm.** Process classes in order of earliest start time. For each class, assign it to any classroom that is free (the last class assigned to it has finished); otherwise open a new classroom.

```
sort classes by start time                          // O(n log n)
rooms := empty                                       // min-heap by lastFinish
for each class C in sorted order:
    if heap non-empty and heap.min <= C.start:
        R := heap.pop()                              // reuse this room
        assign C to R; R.lastFinish := C.finish
        heap.push(R)
    else:
        open new room R; R.lastFinish := C.finish; heap.push(R)
return rooms

Runtime: O(n log n).
```

**(b) Proof (exhaustion).** Let $k$ be the number of rooms greedy used. Consider the moment greedy opened the $k$-th room: at that moment, greedy was processing some class $C$, and every existing room had `lastFinish > C.start` (else greedy would have reused it). So at time $s_C$, there were $k-1$ ongoing classes plus $C$ itself — that's $k$ mutually overlapping classes. Any valid schedule must place these $k$ pairwise-overlapping classes in $k$ distinct rooms. Hence any valid schedule uses $\geq k$ rooms. Since greedy uses $k$, greedy is optimal.

---

### Worked Example 2 — Template 2 (Conference Talks)

**Problem.** $n$ talks with start/finish times. Maximise the number of talks you can attend (one at a time, no leaving early or arriving late).

**(a) Algorithm.** Sort talks by earliest finish time. Walk through in order, adding each talk whose start time is $\geq$ the last selected talk's finish time.

```
sort talks by finish time                            // O(n log n)
selected := empty
lastFinish := -infinity
for each talk T in sorted order:
    if T.start >= lastFinish:
        selected.add(T); lastFinish := T.finish
return selected

Runtime: O(n log n), dominated by the sort.
```

**(b) Proof (exchange, Case 1 collapses).**

> Let $G$ = greedy output. Let OPT = optimal solution with maximum number of talks in common with $G$. Suppose $G \neq \text{OPT}$, and let $j$ be the smallest index (in sorted-by-finish order) where they disagree.
>
> **Case 1 ($T_j \in \text{OPT}, T_j \notin G$):** Greedy skipped $T_j$, so $T_j$ conflicts with one of greedy's prior picks. But OPT agreed on those prior picks, so $T_j$ also conflicts with OPT's prior picks. But OPT contains $T_j$ — contradiction. **Case 1 is impossible.**
>
> **Case 2 ($T_j \in G, T_j \notin \text{OPT}$):** Let $T_k$ be OPT's first pick with index $> j$. Since talks are sorted by finish time and $k > j$, $f_j \leq f_k$. Replace $T_k$ with $T_j$ in OPT: $T_j$ is compatible with OPT's prior picks (same as greedy's, where greedy added $T_j$), and $T_j$ is compatible with OPT's later picks (since $f_j \leq f_k$, anything compatible with $T_k$ is also compatible with $T_j$). OPT' is valid, same size, more commonality — contradicts max-commonality of OPT.
>
> Therefore $G = \text{OPT}$, so $G$ is optimal.

---

### Worked Example 3 — Template 5 (Tower Placement)

**Problem.** $n$ houses at positions $x_1 \leq \ldots \leq x_n$, tower coverage radius $r$. Place minimum towers so every house is covered.

**(a) Algorithm.** Walk through houses in order. At the leftmost uncovered house $x_i$, place a tower at position $x_i + r$ (the furthest position that still covers $x_i$). Skip all houses now within $[x_i, x_i + 2r]$. Repeat.

```
towers := empty
lastTower := -infinity
for i := 1 to n:
    if x_i <= lastTower + r:        // already covered
        continue
    place tower at x_i + r           // greedy rule: furthest right
    towers.add(x_i + r)
    lastTower := x_i + r
return towers

Runtime: O(n) given pre-sorted input; O(n log n) including sort.
```

**(b) Proof (exchange, one direction impossible).**

> Let $G$ = greedy output. Let OPT = optimal solution with maximum number of towers in common with $G$. Suppose $G \neq \text{OPT}$, and let $j$ be the first step where their tower positions disagree. Let $x_i$ be the leftmost house not covered by the shared prior towers. Both G's and OPT's $j$-th towers must cover $x_i$.
>
> By the greedy rule, $G$'s $j$-th tower is at position $x_i + r$ — the furthest position still covering $x_i$. So OPT's $j$-th tower is at some position $p \leq x_i + r$.
>
> **Real case ($p < x_i + r$):** Replace OPT's tower with $G$'s tower (position $x_i + r$). Still covers $x_i$. Extends coverage further right. Anything OPT covered to the left of $x_i$ is already covered by the prior shared towers. So OPT' is valid, same count, more commonality — contradicts max-commonality of OPT.
>
> **Other direction ($p > x_i + r$):** impossible — such a tower would not cover $x_i$.
>
> Therefore $G = \text{OPT}$, so $G$ is optimal.

---

## Standard Conceptual Questions and Answers

### "Why is your greedy algorithm correct?"

Use the proof style matching your template:
- Template 1 (min rooms) → **exhaustion**
- Template 2 (max subset) → **exchange, Case 1 collapses**
- Template 3 (MST) → **exchange, cycle swap**
- Template 4 (shortest path) → **induction**
- Template 5 (cover all on line) → **exchange, one direction impossible**

See [Proof Styles by Template](#proof-styles-by-template) and worked examples above.

### "What is a $k$-partial solution?"

A solution to the problem restricted to the first $k$ inputs in the greedy ordering. The greedy invariant is that the $k$-partial solution remains "extendable" to an optimal solution on all $n$ inputs.

### "Could a different greedy rule work?"

Sometimes yes, sometimes no. E.g. for interval selection, earliest finish works but earliest start doesn't (counterexample: one giant interval covering 100 short ones). Always verify with the exchange argument.

### "What's the runtime?"

Usually dominated by the initial sort: $O(n \log n)$. The greedy loop itself is $O(n)$ with simple state.

### "When does greedy fail?"

When local optima don't compose to global optima. Classic example: 0/1 Knapsack (greedy by value-to-weight ratio is not optimal — use DP instead).

---

## Quick Reference

| Algorithm | Greedy rule | Runtime | Used for | Problem type |
|---|---|---|---|---|
| Interval Scheduling | earliest **start** time | $O(n \log n)$ | minimum labels / colours | partition (min rooms) |
| Interval Selection | earliest **finish** time | $O(n \log n)$ | maximum non-overlapping set | packing (max compatible) |
| Prim's MST | min-cost edge growing $T$ | $O(m \log n)$ | minimum spanning tree | graph connectivity |
| Dijkstra | closest vertex to $T$ | $O(m \log n)$ | single-source shortest paths | shortest paths |
| **Interval Covering** | **furthest-reach** from leftmost uncovered point | $O(n \log n)$ | min markers to cover all points on a line | **covering** (must reach all) |

### Pattern recognition cheat sheet

| Problem says… | Template |
|---|---|
| "minimum rooms / labels / colours" for overlapping items | **1** Interval Scheduling |
| "maximum compatible subset" of activities/intervals | **2** Interval Selection |
| "cheapest set of edges connecting everything" | **3** Prim's MST |
| "shortest path from a source" | **4** Dijkstra |
| "minimum stops / guards / towers to **cover/reach all** on a line" | **5** Interval Covering |

> **Trap:** Templates 2 (Selection) and 5 (Covering) both involve intervals on a line, but they're structurally opposite:
> - **Selection (2):** pick a *subset* to *maximise*; some items get rejected.
> - **Covering (5):** place *markers* so *every* item is served; nothing gets rejected. Items aren't even necessarily intervals — they may be points (paintings, houses, stations) that we cover.

---

## Practice Problems

- **2024 mock Q1 — Interstellar shipping refuelling problem (Template 5, Interval Covering — greedy by max reachable distance).** Note: this is *not* a Template 2 variant; it's a covering problem.
- **Tower placement / Art Gallery Guarding** (GT 10.4, A-10.1, CLRS 16.2-5): paintings/houses on a line, place min guards/towers with radius $r$ to cover all. Template 5.
- Tutorial Week 1 exercises
- Goodrich & Tamassia §10 + Ch 14, 15 (graphs)
- CLRS §16, 23, 24

> **Friend's exam template (for templates that use exchange — i.e., 2, 3, 5):** "greedy rule, $k$-partial solution, exchange via OPT with max commonality, two cases (check which collapses), contradict."
>
> **For Template 1 (min rooms):** *"$k$ rooms used → $k$ overlapping items → any valid schedule needs $\geq k$. Optimal."*
>
> **For Template 4 (Dijkstra):** *"Invariant: $T$ is a subtree of a shortest-path tree. Inductive step uses closest-vertex rule + positive weights."*
