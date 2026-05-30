---
tags:
  - university
  - bcs2420
  - computer-security
---

# X.509 Certificates and Certification Authorities

> [!abstract] Why this note matters
> - Part B Q3 of the 2025 sample exam was the essay question on certificates, the CA's role, and why the CA's signature prevents impersonation.
> - Lecture 2 builds the PKI layer from this exact slide group: the nine X.509 fields, the CA's pre-issuance duties, and the certificate acquisition workflow with a Distinguished Name (DN).
> - You will not be asked a vague PKI question on the exam. You will be asked to enumerate the fields, name the CA's checks, and explain why a relying party trusts the result.

## Overview

A public-key certificate is the data structure that turns a raw public key into something a relying party can act on. It does that by binding the key to an identity and having that binding signed by a trusted Certification Authority (CA). Without the binding, a published key is just bytes; with the binding and a verified signature, it is a usable trust anchor.

X.509 is the certificate format the course teaches. Lecture 2 gives a single slide listing the nine fields and another two slides on CA responsibilities and how an end-entity acquires a certificate. The exam essay question maps almost one-to-one onto those slides.

## Exam Focus

- Tier 1 priority — this note covers a known past essay question verbatim.
- Written to align with Lecture 2 (slides 47-52) and the provided syllabus.

## Core Definitions

- **X.509 certificate**: A structured record binding a public key to an identity, signed by a CA.
- **Certification Authority (CA)**: A trusted third party that issues certificates by signing the binding between an identity and a public key.
- **Distinguished Name (DN)**: The structured identity an end-entity submits when requesting a certificate.
- **Issuer**: The CA whose signature appears on the certificate.
- **Subject**: The owner whose public key the certificate binds.
- **Relying party**: The party that consumes the certificate and decides whether to trust the binding.

## Detailed Explanation

A certificate is not a key. It is a wrapper around a key that records who the key belongs to, who vouches for that fact, how long the vouching is valid, and what algorithm the vouching uses. The CA's job is to make that wrapper trustworthy enough that a stranger can rely on it without having ever met the subject.

The course models this with three operational pieces. First, the nine X.509 fields define the unit of trust. Second, the CA's pre-issuance checks define what a CA must do before it produces the signature. Third, the acquisition workflow shows how an end-entity actually obtains a certificate, namely by submitting a Distinguished Name and a public key.

The reason the system works against impersonation comes back to one observation: the entire wrapper is signed by the CA, and that signature can only be produced by a holder of the CA's private key. If anyone alters any field or substitutes a different public key into the binding, the digital signature stops verifying under the CA's public key. So a forger has two options, both impractical. They can try to forge the CA's signature, which requires the CA's private key. Or they can try to convince the CA to issue a fresh certificate for an identity they do not control, which is exactly what the CA's pre-issuance checks are designed to block.

This is what makes the certificate, and not the key, the unit of trust in PKI.

## How It Works

### X.509 certificate fields (Lecture 2 slide 50)

A certificate contains nine fields:

1. **Version** — certificate format version, e.g. X.509v3.
2. **Serial-Number** — uniquely identifies this certificate, used for revocation lookups.
3. **Issuer** — the issuing CA's name.
4. **Validity-Period** — dates Not-Before and Not-After during which the binding is valid.
5. **Subject** — owner's name.
6. **Public-Key info** — pair (Public-Key-Algorithm, Key-Value).
7. **Extension fields** (optional) — Subject-Alternate-Name (SAN list), Basic-Constraints, Key-Usage, CRL-Distribution-Points, and others.
8. **Signature-Algorithm** — (algorithmID, parameters) identifying the algorithm used to sign the certificate.
9. **Digital-Signature** — the signature of the Issuer over all the preceding fields.

The first eight fields are the data being attested to. The ninth is the CA's attestation over that data.

### CA responsibilities before issuing

Before producing a signature, a CA must:

1. **Verify knowledge of the private key** — the requester must demonstrate that they actually hold the private key matching the public key in the request.
2. **Verify control of computer-addressable identities** — for example domain names or email addresses asserted in the certificate.
3. **Confirm asserted natural-world names** for high-quality certificates — additional vetting for things like corporate identity or extended-validation certificates.

### Certificate acquisition workflow

End-entities request a certificate from a CA by submitting a Distinguished Name (DN), the public key, and other attributes. The CA performs the checks above. If they pass, the CA fills in the eight data fields and produces the ninth field as a signature over them. The signed certificate is returned to the end-entity and can be published.

### Why the issuer signature prevents impersonation

