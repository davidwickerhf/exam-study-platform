---
tags:
  - university
  - bcs2420
  - computer-security
---

# Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI

> [!abstract] Why this note matters
> - The syllabus explicitly requires symmetric and asymmetric cryptography and PKI.
> - Tutorial 2 asks about the comparative advantage of public-key encryption and hybrid encryption.

## Overview

Symmetric encryption is usually efficient for bulk data, but key distribution is difficult because both parties need the shared secret securely in advance. Asymmetric encryption makes key distribution easier, but it is usually more computationally expensive for large data.

Hybrid encryption combines the strengths of both. This is the practical pattern the course wants you to understand: use public-key techniques to protect a fresh symmetric session key, then use the symmetric key for the actual data.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **symmetric encryption**: A setting where the **same shared secret key is used for both encryption AND decryption** (Lecture 2 slide 12 — the exact framing the past exam tested).
- **asymmetric encryption**: A setting using a public key and a private key with different roles — the public encryption key `e_B` encrypts, the private decryption key `d_B` decrypts.
- **hybrid encryption**: A system where a random symmetric key `k` encrypts the data and that symmetric key is then protected with the recipient's asymmetric public key `e_B`.
- **PKI**: Public Key Infrastructure; the collection of certificates, trust relationships, policies, and procedures used to bind public keys to identities.

## Detailed Explanation

Public-key cryptography solves a key-distribution problem, not every problem. It allows a sender to use a recipient's public key without already sharing a secret. That convenience is why tutorial questions identify secure key distribution as the major advantage of asymmetric schemes.

Hybrid encryption exists because asymmetric encryption is not usually the right tool for encrypting large volumes of application data directly. Instead, the sender generates a random symmetric key, encrypts the message with that key, and then protects the symmetric key with the recipient's public key.

PKI provides the trust layer that makes public keys meaningful in real systems. A public key is useful only if you can trust whose key it is. Certificates, issuers, validation, and trust anchors provide that binding.

The retained course corpus goes one step further and discusses certificates explicitly. That means PKI should be understood as an operational trust framework, not just as a vague idea that 'public keys have certificates attached'. The important point is that a relying party accepts a public key because it accepts the binding and the issuer chain behind that binding.

A certificate therefore packages identity information, a public key, and issuer-backed metadata such as serial number and validity period. In a real deployment, the public key becomes usable only after the relying party validates that certificate information against a trust base.

## How It Works

Symmetric: both sides need the **same shared secret key**; the same `k` performs encryption and decryption.

Asymmetric: the public key `e_B` can be shared openly while the private key `d_B` remains secret. Encryption is `c = E_{e_B}(m)`; decryption is `m = D_{d_B}(c)`.

### Hybrid encryption (Lecture 2 slide 23)

The hybrid encryption process is the enumerated three-step pattern the slide tests:

1. **Generate a fresh random symmetric key `k`.**
2. **Encrypt the message `m` with `k`** using a symmetric cipher (e.g. AES): `c = E_k(m)`.
3. **Encrypt the symmetric key `k` with the recipient's public key `e_B`**: `E_{e_B}(k)`.

The sender transmits both pieces: the symmetric-encrypted payload `E_k(m)` and the asymmetric-encrypted key `E_{e_B}(k)`. The recipient decrypts `k` with their private key `d_B`, then uses `k` to decrypt the payload. This combines the efficiency of symmetric encryption for bulk data with the convenience of public-key encryption for key distribution. See [[RSA, Modular Exponentiation, and Why Asymmetric is Slow|the RSA note]] for why the asymmetric step has to be reserved for the key, not the payload.

### PKI

PKI uses certificates and trust chains to decide whether a public key belongs to the claimed entity. Certificate-based trust means the verifier must validate not only the key itself, but also the certificate chain and whether the binding is still trustworthy in context. The structural detail — the nine X.509 fields, the CA's pre-issuance checks, and the impersonation-resistance argument — is in the dedicated note: [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]].

## What You Must Know

- Why asymmetric encryption simplifies key distribution.
- Why hybrid encryption is a practical real-world design.
- What PKI is for at a high level.

## 30-Second Oral Answer

- Symmetric encryption is fast but hard to distribute securely; asymmetric encryption improves key distribution but is expensive for bulk data.
- Hybrid encryption uses both: public-key protection for a fresh symmetric session key, then symmetric encryption for the message.
- PKI makes public keys trustworthy by binding them to identities through certificates and trust structure.

## Typical Exam Questions

- What is the main advantage of public-key cryptography over symmetric cryptography?
- How does hybrid encryption work?
- What role does PKI play in secure systems?

## Common Pitfalls

- Claiming asymmetric cryptography removes the need for private keys.
- Forgetting that PKI is about trust and identity binding, not only about key generation.
## Related Concepts

- [[Hash Functions, Collision Resistance, and Digital Signatures|Hash Functions, Collision Resistance, and Digital Signatures]]
- [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]]
- [[RSA, Modular Exponentiation, and Why Asymmetric is Slow|RSA, Modular Exponentiation, and Why Asymmetric is Slow]]
- [[Message Authentication Codes (MACs)|Message Authentication Codes (MACs)]]
- [[Stream Ciphers vs Block Ciphers — Formal Definitions|Stream Ciphers vs Block Ciphers — Formal Definitions]]
- [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- Lecture 2 — Cryptography Basics, slides 12, 19-23: [Lecture 02 — Cryptography Basics.pdf](../Materials/01%20Lectures/Lecture%2002%20%E2%80%94%20Cryptography%20Basics.pdf)
- [Tutorial 2.pdf](../Materials/02%20Tutorials/Tutorial%202.pdf)
- [Tutorial 2 Solution.pdf](../Materials/02%20Tutorials/Tutorial%202%20Solution.pdf)
