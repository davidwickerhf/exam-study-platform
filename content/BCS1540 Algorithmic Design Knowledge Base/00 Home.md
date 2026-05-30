# BCS1540 Algorithmic Design — Home

**Course:** BCS1540 Algorithmic Design (4 ECTS) | Maastricht University, Year 1, Period 5
**Examiners:** Steven Chaplick (SC) + David Mestel (DM)
**Exam:** Wed 20 May 2026, 12:00–14:00 | **Closed book, no calculator** | Pseudocode (not Java)
**Resit:** Identical format

---

## Grade Calculation

**$Final = max(exam_grade, 0.9 × exam_grade + 0.1 × assignment_grade)$**

The assignment is a 30-minute in-tutorial closed-book test in week 3 covering greedy + master theorem (= 10% if it helps).

**Critical consequence:** A missing / zero assignment **cannot hurt** — the exam alone determines the grade. **Passing is entirely exam-based.**

> Target: **6.0 / 10** on the exam to pass.

---

## Exam Format (based on 2024 final, applicable to 2025–26)

5 questions on 14 pages, mixture of theory + algorithm design. Total 100 points. Structure typically:

| # | Topic | Pts | What it asks |
|---|---|---:|---|
| 1 | **Greedy** | 12 | (a) pseudocode for a greedy algorithm + brief English description (8p); (b) prove optimality via exchange argument (4p) |
| 2 | **Master Theorem** | 12 | Apply to 3 recurrences with brief justification (4p each) |
| 3 | **Dynamic Programming** | 18 | Use the **4-step format**: (1) table definition, (2) recurrence + correctness, (3) bottom-up algorithm + runtime, (4) reconstruction |
| 4 | **NP-completeness + ILP** | 28 | (a) formulate decision problem (5p); (b) state two NP-completeness conditions (2p); (c) prove NP-complete via reduction (10p); (d) write as ILP (6p); (e) explain fractional relaxation (5p) |
| 5 | **Randomized algorithms** | 10 | **NOT relevant in 2025–26 — removed from syllabus** |

The 2025-26 syllabus says **randomized algorithms, network flows, and approximation algorithms are removed**. Backtracking & branch-and-bound get more emphasis this year — the model solutions explicitly warn there may be a question to actually write a backtrack or branch-and-bound algorithm.

> Effective total without Q5: 90 points → 6.0 means ~54 points.

---

## The 7 Topics

| # | Topic | Lectures | Difficulty | Exam yield | Study Priority |
|---|---|---|---|---|---|
| 1 | [[01 Greedy Algorithms]] | L1 + L2 (SC) | Medium | 12 pts + foundational | **1 — Start here** |
| 2 | [[02 Master Theorem and Divide and Conquer]] | L3 (DM) + L4 (SC) | Low–Medium | 12 pts (mechanical) | **2 — Cheap points** |
| 3 | [[03 Dynamic Programming]] | L5 + L6 (SC) | Medium–High | 18 pts (highest single Q) | **3 — Drill the 4-step format** |
| 4 | [[04 Complexity and NP-Completeness]] | L7 + L8 (DM) | High | ~17 pts (part of Q4) | **4 — Reductions are the hard part** |
| 5 | [[06 Linear Programming and ILP]] | L10 (DM) | Medium | ~11 pts (part of Q4) | **5 — Memorise the template** |
| 6 | [[05 Backtracking and Branch-and-Bound]] | L9 (DM) | Medium | Possibly a Q this year | **6 — Could surprise** |

---

## Study Plan (limited time, single-day prep)

The exam rewards **answer templates**, not deep reading. Drill the four core templates:

1. **Greedy + exchange proof** — "Let stops = greedy output. Let OPT be optimal with max stops in common. Suppose stops ≠ OPT. Let j = first disagreement. Case 1: j ∈ OPT, j ∉ stops → exchange to j*…"
2. **Master Theorem** — Write recurrence as $T(n) = aT(n/b) + f(n)$. Compare f(n) to n^(log_b a). Three cases. Done.
3. **Four-step DP** — (1) table OPT[j] = …, (2) recurrence with explanation, (3) bottom-up loop + runtime, (4) reconstruction by backtracking through table.
4. **NP-completeness reduction** — "We reduce from [known NPC problem]. Given instance l, define f(l) as follows: [explicit mapping]. We show f(l) is YES iff l is YES."

