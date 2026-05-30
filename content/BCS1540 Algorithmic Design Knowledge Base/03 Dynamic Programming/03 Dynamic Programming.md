# Topic 3 — Dynamic Programming

**Lectures:** L5 + L6 (Steven Chaplick)
**Reference:** `Materials/02 Lecture Slides/cs1540-week3-dynamic-programming-flattened.pdf`, `DP - Floyd-Warshall.pptx`
**Tutorial:** `Materials/04 Tutorial Exercises/Week3-exercises*.pdf`
**Homework:** `Materials/05 Homework/Homework2-DynamicProgramming.pdf`

---

## What the Exam Asks

From the 2024 final, Q3 is **18 points (largest single question)** and always follows the **strict 4-step format**:

1. **Step 1: Define the table.** State clearly what each entry means — the specific subproblem it corresponds to and what specific value it stores.
2. **Step 2: Give the recurrence.** Justify correctness by reasoning about the recursive structure of optimal solutions.
3. **Step 3: Give the bottom-up algorithm.** Compute values following the recurrence. **Analyse the runtime.**
4. **Step 4: Reconstruct the optimal solution.** From the table values, recover the actual solution (not just its value). Include any extra information needed and a brief correctness/runtime argument.

> **Drill this format until it's muscle memory.** Every DP answer on the exam will use it.

The 2024 mock Q3 was: **maximum-sum contiguous subarray** in an array of integers — Kadane's algorithm in 4-step form.

---

## Bare-Minimum Exam Checklist

If time is short, tick these items as the minimum needed to attempt Q3 confidently. Memorising this list reliably banks 8–12 of the 18 marks, even on a problem that does not match any canonical pattern exactly.

### The 4-step skeleton — write the headers first

On the exam, write the four section headers on your answer sheet **before** thinking. Empty paper earns zero; even partial answers under labelled sections earn marks.

```
Step 1. Define the table.
Step 2. Recurrence + correctness.
Step 3. Bottom-up algorithm + runtime.
Step 4. Reconstruction.
```

### Pattern recognition

Read the problem and match it to one of the canonical shapes:

| If the problem says… | Pattern | Recurrence shape |
|---|---|---|
| "max sum / contiguous range" | **Kadane** | $\text{OPT}[j] = \max(X[j],\ X[j] + \text{OPT}[j-1])$ |
| "max/min total picking subset with constraint" | **WIS** | $\text{OPT}[i] = \max(\text{OPT}[i-1],\ v_i + \text{OPT}[p(i)])$ |
| "longest common between two sequences" | **LCS** | $L[i][j] = 1 + L[i-1][j-1]$ if match, else $\max(L[i-1][j], L[i][j-1])$ |
| "max value, total weight ≤ W" | **0/1 Knapsack** | $\text{OPT}[j][Z] = \max(\text{OPT}[j-1][Z],\ v_j + \text{OPT}[j-1][Z-w_j])$ |

If no exact match, pick the closest pattern and adapt the recurrence to the new constraint.

### Step 1 — table definition (one-sentence template)

> *Let $\text{OPT}[\text{indices}] = $ the [max / min / count] of [property] over [subproblem **with anchor**].*

**Anchor words** that turn a vague subproblem into a valid one:

- "**ending at** $j$" — used in Kadane, LIS, Longest Common Substring
- "**using first $i$ elements**" — used in WIS, Knapsack
- "**of the prefixes** $s_1[1..i]$ and $s_2[1..j]$" — used in LCS, Edit Distance
- "**using first $j$ items with weight ≤ $Z$**" — used in 0/1 Knapsack

Always close with the whole-problem mapping:

> *Whole-problem answer = $\text{OPT}[\ldots]$* (or *max over cells*, if the cell is anchored to a specific endpoint).

### Step 2 — recurrence (bullet-list style)

The 2024 model solution uses a casual bullet-list format, not a formal proof. List the options for the last decision; the listing is itself the correctness argument.

```
The recursive structure: an optimal solution to OPT[...] does one of:
  - [option A]: [brief constraint or reason] → contributes [formula]
  - [option B]: [brief constraint or reason] → contributes [formula]

Recurrence: OPT[...] = max/min { options }.
Base: OPT[base] = base value.
```

No formal "optimal substructure" language is required. Stating the options exhaustively, plus the recurrence and base, is sufficient.

### Step 3 — bottom-up template

```
Initialise base cells.
for each index in topologically increasing order:
    OPT[index] := <recurrence>
return OPT[final]    // or max over cells, depending on the table
```

