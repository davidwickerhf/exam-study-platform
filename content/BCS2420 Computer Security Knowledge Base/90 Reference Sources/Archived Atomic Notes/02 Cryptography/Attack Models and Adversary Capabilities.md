---
tags:
  - university
  - bcs2420
  - computer-security
---

# Attack Models and Adversary Capabilities

> [!abstract] Why this note matters
> - Tutorial 2 directly asks you to summarize the attack models and compare their strength.
> - The distinction between passive and active adversaries also reappears in later protocol notes.

## Overview

A cryptosystem is not judged against one generic attacker. It is judged against attacker models. The stronger the attacker model, the stronger the security claim has to be.

The course uses four classical attack models and the passive-vs-active distinction to reason about what a scheme must resist and what kinds of protocol defenses are necessary.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **ciphertext-only attack**: The attacker only sees ciphertexts.
- **known-plaintext attack**: The attacker knows some plaintext-ciphertext pairs.
- **chosen-plaintext attack**: The attacker can choose plaintexts and obtain their encryptions.
- **chosen-ciphertext attack**: The attacker can choose ciphertexts and obtain corresponding decryptions or oracle outputs.
- **passive adversary**: An attacker who observes but does not modify communication.
- **active adversary**: An attacker who injects, changes, blocks, or replays messages.

## Detailed Explanation

Ciphertext-only is the weakest attacker model because the adversary only sees encrypted outputs. Known-plaintext is stronger because it reveals how some messages map to ciphertext. Chosen-plaintext is stronger again because the attacker can deliberately probe the encryption function. Chosen-ciphertext is typically the strongest of these four because the attacker can actively query decryption behavior.

These are not just taxonomy items. They tell you how aggressively the scheme is being tested. A system secure only against passive observation may still fail badly once the attacker can manipulate or query it.

The passive-vs-active distinction becomes especially important for protocols. Encryption alone may block passive eavesdropping, but active attacks like replay, message injection, or man-in-the-middle require freshness checks, authentication, and sometimes explicit key confirmation.

In other words, attacker models are a way of stating assumptions. If you claim a design is secure, the next question is always 'secure against which adversary and with what powers?'. The course expects you to make those assumptions explicit rather than leaving them implicit.

## How It Works

When comparing models, think of each later model as giving the attacker more leverage or more oracle access than the previous one.

An active adversary is harder to defend against because the attacker can influence system state or communication flow, not merely observe it.

Protocol design must assume active attackers unless there is a very strong reason not to.

## What You Must Know

- Definitions of the four attack models.
- Why chosen-ciphertext is the strongest of the four classical models listed in the course.
- The difference between passive and active adversaries.

## 30-Second Oral Answer

- The attack model defines what power the attacker has.
- Chosen-ciphertext is strongest because the attacker can probe decryption behavior directly.
- Protocols must usually defend against active attackers, not just passive listeners.

## Typical Exam Questions

- Which attack model imposes the strongest requirement on a cryptosystem?
- Why are active adversaries harder to defend against than passive ones?
- How do the four attack models differ?

## Common Pitfalls

- Listing models without explaining the extra power each one adds.
- Assuming encryption solves active-manipulation attacks automatically.
## Related Concepts

- [[Protocols for Secure Communication Nonces, Replay, Reflection, and Relay|Protocols for Secure Communication: Nonces, Replay, Reflection, and Relay]]
- [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 2.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 2.pdf)
- [Tutorial 2.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2.pdf)
- [Tutorial 2 Solution.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2 Solution.pdf)
