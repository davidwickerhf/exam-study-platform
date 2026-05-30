---
tags:
  - university
  - bcs2420
  - computer-security
---

# Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy

> [!abstract] Why this note matters
> - Lecture 4 and the lecture legend cover key establishment, EKE, DH-EKE, and forward secrecy directly.
> - Tutorial 4 asks about key transport vs key agreement, MITM on DH, and forward secrecy.

## Overview

Key establishment answers a practical question: if two parties want secure communication, how do they get a shared session key at all? Lecture 4 distinguishes two answers: one side can choose and send the key, or both sides can contribute to it.

The course then pushes the question further: what stops an attacker from sitting in the middle, and what happens if a long-term secret is compromised later?

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **key transport**: A protocol where one party chooses the session key and securely sends it to the other.
- **key agreement**: A protocol where the shared key is derived from contributions made by both parties.
- **session key**: A short-term key used for one communication session or limited context.
- **forward secrecy**: The property that compromise of long-term keys does not reveal past session keys.
- **EKE**: Encrypted Key Exchange; a password-based protocol that hides key-establishment messages under a password-derived secret.

## Detailed Explanation

Key transport means one side creates the session key and transmits it securely. Key agreement means neither side alone fully determines the shared key; instead, both contribute values from which the final key is derived. Diffie-Hellman is the course's main example of key agreement.

Plain unauthenticated Diffie-Hellman is vulnerable to man-in-the-middle attack because the parties do not know whose public values they received. An active attacker can establish one key with Alice and a different key with Bob and forward traffic between them.

That is why authenticated key establishment matters. Password-based approaches like EKE or DH-EKE attempt to combine password authentication with secure key establishment without revealing enough information to make brute-force attacks easy.

Forward secrecy is desirable because it limits retrospective damage. If long-term credentials leak in the future, recorded past sessions should still remain confidential. DH-EKE supports this better than designs that directly wrap a session key under a long-term secret without fresh independent key agreement.

<figure class="diag-figure">
  <figcaption>Unauthenticated DH vs signed ephemeral DH — the math gives secrecy from eavesdroppers, but signatures are what bind the public shares to identities</figcaption>
  <svg viewBox="0 0 860 350" class="diag-svg" role="img" aria-label="Diffie-Hellman man in the middle and signed Diffie-Hellman defense">
    <defs>
      <marker id="arr-dh-a" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-dh-d" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-dan"/>
      </marker>
      <marker id="arr-dh-g" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-acc"/>
      </marker>
    </defs>

    <rect x="30" y="62" width="120" height="54" class="d-node"/>
    <text x="90" y="84" text-anchor="middle" class="d-h-sm">Alice</text>
    <text x="90" y="104" text-anchor="middle" class="d-sub">sends g^a</text>

    <rect x="370" y="62" width="120" height="54" class="d-node-dan"/>
    <text x="430" y="84" text-anchor="middle" class="d-h-sm">MITM</text>
    <text x="430" y="104" text-anchor="middle" class="d-sub">substitutes shares</text>

    <rect x="710" y="62" width="120" height="54" class="d-node"/>
    <text x="770" y="84" text-anchor="middle" class="d-h-sm">Bob</text>
    <text x="770" y="104" text-anchor="middle" class="d-sub">sends g^b</text>

    <line x1="150" y1="89" x2="368" y2="89" class="d-edge-dan" marker-end="url(#arr-dh-d)"/>
    <line x1="490" y1="89" x2="708" y2="89" class="d-edge-dan" marker-end="url(#arr-dh-d)"/>
    <text x="260" y="74" text-anchor="middle" class="d-label-danger">g^a replaced by g^m</text>
    <text x="600" y="74" text-anchor="middle" class="d-label-danger">g^b replaced by g^n</text>
    <text x="430" y="145" text-anchor="middle" class="d-label-danger">two separate secrets: Alice-MITM and MITM-Bob</text>

    <rect x="30" y="224" width="170" height="62" class="d-node-acc"/>
    <text x="115" y="248" text-anchor="middle" class="d-h-sm">Alice</text>
    <text x="115" y="268" text-anchor="middle" class="d-sub">g^a, Sig_A(g^a)</text>

    <rect x="345" y="224" width="170" height="62" class="d-node"/>
    <text x="430" y="248" text-anchor="middle" class="d-h-sm">Network</text>
    <text x="430" y="268" text-anchor="middle" class="d-sub">shares may be observed</text>

    <rect x="660" y="224" width="170" height="62" class="d-node-acc"/>
    <text x="745" y="248" text-anchor="middle" class="d-h-sm">Bob</text>
    <text x="745" y="268" text-anchor="middle" class="d-sub">g^b, Sig_B(g^b)</text>

    <line x1="200" y1="255" x2="343" y2="255" class="d-edge-acc" marker-end="url(#arr-dh-g)"/>
    <line x1="515" y1="255" x2="658" y2="255" class="d-edge-acc" marker-end="url(#arr-dh-g)"/>
    <text x="430" y="318" text-anchor="middle" class="d-label-accent">substitution fails because the attacker cannot forge signatures over new DH shares</text>
  </svg>