Always state the runtime explicitly, with the breakdown:

> *Runtime: $O(\text{table size} \times \text{work per cell}) = O(\ldots)$.*

### Step 4 — reconstruction template

```
Start at the winning cell (the argmax / argmin cell).
At each cell, determine which branch of the recurrence "won" by
  comparing OPT[cell] against each option's formula.
Record the choice. Move to the predecessor cell suggested by the
  winning branch.
Repeat until a base case is reached.
```

Runtime is typically $O(n)$ or $O(n + m)$ — the depth of the walk.

### Topics that can be safely skipped under time pressure

The following appear rarely and are not worth memorising when time is short:

- **TSP recurrence** ($\text{OPT}[S, v]$) — bitmask DP, complex setup
- **Floyd-Warshall** ($D[k][i][j]$) — 3D table, rarely tested
- **Edit Distance specifics** — recognisable as an LCS-shaped problem at exam time, can be adapted on the spot
- **Longest Increasing Subsequence specifics** — adaptable from Kadane's pattern using the "previous state" recurrence

### Pre-exam mental warm-up

Recite to yourself before opening the question paper:

> *"Four steps. Table, recurrence, bottom-up, reconstruction. Anchor the cell to a single decision point. Recurrence = list the options for the last decision. Always state runtime. Always do reconstruction."*

This is the entire DP exam strategy compressed into one sentence.

---

## The 5-Step Roadmap (Course's Version)

From the SC course recap:

1. **Recursive Structure:** think about a best solution under some condition (e.g. including or excluding a "last" element).
2. **Table:** an array indexed by parameters that define subproblems, storing the optimal value for each. **Make sure one of the subproblems equals the whole problem.**
3. **Recurrence:** based on the recursive structure, describe a recurrence to compute table values, including base cases.
4. **Bottom-up:** write an iterative algorithm that computes values in the array following the recurrence.
5. **Backtracking:** use the computed array values to reconstruct a solution achieving the best value (may require extra info about choices made).

---

## DP Algorithms Covered

### 1. Longest Common Subsequence (LCS) — [GT 12.5, CLRS 15.4]

**Input:** two strings $s_1$ (length $n$), $s_2$ (length $m$).
**Goal:** length and content of the longest string that is a subsequence of both.

**Table:** $L(i, j) = $ LCS of prefixes $s_1[1..i]$ and $s_2[1..j]$.

**Recurrence:**

$$L(i, j) = \begin{cases} 0 & i = 0 \text{ or } j = 0 \\ 1 + L(i-1, j-1) & s_1[i] = s_2[j] \\ \max(L(i-1, j), L(i, j-1)) & s_1[i] \neq s_2[j] \end{cases}$$

**Structure:** at the end either we match the last element of both, or we don't (drop one).

**Runtime:** $O(nm)$ table, $O(1)$ per cell $\to$ $O(nm)$ total.

**Reconstruction:** start at $L(n, m)$. At each cell, if the recurrence came from $L(i-1, j-1)$ (i.e. match), prepend $s_1[i]$ to the answer; otherwise follow the larger of $L(i, j-1) / L(i-1, j)$.

> **Homework 2 variant (Anchored LCS):** a `*` is an "anchor" that cannot be skipped. Modify the recurrence: if exactly one string has a `*` at the current position, we must use it (so the LACS must include it or we move forward in the other string).

### 2. Weighted Interval Scheduling (a.k.a. Scheduling Telescope Time) — [GT 12.3]

**Input:** intervals $(s_i, f_i)$ with benefits $b_i$.
**Goal:** select non-conflicting intervals maximising total benefit.

**Setup:** sort intervals by finish time. For interval $i$, let $p(i)$ be the largest index $j < i$ such that interval $j$ doesn't conflict with $i$.

**Table:** $\text{OPT}[i] = $ max benefit using a subset of the first $i$ intervals.

**Recurrence:**

$$\text{OPT}[i] = \max\bigl(\text{OPT}[i - 1], \; b_i + \text{OPT}[p(i)]\bigr), \quad \text{OPT}[0] = 0$$

The two branches: don't take $i$ (left), or take $i$ and use the best of compatible earlier intervals (right).

**Runtime:** $O(n \log n)$ total (sort + compute $p$ via binary search).

**Reconstruction:** walk back: if $\text{OPT}[i] > \text{OPT}[i - 1]$ then $i$ was taken; jump to $p(i)$.

### 3. 0/1 Knapsack — [GT 12.6, CLRS 16.2]

