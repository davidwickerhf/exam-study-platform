---
tags:
  - university
  - bcs2420
  - computer-security
---

# Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps

> [!abstract] Why this note matters
> - STRIDE appeared directly in Sample Paper Part A Q1 and Tutorial 1 MCQ.
> - Attack Trees and Diagram-Driven Modeling are compared in Tutorial 1 Part B.
> - Model-Reality Gaps appear in Tutorial 1 Part B Q5 and are a recurring exam theme.

## Overview

Threat modeling is the practice of systematically identifying what can go wrong in a system before an attacker finds it first. The course covers four structured approaches: STRIDE, Attack Trees, Diagram-Driven Modeling, and Checklists. Each uses a different lens to enumerate threats.

Model-Reality Gaps arise when the security model assumes something about the real system that is false — the most dangerous kind of security failure because it is invisible under normal conditions.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **threat modeling**: A structured process for identifying, classifying, and prioritizing potential threats to a system.
- **STRIDE**: A mnemonic for six threat categories: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Escalation of Privilege.
- **attack tree**: A hierarchical diagram where the root is the attacker's top-level goal and leaves are concrete methods to achieve sub-goals.
- **diagram-driven modeling**: A threat modeling approach based on architectural diagrams, data flow diagrams (DFDs), and trust boundary analysis.
- **checklist-based modeling**: Using a predefined list of known threat types to ensure completeness.
- **model-reality gap**: A mismatch between the assumptions made in a security model and the actual properties of the real system.

## Detailed Explanation

### STRIDE

STRIDE is a structured mnemonic developed to ensure common threat categories are not overlooked when reviewing a system.

| Letter | Threat | Violates |
|--------|--------|----------|
| **S** | Spoofing | Authentication |
| **T** | Tampering | Integrity |
| **R** | Repudiation | Non-repudiation |
| **I** | Information Disclosure | Confidentiality |
| **D** | Denial of Service | Availability |
| **E** | Escalation of Privilege | Authorisation |

Usage: Walk through each system component and data flow. For each, ask: can someone spoof this? Tamper with it? Repudiate their actions? etc.

Advantage: Systematic, easy to remember, good for brainstorming sessions.
Disadvantage: May miss novel or unusual threats not in the six categories; gives less architectural detail than diagram-driven approaches.

### Attack Trees

Attack trees represent threats as a hierarchical decomposition of an attacker's goal.

- **Root node**: The attacker's ultimate objective (e.g., "steal customer passwords").
- **Children nodes**: Sub-goals or alternative methods.
- **Leaves**: Concrete, actionable attack steps.

Nodes can be AND (all children must succeed) or OR (any child is enough).

Advantage: Visualises the space of attacks; makes dependencies explicit; good for comparing attack paths and costs.
Disadvantage: Time-consuming for large systems; quality depends on analyst completeness.

### Diagram-Driven Modeling

A visual approach that starts with an architectural representation of the system: components, data flow links, gateways, and trust domains (areas with shared security policies or trust levels).

**Lecture 1's five named steps:**

1. **Draw an architectural diagram** with system components and communication links.
2. **Mark gateways** where controls restrict communication (firewalls, routers, proxies).
3. **Define trust domains** based on trust assumptions (e.g. "authenticated users," "DMZ-facing services").
4. **Assess how trust assumptions could be violated** for each component, link, and domain. ("What could go wrong here?")
5. **Simplify into a data flow diagram (DFD)** that traces data flow through the tasks the system performs.

The fifth step is critical: the architectural diagram shows *what exists*, but the DFD shows *what data moves where*, which is what threats actually exploit.

#### Consider user workflow

A diagram-driven model is only as complete as the workflows it covers. Lecture 1 stresses:

- **Trace user actions from task initiation to completion**, including *uncommon tasks like account creation and software updates*. These are easy to forget because they happen rarely, but they are exactly where attackers concentrate (provisioning flows often have weaker access checks; update channels are high-value supply-chain targets).
- **Highlight where sensitive data is stored** and ensure all access paths are shown — not just the obvious "happy path."

Advantage: Highly contextual; finds system-specific issues; good for complex architectures.
Disadvantage: Time-intensive; relies on accurate, complete diagrams; does not provide a predefined threat checklist.

### Checklists

A static list of known threats or vulnerabilities used to quickly verify coverage. Often used alongside other methods.

Advantage: Fast, requires little expertise, consistent.
Disadvantage: Misses threats not on the list; tends toward known patterns, not novel ones.

### Model-Reality Gaps

A security model is only as good as its assumptions. A model-reality gap is when an assumption the model depends on does not hold in practice. Threat modeling is difficult precisely *because* of invalid assumptions and the tendency to focus on the wrong threats.

#### Quality of a Threat Model (Lecture 1)

> The quality of a threat model depends on how accurately it reflects system details and the operating environment.

Lecture 1 names **three sources** from which model-reality gaps arise:

1. **Abstraction** — the model deliberately omits detail; the omitted detail turns out to matter.
2. **Invalid assumptions** — an assumption (about an interface, a user, a provider) is simply wrong.
3. **Misplaced trust** — a component or actor was trusted to behave correctly but does not.

#### Examples