</figure>

## How It Works

Key transport -> one side chooses the key and sends it securely.

Key agreement -> both sides contribute, so the shared key is a function of both contributions.

Unauthenticated DH -> vulnerable to MITM because public values are not authenticated.

Forward secrecy -> old session keys are not recoverable just because a long-term key later leaks.

## Diffie-Hellman: The Math

Diffie-Hellman lets two parties derive a shared secret by exchanging only public values. The construction rests on three public parameters and one hard problem.

### Public parameters

- **Prime `p`**: A large prime modulus. All arithmetic in the protocol is done modulo `p`. The size of `p` (typically 2048 bits or more in modern use) controls the difficulty of the underlying hard problem.
- **Generator `g`**: A *primitive root modulo p*. This means the powers `g^1, g^2, g^3, ..., g^(p-1)` cycle through every nonzero residue mod p. The generator's job is to ensure that `g^a mod p` covers a large enough space that brute search is infeasible.

Both `p` and `g` are public — they are not secret. Alice and Bob agree on them in advance.

### Exchange and shared key

Each party picks one private value:

- Alice picks secret `a`, computes and sends `g^a mod p`.
- Bob picks secret `b`, computes and sends `g^b mod p`.

Both then compute the same shared session key:

```text
K = (g^b)^a mod p = (g^a)^b mod p = g^(ab) mod p
```

The reason this works is that exponentiation in the multiplicative group mod p is commutative: `(g^b)^a` and `(g^a)^b` are both `g^(ab)`. So both sides arrive at the same K, without ever transmitting K itself, and without ever transmitting `a` or `b`.

### Why an eavesdropper cannot recover K — the Discrete Logarithm Problem (DLP)

An eavesdropper Eve sees `g`, `p`, `g^a mod p`, and `g^b mod p`. To recover K = g^(ab) mod p, she would need to learn either `a` or `b`. That requires solving:

> Given `g^x mod p`, find `x`.

This is the **Discrete Logarithm Problem (DLP)**. For a suitably chosen `p` (large, and with no nice factorizations of `p-1`), DLP is believed to be computationally hard — no efficient classical algorithm is known. This is why DH is secure against a passive eavesdropper even though all transmitted values are public.

DLP is what makes the math of DH work: multiplication of exponents is easy in one direction (forward) and hard in the other (backward). Eve can verify `g^a` if you tell her `a`, but cannot find `a` from `g^a` alone in reasonable time.

## Signed Diffie-Hellman: Authenticity + Forward Secrecy

Plain Diffie-Hellman has no concept of *who* sent each public value. A man-in-the-middle attacker can intercept `g^a`, replace it with `g^a'`, and establish one session with Alice and another with Bob — neither party will notice. This is the classic MITM weakness of unauthenticated DH, and it is the scenario the 2025-03-21 exam (Part C, Q3) asks about: a developer implements Diffie-Hellman without authenticating the public shares.

