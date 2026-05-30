---
tags:
  - university
  - bcs2420
  - computer-security
  - cram-sheet
---

# 02 Cryptography Cram Sheet

Morning-of-exam scan sheet. Dense facts, formulas, acronyms.

## Core Vocabulary

- **Plaintext (m)** — original message.
- **Ciphertext (c)** — encrypted output.
- **Encryption key / decryption key** — symmetric (same) or asymmetric (pair).
- **Key space** — total set of possible keys.
- **Exhaustive key search** — brute force; on average succeeds after ~half the key space.

```text
Symmetric:  c = E_k(m)     m = D_k(c)
Asymmetric: c = E_{e_B}(m) m = D_{d_B}(c)
```

## Key Space Sizing

- For an **n-bit binary key**: key space = `2^n`.
- DES key = 56 bits → `2^56` keys.
- AES-128 → `2^128`. AES-256 → `2^256`.
- Caesar shift = 26 keys (trivially brute-forceable).
- Encoding ≠ encryption — encoding has no secret key.

## Attack Models (weakest → strongest)

1. **Ciphertext-only (COA)** — attacker only sees ciphertexts.
2. **Known-plaintext (KPA)** — attacker knows some (m, c) pairs.
3. **Chosen-plaintext (CPA)** — attacker picks m, gets c.
4. **Chosen-ciphertext (CCA)** — attacker picks c, gets decryption / oracle output. **Strongest** of the four.

## Passive vs Active Adversary

| | Passive | Active |
|---|---|---|
| Behavior | Observe only | Inject, modify, replay, block |
| Defended by | Encryption alone | Encryption + freshness + auth |
| Examples | Eavesdropping | MITM, replay, message injection |

- Protocols must assume **active** adversaries unless there is a strong reason not to.

## Symmetric vs Asymmetric

| Property | Symmetric | Asymmetric |
|---|---|---|
| Keys | Same shared secret key `k` used for E AND D | Key pair: public `e_B` encrypts, private `d_B` decrypts |
| Speed | Fast (AES = ns/block) | Slow (RSA = ms/op, ~1000× slower) |
| Key distribution | **Hard** — pre-shared secret needed | **Easy** — publish public key |
| Use | Bulk data | Key transport, signatures |
| Examples | AES, DES, Vernam | RSA, DH, ECC |

- **Past-exam framing**: "**pre-shared secret**" = symmetric. Public/private pair = asymmetric.
- Asymmetric's main advantage = **simplified key distribution**.

## Stream vs Block Ciphers

| | Stream cipher | Block cipher |
|---|---|---|
| Processes | **One bit (or character) at a time** | Fixed-length blocks of `n` bits |
| Combines plaintext with | Keystream `k_1 k_2 k_3 ...` | Keyed transform `c_i = E_k(m_i)` |
| Padding | None | Required for short final block |
| Example | Vernam (OTP) | DES, AES |

- **Past-exam verbatim definition (Lec 2 slide 15)**: stream cipher "encrypts plaintext one bit or one character at a time".

## DES vs AES Cheat Card

| | DES | AES (Rijndael) |
|---|---|---|
| Blocklength | 64 bits | **128 bits** (fixed) |
| Keylength | **56 bits** | **128 / 192 / 256 bits** |
| Status | Deprecated (`2^56` brute-forceable) | Current standard |
| Origin | IBM / NIST 1977 | Rijndael, KU Leuven |

- Header `AES-256-CBC` → AES blocklength 128, 256-bit key, CBC mode.

## Vernam / One-Time Pad

- Vernam: `c_i = m_i XOR k_i`.
- OTP = perfect secrecy **iff**:
  1. Key truly random.
  2. Key ≥ length of message.
  3. Key used **exactly once**.
- **OTP reuse failure** (lab pattern):
  ```text
  c1 = m1 XOR k
  c2 = m2 XOR k
  c1 XOR c2 = m1 XOR m2   <-- pad cancels, plaintexts leak
  ```

## Confusion vs Diffusion (Shannon)

- **Confusion** — relation between key and ciphertext is complex (substitution).
- **Diffusion** — changing 1 bit of plaintext should change many bits of ciphertext (permutation/spreading).

## Block Cipher Modes

| Mode | Behavior | Strength | Weakness |
|---|---|---|---|
| **ECB** | Encrypt each block independently | Simple, parallel | Same plaintext block → same ciphertext block → **patterns leak** (ECB Penguin) |
| **CBC** | XOR with previous ciphertext block before encryption | Hides patterns | Sequential, error propagation |
| **CTR** | Encrypt counter → keystream, XOR with plaintext | Parallel, no padding, stream-like | Catastrophic if counter reuse |
| **OFB** | Encrypt evolving state → keystream | Stream-like | Sequential |

