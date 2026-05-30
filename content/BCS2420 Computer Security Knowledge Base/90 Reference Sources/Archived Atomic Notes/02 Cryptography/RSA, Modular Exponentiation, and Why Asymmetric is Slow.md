---
tags:
  - university
  - bcs2420
  - computer-security
---

# RSA, Modular Exponentiation, and Why Asymmetric is Slow

> [!abstract] Why this note matters
> - Tutorial 2 Q4 uses 'modular exponentiation with prime numbers' as a distinguishing distractor for the Vernam cipher — you need to recognise this phrase as describing RSA, not stream ciphers.
> - The exam tests *why* asymmetric encryption is slow, which is the motivation for hybrid encryption in the first place.
> - You will not be asked to derive RSA. You will be asked to recognise it and to explain its cost.

## Overview

RSA is the canonical public-key (asymmetric) encryption scheme. The course does not test the full derivation; it tests recognition. You should be able to look at a description and say 'that is RSA' when it mentions a key pair generated from two large primes, encryption as `c = m^e mod n`, and decryption as `m = c^d mod n`. You should also be able to explain why operations of that shape are slow compared to symmetric ciphers like AES, which is what motivates hybrid encryption.

## Exam Focus

- Tier 1 priority for conceptual recognition; the exam does not ask for the mathematical proof.
- Written to align with Lecture 2 (public-key encryption slides 26-28, hybrid encryption slide 23) and Tutorial 2 Q4 and Part C Q6.

## Core Definitions

- **RSA**: A public-key encryption scheme whose security rests on the difficulty of factoring large integers.
- **Modulus `n`**: Product of two large secret primes, `n = pq`.
- **Public exponent `e`**: Public key value used for encryption.
- **Private exponent `d`**: Private key value used for decryption; chosen so that exponentiating by `d` undoes exponentiating by `e` modulo `n`.
- **Modular exponentiation**: The operation `a^b mod n` — the core RSA primitive.
- **Integer factorization problem**: Given `n = pq`, recover `p` and `q`. Believed to be hard for large `n`, which is the security assumption RSA depends on.

## Detailed Explanation

RSA's key pair is built from two large secret primes `p` and `q`. The public modulus is `n = pq`. The public encryption key is the pair `(n, e)`; the private decryption key is `(n, d)`. Encryption is `c = m^e mod n` and decryption is `m = c^d mod n`. The two exponents are mathematically linked so that they cancel out modulo `n`.

Security depends on the fact that recovering `d` from the public information requires factoring `n`, which is believed to be computationally infeasible for large primes. If an attacker could factor `n`, they could recompute `d` and decrypt anything.

The cost story is what the exam actually leans on. Modular exponentiation on numbers thousands of bits wide is enormously more expensive than the bit-level operations a block cipher like AES performs on 128-bit blocks. AES finishes a block in nanoseconds; an RSA operation can take milliseconds — a gap of several orders of magnitude. Tutorial 2 Part C Q6 makes this concrete: 10,000 messages at 5ms per RSA operation is 50 seconds of pure crypto, while AES would dispatch the same volume in a small fraction of a second.

This cost gap is exactly the reason the course teaches hybrid encryption. You do not use RSA to encrypt the payload. You use RSA once to protect a fresh symmetric key, and then you use the symmetric cipher for everything else. The asymmetric primitive solves the key-distribution problem; the symmetric primitive does the bulk work.

## How It Works

### Key generation (high level)

1. Pick two large secret primes `p` and `q`.
2. Compute the modulus `n = pq`.
3. Choose a public exponent `e`.
4. Derive the private exponent `d` such that exponentiation by `d` inverts exponentiation by `e` modulo `n`.
5. Publish `(n, e)`; keep `d` (and `p`, `q`) secret.

### Encryption and decryption

- Encrypt: `c = m^e mod n` using the recipient's public key `(n, e)`.
- Decrypt: `m = c^d mod n` using the private key `(n, d)`.

### Why it is slow

- Each operation is a modular exponentiation on numbers as wide as the modulus (typically 2048 or 4096 bits today).
- Even with efficient algorithms (square-and-multiply, CRT), the per-operation cost is orders of magnitude greater than a symmetric block cipher operation.
- Symmetric ciphers like AES operate on small blocks (128 bits for AES) using bit-level primitives that hardware accelerates very well, while RSA's arithmetic is inherently big-integer.