The single countermeasure that preserves *both* forward secrecy and authenticity is to **sign each ephemeral Diffie-Hellman public value with the sender's long-term identity key** (or use certificates binding identity keys to identities). This is the construction underlying the Station-to-Station protocol and signed-DH variants used in modern TLS.

### Why this defeats MITM (authenticity)

Each party transmits not just `g^a` (or `g^b`) but also a signature over that value, produced with their long-term identity signing key. Verifying the signature with the corresponding public key proves the public DH share originated with the legitimate party. A MITM cannot forge the signature without the long-term private key, so any substituted `g^a'` fails verification and the session is aborted. Authenticity of the exchanged DH shares blocks MITM at the source.

### Why forward secrecy is preserved

Forward secrecy is the property that a *future* compromise of long-term keys does not let the attacker recover *past* session keys. The construction preserves this property because:

1. The DH exponents `a` and `b` are **ephemeral** — they are generated freshly for this one session and discarded immediately after K is derived.
2. The **long-term identity key** is used *only* to sign the ephemeral public values `g^a` and `g^b`. It is never used to encrypt anything.
3. The session key `K = g^(ab) mod p` is derived purely from the ephemeral DH agreement.

If, at some later date, the attacker compromises the long-term signing key, that key gives them the power to *forge signatures going forward* — they could impersonate the party in *future* sessions. But it gives them no help recovering past session keys K, because past K's were derived from past ephemeral `a` and `b` that no longer exist anywhere. To reconstruct any past K from the recorded `g^a` and `g^b`, the attacker would still need to solve the Discrete Logarithm Problem — which the long-term key compromise does nothing to ease.

That is the essential separation: the long-term key authenticates *who is speaking now*, while the ephemeral DH exchange determines *the secret material protecting this session*. Compromise of the first does not leak the second.

### Summary of the model answer

- Countermeasure: sign each ephemeral DH public key with the sender's long-term identity key (or use certificates).
- Authenticity: MITM substitution is detected because the signature on the substituted share fails verification.
- Forward secrecy: ephemeral exponents `a`, `b` are discarded post-session; future compromise of the long-term signing key cannot recover past `g^(ab)` because DLP still stands in the way.

## What You Must Know

- Difference between key transport and key agreement.
- Why unauthenticated Diffie-Hellman is vulnerable to MITM.
- What forward secrecy means and why it matters.
- The high-level idea behind EKE and DH-EKE.

## 30-Second Oral Answer

- Key transport sends a chosen session key; key agreement derives one from both parties' inputs.
- Diffie-Hellman alone does not authenticate who supplied the public values, so a MITM can interpose.
- Forward secrecy means future compromise of long-term keys should not reveal past session keys.

## Typical Exam Questions

- What is the difference between key transport and key agreement?
- Why can MITM break unauthenticated Diffie-Hellman?
- What is forward secrecy?
- Why is DH-EKE stronger than a naive password-based key exchange?

## Common Pitfalls

- Claiming key agreement means no party contributes private material.
- Saying all key transport provides forward secrecy by default.
## Worked Examples

### Reflection vs MITM contrast

A MITM on unauthenticated Diffie-Hellman is not a replay attack. The attacker actively negotiates two different keys by substituting public parameters.

That is why the fix is authentication of the exchange, not merely freshness.

## Related Concepts

- [[Protocol Notation and the EKE Message Flow|Protocol Notation and the EKE Message Flow]]
- [[Protocols for Secure Communication Nonces, Replay, Reflection, and Relay|Protocols for Secure Communication: Nonces, Replay, Reflection, and Relay]]
- [[Implicit and Explicit Key Authentication and SSO|Implicit and Explicit Key Authentication and SSO]]
- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 04 — Authentication and Key Establishment.pdf](../Materials/01 Lectures/Lecture 04 — Authentication and Key Establishment.pdf)
- [Lecture 04 Legend — Protocol Notation.pdf](../Materials/01 Lectures/Lecture 04 Legend — Protocol Notation.pdf)
- [Tutorial 4.pdf](../Materials/02 Tutorials/Tutorial 4.pdf)
- [Tutorial 4 Solution.pdf](../Materials/02 Tutorials/Tutorial 4 Solution.pdf)
