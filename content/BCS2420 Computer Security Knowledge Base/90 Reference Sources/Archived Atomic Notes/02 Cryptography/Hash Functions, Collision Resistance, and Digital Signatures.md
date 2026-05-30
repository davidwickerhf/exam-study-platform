---
tags:
  - university
  - bcs2420
  - computer-security
---

# Hash Functions, Collision Resistance, and Digital Signatures

> [!abstract] Why this note matters
> - Tutorial 2 asks directly about one-wayness, collision resistance, and digital signatures.
> - Passwords, integrity, and signature reasoning all depend on distinguishing the hash properties correctly.

## Overview

Hash functions are not encryption. They are fixed transformations used for integrity, indexing, password verification, and signature construction. That means the security questions are different from secrecy questions.

The tutorial material highlights three properties that students often mix up: one-wayness, collision resistance, and second-preimage resistance. The course expects you to keep them separate.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **one-way property**: It should be computationally infeasible to recover the original input from the hash output.
- **collision resistance**: It should be computationally infeasible to find two distinct inputs with the same hash.
- **second-preimage resistance**: Given one input, it should be hard to find a different input with the same hash.
- **digital signature**: A cryptographic mechanism that provides integrity, origin authentication, and usually non-repudiation.

## Detailed Explanation

One-wayness is about inversion: given the digest, can you recover the input? Collision resistance is about finding any two different inputs with the same digest. Second-preimage resistance is narrower: given one specific input, can you find another that collides with it?

Digital signatures rely on hash functions because it is usually more efficient to sign a digest of the message than the full message, and because a secure digest binds the signature to message integrity. The signature then provides proof of origin and protection against tampering.

This distinction also matters for later authentication notes. Password hashes are not encrypted passwords waiting to be decrypted. They are digests that must be recomputed and compared, which is why salts, stretching, and secret peppers matter.

The exam value of this topic is precision. Students often say 'hashing proves integrity' without explaining why. A stronger answer says integrity checking works because any meaningful change to the message should change the digest, and a signature over that digest lets the verifier detect tampering and confirm who signed it.

## How It Works

If the question is 'can you recover the input from the hash?', think one-wayness.

If the question is 'can you find any two messages with the same digest?', think collision resistance.

If the question is 'can you forge a different message that matches this message's digest?', think second-preimage resistance.

If the question is about signatures, separate the hash role from the signing-key role: the hash compresses and binds the message, while the signing operation authenticates the digest.

## What You Must Know

- The difference between one-wayness, collision resistance, and second-preimage resistance.
- What digital signatures are intended to provide: integrity, origin authentication, and non-repudiation.
- That hash functions are not secrecy tools in the same sense as encryption.

## 30-Second Oral Answer

- Hash properties answer different questions: inversion, any collision, or targeted collision.
- Digital signatures use these properties to bind identity and integrity to a message.

## Typical Exam Questions

- What is collision resistance?
- What is the difference between one-wayness and second-preimage resistance?
- What do digital signatures provide?

## Common Pitfalls

- Using 'collision resistance' for every hash-security property.
- Calling signatures an encryption mechanism for confidentiality.
## Related Concepts

- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial 2.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2.pdf)
- [Tutorial 2 Solution.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2 Solution.pdf)