### Recommended one-day session order (Mon–Tue–Wed before the exam)

1. [[02 Master Theorem and Divide and Conquer]] — 90 min: read the three cases, do mock Q2 in 5 min flat.
2. [[01 Greedy Algorithms]] — 120 min: read the exchange argument template, write out mock Q1 with the proof.
3. [[03 Dynamic Programming]] — 180 min: drill the 4-step format on the 2024 mock Q3 (max-subarray sum); rewrite from memory.
4. [[04 Complexity and NP-Completeness]] — 120 min: focus on (a) decision problem template, (b) NPC conditions, (c) reduction structure.
5. [[06 Linear Programming and ILP]] — 90 min: standard form, fractional relaxation, Vertex-Cover-as-ILP.
6. [[05 Backtracking and Branch-and-Bound]] — 60 min: read the generic backtracking and B&B pseudocode templates; could be examined.
7. [[2024 Final Walkthrough]] — 120 min timed under exam conditions, then compare to model solutions.

---

## Study Progress Checklist

### Topic 1 — Greedy Algorithms
- [ ] Concept: greedy rule, k-partial solution, optimization problem
- [ ] Concept: exchange argument structure (Case 1 + Case 2) — 4-word mnemonic: MAX-OVERLAP → FIRST-DISAGREE → TWO-SWAPS → CONTRADICT
- [ ] Algorithm: Interval Scheduling (earliest start time, exhausted-labels argument) — Template 1, partition / min rooms
- [ ] Algorithm: Interval Selection (earliest finish time, exchange argument) — Template 2, packing / max compatible
- [ ] Algorithm: MST — Prim's (grow by min-cost edge, exchange argument on first differing edge) — Template 3
- [ ] Algorithm: Dijkstra (grow shortest-path tree to closest vertex) — Template 4
- [ ] Algorithm: **Interval Covering / Art Gallery (furthest-reach greedy on a line) — Template 5, covering / min markers**. This is the **2024 mock Q1** template (interstellar refueling).
- [ ] Pattern recognition: Template 2 (packing, max subset) vs Template 5 (covering, must reach all) — same shape, opposite goal
- [ ] Mock Q1 done by hand — pseudocode + exchange proof

### Topic 2 — Master Theorem & Divide and Conquer
- [ ] Form: $T(n) = aT(n/b) + f(n)$
- [ ] Comparison: $f(n)$ vs $n^(log_b a)$
- [ ] Case 1: $f(n) = O(n^(log_b a - ε))$ → $T(n) = \Theta (n^(log_b a))$
- [ ] Case 2: $f(n) = \Theta (n^(log_b a) \cdot log^k n)$ → $T(n) = \Theta (n^(log_b a) \cdot log^(k+1) n)$
- [ ] Case 3: $f(n) = \Omega (n^(log_b a + ε))$ → $T(n) = \Theta (f(n))$
- [ ] D&C: Mergesort `2T(n/2) + n` → Θ(n log n)
- [ ] D&C: Linear-time select (median of medians), Karatsuba multiplication, Convex hull, Closest pair
- [ ] Mock Q2 done by hand — 3 recurrences

