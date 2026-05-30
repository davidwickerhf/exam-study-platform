---
tags:
  - university
  - bcs2420
  - computer-security
---

# Security Goals, Policy, Adversaries, and Risk

> [!abstract] Why this note matters
> - Lecture 1 and Tutorial 1 define the vocabulary that the rest of the course assumes.
> - The risk equation and policy-based view of attacks are exam-style building blocks.

## Overview

Security in this course starts from policy and goals, not from tools. Tools matter only because they help defend confidentiality, integrity, availability, or related properties such as authentication and accountability.

Lecture 1 uses major incidents like WannaCry, NotPetya, Stuxnet, and TRITON to show that security failures are not abstract. They affect hospitals, shipping, industry, and safety systems. The correct mental model is therefore broad: a system is secure only relative to a policy and a threat environment.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **confidentiality**: Non-public information remains accessible only to authorized parties.
- **integrity**: Data, software, or hardware remains unaltered except by authorized parties.
- **availability**: Information, services, and computing resources remain accessible for authorized use.
- **security policy**: A statement of what is allowed and disallowed in a system or organization.
- **attack**: Deliberate steps intended to cause a security violation — to drive the system from a secure state into a non-secure state.
- **risk** (verbal): The expected loss due to harmful future events relative to assets, over a fixed time period.
- **risk** (equation): `R = T * V * C` — threat probability times vulnerability times cost.
- **V (vulnerability)**: Probability of a successful compromise, given that the threat is activated. (Tested verbatim on the 2025-03-21 past exam.)
- **C (cost)**: Tangible plus intangible cost if the attack succeeds — not just monetary loss.

## Detailed Explanation

A security policy describes the desired secure state. An attack is not merely 'something bad'; it is an intentional effort to violate the policy. That framing matters because it links technical events back to organizational intent and acceptable behavior.

The CIA triad is the classical foundation, but Lecture 1 names three more — Authorization, Authentication, Accountability — as foundational goals alongside it. See [[Security Goals Beyond CIA — Authorization, Authentication, Accountability|Security Goals Beyond CIA — Authorization, Authentication, Accountability]] for those.

Confidentiality protects secrecy, integrity protects correctness and trustworthiness, and availability protects access and operational continuity. Real incidents often violate more than one pillar at once. Ransomware harms availability, often confidentiality, and sometimes integrity as well.

### CIA Methods (Lecture 1, slides 16-21)

Each pillar of the CIA triad is supported by specific defensive methods. Lecture 1 lists them explicitly:

| Goal | Methods | Notes |
|------|---------|-------|
| **Confidentiality** | Access Control, Data Encryption, Procedural Means | Access control is OS-enforced; encryption uses cryptographic algorithms; procedural means = physical access restrictions to offline storage media. |
| **Integrity** | Error Detection/Correction Codes (for benign errors); Access Controls + Cryptographic Checksums (against malicious alteration) | The benign vs malicious split is the key distinction. Example: ensuring software updates are not tampered with. |
| **Availability** | Reliable Hardware and Software; Protection Mechanisms | Reliable HW/SW addresses faults; protection mechanisms address intentional disruption such as denial of service. |

### Adversary Modeling (Lecture 1)

Adversary modeling identifies and understands potential attackers, their objectives, methods, capabilities, and resources. Lecture 1 lists **five** attributes of an adversary (the original four plus Outsider vs Insider):

1. **Objectives**: Goals of the adversary — what assets they target (stealing sensitive data, disrupting services, financial gain).
2. **Methods**: Anticipated attack techniques or types of attacks (phishing, malware, social engineering, direct network attacks).
3. **Capabilities**: Resources, skills, and knowledge available — computing power, knowledge of system vulnerabilities, skilled personnel, opportunity (e.g. physical access). *Tested on 2025-03-21 exam Q3 as "technical means and skill set."*
4. **Funding Level**: Financial resources influencing determination and methods (government-funded agencies vs individual hackers).
5. **Outsider vs Insider**: Origin of the attack. Outsiders launch attacks without prior special access; insiders have some starting advantage, such as employees with network credentials.

### Named Groups of Adversaries (Lecture 1)

Lecture 1 also lists seven named adversary groups, ordered loosely from most to least capable:

1. **Foreign intelligence** (including government-funded agencies)
2. **Cyber-terrorists** or politically-motivated adversaries
3. **Industrial espionage agents** (perhaps funded by competitors)
4. **Organized crime** (groups)
5. **Lesser criminals and crackers** (individuals who break into computers)
6. **Malicious insiders** (including disgruntled employees)
7. **Non-malicious employees** (often security-unaware) — distinct from malicious insiders; their harm is accidental but real. See [[Human Factors, Insider Threats, and Ethical Security Practice|Human Factors, Insider Threats, and Ethical Security Practice]].

