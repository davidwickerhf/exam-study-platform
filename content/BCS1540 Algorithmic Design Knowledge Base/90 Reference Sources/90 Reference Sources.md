# Reference Sources — BCS1540 Algorithmic Design

Catalogue of every PDF in `Materials/`, with what it's useful for and the topic it maps to.

---

## Highest Priority (use first)

| File | Why it matters |
|---|---|
| `Materials/03 Past Exams and Solutions/cs1540-FinalExam2024.pdf` | The actual 2024 exam — same format expected in 2025-26 (minus Q5 randomized). Practice in timed conditions. |
| `Materials/03 Past Exams and Solutions/exam-model-solutions.pdf` | Official model answers for the 2024 exam. Shows the level of detail and exact answer style expected. Includes the explicit hint that backtracking/B&B "could be examined" this year. |
| `Materials/01 Syllabus and Exam Info/Canvas-syllabus.pdf` | Course outline, schedule, exam format (closed book, 2hr, no calculator, pseudocode), grading formula, list of removed topics for 2025-26 (network flows, approximation, randomized). |
| `Materials/01 Syllabus and Exam Info/BSC1540-Assessment_2025-2026.pdf` | Official assessment plan. Confirms exam-only grading is possible: $max(exam, 0.9\cdot exam + 0.1\cdot assignment)$. Resit identical format. |
| `Materials/06 Recap and Review/cs1540-review-SC.pdf` | SC's two-part course recap covering the first half: greedy, D&C, DP. 31 pages of consolidated lecture material — best single revision document for these topics. |
| `Materials/06 Recap and Review/Recap – DM half-2026.pdf` | DM's 2026 recap covering second half: P/NP, NP-completeness, backtracking, B&B, LP/ILP. 23 pages, explicitly the lecturer's own exam-prep summary. |

---

## Topic-by-Topic Map

### Greedy Algorithms (Lectures 1-2, SC)
- `Materials/02 Lecture Slides/cs1540-week1-intro-greedy_flattened.pdf` — lecture slides
- `Materials/02 Lecture Slides/dijkstra-flat.pdf` — Dijkstra example walk-through
- `Materials/04 Tutorial Exercises/Week1-ExercisesSlide.pdf` + `Week1-Exercises-Solutions.pdf` — tutorial problems on intervals, MST, Dijkstra
- Textbook: Goodrich & Tamassia §10 (greedy), §14 (shortest paths), §15 (MST). CLRS §16 (greedy), §23 (MST), §24 (shortest paths).

### Master Theorem & Divide and Conquer (Lectures 3-4, DM + SC)
- `Materials/02 Lecture Slides/lecture3-mastertheorem.pdf` — DM's full Master Theorem lecture (45 slides), including Karatsuba walkthrough
- `Materials/02 Lecture Slides/cs1540-week2-part2_flattened.pdf` — SC's D&C lecture (median selection, convex hull, closest pair)
- `Materials/04 Tutorial Exercises/Week2-part2-ExercisesSlide.pdf` + `Week2-part2-exercises-Solutions.pdf`
- Textbook: GT R-11.1, C-11.3, C-11.4. CLRS 4.5-1, 4.5-3, 4.5-4, 4-1, 4-2, 4-3.

### Dynamic Programming (Lectures 5-6, SC)
- `Materials/02 Lecture Slides/cs1540-week3-dynamic-programming-flattened.pdf` — main DP lecture (LCS, weighted interval scheduling, knapsack, TSP)
- `Materials/02 Lecture Slides/DP - Floyd-Warshall.pptx` — Floyd-Warshall (all-pairs shortest paths) — convert to PDF if needed
- `Materials/04 Tutorial Exercises/Week3-exercises.pdf` + `Week3-exercises-Solutions.pdf`
- `Materials/05 Homework/Homework2-DynamicProgramming.pdf` — Anchored LCS variant (good practice for novel DP problems)
- Textbook: GT Ch 12 (covers LCS 12.5, weighted intervals 12.3, knapsack 12.6). CLRS Ch 15.

