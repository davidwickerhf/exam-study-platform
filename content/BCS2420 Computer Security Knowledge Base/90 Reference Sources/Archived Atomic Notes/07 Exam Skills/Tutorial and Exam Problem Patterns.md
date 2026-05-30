---
tags:
  - university
  - bcs2420
  - computer-security
---

# Tutorial and Exam Problem Patterns

> [!abstract] Why this note matters
> - The tutorials and their solutions reveal the stable question shapes used across the course.
> - This note compresses the answer patterns expected in the final closed-book exam.

## Overview

The course uses recurring question types. Some ask for crisp concept distinctions, such as symmetric vs asymmetric or stateless vs stateful. Some ask for mechanism explanations, such as replay defense or OTP reuse. Some ask for calculations, such as risk or alarm reasoning.

A good exam answer is usually short but structured. The best pattern is: define the concept, explain the mechanism, give one example or implication, and, if relevant, state the defense or tradeoff.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **compare-and-contrast question**: A question that asks you to distinguish two or more concepts clearly and structurally.
- **mechanism question**: A question asking how a protocol, attack, or defense actually works.
- **attack-defense mapping**: An answer structure that pairs a concrete vulnerability or attack with the control that mitigates it.

## Detailed Explanation

Tutorial Part A questions test precise vocabulary and mechanism recognition. These require confident definitions with no drift in terminology.

Tutorial Part B and lab-style questions require structured explanations. Here the expected move is to define the attack or mechanism, explain the key steps, compare with a nearby concept if useful, and finish with practical consequences or defenses.

Calculation questions still require words. When computing risk or interpreting false positives, you should state not only the number but what it means and what decision it supports.

## How It Works

For compare questions: define both items, state the core difference, then give one consequence.

For mechanism questions: identify attacker capability, vulnerable step, why it works, and how to stop it.

For calculations: show the formula, plug in values, compute, and interpret.

## Exam-Day Strategy

**Time budget (120 minutes total, 14 questions):**

| Section | Count | Per-question budget | Total |
|---|---|---|---|
| Part A (multiple choice) | 12 | ~3 min | 36 min |
| Part B (short essays) | 3 | ~10 min | 30 min |
| Part C (longer problems) | 3 | ~15 min | 45 min |
| Buffer for review and unsticking | — | — | ~9 min |

- Spend the first pass on Part A — most marks per minute. If a question takes longer than 3 minutes, mark it and move on.
- Tackle Part C before B if the C scenarios look more familiar — the marginal point is worth more per minute on the longer questions.
- Reserve the final ~9 minutes to revisit flagged items and to double-check that every page has your name and ID.

**Answer-pattern templates:**

- **Theory question (Define → Mechanism → Attack → Defense → Tradeoff):**
  1. Define the concept precisely.
  2. Explain how the mechanism works.
  3. Name the attack or failure mode this addresses.
  4. State the defense or control.
  5. Note the residual tradeoff or limitation.

- **Scenario essay (Identify the policy violated → Explain the mechanism → Propose the defense):**
  1. Identify which security property or policy clause is violated (confidentiality, integrity, availability, authenticity, non-repudiation, authorization).
  2. Explain the attack mechanism step by step in the scenario's terms.
  3. Propose a concrete defense and state which property it restores.

- **Calculation (Formula → Substitution → Number → Interpretation):**
  1. Write the formula symbolically.
  2. Substitute values explicitly.
  3. Compute the result with units.
  4. Interpret what the number means operationally and what action it supports.

**Multiple-choice sanity checklist:**

- Eliminate impossible distractors first. Options with reversed-direction claims (e.g., "public-key is faster than symmetric for bulk encryption") are usually wrong by construction.
- Watch for absolute quantifiers: "always," "only," "never," "guarantees," "no offline attacks possible." These are usually traps — security claims rarely hold absolutely.
- For STRIDE questions, the question typically asks about the *category* the threat falls in, not the specific exploit. Map first to the letter (S, T, R, I, D, E), then to the answer.
- For "best reason" questions, multiple options may be technically true; pick the one most directly causal to the asked property.
- For "fundamental difference" questions, the right answer states the defining structural property, not a peripheral consequence.

## What You Must Know

- How to structure short-answer and long-answer responses cleanly.
- How to connect definitions to examples and defenses.
- How to interpret calculations, not just compute them.

## 30-Second Oral Answer

- A high-quality answer defines, explains, gives an example, and states the defense or tradeoff.
- Exam responses should be structured, not stream-of-consciousness lists.

## Typical Exam Questions

- How should you answer a compare-and-contrast security question?
- What structure works well for an attack/defense explanation?
- What must be included in a risk or detection-rate calculation answer?

## Common Pitfalls

- Answering with only definitions and no mechanism.
- Answering with only stories and no precise terminology.
- Giving a computed number with no interpretation.
## Related Concepts

- [[Sample Paper 2025 — Question Bank with Model Answers|Sample Paper 2025 — Question Bank with Model Answers]]
- [[Part B and C Essay Templates and Model Answers|Part B and C Essay Templates and Model Answers]]
- [[Fast Facts, Formulas, and Core Terms|Fast Facts, Formulas, and Core Terms]]
- [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial 1.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 1.pdf)
- [Tutorial 2.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2.pdf)
- [Tutorial 3.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 3.pdf)
- [Tutorial 4.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 4.pdf)
- [Tutorial 5.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 5.pdf)
- [Tutorial L6.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L6.pdf)
- [Tutorial L7.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L7.pdf)
- [Tutorial L8.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L8.pdf)
