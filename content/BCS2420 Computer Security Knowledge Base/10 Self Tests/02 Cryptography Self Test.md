---
tags:
  - university
  - bcs2420
  - computer-security
  - self-test
---

# 02 Cryptography Self Test

Answer these without checking the notes. Then expand the Answer Key callout at the bottom to grade yourself.

## Encryption, Decryption, Key Space, and Exhaustive Search

1. What is key space?
2. Why does key length matter for brute-force resistance?
3. Why are simple encodings or weak substitutions not enough for confidentiality?

## Attack Models and Adversary Capabilities

4. Which attack model imposes the strongest requirement on a cryptosystem?
5. Why are active adversaries harder to defend against than passive ones?
6. How do the four attack models differ? List them in increasing order of attacker power.
7. Define **passive** vs **active** attacker. Give one concrete example of each.

## Hash Functions, Collision Resistance, and Digital Signatures

8. What is collision resistance?
9. What is the difference between one-wayness and second-preimage resistance?
10. What do digital signatures provide?
11. Why is the message hashed before being signed (rather than signing the message directly)? Give at least two reasons.

## Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI

12. State the formal definition of **symmetric** encryption used in Lecture 2 — what is "the same shared secret key used for"?
13. What is the main advantage of public-key cryptography over symmetric cryptography?
14. How does hybrid encryption work? List the three steps from Lecture 2 slide 23.
15. What role does PKI play in secure systems?

## Stream vs Block Ciphers

16. State the verbatim Lecture 2 slide 15 definition of a **stream cipher**.
17. What is the blocklength and keylength of AES? Why is DES considered deprecated?
18. Why does a block cipher need padding for the last block, while CTR mode does not?

## Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes

19. What conditions are required for a one-time pad to be perfectly secure?
20. Why does OTP reuse fail? (Show the XOR relation.)
21. Why is ECB weaker than CBC for structured data?
22. Why is CTR often described as suitable for high-speed or parallel-friendly use?

## X.509 Essay (past exam Part B Q3)

23. List the nine fields of an X.509 certificate in order. Then explain *why* the issuer's digital signature in the certificate prevents an attacker from impersonating the certificate owner. Walk through what happens if the attacker (a) tampers with a field, (b) tries to forge a fresh certificate.