- CTR-mode block cipher behaves like a stream cipher (no padding needed).

## Hash Functions — 3 Properties (don't mix them up)

- **One-wayness (preimage)** — given `h`, infeasible to find `m` such that `H(m)=h`.
- **Second-preimage resistance** — given `m1`, infeasible to find different `m2` with `H(m1)=H(m2)`.
- **Collision resistance** — infeasible to find *any* two `m1 ≠ m2` with same hash.

- Hashes are **not encryption** (no key, not for secrecy).
- "Can you recover input from hash?" → one-wayness.
- "Can you find any colliding pair?" → collision resistance.
- "Can you forge a different message with the same hash as this one?" → second-preimage.

## Digital Signatures — what they provide

- **Integrity** — any tampering breaks the signature.
- **Origin authentication** — proves it came from holder of signing private key.
- **Non-repudiation** — only private-key holder could have signed; provable to third party.

## MAC vs Digital Signature

| Property | MAC | Digital Signature |
|---|---|---|
| Key type | Symmetric shared `k` | Asymmetric (priv signs, pub verifies) |
| Formula | `t = M_k(m)` | `σ = Sign_d(H(m))` |
| Integrity | Yes | Yes |
| Origin auth | Yes (to key-holders) | Yes (publicly) |
| **Non-repudiation** | **No** (either party could have made it) | **Yes** |
| Speed | Fast (hash-like) | Slow (asymmetric op) |
| Use | Two parties already sharing key | Public attestation, contracts |

- **Exam trap**: MAC ≠ non-repudiation, by construction.

## Hybrid Encryption — 3 Steps (Lec 2 slide 23)

1. Generate fresh random symmetric key `k`.
2. Encrypt message: `c = E_k(m)` (e.g., AES).
3. Encrypt the key: `E_{e_B}(k)` (recipient's public key).

- Send both `c` and `E_{e_B}(k)`. Recipient decrypts `k` with `d_B`, then decrypts `m` with `k`.
- Reason: asymmetric is too slow for bulk; symmetric needs key distribution → combine both.

## RSA Quick Card

- Key gen: pick large primes `p, q`. `n = pq`. Choose public `e`. Derive private `d`.
- Encrypt: `c = m^e mod n`. Decrypt: `m = c^d mod n`.
- Security = hardness of factoring `n`. `n` is public; secret is `(p, q)`.
- Modulus typically 2048 or 4096 bits.
- Recognise RSA by: "two large primes", "modular exponentiation", `c = m^e mod n`.
- Order of magnitude: AES ~ns/block, RSA ~ms/op → ~10^6 ratio.

## PKI — High Level

- Binds public keys to identities via signed certificates.
- Without binding, a public key is just bytes.
- Relying party trusts the CA's signature → trusts the binding.

## X.509 Certificate — 9 Fields (memorize)

1. **Version** (e.g. v3)
2. **Serial-Number** (unique, for revocation lookups)
3. **Issuer** (CA name)
4. **Validity-Period** (Not-Before, Not-After)
5. **Subject** (owner name)
6. **Public-Key Info** (algorithm + key value)
7. **Extension fields** (SAN, Basic-Constraints, Key-Usage, CRL distribution)
8. **Signature-Algorithm** (algorithmID + parameters)
9. **Digital-Signature** (CA's signature over fields 1–8)

- Fields 1–8 = data attested; field 9 = CA's attestation.

## CA's 3 Pre-Issuance Checks

1. **Proof of possession** of the private key matching the public key.
2. **Verify control of computer-addressable identity** (domain, email).
3. **Confirm natural-world name** (for high-quality / EV certificates).

## Why CA Signature Prevents Impersonation (past-exam essay)

- Tamper with any field → recomputed hash ≠ signature → verification fails.
- Forge a fresh signed cert → requires CA's private key (signature hardness).
- Trick CA into issuing for wrong identity → blocked by 3 pre-issuance checks.

## Common Pitfalls

- Calling encoding "encryption".
- Confusing blocklength (128 fixed for AES) with keylength (128/192/256 for AES).
- Calling Vernam a block cipher (it is bit-wise stream).
- Saying RSA is faster than AES (it is ~10^6× slower).
- Claiming MAC gives non-repudiation.
- Treating PKI as just "public keys have certificates" — it's about the trust binding.
- Saying "the certificate encrypts the public key" — it signs a binding.