**Input:** weight capacity $W$, $n$ objects with positive integer weights $w_i$ and values $v_i$.
**Goal:** maximum-value subset of objects with total weight $\leq W$.

**Table:** $\text{OPT}[j, Z] = $ max value using a subset of the first $j$ objects with total weight at most $Z$.

**Recurrence:**

$$\text{OPT}[j, Z] = \max\bigl(\text{OPT}[j - 1, Z], \; v_j + \text{OPT}[j - 1, Z - w_j]\bigr), \quad \text{OPT}[0, Z] = 0$$

The two branches: skip object $j$ (left), or take object $j$ (only if $w_j \leq Z$; right).

**Runtime:** $O(nW)$ table, $O(1)$ per cell $\to$ $O(nW)$.

> **Pseudopolynomial.** The input size is $O(n \log W)$ (the value $W$ needs $\log W$ bits to write down), but the runtime is $O(nW) = O(n \cdot 2^{\log W})$. So this is **not** polynomial in the input size. This is "the best we can do" — Knapsack is NP-complete.

**Reconstruction:** walk back from $\text{OPT}[n, W]$: if $\text{OPT}[j, Z] > \text{OPT}[j - 1, Z]$ then $j$ was taken; recurse on $(j - 1, Z - w_j)$.

### 4. Knapsack with Repetition (a.k.a. Unbounded Knapsack)

**Setup:** same as 0/1 Knapsack but objects can be used multiple times.

**Table:** $\text{OPT}[Z] = $ max value of a multiset of objects with total weight $\leq Z$.

**Recurrence:**

$$\text{OPT}[Z] = \begin{cases} 0 & Z < w_j \text{ for all } j \\ \max \{ v_j + \text{OPT}[Z - w_j] : j \text{ with } w_j \leq Z \} & \text{otherwise} \end{cases}$$

**Runtime:** $O(nW)$. Note the table is 1-D (just indexed by $Z$, since we can reuse objects).

### 5. Travelling Salesperson (TSP)

**Input:** complete directed $n$-vertex weighted graph $G = (V, E)$ with $c : E \to \mathbb{Q}_{\geq 0}$. A starting vertex $s$.
**Goal:** shortest Hamiltonian cycle (visits every vertex exactly once, returns to start).

**Table:** $\text{OPT}[S, v] = $ length of shortest $s$-to-$v$ path that visits precisely the vertices of $S \cup \{s\}$. Here $S$ is a subset of $V \setminus \{s\}$.

**Recurrence:**

$$\text{OPT}[S, v] = \min \{ \text{OPT}[S \setminus \{v\}, u] + c(u, v) : u \in S \setminus \{v\} \}$$

$$\text{OPT}[\emptyset, v] = c(s, v)$$

**Final answer:** $\min \{ \text{OPT}[V \setminus \{s\}, v] + c(v, s) : v \in V \setminus \{s\} \}$.

**Runtime:** $O(n^2 \cdot 2^n)$ — exponential, but a huge improvement over the $n!$ brute force.

> TSP is **NP-complete** — exponential is "the best we can do" up to constants.

### 6. Floyd-Warshall (All-Pairs Shortest Paths)

**Input:** weighted graph $G = (V, E)$ with weights $w : E \to \mathbb{R}$ (negative allowed, no negative cycles).
**Goal:** shortest path distance between every pair of vertices.

**Table:** $D[k][i][j] = $ length of shortest $i$-to-$j$ path using only intermediate vertices from $\{1, \ldots, k\}$.

**Recurrence:**

$$D[k][i][j] = \min\bigl(D[k-1][i][j], \; D[k-1][i][k] + D[k-1][k][j]\bigr)$$

with $D[0][i][j] = w(i, j)$ if the edge exists, $+\infty$ otherwise, and $D[0][i][i] = 0$.

**Runtime:** $O(n^3)$, space $O(n^2)$ (can collapse the $k$ dimension).

> Used for dense graphs or when you need all distances. For sparse graphs, run Dijkstra from each vertex: $O(n \cdot m \log n)$.

### 7. Max Contiguous Subarray Sum (2024 Mock Q3 — Kadane's Algorithm)

**Input:** array $X[0..n-1]$ of integers (can be negative).
**Goal:** find indices $i, j$ such that $\sum_{p = i}^{j} X[p]$ is maximised.

**Table:** $\text{OPT}[j] = $ max sum of a contiguous subarray ending at index $j$. So $\text{OPT}[j] = \max_i \sum_{p = i}^{j} X[p]$.

**Recurrence:**

