---
tags:
  - university
  - bcs2420
  - computer-security
---

# Differential and Linear Cryptanalysis

> [!abstract] Why this note matters
> - Tutorial 2 Part B Q4 asks directly about advanced cryptanalytic methods and how a well-designed cipher resists them.
> - The concepts of confusion and diffusion are the standard answer to why AES-like ciphers survive these attacks.

## Overview

Differential and linear cryptanalysis are the two most important classical attacks on block ciphers. They are not brute-force; they exploit mathematical structure in how the cipher maps inputs to outputs. A well-designed cipher must specifically resist both.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **differential cryptanalysis**: An attack that analyzes how specific differences in plaintext input lead to differences in ciphertext output, exploiting predictable propagation of XOR differences through rounds.
- **linear cryptanalysis**: An attack that exploits statistical linear approximations between bits of the plaintext, key, and ciphertext.
- **confusion**: The property that the relationship between key bits and ciphertext bits is as complex as possible; achieved via substitution (S-boxes).
- **diffusion**: The property that each plaintext bit influences many ciphertext bits, spreading structure across the output; achieved via permutation layers.
- **S-box**: A substitution component in a block cipher designed to introduce non-linearity, resisting linear approximations.

## Detailed Explanation

### Differential Cryptanalysis

Introduced by Biham and Shamir in the early 1990s. The idea: instead of attacking the cipher directly, study how a chosen difference ΔP between two plaintexts propagates through the cipher's rounds to produce a ciphertext difference ΔC.

If a cipher's round functions are predictable in how they handle XOR differences, the attacker can:
1. Choose many pairs of plaintexts with the same difference ΔP.
2. Observe the corresponding ciphertext pairs.
3. Statistically recover information about the last round key.

**How a well-designed cipher resists it:**
- Strong non-linear S-boxes with low differential uniformity (the maximum probability that a given input difference leads to a given output difference is minimized).
- Sufficient number of rounds to make differential characteristics exponentially unlikely over the full cipher.

### Linear Cryptanalysis

Introduced by Matsui in 1993. The idea: find a linear equation over GF(2) (XOR) that approximately holds between some plaintext bits, key bits, and ciphertext bits with a probability significantly different from 0.5.

If such a bias exists, the attacker can:
1. Gather enough plaintext/ciphertext pairs.
2. Use the statistical bias to guess key bits.
3. With enough data, recover portions of the key.

**How a well-designed cipher resists it:**
- S-boxes designed with high non-linearity so no linear approximation has a significant bias.
- Diffusion layers (MixColumns in AES) spread linear biases so they cancel out over multiple rounds.

### Confusion and Diffusion as Defenses

Shannon's two principles for secure cipher design:

- **Confusion** makes the relationship between the key and ciphertext as complex and non-linear as possible. Without confusion, linear approximations are strong.
- **Diffusion** ensures each bit of the plaintext and key affects many bits of the ciphertext. Without diffusion, differential characteristics affect only small parts of the state and are easier to track.

Modern block ciphers (AES, 3DES) combine substitution-permutation networks (SPNs) to achieve both simultaneously.

## How It Works

Differential → exploit predictable input-difference to output-difference propagation → needs low-differential S-boxes + enough rounds to block.

Linear → exploit statistical bias in linear equations over cipher bits → needs high-nonlinearity S-boxes + diffusion to cancel biases.

Confusion → complex key↔ciphertext relationship via substitution (S-boxes).

Diffusion → each input bit affects many output bits via permutations/mixing layers.

## What You Must Know

- What differential cryptanalysis exploits (difference propagation).
- What linear cryptanalysis exploits (statistical linear biases).
- How confusion counters linear cryptanalysis.
- How diffusion counters differential cryptanalysis.
- That a well-designed cipher (e.g., AES) is resistant to both because its S-boxes have low differential uniformity and high non-linearity.

## 30-Second Oral Answer

- Differential cryptanalysis studies how input differences propagate through the cipher; linear cryptanalysis exploits statistical biases in linear bit relationships.
- Confusion (non-linear S-boxes) counters linear attacks; diffusion (mixing layers) counters differential attacks.
- AES was specifically designed to resist both, with a provable security margin for a sufficient number of rounds.

## Typical Exam Questions

- What does differential cryptanalysis attack and how does a well-designed cipher resist it?
- What is the role of confusion and diffusion in a secure block cipher?
- Why are non-linear S-boxes critical in block cipher design?

## Common Pitfalls

- Confusing differential (difference propagation) with linear (statistical bias) — they are separate techniques.
- Thinking confusion = diffusion — they are complementary and distinct properties.
- Forgetting that these attacks are only practical when the number of rounds is insufficient or S-boxes are poorly designed.

## Related Concepts

- [[Attack Models and Adversary Capabilities|Attack Models and Adversary Capabilities]]
- [[Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes|Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes]]
- [[Encryption, Decryption, Key Space, and Exhaustive Search|Encryption, Decryption, Key Space, and Exhaustive Search]]

## Sources

- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial 2.pdf](100 Extra Materials/Tutorial 2.pdf)
- [Tutorial 2 Solution.pdf](100 Extra Materials/Tutorial 2 Solution.pdf)
- [Lecture 2.pdf](100 Extra Materials/Lecture 2.pdf)
