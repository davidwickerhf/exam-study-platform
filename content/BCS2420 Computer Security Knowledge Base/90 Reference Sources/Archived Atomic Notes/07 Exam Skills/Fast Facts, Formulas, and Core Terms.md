---
tags:
  - university
  - bcs2420
  - computer-security
---

# Fast Facts, Formulas, and Core Terms

> [!abstract] Why this note matters
> - Closed-book exams reward strong recall of formulas, terms, and standard distinctions.
> - This note centralizes the highest-yield short facts without replacing the main explanatory notes.

## Overview

This note is intentionally compressed. Use it after the main notes already make sense. It is not the teaching layer; it is the recall layer.

The course often tests not only whether you know a term, but whether you can connect it to the correct neighboring terms. So the most useful fact list is one built around contrasts and formulas.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **CIA triad**: Confidentiality, integrity, availability.
- **risk equation**: The course formula `R = T * V * C` (Threat × Vulnerability × Consequence). V is the probability the system is compromised given an attack attempt.
- **FAR**: False Accept Rate in biometrics.
- **IDS vs IPS**: Detect-only versus detect-and-prevent systems.

## Formulas to Memorize

- **Risk:** `R = T * V * C`.
- **Key space:** `|K| = 2^n` where `n` is the key length in bits. DES `n = 56` → `2^56` keys; AES `n ∈ {128, 192, 256}` → `2^128`, `2^192`, `2^256` keys. Exhaustive search cost scales with key-space size.
- **IDS confusion matrix:**
  - True Positive Rate (sensitivity, recall): `TPR = TP / (TP + FN)`
  - False Positive Rate: `FPR = FP / (FP + TN)`
  - True Negative Rate (specificity): `TNR = 1 − FPR = TN / (TN + FP)`
  - False Negative Rate: `FNR = 1 − TPR = FN / (FN + TP)`
  - Precision (Accuracy of Positives): `AP = TP / (TP + FP)` — the probability that an alarm is real, dominated in practice by the base rate.
- **Base-rate problem:** even a high-TPR / low-FPR detector produces mostly false alarms when the prior probability of attack is very small. Always interpret AP in light of the attack base rate.

## Hashing Properties Trio

A cryptographic hash function `H` must satisfy three properties (ordered weakest to strongest):

1. **One-wayness (preimage resistance):** given `h = H(x)`, infeasible to find any `x'` with `H(x') = h`.
2. **Second-preimage resistance:** given `x`, infeasible to find a different `x' ≠ x` with `H(x') = H(x)`.
3. **Collision resistance:** infeasible to find any pair `(x, x')` with `x ≠ x'` and `H(x) = H(x')`.

Collision resistance is the strongest — breaking it does not necessarily break the others, but breaking it usually disqualifies the hash for digital signatures.

## STRIDE — Threat Category to Security Property Violated

| Letter | Threat | Property violated |
|---|---|---|
| **S** | Spoofing | Authenticity |
| **T** | Tampering | Integrity |
| **R** | Repudiation | Non-repudiation |
| **I** | Information Disclosure | Confidentiality |
| **D** | Denial of Service | Availability |
| **E** | Escalation of Privilege | Authorization |

Use the table to map a scenario directly to the violated property in a Part B/C essay.

## Five Adversary Attributes

1. **Objectives** — what the attacker wants to achieve (financial, political, espionage, sabotage).
2. **Methods** — the techniques they use (social engineering, exploitation, supply chain).
3. **Capabilities** — the resources, knowledge, and skills they possess (this is the one that maps to "technical means and skill set").
4. **Funding Level** — the budget available (script kiddie vs nation-state).
5. **Outsider vs Insider** — whether they start outside the trust boundary or already inside.

## Detailed Explanation

A fast-facts note helps because the final exam is closed-book, but rote memorization alone is not enough. Each item here should cue a fuller explanation from the main notes.

That also means this note should be treated as a retrieval map, not as a substitute for the full concept notes. Every item below corresponds to a contrast or mechanism that the source material uses repeatedly.

Use it as a compression layer after understanding the topic notes. If one line here feels too abstract to explain aloud in two or three sentences, that is the signal to revisit the linked concept note rather than to memorize the phrase more aggressively.

## How It Works

Use this note for active recall, then jump back into the linked full notes when a term feels thin.

For each item, practice a three-step response: define it, contrast it with the nearest similar concept, and give one course-specific example.

For formulas or rates, always add an interpretation step: what does the number mean operationally, and what control or judgment follows from it?

## What You Must Know

- CIA triad.
- Risk equation `R = T * V * C`.
- Passive vs active adversary.
- Ciphertext-only, known-plaintext, chosen-plaintext, chosen-ciphertext.
- One-time pad conditions and OTP reuse failure.
- ECB vs CBC vs CTR vs OFB.
- Authentication vs identification vs authorization.
- Salt vs pepper vs stretching.
- Replay vs reflection vs relay.
- Key transport vs key agreement.
- Virus vs worm vs trojan vs ransomware vs rootkit.
- Polymorphic vs metamorphic malware.
- Stored vs reflected vs DOM-based XSS.
- Mixed content, `document.domain`, and cookie scope across subdomains.
- Stateless vs stateful firewall.
- Default-deny vs default-allow; bastion host; port knocking.
- IDS vs IPS, HIDS vs NIDS.
- False positive vs false negative; base-rate problem.
- ARP spoofing vs DNS cache poisoning.

## 30-Second Oral Answer

- Use this note for quick recall, not as your only explanation source.

## Typical Exam Questions

- Can you define each pair or group and state the key difference from memory?
- Can you compute risk and then interpret the result?

## Common Pitfalls

- Using the recall list as a substitute for understanding.
## Related Concepts

- [[Sample Paper 2025 — Question Bank with Model Answers|Sample Paper 2025 — Question Bank with Model Answers]]
- [[Part B and C Essay Templates and Model Answers|Part B and C Essay Templates and Model Answers]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