$$\text{OPT}[j] = \max\bigl(X[j], \; X[j] + \text{OPT}[j - 1]\bigr), \quad \text{OPT}[0] = X[0]$$

Two branches: start fresh at $j$ (left), or extend the best subarray ending at $j - 1$ (right).

**Final answer:** $\max_j \text{OPT}[j]$.

**Runtime:** $O(n)$ for the table, $O(n)$ for the max, $O(n)$ total (much faster than the brute-force $O(n^3)$).

**Reconstruction:** find $j^* = \arg\max_j \text{OPT}[j]$ (the end index). Then walk backward: $i^* = j^*$; while $\text{OPT}[i^*] = \text{OPT}[i^* - 1] + X[i^*]$, set $i^* := i^* - 1$. Return $[i^*, j^*]$.

---

## The 4-Step Answer Template — Memorise This

For any DP problem on the exam:

> **Step 1: Define the table.**
> Let $\text{OPT}[\text{index variables}]$ be the [maximum / minimum / count] of [property] over [subproblem description].
> The whole problem corresponds to $\text{OPT}[\text{final index}]$.
>
> **Step 2: Recurrence.**
> The recursive structure: any optimal solution either [option A], or [option B], …
> So: $\text{OPT}[\ldots] = \max / \min \{ \text{option A formula}, \text{option B formula}, \ldots \}$
> Base case: $\text{OPT}[\text{small index}] = \text{base value}$.
> Correctness: the recurrence considers all possibilities for the last decision and picks the best.
>
> **Step 3: Bottom-up algorithm.**
>
> ```
> Initialize OPT[base] = base value
> for index in topologically increasing order
>     OPT[index] := <recurrence>
> end for
> ```
>
> Runtime: $O(\text{table size} \cdot \text{work per cell}) = O(\ldots)$.
>
> **Step 4: Reconstruction.**
> Walk back through the table from $\text{OPT}[\text{final}]$. At each step, identify which branch of the recurrence was taken (by comparing values). Record the choice and recurse on the predecessor index.
>
> ```
> i := final index
> answer := empty
> while i > base
>     find which branch achieved OPT[i]
>     update answer accordingly
>     i := predecessor for that branch
> end while
> return answer
> ```
>
> Runtime: $O(\text{depth})$.

---

## Standard Conceptual Questions and Answers

### "Why DP and not greedy?"

DP is for problems where local optima don't compose into global ones — the optimal solution arises in **several different ways** and we have to try them all. Knapsack is the classic example where greedy (by value-to-weight ratio) is not optimal but DP is.

### "What's the difference between top-down (memoization) and bottom-up?"

Same recurrence, different evaluation order. Top-down (recursive + cache) is easier to write but has function-call overhead. Bottom-up (iterative table fill) is more efficient and standard in exam answers.

### "Is your DP polynomial?"

Check input size carefully. For Knapsack the input is $O(n \log W)$, but the runtime is $O(nW)$ — exponential in the input size of $W$. This is called **pseudopolynomial**.

### "Can DP have negative entries?"

Yes — e.g. max subarray sum can have $\text{OPT}[j] < 0$ for prefixes of all negatives. The "max over $j$" at the end picks the best valid choice.

### "What goes in the table?"

Just the **value** of the optimum (a number), not the solution itself. The solution is reconstructed in step 4.

---

## Quick Reference

| Problem | Table | Recurrence shape | Runtime |
|---|---|---|---|
| LCS | $L(i, j)$ | match last or drop | $O(nm)$ |
| Weighted Interval Sched | $\text{OPT}[i]$ | take or skip $i$ | $O(n \log n)$ |
| 0/1 Knapsack | $\text{OPT}[j, Z]$ | take or skip $j$ | $O(nW)$ pseudo-poly |
| Knapsack repeat | $\text{OPT}[Z]$ | which item $j$ to add | $O(nW)$ |
| TSP | $\text{OPT}[S, v]$ | which $u$ was previous | $O(n^2 \cdot 2^n)$ |
| Floyd-Warshall | $D[k][i][j]$ | use $k$ or not | $O(n^3)$ |
| Max subarray sum | $\text{OPT}[j]$ | extend or restart | $O(n)$ |

---

## Practice Problems

- 2024 mock Q3 (max contiguous subarray sum)
- Tutorial Week 3 exercises
- Homework 2 (Anchored LCS — variant of LCS)
- Goodrich & Tamassia Ch 12
- CLRS Ch 15

> Friend's exam template: **4 steps. Table. Recurrence. Bottom-up. Reconstruction. Every. Single. Time.**
