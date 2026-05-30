---
tags:
  - university
  - bcs2420
  - computer-security
  - worked-drill
---

# Security Foundations Worked Drills

Use these drills to practice complete short-answer and long-answer responses under closed-book conditions.

**Best use:** attempt each answer from memory, then compare against the model. Do not memorize the exact prose; memorize the structure.

## Drill 1 — CIA Triad in One Concrete System

**Question.** Explain the CIA triad using one concrete system example.

### Try First

Pick one system and fill the table.

| Property | What failure would look like | Control |
|---|---|---|
| Confidentiality |  |  |
| Integrity |  |  |
| Availability |  |  |

### Model Answer

For an online banking system, **confidentiality** means only authorized users and bank staff may read account balances, transaction histories, and personal data. A confidentiality failure would be a stranger viewing another customer's statement; controls include authentication, authorization checks, TLS, and encryption at rest.

**Integrity** means account balances and payment instructions cannot be modified without authorization. An integrity failure would be an attacker changing the destination account or amount of a transfer; controls include access control, input validation, transaction logs, digital signatures or MACs on sensitive messages, and database constraints.

**Availability** means legitimate users can access the banking service when needed. A failure would be a DDoS attack or server outage that prevents customers from logging in or making payments; controls include redundancy, rate limiting, DDoS protection, backups, monitoring, and incident response.

### Marking Cues

- Full credit requires all three properties.
- Each property needs a concrete failure, not only a definition.
- Strong answers name at least one matching control per property.

**Covered in:** [[01 Foundations and Security Principles/01 Foundations and Security Principles|Security Goals, Policy, Adversaries, and Risk]]

## Drill 2 — Risk Calculation and Control Mapping

**Question.** A web service faces a threat probability `T = 0.20` per year. If attacked, the probability of successful compromise is `V = 0.40`. The expected cost of compromise is `C = EUR 150,000`. Compute annualized risk using `R = T * V * C`, then explain two ways to reduce it.

### Model Answer

Formula:

```text
R = T * V * C
R = 0.20 * 0.40 * 150,000
R = 12,000
```

The annualized risk is **EUR 12,000**. Operationally, this means the expected yearly loss from this threat scenario is twelve thousand euros, assuming the estimated probabilities and cost are realistic.

Two reductions:

| Lever | Example control | Why it reduces risk |
|---|---|---|
| Lower `T` | Reduce exposure by removing public admin panels, using firewall allowlists, or disabling unused services | Fewer attack attempts or fewer reachable attack surfaces |
| Lower `V` | Patch the vulnerable component, add MFA, harden configuration, or enforce least privilege | If attacked, compromise becomes less likely |
| Lower `C` | Backups, incident-response plan, segmentation, cyber-insurance, data minimization | The damage of a successful compromise is reduced |

### Common Trap

Do not say "encryption lowers all risk." Encryption can lower cost or vulnerability for confidentiality failures, but it may not help availability, phishing, or business process abuse.

**Covered in:** [[01 Foundations and Security Principles/01 Foundations and Security Principles|Security Goals, Policy, Adversaries, and Risk]]

## Drill 3 — STRIDE Mapping

**Question.** Map each scenario to the most fitting STRIDE category and the security property it violates.

| Scenario | STRIDE | Violated property |
|---|---|---|
| Attacker logs in using a stolen user's session cookie |  |  |
| Attacker modifies an invoice amount in transit |  |  |
| User deletes a record and later denies doing it |  |  |
| User downloads confidential records they are not allowed to read |  |  |
| Botnet floods the server until normal users cannot connect |  |  |
| Normal user calls an admin-only API endpoint and becomes admin |  |  |

### Model Answer

| Scenario | STRIDE | Violated property |
|---|---|---|
| Attacker logs in using a stolen user's session cookie | Spoofing | Authenticity |
| Attacker modifies an invoice amount in transit | Tampering | Integrity |
| User deletes a record and later denies doing it | Repudiation | Non-repudiation / accountability |
| User downloads confidential records they are not allowed to read | Information disclosure | Confidentiality |
| Botnet floods the server until normal users cannot connect | Denial of service | Availability |
| Normal user calls an admin-only API endpoint and becomes admin | Elevation of privilege | Authorization |

### Marking Cues

- STRIDE is a threat-enumeration mnemonic, not a complete security design.
- Good answers map the scenario to both the letter and the violated property.

**Covered in:** [[01 Foundations and Security Principles/01 Foundations and Security Principles|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]

## Drill 4 — Insider vs Outsider Threats

**Question.** Compare insider and outsider threats in one structured paragraph.

### Model Answer

An **outsider threat** begins outside the organization's trusted boundary: the attacker usually lacks legitimate credentials and must first gain access through phishing, exposed services, credential theft, malware, or network exploitation. An **insider threat** comes from someone who already has legitimate access, such as an employee, contractor, or administrator. This makes insider threats dangerous because ordinary controls may treat their actions as authorized, especially when permissions are too broad. Outsiders are often constrained by perimeter defenses; insiders are constrained mainly by least privilege, separation of duties, monitoring, logging, and strong accountability. Non-malicious insiders also matter: a careless employee can leak data or misconfigure a system without intending harm.

### Marking Cues

- Mention legitimate access for insiders.
- Mention perimeter/initial-access barriers for outsiders.
- Include both malicious and non-malicious insiders for a stronger answer.

**Covered in:** [[01 Foundations and Security Principles/01 Foundations and Security Principles|Human Factors, Insider Threats, and Ethical Security Practice]]

## Drill 5 — Formal Policy to Threat Model

**Question.** A university grading system has this policy: "Only lecturers assigned to a course may modify final grades; students may read only their own grades." Explain how this policy guides threat modeling and give two threats.

### Model Answer

The policy defines the secure states of the system. Threat modeling asks how an attacker might move the system into a non-secure state by violating one of the policy clauses. In this case, one threat is **elevation of privilege**: a student calls an unprotected grade-update endpoint and modifies their own grade, violating authorization and integrity. Another threat is **information disclosure**: a student changes an ID parameter in a URL and reads another student's grade, violating confidentiality. The policy tells the analyst what must be protected, which actors should be allowed, and what tests the controls must pass.

**Covered in:** [[01 Foundations and Security Principles/01 Foundations and Security Principles|Security Goals, Policy, Adversaries, and Risk]], [[01 Foundations and Security Principles/01 Foundations and Security Principles|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]

## Related

- [[01 Foundations and Security Principles/01 Foundations and Security Principles|Course Structure, Assessment, and Exam Rules]]
- [[07 Exam Skills/07 Exam Skills|Tutorial and Exam Problem Patterns]]
- [[07 Exam Skills/07 Exam Skills|Part B and C Essay Templates and Model Answers]]
