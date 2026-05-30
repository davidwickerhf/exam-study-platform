---
tags:
  - university
  - bcs2420
  - computer-security
---

# OTPs, Tokens, Biometrics, and Derived Passwords

> [!abstract] Why this note matters
> - Tutorial 3 includes Lamport chains, hardware-token ideas, biometrics, peppers, and derived passwords.
> - These are classic compare-and-contrast topics for short-answer exam questions.

## Overview

Not every authentication system is a reusable password checked against a stored hash. The course also covers one-time passwords, hardware tokens, biometrics, and systems that derive site-specific credentials from a master secret.

These mechanisms solve different problems. One-time methods resist replay. Derived passwords reduce password reuse across sites. Biometrics trade usability against error rates and enrollment limits.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **Lamport hash chain**: A one-time password scheme based on repeatedly hashing a secret and verifying values in reverse order.
- **FAR**: False Accept Rate; how often an unauthorized biometric user is incorrectly accepted.
- **FTE**: Failure to Enroll; the rate at which legitimate users cannot be registered successfully.
- **derived password**: A site-specific password generated from a master password plus context such as a domain name.

## Detailed Explanation

Lamport hash chains show a core security idea: you can authenticate by revealing a value that is valid only once, while the server verifies it against a stored anchor or expected next value. That reduces replay risk compared with static secrets.

Hardware tokens that refresh codes over time are similar in spirit: the code is not a permanent password, but a value bound to time or a challenge. Tutorial 3 describes time-based code generators as implicit time-based challenge systems.

Derived-password systems try to stop password reuse without requiring the user to memorize and store a large number of unrelated passwords. They combine a master secret with site context to generate distinct passwords per domain.

Biometric systems introduce a different problem: matching is probabilistic. Tight thresholds reduce false accepts but increase false rejects. Failure to enroll shows that a system can be unusable for some legitimate users even before run-time matching begins.

## How It Works

Lamport chain verification works because hashing is one-way but easy in the forward direction.

A time-based token works because both sides know the time step and secret, so they can derive the same short-lived code.

Biometric systems must choose thresholds that balance FAR and FRR, and they can fail at the enrollment stage entirely.

## What You Must Know

- What Lamport chains, time-based tokens, and derived passwords are for.
- What FAR and FTE mean in biometric systems.
- Why threshold choice changes security/usability tradeoffs in biometrics.

## 30-Second Oral Answer

- OTPs reduce replay risk by making each accepted proof short-lived or one-time.
- Derived passwords reduce reuse by generating different passwords per site from one master secret.
- Biometrics are probabilistic systems with usability and error-rate tradeoffs.

## Typical Exam Questions

- What is the purpose of a Lamport hash chain?
- How does a time-based token work at a high level?
- How do threshold choices affect FAR and FRR?
- What problem do derived passwords try to solve?

## Common Pitfalls

- Treating biometrics as exact matching rather than threshold-based matching.
- Confusing FTE with FAR or FRR.
## Related Concepts

- [[Authentication, Identification, and Authorization|Authentication, Identification, and Authorization]]
- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial 3.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 3.pdf)
- [Tutorial 3 Solution.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 3 Solution.pdf)
