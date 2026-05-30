---
tags:
  - university
  - bcs2420
  - computer-security
---

# Security Goals Beyond CIA — Authorization, Authentication, Accountability

> [!abstract] Why this note matters
> - Lecture 1 lists six foundational security goals, not three. The CIA triad is only half the picture; Authorization, Authentication, and Accountability complete it.
> - Past exam (2025-03-21) Q3 tested an adversary-modeling attribute by definition; the same style of "match the definition to the named concept" question recurs for the security goals.
> - Distinguishing entity authentication from data-origin authentication is a recurring source of confusion that the lecture explicitly disambiguates.

## Overview

The CIA triad (confidentiality, integrity, availability) is the classical starting point, but Lecture 1 places it inside a wider set of six foundational security goals. The other three — Authorization, Authentication, Accountability — are what tie security back to identities, permissions, and evidence after the fact.

In the Lecture 1 diagram, access control sits in the middle: it depends on authentication (who is the principal?) and policy (what are they allowed to do?), and it is the mechanism that enforces confidentiality, integrity, and authorization. Accountability sits to the side and is supported by digital evidence such as logs.

> [!info] Non-repudiation is *not* one of the six foundational goals
> Non-repudiation is a useful security property (and STRIDE's "Repudiation" threat maps to it), but Lecture 1's list of foundational goals is CIA plus Authorization, Authentication, and Accountability. Do not list non-repudiation as a foundational goal in an exam answer — list Accountability instead, since the lecture defines accountability as the property that supports holding principals responsible.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **authorization**: Computing resources accessible only by authorized entities.
- **authentication**: Assurance that a principal, data, or software is genuine.
- **entity authentication**: Verifies the identity of users (or processes acting on their behalf).
- **data-origin authentication**: Verifies the source of data (which principal produced this message?).
- **accountability**: Ability to identify principals responsible for actions.
- **principal**: An identified entity (user, process, device) to which actions can be attributed.

## Detailed Explanation

### Authorization

Authorization is the property that computing resources — physical devices, software services, information — are accessible only by authorized entities. It is enforced by **access control mechanisms**, which restrict access according to a policy.

Authorization is distinct from authentication. Authentication answers *who are you?*; authorization answers *what are you allowed to do?* In the Lecture 1 diagram, access control depends on both: it consumes an authenticated identity together with a policy, and decides whether the operation is permitted.

### Authentication: Entity vs Data-Origin

Lecture 1 splits authentication into two types because they answer different questions:

- **Entity Authentication** verifies the **identity of users** (or of a principal acting on a user's behalf). Example: a login asking you to prove who you are before granting a session.
- **Data-Origin Authentication** verifies the **source of data**. Example: a digital signature on an email that lets the receiver verify which principal produced it, independently of when or how it was delivered.

Both rely on a secret or a verifiable uniqueness property tied to an asserted identity. Entity authentication is about *who is at the other end right now*; data-origin authentication is about *who produced this artifact*.

### Accountability

Accountability is the ability to identify the principals responsible for actions taken in the system. It is what makes after-the-fact investigation possible: when something goes wrong, accountability lets you answer "who did this?"

The lecture lists the supporting method as **transaction evidence and logs** — electronic means to record actions and identify principals. Logs only give accountability if (i) the recorded identifier maps back to a real principal (depends on authentication) and (ii) the log itself is protected from tampering (depends on integrity).

## How It Works

Authentication establishes who a principal is. Authorization, given that identity plus a policy, decides what they may do. Access control enforces that decision against confidentiality, integrity, and authorization properties. Accountability layers on top: every consequential action is logged with the authenticated principal, so responsibility can be assigned afterward.

The six goals are interdependent, not independent. Authorization without authentication is meaningless (you cannot enforce "only X may do Y" if you cannot tell who X is). Accountability without integrity is fragile (logs that can be silently edited prove nothing). Confidentiality without authorization collapses to whoever can read the bits.

## What You Must Know

- The six foundational security goals: Confidentiality, Integrity, Availability, Authorization, Authentication, Accountability.
- The Authorization definition: computing resources accessible only by authorized entities.
- The two types of authentication and what each verifies: entity (identity of users) vs data-origin (source of data).
- The Accountability definition: ability to identify principals responsible for actions, supported by transaction evidence and logs.
- That non-repudiation is a property, not one of the six foundational goals in this course.

## 30-Second Oral Answer

- The CIA triad is the starting set; Authorization, Authentication, and Accountability complete the six foundational goals.
- Authorization restricts resources to authorized entities; authentication splits into entity (identity) and data-origin (source) flavors; accountability uses transaction evidence and logs to identify the principals responsible for actions.
- These goals are interdependent: authorization needs authentication, accountability needs integrity, and access control is the central enforcement mechanism that ties them together.

## Typical Exam Questions

- What does it mean for a system to provide *authorization*?
- Distinguish entity authentication from data-origin authentication with one example each.
- Define accountability and name one mechanism that supports it.
- Is non-repudiation one of the foundational security goals in this course? Justify.

## Common Pitfalls

- Listing only the CIA triad when asked for the foundational goals of security.
- Conflating authentication and authorization — they answer different questions.
- Treating "authentication" as a single concept and missing the entity vs data-origin split.
- Listing non-repudiation as one of the six foundational goals (it is a property; the foundational goal is Accountability).
- Claiming logs alone provide accountability, ignoring that they depend on authentication and integrity of the log store.

## Concrete Examples and Commands

### Login with logged operations

```text
Step 1 (entity authentication):
  User submits username + password / token.
  System verifies credentials → principal P established.

Step 2 (authorization):
  Policy: "only role=admin may delete records."
  Access control consults policy and P's role → permit or deny.

Step 3 (accountability):
  System writes log entry: [timestamp] P deleted record R via op O.
  Log is append-only and integrity-protected so a later auditor
  can identify the responsible principal.
```

### Data-origin authentication

```text
Sender P signs message M with private key:
  sig = Sign_P(M)

Receiver verifies with P's public key:
  Verify_P(M, sig) → true means M originated from P.

Note: this is data-origin authentication, not entity authentication.
It tells you "who produced this message" — not "who is talking to
me on this channel right now."
```

## Related Concepts

- [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]
- [[Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]
- [[Defense in Depth, Security Strategy, and Security Posture|Defense in Depth, Security Strategy, and Security Posture]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 01 — Introduction and Security Fundamentals.pdf](../Materials/01 Lectures/Lecture 01 — Introduction and Security Fundamentals.pdf)
- [Tutorial 1.pdf](../Materials/02 Tutorials/Tutorial 1.pdf)
