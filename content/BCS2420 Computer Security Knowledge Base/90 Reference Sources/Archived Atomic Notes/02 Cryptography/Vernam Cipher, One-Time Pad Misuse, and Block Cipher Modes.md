---
tags:
  - university
  - bcs2420
  - computer-security
---

# Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes

> [!abstract] Why this note matters
> - Tutorial 2 and the retained course corpus explicitly cover the Vernam cipher, one-time pad conditions, and ECB/CBC/CTR/OFB.
> - Lab 1 already uses OTP misuse as a practical attack pattern, so these ideas need to exist as first-class notes.

## Overview

This topic is where the course stops talking about encryption only in generic terms. The same cipher can behave very differently depending on how it is composed or reused.

The Vernam / OTP material shows the strongest possible secrecy claim and the cleanest failure mode when the usage rules are broken. The mode-of-operation material shows that even with the same underlying block cipher, pattern leakage and engineering tradeoffs can differ sharply.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **Vernam cipher**: A XOR-based stream-cipher construction that becomes a one-time pad only when the key conditions are ideal.
- **one-time pad**: A perfectly secret scheme only if the key is truly random, at least as long as the message, and never reused.
- **ECB**: Electronic Codebook mode; encrypts each plaintext block independently.
- **CBC**: Cipher Block Chaining mode; XORs each plaintext block with the previous ciphertext block before encryption.
- **CTR**: Counter mode; generates keystream blocks by encrypting counter values.
- **OFB**: Output Feedback mode; generates keystream from repeated encryption of evolving state.

## Detailed Explanation

The Vernam cipher encrypts by XORing plaintext with a keystream. It becomes a one-time pad only if the keystream is truly random, long enough, and never reused. The course is careful about this because students often remember 'OTP is perfectly secret' and forget the very strict conditions that make that statement true.

Lab 1 demonstrates the consequence of violating those conditions. If the same pad is reused, then the relationship between ciphertexts leaks structure, and a known-plaintext attack can recover pad information and expose another message. That is why OTP misuse is not a small bug; it destroys the central security guarantee.

Block-cipher modes make the same broader point. ECB encrypts blocks independently, so repeated plaintext blocks remain repeated ciphertext blocks. CBC reduces that leakage by chaining blocks. CTR and OFB instead generate keystream-like values, which changes both the leakage properties and the implementation behavior.

The course does not require deep formal proofs of these modes. What it does require is high-level reasoning: what repeats, what chains, what behaves like a keystream, and what the practical implications are for confidentiality and implementation.

## How It Works

OTP/Vernam encryption is based on XOR between message data and a keystream or pad.

Reusing the same OTP pad across messages leaks relations between plaintexts.

ECB treats blocks independently, so repeated structure leaks.

CBC adds dependency by combining each block with previous ciphertext.

CTR and OFB turn the block cipher into a keystream-producing mechanism in different ways.

## What You Must Know

- Conditions required for OTP to be perfectly secure.
- Why OTP reuse breaks confidentiality.
- The main weakness of ECB.
- The high-level differences among CBC, CTR, and OFB.

## 30-Second Oral Answer

- OTP is perfectly secure only under strict one-time random-key conditions.
- ECB leaks repeated-block structure, while CBC, CTR, and OFB change how blocks or keystreams are combined.

## Typical Exam Questions

- What conditions are required for a one-time pad to be perfectly secure?
- Why does OTP reuse fail?
- Why is ECB weaker than CBC for structured data?
- Why is CTR often described as suitable for high-speed or parallel-friendly use?

## Common Pitfalls

- Calling any XOR-based scheme a one-time pad.
- Thinking ECB is safe for patterned data because the underlying block cipher is strong.
- Confusing CBC chaining with CTR counter generation.

## Concrete Examples and Commands

### OTP reuse relation

```text
c1 = m1 XOR k
c2 = m2 XOR k
c1 XOR c2 = m1 XOR m2
```

The key cancels when reused across two ciphertexts, exposing a relation between the plaintexts and enabling known-plaintext recovery.

### Mode comparison shorthand

```text
ECB: same plaintext block -> same ciphertext block
CBC: block mixed with previous ciphertext before encryption
CTR: encrypt counters to make a keystream
OFB: repeatedly encrypt evolving state to make a keystream
```

## Worked Examples

### Why the ECB image-pattern problem exists

If structured plaintext contains many repeated blocks, ECB can preserve visible repetition patterns because each block is encrypted in isolation.

That is why ECB's weakness is a structural leakage issue rather than a claim that the underlying block primitive is broken.

## Related Concepts

- [[Encryption, Decryption, Key Space, and Exhaustive Search|Encryption, Decryption, Key Space, and Exhaustive Search]]
- [[Attack Models and Adversary Capabilities|Attack Models and Adversary Capabilities]]
- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial 2.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2.pdf)
- [Tutorial 2 Solution.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2 Solution.pdf)
- [lab1.pdf](/Users/davidwickerhf/Downloads/Computer Security/lab1.pdf)