- **Hotel Safebox** (Lecture 1's canonical example): Checking into a hotel room with a small safe, the combination *chosen by the guest* might not be secure against hotel staff with master keys. The guest's threat model assumes only people who know the combination can open the safe; reality includes a master key the guest never sees. The misplaced trust is in the hotel, not in the safe's locking mechanism.
- **Cloud isolation assumption**: A model assumes the cloud provider enforces strong tenant isolation, but the underlying hypervisor has a known VM-escape vulnerability.
- **Trusted insider assumption**: A model assumes all employees are trustworthy, but insider threats exist.
- **Cryptographic assumption**: A model treats encryption as unconditional, but the key management is broken.

Notice the pattern: each example pairs a *defensive assumption* with a *real-world condition that breaks it*. The hotel safebox is especially clean because the security mechanism (the safe) works exactly as advertised — the gap is in the threat model that ignored the hotel itself.

#### How to mitigate

- Regular audits and penetration tests to probe assumptions.
- Third-party certification reviews.
- Establishing explicit SLAs and security contracts.
- Assume adversarial conditions rather than benign ones for critical components.
- Re-examine what you have abstracted away — abstraction itself is a source of gaps.

## How It Works

STRIDE -> apply six categories to each component and data flow to enumerate threats systematically.

Attack Tree -> root = goal, branches = subgoals, leaves = concrete actions; AND/OR nodes model dependencies.

Diagram-Driven -> follow the five named steps: architectural diagram → mark gateways → define trust domains → assess trust-assumption violations → simplify to a DFD. Trace user workflow from initiation to completion, including uncommon tasks like account creation and software updates.

Model-Reality Gap -> assumption fails in the real world → security model provides false guarantees. Gaps come from abstraction, invalid assumptions, or misplaced trust.

## What You Must Know

- STRIDE: the full mnemonic and what security property each letter violates.
- Attack Trees: structure (root, branches, leaves), AND vs OR nodes.
- Diagram-Driven: the five named steps (architectural diagram → gateways → trust domains → assess violations → DFD), the role of trust domains as areas with shared security policy, and the user-workflow consideration including uncommon tasks.
- How to compare STRIDE vs Diagram-Driven: strengths and weaknesses of each.
- What a model-reality gap is; the **Hotel Safebox** and Cloud examples; and the three sources of gaps — abstraction, invalid assumptions, misplaced trust.

## 30-Second Oral Answer

- STRIDE ensures six threat categories are systematically checked; Attack Trees hierarchically decompose attacker goals; Diagram-Driven Modeling follows data flows across trust boundaries; Checklists offer a quick completeness check.
- Model-Reality Gaps are dangerous because they look secure on paper while being exploitable in practice.
- Good threat modeling uses at least two methods together: STRIDE for coverage, Diagram-Driven for architecture context.

## Typical Exam Questions

- What does STRIDE stand for and what security property does each letter relate to?
- Compare Diagram-Driven and STRIDE threat modeling: how does each identify threats, and what are their trade-offs?
- What is an attack tree? How does the root-to-leaf structure represent attacker goals?
- Describe a model-reality gap in a cloud service context and suggest one mitigation.

## Common Pitfalls

- Thinking STRIDE only applies to network protocols — it applies to any component or data flow.
- Confusing Attack Trees (goal-based hierarchy) with STRIDE (category-based checklist).
- Treating a model-reality gap as simply a "bug" — it is a structural mismatch between assumption and reality.
- Forgetting that Repudiation (R in STRIDE) relates to non-repudiation as a security property.

## Concrete Examples and Commands

### STRIDE applied to a login form

```text
Component: login form receiving username + password

S - Spoofing: Can attacker impersonate the user? → Use strong authentication.
T - Tampering: Can credentials be modified in transit? → Use HTTPS.
R - Repudiation: Can a user deny they logged in? → Maintain audit logs.
I - Info Disclosure: Can passwords leak in error messages? → Sanitize error output.
D - DoS: Can the form be flooded to lock users out? → Rate-limit login attempts.
E - Escalation: Can a low-privilege user gain admin access? → Enforce RBAC.
```

### Model-Reality Gap example — Cloud

```text
Security Model assumes:
  "Cloud provider enforces strict tenant isolation."

Reality:
  Provider uses a hypervisor with a known VM-escape vulnerability.

Gap effect:
  Cross-tenant attacks are possible even though the model treated them as impossible.

Source of gap:
  Misplaced trust (in the provider's hypervisor isolation).

Mitigation:
  Request provider's security audit report; conduct independent penetration testing.
```

### Model-Reality Gap example — Hotel Safebox

```text
Security Model assumes:
  "Only someone who knows the combination can open the safe."

Reality:
  Hotel staff hold master keys that bypass the combination.

Gap effect:
  The guest believes the combination secures their valuables, but the
  hotel itself is a trusted party in the real system that the guest's
  model never represented.

Source of gap:
  Abstraction (the hotel was abstracted out of the model) +
  misplaced trust (in the hotel as a benign environment).

Mitigation:
  Re-draw the threat model to include the hotel as an actor with
  master-key capability; use external storage for valuables that
  truly require a guest-only secret.
```

## Related Concepts

- [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]
- [[Security Goals Beyond CIA — Authorization, Authentication, Accountability|Security Goals Beyond CIA — Authorization, Authentication, Accountability]]
- [[Defense in Depth, Security Strategy, and Security Posture|Defense in Depth, Security Strategy, and Security Posture]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 01 — Introduction and Security Fundamentals.pdf](../Materials/01 Lectures/Lecture 01 — Introduction and Security Fundamentals.pdf)
- [Tutorial 1.pdf](../Materials/02 Tutorials/Tutorial 1.pdf)
- [Tutorial 1 Solution.pdf](../Materials/02 Tutorials/Tutorial 1 Solution.pdf)
