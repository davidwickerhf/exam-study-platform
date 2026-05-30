# 2024 Final Walkthrough — BCS1540

**Source:** `Materials/03 Past Exams and Solutions/cs1540-FinalExam2024.pdf` and `exam-model-solutions.pdf`

This is the exam-shape drill. Do not memorize the story; memorize the answer forms.

---

## Q1 — Greedy Refueling Stops

Problem: stations on a line, ship travels at most `t` after refueling, choose fewest stops.

Greedy idea: from current position, go to the furthest reachable station before you would be unable to reach the next station / destination.

Pseudocode:

```
stops := empty
p := 0
for i := 1 to n-1
    if d_{i+1} > p + t
        stops.add(i)
        p := d_i
if d_star > p + t
    stops.add(n)
return stops
```

Proof: exchange argument. Let OPT be an optimal stop sequence with maximum overlap with greedy. At the first disagreement, greedy's chosen station is at least as far along the route as OPT's reachable choice. Replace OPT's stop with greedy's stop; all later stops remain reachable because starting later is no worse. Same number of stops, more overlap, contradiction.

---

## Q2 — Master Theorem

Use $T(n)=aT(n/b)+f(n)$.

1. $T(n)=6T(n/2)+n$
   - $n^(log_2 6)$ dominates `n`
   - answer: $\Theta (n^(log_2 6))$

2. $T(n)=8T(n/2)+2^n$
   - $2^n$ dominates $n^3$
   - answer: $\Theta (2^n)$

3. $T(n)=2T(n/4)+sqrt(n)$
   - $n^(log_4 2)=sqrt(n)$
   - same size, case 2
   - answer: $\Theta (sqrt(n) log n)$

---

## Q3 — Dynamic Programming: Maximum Subarray

Table:

$OPT[j]$ = maximum sum of a subarray that **must end at index j**.

Recurrence:

```
OPT[j] = max(X[j], X[j] + OPT[j-1])
```

Reason: the best subarray ending at j either starts at j, or extends the best subarray ending at j-1.

Bottom-up:

```
OPT[0] := X[0]
for j := 1 to n-1
    OPT[j] := max(X[j], X[j] + OPT[j-1])
best := max_j OPT[j]
```

Runtime: $O(n)$.

Reconstruction: store whether each $OPT[j]$ starts fresh or extends. Pick $end = argmax OPT[j]$, then walk backward while the table says "extends".

---

## Q4 — NP-Completeness + ILP

### Decision problem

Input: tree of towns and roads, upgrade costs, travel times, nobles, budget `B`, threshold `T`.

Question: is there a set of road upgrades with total cost at most `B` such that the sum of noble arrival times is at most `T`?

### Conditions for NP-complete

1. Problem is in NP.
2. Problem is NP-hard.

### Reduction from Knapsack

Given Knapsack items with weights $w_i$, values $v_i$, capacity `C`, target `V`:

- Make a path of `o+1` towns.
- Road i connects town i to i+1.
- Road cost $c_i = w_i$.
- Road time $b_i = 2v_i$.
- One noble at final town.
- Budget `B = C`.
- Target `T = sum_i 2v_i - V`.

Upgrading road i saves $v_i$ time and costs $w_i$. Therefore finding upgrades saving at least `V` within budget `C` is exactly Knapsack.

### ILP

Variables:

- $u_i \in {0,1}$ for road upgrades.
- $T_j \geq 0$ for arrival time at town j.

Objective:

```
minimize T_N1 + ... + T_Nk
```

Budget:

```
sum_i c_i u_i <= B
```

Path constraints:

```
T_j >= sum_{i in path(1,j)} (1 - u_i/2)b_i
```

Fractional relaxation: replace $u_i \in {0,1}$ by $0 \leq u_i \leq 1$. This gives a lower bound for minimization and can prune branch-and-bound.

---

## Q5 — Randomized Algorithms

The 2025-2026 syllabus says randomized algorithms were removed. Do not spend serious time here unless the lecturer explicitly reintroduces it.