### Risk Equation

The risk equation gives a planning model: threat probability times vulnerability times cost. It is not perfect, but it trains the right habit: security is about reducing either the likelihood of attacks, the likelihood of success, or the impact of compromise.

Note carefully:
- **T** is the probability the threat is activated.
- **V** is the probability that, if activated, the threat *succeeds in compromising the system* — i.e. vulnerability is conditional on the threat firing.
- **C** is the cost if the attack succeeds, and includes both **tangible** (revenue loss, replacement hardware) and **intangible** (reputation, regulatory penalties, loss of trust) components.

## How It Works

If the policy says only authorized payroll staff may access salary records, then unauthorized disclosure is a confidentiality violation and therefore an attack success.

If `R = T * V * C`, then you can lower risk by reducing threat probability, reducing vulnerability, or reducing impact. Different controls act on different terms.

Attack trees and similar threat-modeling methods work by starting from an attacker goal and breaking it into feasible subgoals or techniques.

## What You Must Know

- CIA triad and the supporting methods for each pillar (access control / encryption / procedural for C; error codes vs access control + checksums for I; reliable HW/SW + protection mechanisms for A).
- That Lecture 1's foundational goals are six, not three — CIA *plus* Authorization, Authentication, Accountability.
- The relation between security policy and attacks: an attack is a deliberate step intended to drive the system from secure to non-secure state.
- All **five** adversary attributes: objectives, methods, capabilities, funding level, **outsider vs insider**.
- The **seven** named adversary groups (foreign intelligence through non-malicious employees).
- The verbal definition of risk: expected loss due to harmful future events relative to assets, over a fixed time period.
- The risk equation `R = T * V * C`, the precise meaning of V (probability of successful compromise), and that C includes intangible costs.

## 30-Second Oral Answer

- Security is defined relative to policy: an attack is a policy violation or an attempt to cause one.
- The CIA triad gives the basic goals, while risk reasoning adds probability, weakness, and impact.
- Good answers connect a concrete threat to the policy it violates and the control that reduces the risk.

## Typical Exam Questions

- What is the relationship between a security policy and an attack?
- How would you explain the CIA triad using a real system, and what defensive methods support each pillar?
- What does each variable in `R = T * V * C` represent? (V was tested verbatim on 2025-03-21.)
- Name the five adversary attributes from Lecture 1.
- Name three of the seven named adversary groups and place them on the capability spectrum.
- Why can cyber incidents have operational and reputational impacts beyond pure technical damage?

## Common Pitfalls

- Treating CIA as isolated buzzwords without examples or supporting methods.
- Listing only four adversary attributes (missing Outsider vs Insider).
- Treating non-malicious employees as the same category as malicious insiders.
- Defining V as "vulnerability count" rather than "probability of successful compromise."
- Treating C as monetary only — the lecture explicitly says tangible + intangible.
- Calling every failure an 'attack' without referencing the policy being violated.
- Thinking risk can only be reduced by buying more tools rather than by reducing vulnerability or impact.

## Concrete Examples and Commands

### Risk calculation pattern

```text
Given:
T = 0.02
V = 0.7
C = 5,000,000 EUR

R = T * V * C
R = 0.02 * 0.7 * 5,000,000
R = 70,000 EUR expected annual risk
```

A technical control such as better patching mostly lowers `V`, while staff training or improved monitoring may lower `T` or reduce `C` indirectly by speeding response.

## Worked Examples

### Policy violation example

Suppose a university policy states that only enrolled students may access exam solutions before the review session.

If an attacker exposes the solution files through a misconfigured web directory, the secure state is broken because unauthorized access became possible. The exploit is an attack success because it violated the policy, not just because 'a file leaked'.

## Related Concepts

- [[Security Goals Beyond CIA — Authorization, Authentication, Accountability|Security Goals Beyond CIA — Authorization, Authentication, Accountability]]
- [[Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]
- [[Defense in Depth, Security Strategy, and Security Posture|Defense in Depth, Security Strategy, and Security Posture]]
- [[Human Factors, Insider Threats, and Ethical Security Practice|Human Factors, Insider Threats, and Ethical Security Practice]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 01 — Introduction and Security Fundamentals.pdf](../Materials/01 Lectures/Lecture 01 — Introduction and Security Fundamentals.pdf)
- [Tutorial 1.pdf](../Materials/02 Tutorials/Tutorial 1.pdf)
- [Tutorial 1 Solution.pdf](../Materials/02 Tutorials/Tutorial 1 Solution.pdf)