### Topic 3 — Dynamic Programming
- [ ] Concept: 5-step DP roadmap (recursive structure → table → recurrence → bottom-up → backtracking)
- [ ] Algorithm: LCS — $L(i,j) = max(L(i-1,j), L(i,j-1)) or 1+L(i-1,j-1)$
- [ ] Algorithm: Weighted Interval Scheduling — $OPT[i] = max(OPT[i-1], b_i + OPT[p(i)])$
- [ ] Algorithm: 0-1 Knapsack — $OPT[j,Z] = max(OPT[j-1,Z], v_j + OPT[j-1,Z-w_j])$, runtime O(nW) pseudopolynomial
- [ ] Algorithm: Knapsack with repetition — $OPT[Z] = max(v_j + OPT[Z-w_j])$
- [ ] Algorithm: TSP — $OPT[S,v] = min_{u\in S-v}(OPT[S-v,u] + c(u,v))$, runtime O(n² · 2^n)
- [ ] Algorithm: Floyd-Warshall — all-pairs shortest paths
- [ ] Algorithm: Max contiguous subarray sum — O(n) DP (Kadane's algorithm, 2024 mock Q3)
- [ ] Mock Q3 done by hand — full 4-step format

### Topic 4 — NP-Completeness
- [ ] Concept: optimization vs decision problem (convert)
- [ ] Concept: P = polynomial-time solvable, NP = polynomial-time verifiable certificates
- [ ] Concept: polynomial-time (Karp) reduction $L1 \to L2$
- [ ] Definition: NP-hard = every problem in NP reduces to it
- [ ] Definition: NP-complete = NP-hard AND in NP
- [ ] Cook-Levin: CNF-SAT is NP-complete (so any NP-hardness reduction can start from a known NPC problem)
- [ ] Chain: CNF-SAT → 3-SAT → Vertex-Cover → Subset-Sum
- [ ] Known NPC problems: SAT, 3-SAT, Vertex Cover, Subset Sum, Knapsack, TSP, Hamiltonian Cycle, Clique, Independent Set, 3-Colouring
- [ ] Reduction structure: "to show L is NP-complete: (1) L ∈ NP — give certificate + verifier; (2) L NP-hard — reduce from known NPC problem"
- [ ] Mock Q4(a)–(c) done by hand

### Topic 5 — Linear Programming & ILP
- [ ] Standard form: max $c\cdot x$ s.t. $Ax \leq b$, $x \geq 0$
- [ ] Simplex algorithm exists, runs in poly time in practice (LP ∈ P, ILP NP-complete)
- [ ] LP duality: primal $max c\cdot x s.t. Ax \leq b$ ↔ dual $min b\cdot y s.t. yᵀA \geq c$; strong duality: same optimum
- [ ] Shadow prices: $y_i$ = marginal value of one extra unit of resource i
- [ ] **Fractional relaxation:** drop integrality $x_i \in ℤ$. Bound: $m_LP \geq m_ILP$ (max) or $m_LP \leq m_ILP$ (min)
- [ ] Express problems as ILP: Vertex-Cover, 3-SAT, Clique number, the 2024 mock Q4(d) road-upgrade problem
- [ ] Connection to B&B: use fractional relaxation to bound partial solutions
- [ ] Mock Q4(d)–(e) done by hand

### Topic 6 — Backtracking & Branch-and-Bound
- [ ] Concept: partial solution, `extend(a,i)`, `dead(b)`, `complete(b)`
- [ ] Generic backtracking pseudocode (set of partial solutions, while loop)
- [ ] Generic branch-and-bound pseudocode (bestcost, bound function)
- [ ] Example: SAT (DPLL-like)
- [ ] Example: Vertex Cover backtracking
- [ ] Example: Knapsack branch-and-bound
- [ ] Bound functions: greedy lower bound; LP relaxation as generic bound

---

## Materials Layout

Files are organized in `Materials/` as:

- `01 Syllabus and Exam Info/` — official course documents (Canvas syllabus, 2025–2026 assessment plan)
- `02 Lecture Slides/` — lecture decks: SC half (greedy, DnC, DP, master theorem), DM half (complexity, NP, backtracking, LP)
- `03 Past Exams and Solutions/` — 2024 final exam + model solutions (the most exam-faithful resource)
- `04 Tutorial Exercises/` — weekly exercise slides + worked solutions (week 1 greedy, week 2 DnC, week 3 DP)
- `05 Homework/` — practice homework sets (programming + DP + NP/LP)
- `06 Recap and Review/` — Mestel's recap from 2026 lecture 12 + Chaplick's 2-part course recap

See [[University/June Exams/BCS1540 Algorithmic Design Knowledge Base/90 Reference Sources/90 Reference Sources]] for a topic-by-topic mapping.

---

## Key Conventions in This KB

- **Pseudocode style:** follows the lecture style (Pascal-ish with `for ... end for`, `:=` assignment, no explicit types). The model solutions use the same.
- **All algorithm notes lead with the standard four blocks:** Input / Goal / Greedy rule (or recurrence) / Correctness sketch.
- **All complex algorithms include a "what the exam asks" section** based on the 2024 final and exercises.
- **Cram sheets** in `09 Cram Sheets/` distill each topic to a single page for last-minute review.
