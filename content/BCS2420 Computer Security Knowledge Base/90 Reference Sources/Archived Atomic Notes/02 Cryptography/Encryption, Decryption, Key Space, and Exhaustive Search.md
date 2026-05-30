---
tags:
  - university
  - bcs2420
  - computer-security
---

# Encryption, Decryption, Key Space, and Exhaustive Search

> [!abstract] Why this note matters
> - Lecture 2 and Tutorial 2 make this the base model for the rest of the cryptography material.
> - Lab 1 is built around weak transformations, readable ciphertext reasoning, and brute-force feasibility.

## Overview

Lecture 2 treats cryptography as foundational infrastructure for security. The basic model is simple: encryption converts plaintext to ciphertext, and decryption recovers plaintext using the appropriate key.

What makes that model useful or useless is not the existence of a transformation but the size and structure of the key space and the difficulty of reversing the transformation without the key.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **plaintext**: The original message before encryption.
- **ciphertext**: The transformed, unintelligible output produced by encryption.
- **encryption key**: The secret or public parameter used to convert plaintext into ciphertext.
- **decryption key**: The parameter used to recover plaintext from ciphertext.
- **key space**: The total set of possible keys for a cryptographic system.
- **exhaustive key search**: Trying every key until the correct one is found.

## Detailed Explanation

A cipher does not become secure merely because it changes the appearance of the text. Encodings and simple transformations may be reversible without any real secrecy. Lab 1 is designed to force that distinction: some outputs look transformed, but only some actually behave like cryptography.

Key space matters because brute force is always the fallback attack. If the set of possible keys is tiny, then trying all keys is feasible. If it is enormous, brute force becomes impractical. This is why lecture material contrasts Caesar-style substitution with modern key sizes.

But key length is not the entire story. The algorithm must also resist smarter attacks than brute force. Still, the first sanity check is always: if I had to try all keys, is the search space obviously too small?

## How It Works

Encryption is a function from plaintext and key to ciphertext; decryption reverses it with the matching key or matching key pair.

A good cryptosystem should make plaintext recovery infeasible without the correct key.

Exhaustive key search typically succeeds after about half the key space on average, because the right key is equally likely to be anywhere in the set.

## What You Must Know

- Plaintext, ciphertext, encryption key, and decryption key.
- What key space means and why larger key spaces resist brute-force attacks.
- Why not every transformation counts as real cryptography.

## 30-Second Oral Answer

- Encryption aims to protect confidentiality by turning plaintext into ciphertext under a key.
- The first security sanity check is whether brute-force search over the key space is feasible.
- A transformation is not secure just because it looks scrambled; it must resist recovery without the key.

## Typical Exam Questions

- What is key space?
- Why does key length matter for brute-force resistance?
- Why are simple encodings or weak substitutions not enough for confidentiality?

## Common Pitfalls

- Confusing encoding with encryption.
- Talking about key length without linking it to search feasibility.

## Concrete Examples and Commands

### Lecture-level notation

```text
c = E_k(m)
m = D_k'(c)
```

The exact notation depends on whether the scheme is symmetric or asymmetric, but the course uses this form to separate message, ciphertext, and key roles.

### Lab 1 attacker viewpoint

```text
Question: is this line encrypted, or only encoded/transformed?
Check:
1. Is there any real secret key involved?
2. Is the key space tiny enough to brute-force?
3. Is the transformation obviously reversible without cryptanalysis?
```

## Worked Examples

### Why a small key space fails

If a cipher has only 26 keys, as in a Caesar-style alphabetic shift, an attacker can simply try every shift and inspect the outputs.

That is not because the algorithm is badly implemented. It is because the key space is so small that exhaustive search is trivial.

## Related Concepts

- [[Attack Models and Adversary Capabilities|Attack Models and Adversary Capabilities]]
- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 2.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 2.pdf)
- [Tutorial 2.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2.pdf)
- [Tutorial 2 Solution.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial 2 Solution.pdf)
- [lab1.pdf](/Users/davidwickerhf/Downloads/Computer Security/lab1.pdf)
