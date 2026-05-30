---
tags:
  - university
  - bcs2420
  - computer-security
---

# Message Authentication Codes (MACs)

> [!abstract] Why this note matters
> - Tutorial 2 Q10 directly asks when a MAC is preferable to a digital signature and vice versa.
> - Lecture 2 introduces MACs as the symmetric counterpart to digital signatures: same integrity and origin guarantees, no non-repudiation.
> - Confusing MAC and signature is one of the easiest ways to lose marks on the integrity questions.

## Overview

A Message Authentication Code (MAC) is a tag computed over a message using a shared secret key. It tells the receiver two things: the message was not altered in transit (integrity), and it came from someone who holds the same key (origin). It does not tell the receiver which of the key-holders sent it — that is the property MACs deliberately do not have.

The course presents MACs alongside digital signatures because they answer almost the same question but with very different trust assumptions. A signature uses asymmetric keys and gives non-repudiation. A MAC uses one shared symmetric key and gives no non-repudiation, but is much faster.

## Exam Focus

- Tier 1 priority.
- Written to align with Lecture 2 (slides 41-43) and Tutorial 2 Q10.

## Core Definitions

- **MAC (Message Authentication Code)**: A short tag `t = M_k(m)` computed over a message `m` using a secret key `k` shared between sender and receiver.
- **Tag**: The output of the MAC algorithm; appended to the message and sent alongside it.
- **Verification**: The receiver recomputes the tag with the same key and accepts the message if and only if the recomputed tag matches the received tag.
- **Origin authentication**: Assurance that the message came from one of the key-holders.
- **Integrity**: Assurance that the message has not been altered.

## Detailed Explanation

The MAC algorithm `M` takes a key `k` and a message `m` and produces a tag `t = M_k(m)`. The sender transmits the pair `(m, t)`. The receiver, who also holds `k`, recomputes `M_k(m')` on whatever message `m'` they received and compares it against the transmitted `t`. Equal tags mean the message is valid; unequal tags mean it has been tampered with or did not come from the key-holder.

The security argument is symmetric. Because only key-holders can compute valid tags, an outsider who does not know `k` cannot produce a tag that will verify, so they cannot inject a forged message under the legitimate sender's identity. They also cannot meaningfully alter a real message in transit, because changing `m` would require recomputing `t`, which they cannot do without `k`.

This is exactly the integrity-plus-origin story digital signatures tell, with one important loss. Because both parties hold the same key, neither party can prove to a third party which of them produced a tag. Either of them could have. That is why MACs do not provide non-repudiation, and it is the single point that decides whether the exam answer should be 'MAC' or 'signature'.

The same reason MACs lack non-repudiation is also the reason they are practical for high-volume integrity work: there is no asymmetric operation on the critical path, so the cost is comparable to a hash, not to a public-key signature.

## How It Works

### Tag generation and verification (Lecture 2 slides 41-43)

1. **Compute the tag**: sender runs `t = M_k(m)` and sends `(m, t)` to the receiver.
2. **Verify the tag**: receiver, given `(m', t')`, computes `M_k(m')` and accepts if and only if it equals `t'`.

Both sides must share `k` ahead of time over a secure channel.

### MAC vs digital signature

| Property | MAC | Digital signature |
|---|---|---|
| Key type | Symmetric (shared key `k`) | Asymmetric (signing private key, verification public key) |
| Who can produce a valid tag | Any holder of `k` | Only the holder of the signing private key |
| Who can verify | Any holder of `k` | Anyone with the verification public key |
| Integrity | Yes | Yes |
| Origin authentication | Yes, to key-holders | Yes, publicly |
| Non-repudiation | No (either party could have made it) | Yes (only the private-key holder could have) |
| Speed | Fast (hash-like cost) | Slow (asymmetric crypto) |
| Best use case | High-volume integrity between two parties who already share a key | Public attestation, legal contexts, anything needing third-party proof |

## What You Must Know

- The MAC formula `t = M_k(m)` and the verify-by-recompute pattern.
- That MAC gives integrity and origin but **not** non-repudiation.
- The reason non-repudiation is missing: both parties hold the same key, so neither can prove to a third party who produced the tag.
- That MAC is much faster than a signature because there is no public-key operation.

## 30-Second Oral Answer

- A MAC is a tag `t = M_k(m)` computed with a shared secret key; the receiver recomputes the same tag with the same key to verify.
- It ensures integrity and origin authentication between the two key-holders.
- It does not give non-repudiation, because either key-holder could have produced the tag — for non-repudiation you need a digital signature with an asymmetric signing key.

## Typical Exam Questions

- What does a MAC guarantee, and what does it not guarantee?
- Explain how a MAC is generated and verified.
- When would you choose a MAC over a digital signature, and vice versa? *(Tutorial 2 Q10.)*
- Why does a MAC fail to provide non-repudiation?

## Common Pitfalls

- Claiming MACs provide non-repudiation. They do not, by construction.
- Confusing MAC with a hash. A bare hash has no key and gives no origin authentication — anyone can recompute it.
- Confusing MAC with a digital signature. The asymmetry of keys is what gives signatures their extra property; MACs are intentionally symmetric.
- Forgetting that key distribution is still a problem — MAC verification assumes both sides already share `k`.

## Concrete Examples

A storage system uses HMAC-SHA-256 to protect file integrity. The server and the client share a secret key. Every time the client uploads a file, it sends the file plus an HMAC tag. The server recomputes the HMAC with the same key and refuses the upload if the tags do not match. This catches transmission errors and any attacker who tampered with the file in flight, since they do not know the key.

The same architecture would be a bad fit for, say, signed software updates that a vendor distributes to thousands of customers. Each customer would need the same key as the vendor, which both leaks the ability to forge updates and prevents the vendor from later proving that a particular customer received a specific update. That is a signature problem, not a MAC problem.

## Worked Examples

**Q.** Alice and Bob share a MAC key `k`. Alice sends Bob `(m, t)` where `t = M_k(m)`. Bob receives `(m', t)` and the tag verifies. Bob then claims Alice sent `m'`. Can Alice deny it credibly to a judge?

**A.** Yes — credibly. Because Bob also holds `k`, Bob could equally have produced `(m', t)` himself. The judge has no way to distinguish a tag Alice made from a tag Bob made. This is exactly the missing non-repudiation property. If non-repudiation were required, Alice would need to have signed `m` with her own signing private key instead.

**Q.** When is a MAC the right choice?

**A.** When both parties trust each other, share a key already, and need fast integrity-and-origin checks at high throughput — for example, protecting message frames inside a single TLS session, or authenticating storage blocks within an organization. The asymmetric guarantees of a signature would be wasted work in that setting.

## Related Concepts

- [[Hash Functions, Collision Resistance, and Digital Signatures|Hash Functions, Collision Resistance, and Digital Signatures]]
- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
- [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- Lecture 2 — Cryptography Basics, slides 41-43: [Lecture 02 — Cryptography Basics.pdf](../Materials/01%20Lectures/Lecture%2002%20%E2%80%94%20Cryptography%20Basics.pdf)
- [Tutorial 2.pdf](../Materials/02%20Tutorials/Tutorial%202.pdf)
- [Tutorial 2 Solution.pdf](../Materials/02%20Tutorials/Tutorial%202%20Solution.pdf)