### Why this motivates hybrid encryption

- Public-key crypto is convenient for key distribution: you can use the recipient's published key without prior contact.
- Public-key crypto is impractical for bulk data because of the per-operation cost.
- Hybrid encryption keeps the convenience and discards the cost: generate a fresh symmetric key `k`, encrypt the message `m` with `k`, and encrypt only `k` with the recipient's public key. See [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|the hybrid encryption note]] for the full enumeration.

## What You Must Know

- RSA is recognised by the phrases 'key pair', 'two large primes', and 'modular exponentiation' with `c = m^e mod n` / `m = c^d mod n`.
- Security comes from the hardness of factoring `n = pq`.
- RSA is much slower than symmetric ciphers, which is why hybrid encryption exists.
- The course will not ask you to compute RSA by hand; it will ask you to recognise it and explain its role.

## 30-Second Oral Answer

- RSA is a public-key scheme: the key pair is built from two large secret primes whose product `n` is published as part of the public key.
- Encryption and decryption are modular exponentiations, `c = m^e mod n` and `m = c^d mod n`; security rests on the difficulty of factoring `n`.
- These operations are expensive on large integers, so in practice RSA is used to encapsulate a fresh symmetric key in a hybrid scheme, not to encrypt bulk data directly.

## Typical Exam Questions

- Which of the following describes RSA? *(Distractor: 'modular exponentiation with prime numbers'.)*
- Why is public-key encryption typically slower than symmetric encryption?
- Why is hybrid encryption preferred over using RSA directly on large messages? *(Tutorial 2 Part C Q6.)*
- What problem must remain hard for RSA to remain secure?

## Common Pitfalls

- Mixing RSA up with the Vernam cipher because both involve 'keys' — Vernam is symmetric bit-XOR with a keystream; RSA is asymmetric modular exponentiation.
- Saying RSA is 'broken if you know `n`'. The modulus `n` is public; the secret is the factorisation of `n`.
- Claiming RSA is faster than AES. It is several orders of magnitude slower per operation.
- Calling hybrid encryption a 'weaker' form of encryption. It is the standard form; pure RSA encryption of large payloads is what is unusual.

## Concrete Examples

A TLS handshake is the canonical hybrid pattern. The client and server agree on a fresh symmetric session key using a public-key operation (RSA-style key transport, or Diffie-Hellman), then every byte of the actual HTTPS traffic is encrypted with a symmetric cipher like AES-GCM. The expensive asymmetric step happens once per session; the cheap symmetric step happens for every packet.

A counter-example: encrypting a 1 GB backup directly with RSA. At thousands of RSA blocks per second, this is impractically slow, and the ciphertext would be inflated to multiples of the modulus size. The right pattern is to generate a random AES key, encrypt the backup with AES, and encrypt only the AES key with RSA.

## Worked Examples

**Q.** Tutorial 2 Part C Q6: 10,000 messages, each encrypted with RSA at 5 ms per operation. How long does that take, and why does that motivate hybrid encryption?

**A.** `10,000 * 5 ms = 50,000 ms = 50 seconds` of pure crypto time. The same volume under AES would complete in well under a second. The cost ratio is exactly why hybrid encryption uses RSA only once (to protect the symmetric key) and then runs the bulk encryption with the symmetric cipher.

**Q.** Tutorial 2 Q4 lists 'It uses modular exponentiation with prime numbers' as one of the options about the Vernam cipher. Why is that option wrong, and what does it actually describe?

**A.** Vernam is a stream cipher: it XORs message bits with a keystream of equal length. Modular exponentiation with prime numbers is the operational signature of RSA, not Vernam. The exam uses the phrase deliberately to test whether you can tell the two apart.

## Related Concepts

- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
- [[Stream Ciphers vs Block Ciphers — Formal Definitions|Stream Ciphers vs Block Ciphers — Formal Definitions]]
- [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]]
- [[Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes|Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- Lecture 2 — Cryptography Basics (public-key and hybrid encryption sections): [Lecture 02 — Cryptography Basics.pdf](../Materials/01%20Lectures/Lecture%2002%20%E2%80%94%20Cryptography%20Basics.pdf)
- [Tutorial 2.pdf](../Materials/02%20Tutorials/Tutorial%202.pdf)
- [Tutorial 2 Solution.pdf](../Materials/02%20Tutorials/Tutorial%202%20Solution.pdf)