The signature covers all the data fields. A verifier recomputes the hash of those fields and checks it against the signature using the CA's public key. Three attack attempts then fail:

- **Tamper with a field** (for example swap the Subject or replace the Public-Key info): the recomputed hash no longer matches the signature, so verification fails.
- **Forge a fresh signed certificate** with a fake binding: this requires producing a valid signature without holding the CA's private key, which is the hardness assumption of the signature scheme.
- **Convince the CA to issue a real certificate for someone else's identity**: this is what the CA's three pre-issuance checks are designed to stop — proof-of-possession of the private key, control of the addressable identity, and confirmation of the natural-world name.

So the security argument is: the binding cannot be altered without breaking the signature, and the binding cannot be freshly forged without either compromising the CA or defeating its identity checks.

## What You Must Know

- The nine X.509 fields, in order, and what each one stores.
- The three CA pre-issuance checks.
- The acquisition workflow (end-entity submits DN + public key + attributes; CA verifies; CA signs).
- The exact security argument: tampering breaks the signature; forgery requires the CA's private key.
- That the certificate, not the key, is what a relying party trusts.

## 30-Second Oral Answer

- An X.509 certificate binds a public key to a Subject's identity using nine fields, the last of which is the CA's digital signature over the other eight.
- Before signing, the CA verifies that the requester holds the matching private key, controls the asserted computer-addressable identities, and (for high-quality certificates) actually has the asserted natural-world name.
- The signature prevents impersonation because any tamper with a field invalidates the signature, and producing a fresh fake binding requires the CA's private key — neither path is available to an attacker.

## Typical Exam Questions

- List the fields contained in an X.509 certificate.
- What are the responsibilities of a Certification Authority before issuing a certificate?
- Describe how an end-entity acquires a certificate from a CA.
- Explain why the digital signature in a certificate prevents an attacker from impersonating the certificate owner. *(Past Part B Q3.)*
- What is the difference between the Issuer and the Subject fields?

## Common Pitfalls

- Confusing the Issuer (CA) with the Subject (owner). The signature is produced by the Issuer, over a binding that names the Subject.
- Saying 'the certificate encrypts the public key'. It does not encrypt anything. It signs a binding.
- Forgetting that revocation depends on the Serial-Number — that is why uniqueness of serials matters operationally.
- Treating the certificate as the trust anchor. The trust anchor is the CA's public key in the relying party's trust store; the certificate is the artifact that anchor verifies.

## Concrete Examples

A browser visits `https://example.com`. The server presents an X.509 certificate whose Subject (or SAN extension) lists `example.com`, whose Public-Key info contains the server's public key, and whose Issuer is a CA the browser already trusts. The browser hashes the data fields, verifies the Digital-Signature field with the CA's public key, checks the Validity-Period, and if everything passes, treats the public key as belonging to `example.com`. Only then does it use that key in the TLS handshake.

## Worked Examples

**Q.** An attacker intercepts a legitimate `example.com` certificate and rewrites the Public-Key info field to contain their own public key, hoping browsers will then encrypt session keys to them. Why does this not work?

**A.** Modifying the Public-Key info changes the data over which the CA's signature was computed. When the browser recomputes the hash and verifies it against the existing Digital-Signature using the CA's public key, the check fails, so the browser rejects the certificate. The attacker would need the CA's private key to re-sign the modified data, and they do not have it.

**Q.** Why are the three CA checks structured the way they are?

**A.** Each check closes a different forgery path. Proof-of-possession blocks an attacker from claiming a key they do not actually hold. Verifying control of the addressable identity blocks issuance of a certificate for a domain the requester does not run. Confirming the natural-world name blocks identity-level fraud. Together they ensure the binding the CA signs reflects reality.

## Related Concepts

- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
- [[Hash Functions, Collision Resistance, and Digital Signatures|Hash Functions, Collision Resistance, and Digital Signatures]]
- [[Message Authentication Codes (MACs)|Message Authentication Codes (MACs)]]
- [[RSA, Modular Exponentiation, and Why Asymmetric is Slow|RSA, Modular Exponentiation, and Why Asymmetric is Slow]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- Lecture 2 — Cryptography Basics, slides 47-52: [Lecture 02 — Cryptography Basics.pdf](../Materials/01%20Lectures/Lecture%2002%20%E2%80%94%20Cryptography%20Basics.pdf)
- [Tutorial 2.pdf](../Materials/02%20Tutorials/Tutorial%202.pdf)
- [Tutorial 2 Solution.pdf](../Materials/02%20Tutorials/Tutorial%202%20Solution.pdf)
