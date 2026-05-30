---
tags:
  - university
  - bcs2420
  - computer-security
---

# Protocols for Secure Communication: Nonces, Replay, Reflection, and Relay

> [!abstract] Why this note matters
> - Lecture 4 and Tutorial 4 center on these protocol attacks and defenses.
> - This is one of the most exam-likely reasoning areas because it mixes definitions with attack logic.

## Overview

Secure communication protocols are not only about confidentiality. They must also show freshness, resist message reuse, and often bind identity to session establishment.

The course repeatedly emphasizes that old valid messages may still be dangerous if the protocol cannot distinguish fresh runs from stale ones.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **nonce**: A random value used once to guarantee freshness.
- **timestamp**: A time value used to show that a message is recent.
- **sequence number**: An ordered counter used to detect duplicates or reordering.
- **Time-Variant Parameters (TVPs)**: Lecture 4's umbrella term for the family of freshness defenses (nonces + timestamps + sequence numbers). Any value that changes from run to run and can be bound into a protected message qualifies.
- **replay attack**: Reusing a previously captured message in a later protocol run.
- **reflection attack**: Replaying a captured message back to the originating party, exploiting symmetric mutual-authentication structures.
- **relay attack**: Forwarding messages in real time between distinct protocol runs, impersonating proximity or identity.
- **interleaving attack**: Weaving together messages from distinct *concurrent* protocol runs so that responses from one run satisfy challenges in another.
- **forward search attack**: Pre-computing candidate responses by feeding guesses into the protocol's one-way function and seeking output matches against captured traffic.
- **pre-capture attack**: Extracting one-time passwords (OTPs) or other one-shot credentials from a client by social engineering, before the legitimate use, then replaying them later.

## Detailed Explanation

Replay attacks work because many protocols would accept a valid-looking message again if they have no freshness check. If an attacker records one successful login response or challenge response and sends it later, the system may accept it unless it checks that the message belongs to the current session.

**Time-Variant Parameters (TVPs)** — the lecture's umbrella term covering nonces, timestamps, and sequence numbers — solve this by binding a response to the present run. A challenge-response message that includes the server's nonce proves not only knowledge of a secret but also that the response was constructed for this challenge. Each TVP defends against a slightly different threat model: nonces give random freshness, timestamps give absolute freshness (at the cost of clock synchronisation), sequence numbers give ordered freshness (cheap but stateful). Tutorial 4 Part A Q2 tests the ability to map these defenses against each attack type.

Reflection attacks occur when the adversary exploits symmetric protocol structure, sending a challenge or response back toward the originator to obtain a useful answer. Relay attacks are different: the attacker is a live messenger in the middle, passing protocol messages between genuine endpoints while impersonating one side.

### Three further attack types from Lecture 4

Beyond the classic replay/reflection/relay trio, Lecture 4 explicitly names three more attack patterns:

- **Interleaving**: The attacker runs two (or more) protocol instances *in parallel* against the same victim, using the responses obtained in one run as inputs to challenges in the other. Where reflection bounces messages within a single run, interleaving weaves together messages from distinct concurrent runs. Defenses include binding session identifiers or role tags into every protected message so that a response built for run X cannot satisfy a challenge in run Y.

- **Forward search**: Conceptually similar to a dictionary attack, but framed as a *precomputation* attack against a known one-way function. The attacker enumerates plausible inputs (passwords, OTP seeds), feeds them through the hash or KDF, and stores the outputs. When real traffic is later captured, it is matched against the precomputed table. Defenses are exactly the standard offline-attack defenses: salts, slow hashes, large input spaces.

- **Pre-capture**: A social-engineering attack specifically against one-time-password systems. The attacker tricks the user into reading or typing an OTP *before* the user actually needs it (for example, by impersonating support staff and asking the user to "test" their authenticator). The captured OTP is then replayed by the attacker into the real authentication flow within the OTP's validity window. Because OTPs are valid exactly once and only briefly, the defense is operational rather than cryptographic: train users not to disclose OTPs, never use them outside the legitimate login flow, and shorten validity windows.

These distinctions matter because the defenses differ. Freshness checks (TVPs) stop replay and basic interleaving. Asymmetric protocol structure or explicit role binding helps with reflection and richer interleaving. Proximity and man-in-the-middle-resistant designs help with relay. Salts and slow hashing help with forward search. User training and short validity windows help with pre-capture.

## How It Works

No freshness mechanism -> old valid message may still be accepted.

Nonce-based design -> response must include the fresh challenge in a protected way.

Reflection -> attacker reuses a party's own behavior against it.

Relay -> attacker forwards messages in real time without necessarily understanding them.

## What You Must Know

- The roles of nonces, timestamps, and sequence numbers, all subsumed under the term **Time-Variant Parameters (TVPs)**.
- The difference between replay, reflection, relay, interleaving, forward search, and pre-capture attacks.
- Why sending a simple hash of a secret can still be replayed.
- That TVPs are the lecture's umbrella defense term against freshness-related attacks (tested in Tutorial 4 Part A Q2).

## 30-Second Oral Answer

- Freshness is essential in authentication protocols because a valid old message may still authenticate if the protocol cannot tell it is stale.
- Replay reuses old traffic, reflection abuses symmetric challenge structure, and relay forwards live traffic between legitimate endpoints.

## Typical Exam Questions

- How does a nonce help prevent replay?
- What is the difference between a reflection attack and a relay attack?
- Why is a simple `H(K)` proof insecure if reused across sessions?

## Common Pitfalls

- Using 'replay' for every protocol attack involving repeated messages.
- Forgetting that timestamps require reasonably synchronized clocks and freshness checking logic.
## Related Concepts

- [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]]
- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 04 — Authentication and Key Establishment.pdf](../Materials/01 Lectures/Lecture 04 — Authentication and Key Establishment.pdf)
- [Tutorial 4.pdf](../Materials/02 Tutorials/Tutorial 4.pdf)
- [Tutorial 4 Solution.pdf](../Materials/02 Tutorials/Tutorial 4 Solution.pdf)
