---
tags:
  - university
  - bcs2420
  - computer-security
  - cram-sheet
---

# 01 Foundations and Security Principles Cram Sheet

Morning-of-exam scan sheet. Dense facts, formulas, acronyms.

## Course Logistics

- Final exam = 75%, project = 25%. Must score **>55% on the exam** for the project to count.
- 120 min closed-book. Allowed: pen + DACS-approved calculator.
- Grade scale: 10 = 95–100 | 9 = 85–94 | 8 = 75–84 | 7 = 65–74 | 6 = 55–64 | F = below 55.
- Late work: −2 pts/day.
- Resit grade = `max( (resit/7.5) + (project/2.5) , (resit/10) )`.

## CIA Triad (+ extensions)

- **C**onfidentiality — info only to authorized parties.
- **I**ntegrity — data/state not altered except in authorized ways.
- **A**vailability — usable when needed.
- Often extended: **Authentication** (who is it?), **Authorization** (what may they do?), **Accountability** (audit trail), **Non-repudiation** (can't deny).

## Security Policy and Attacks

- **Security policy** = statement of what is allowed/disallowed.
- **Attack** = intentional action to violate the policy.
- A "failure" is only an attack success if it violates the policy.
- Ransomware violates A first, often C, sometimes I.

## Risk Equation

```text
R = T * V * C
```

- **T** = threat probability (likelihood of attempt).
- **V** = vulnerability (likelihood of success).
- **C** = cost (impact/loss if successful).
- Worked: T=0.02, V=0.7, C=5M EUR → R = 70,000 EUR.
- Controls reduce one or more terms:
  - Patching → lowers V.
  - Awareness training → lowers T.
  - Faster IR + backups → lowers C.

## Adversary Attributes (5)

- **Objectives** — what they want (data, money, disruption, espionage).
- **Methods** — tactics, techniques, procedures.
- **Capabilities** — technical skill, tooling, access.
- **Funding level** — resources, persistence over time.
- **Origin** — Outsider vs Insider.

## Adversary Groups (7 named)

- Script kiddies
- Hacktivists
- Cybercriminals (financially motivated)
- Insiders (malicious or accidental)
- Industrial spies / competitors
- Terrorists
- Nation-state APTs

## Outsider vs Insider

| | Outsider | Insider |
|---|---|---|
| Access | None initially | Already has credentials/trust |
| Starting position | Outside perimeter | Inside, close to assets |
| Mitigation | Perimeter, auth, monitoring | Least privilege, separation of duties, auditing |

## STRIDE (memorise letter ↔ property)

| Letter | Threat | Violates |
|---|---|---|
| **S** | Spoofing | Authentication |
| **T** | Tampering | Integrity |
| **R** | Repudiation | Non-repudiation |
| **I** | Information Disclosure | Confidentiality |
| **D** | Denial of Service | Availability |
| **E** | Escalation of Privilege | Authorisation |

## Threat Modeling — 4 Methods

1. **STRIDE** — checklist of 6 threat categories per component.
2. **Attack Trees** — root = attacker goal; AND/OR nodes; leaves = concrete attacks.
3. **Diagram-Driven (DFD)** — 5-step pattern:
   1. List actors, processes, data stores, external entities.
   2. Draw data flows.
   3. Draw trust boundaries.
   4. For each flow crossing a boundary: ask "what could go wrong?"
   5. Generate threats from crossings.
4. **Checklists** — predefined list of known threats; fast but blind to novel ones.

## Model-Reality Gap

- Assumption in the model does not hold in reality → invisible insecurity.
- Examples: cloud isolation assumption, trusted-insider assumption, broken key management.
- Mitigate: audits, pen-tests, third-party certification, explicit SLAs.

## Defense in Depth

- Multiple overlapping controls so one failure does not cause total compromise.
- Each layer should address a different attack step OR same step in a different way.
- Example chain: mail filter → browser sandbox → least privilege → segmentation → monitoring.

## Security Posture

- System-wide view: exposure + controls + weaknesses + response capability.
- "What is exposed, which assumptions are wrong, what happens when one layer fails, how fast can we detect/recover?"

## Design Principles (Lecture 7)

- **Safe defaults** — deny unless explicitly allowed (e.g., default-deny firewall).
- **Complete mediation** — check every access every time; do not rely on cached prior checks.
- **Isolated compartments** — DMZ, segmentation, blast-radius reduction.
- **Least privilege** — minimum perms needed for task.

## Control Types — Know the Job

- Reduce **attack surface** (disable services).
- Reduce **exploitation success** (patches, configs).
- Reduce **impact** (segmentation, backups).
- **Detect** what prevention misses (IDS, logging).

## Human Factors

- **Insider threat** = risk from someone with legitimate access (malicious OR accidental).
- **Outsider threat** = risk from outside the org.
- Usability matters — if secure path is painful, users route around it.
- **Ethical use** = only test systems you own or have explicit permission to test. Technical capability ≠ authorization.

## Common Pitfalls

- Calling every failure an "attack" without naming the policy violated.
- Listing CIA as buzzwords with no example.
- Treating insider threats as only malicious.
- Saying "more tools = better posture" without checking which risks they address.
- Confusing detection controls with prevention controls.