### NP-Completeness & Complexity (Lectures 7-8, DM)
- `Materials/02 Lecture Slides/2026-lecture -complexity.pdf` — DM's intro to complexity theory (P, NP, languages, reductions)
- `Materials/02 Lecture Slides/2026-npcompleteness.pdf` — DM's NP-completeness lecture (Cook-Levin, CNF-SAT → 3-SAT → Vertex-Cover → Subset-Sum chain)
- `Materials/02 Lecture Slides/complexity-notes.pdf` — handwritten DM notes, MST decision problem + SCS-to-LCS reduction example
- Textbook: GT R-17.3 to 17.9, C-17.9 to 17.17, A-17.2 to 17.6. CLRS 34.5-2, 34.5-3, 34.5-7, 34.5-8, 34-2, 34-3, 34-4.

### Backtracking & Branch-and-Bound (Lecture 9, DM)
- `Materials/02 Lecture Slides/2026-backtrack.pdf` — DM's lecture (SAT backtracking, n-queens, vertex cover, B&B generic algorithm)
- No dedicated tutorial slides — exercises folded into Week 4 tutorial covering NP/LP/B&B together
- Textbook: GT C-18.2, C-18.3, C-18.4.

### Linear Programming & ILP (Lecture 10, DM)
- `Materials/02 Lecture Slides/2026-linearprogramming.pdf` — DM's full LP lecture (standard form, simplex sketch, duality, shadow prices, ILP NP-completeness, fractional relaxation, 3-SAT-as-ILP)
- Textbook: GT R-26.1, R-26.3, R-26.7, R-26.12, R-26.13, A-26.3, C-26.10, C-26.13, A-26.5, A-26.6. CLRS 29.1-4, 29.2-1, 29.2-6, 29.2-7.

---

## Homework / Practice

| File | Topic | Use |
|---|---|---|
| `Materials/05 Homework/Homework1-ProgrammingAndMore.pdf` | Programming + greedy | Optional practice; not exam material |
| `Materials/05 Homework/Homework2-DynamicProgramming.pdf` | Anchored LCS (DP variant) | **Recommended** — exam-style DP variant |
| `Materials/05 Homework/AlgorithmDesign_assignments-3.pdf` | "Weg afgesloten" (Dijkstra + NP-completeness extension) | **Highly recommended** — the NP-completeness extension (bribing road closures) uses the same Knapsack reduction template as 2024 mock Q4(c) |
| `Materials/05 Homework/Homework4.pdf` | Final homework set | Optional practice |

---

## What's Deprioritized for 2025-26

The 2025-26 syllabus explicitly removes:
- **Randomized algorithms** (Q5 of the 2024 exam — skip this entirely)
- **Approximation algorithms**
- **Network flows**

If they appear in old material (e.g. the 2024 exam Q5 about Las Vegas / Monte Carlo 3-colouring), treat them as low priority. The model solutions for the 2024 exam confirm: *"5. Not relevant this year."*

The **assignment** is now a 30-minute in-tutorial test in week 3 (not graded homework). Since the grading formula is $max(exam, 0.9\cdot exam + 0.1\cdot assignment)$, **missing/failing the assignment cannot hurt your grade** — only the exam matters for passing.

---

## Cross-Reference Quick Index

| If you want to … | Read |
|---|---|
| See exam format | `01 Syllabus and Exam Info/Canvas-syllabus.pdf` page 2 |
| See grading formula | `01 Syllabus and Exam Info/BSC1540-Assessment_2025-2026.pdf` section 3 |
| Practice in exam conditions | `03 Past Exams and Solutions/cs1540-FinalExam2024.pdf` (skip Q5) |
| See model-quality answers | `03 Past Exams and Solutions/exam-model-solutions.pdf` |
| Last-minute SC topics review | `06 Recap and Review/cs1540-review-SC-flattened.pdf` |
| Last-minute DM topics review | `06 Recap and Review/Recap – DM half-2026.pdf` |
| Learn a topic from scratch | the corresponding lecture slide in `02 Lecture Slides/` |
| Practice problems by topic | the corresponding `Week*-exercises*.pdf` in `04 Tutorial Exercises/` |