> [!info]- Answer Key
> 1. Key space = the total set of possible keys for a cryptosystem. Its size determines whether brute-force exhaustive search is feasible. A Caesar cipher has 26 keys; AES-128 has 2^128.
> 2. Brute force is always the fallback attack. If the key space is small, an attacker can try every key. Larger keys make the search infeasible. Average exhaustive search succeeds after ~half the key space.
> 3. They lack a real secret key, or the key space is tiny, or the transformation is trivially reversible. Base64 is encoding, not encryption — it has no key. A Caesar shift has 26 keys. Encoding ≠ encryption.
> 4. **Chosen-ciphertext** (CCA) — the attacker can choose ciphertexts and obtain decryptions / oracle outputs. This is the strongest of the four classical models.
> 5. Active attackers can inject, modify, block, or replay messages — not just observe. Encryption alone may stop passive eavesdropping but does nothing against an active attacker who can manipulate protocol flow; you need freshness checks, authentication, and integrity protection.
> 6. **Ciphertext-only** < **Known-plaintext** < **Chosen-plaintext** < **Chosen-ciphertext**. Each later model gives the attacker more leverage or oracle access than the previous.
> 7. Passive = observes only (e.g., a Wi-Fi eavesdropper running Wireshark). Active = injects/modifies/blocks messages (e.g., MITM substituting DH public values, or an ARP-spoofing attacker rerouting LAN traffic).
> 8. It is computationally infeasible to find any two distinct inputs that hash to the same output.
> 9. **One-wayness**: given a hash output, you cannot find any input that produces it (inversion). **Second-preimage resistance**: given one *specific* input x, you cannot find a *different* input x' with the same hash as x. Collision resistance is even stronger — find *any* two colliding inputs.
> 10. Integrity (any change to the message breaks signature verification), origin authentication (only the holder of the private key could have produced it), and non-repudiation (signer cannot later deny they signed).
> 11. (a) Efficiency — signing a fixed-size digest is much faster than signing a long message, especially for asymmetric algorithms which are slow. (b) Binding via the hash — a secure digest binds the signature to the exact message content, so any tampering breaks verification. (c) Practical: most signature schemes operate on a fixed-size input, so a hash normalises arbitrary-length messages.
> 12. Lecture 2 slide 12: "the same shared secret key is used for both encryption AND decryption". The pre-shared secret is the defining feature.
> 13. Public-key cryptography solves the **key distribution** problem — you can use the recipient's public key without ever sharing a secret with them beforehand. Symmetric requires an out-of-band channel to deliver the shared secret first.
> 14. (1) Generate a fresh random symmetric key k. (2) Encrypt the message m with k using a symmetric cipher: `c = E_k(m)`. (3) Encrypt the symmetric key k with the recipient's public key `e_B`: `E_{e_B}(k)`. Send both pieces. Combines symmetric speed for bulk data with asymmetric convenience for key delivery.
> 15. PKI provides the **trust layer**: certificates issued by trusted CAs bind public keys to identities so a relying party can act on a stranger's public key. Without PKI, a published public key is just bytes; with it, you can verify whose key it really is.
> 16. Slide 15 verbatim: an encryption scheme that processes plaintext **one bit (or one character) at a time**, combining each unit with a corresponding unit from a **keystream**. Vernam (XOR plaintext bit with key bit) is the canonical example.
> 17. AES blocklength = 128 bits (fixed). AES keylength = 128, 192, or 256 bits. DES has a 56-bit key, giving only 2^56 possible keys — brute-forceable on modern hardware, so it is deprecated.
> 18. Block cipher's transformation is defined only for inputs of exactly `n` bits — if the last plaintext block is shorter, there is nothing for the cipher to operate on, so padding (filler characters with an unambiguous scheme) fills the gap. CTR mode XORs plaintext bits with a keystream produced by encrypting counter values — it processes bit-wise like a stream cipher, so any short remainder is just XORed against the matching keystream bits with no need to fill a block.
> 19. (a) Key truly random; (b) key at least as long as the message; (c) key never reused. All three must hold; if any one fails, perfect secrecy is lost.
> 20. If `c1 = m1 XOR k` and `c2 = m2 XOR k`, then `c1 XOR c2 = m1 XOR m2`. The key cancels — the relation between plaintexts is exposed, and a known plaintext for one message leaks the pad which then decrypts the other.
> 21. ECB encrypts each plaintext block independently with the same key. Identical plaintext blocks → identical ciphertext blocks, so repeated structure (the classic "ECB penguin" image example) leaks visibly. CBC XORs each plaintext block with the previous ciphertext before encryption, so repeated blocks no longer produce repeated ciphertext.
> 22. CTR generates keystream by encrypting counter values, then XORs with plaintext. Each block of keystream depends only on the counter (not on previous output), so blocks can be computed in **parallel** and pre-computed before plaintext arrives. No chaining dependency = fast, parallel-friendly, no padding.
> 23. Nine fields (Lecture 2 slide 50): (1) Version, (2) Serial-Number, (3) Issuer, (4) Validity-Period (Not-Before / Not-After), (5) Subject, (6) Public-Key info (algorithm + value), (7) Extension fields (SAN, Key-Usage, etc.), (8) Signature-Algorithm, (9) Digital-Signature over the preceding eight fields. **Why the signature prevents impersonation**: the verifier recomputes the hash of fields 1-8 and verifies it against field 9 using the CA's public key. (a) If the attacker tampers with any field (e.g., swaps the Subject or replaces the Public-Key), the recomputed hash no longer matches the existing signature — verification fails, browser rejects. (b) To forge a fresh certificate with a fake binding, the attacker would need to produce a valid signature, which requires the CA's private key (signature-scheme hardness assumption). The alternative path — convincing the CA to issue a real certificate for someone else's identity — is blocked by the CA's three pre-issuance checks: proof-of-possession of the private key, control of the addressable identity (domain/email), and confirmation of the natural-world name.
