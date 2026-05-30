---
tags:
  - university
  - bcs2420
  - computer-security
  - worked-drill
---

# Cryptography and Authentication Worked Drills

Use these drills to practice complete short-answer and long-answer responses under closed-book conditions.

**Best use:** first write the answer without notes; then compare your mechanism, terminology, and defense mapping against the model.

## Drill 1 — Attack Models

**Question.** Compare ciphertext-only, known-plaintext, chosen-plaintext, and chosen-ciphertext attacks.

### Model Answer

| Attack model | What the attacker has | Why it is stronger |
|---|---|---|
| Ciphertext-only attack (COA) | Only intercepted ciphertexts | Weakest model; attacker infers structure from ciphertext alone |
| Known-plaintext attack (KPA) | Some plaintexts and matching ciphertexts | Reveals how known messages map through the cipher |
| Chosen-plaintext attack (CPA) | Ability to choose plaintexts and obtain ciphertexts | Attacker can craft inputs to expose cipher behavior |
| Chosen-ciphertext attack (CCA) | Ability to choose ciphertexts and obtain decrypted plaintexts | Strongest common model; attacker can probe decryption behavior |

The progression is about increasing adversary capability. A cipher secure only against ciphertext-only attacks is weak by modern standards; robust schemes should remain secure even when attackers can obtain encryptions of chosen messages, and many protocol settings also require resistance to chosen-ciphertext attacks.

**Covered in:** [[02 Cryptography/02 Cryptography|Attack Models and Adversary Capabilities]]

## Drill 2 — OTP Reuse and Known Plaintext

**Question.** Explain why one-time-pad reuse breaks confidentiality and how a known-plaintext attack can recover another message.

### Model Answer

For a one-time pad:

```text
c1 = m1 XOR k
c2 = m2 XOR k
```

If the same pad `k` is reused, XORing the ciphertexts cancels the key:

```text
c1 XOR c2 = (m1 XOR k) XOR (m2 XOR k)
            = m1 XOR m2
```

The attacker now knows a relationship between the two plaintexts. If the attacker knows one plaintext, they recover the pad segment:

```text
k = c1 XOR m1
```

Then they decrypt the other ciphertext:

```text
m2 = c2 XOR k
```

So OTP security depends on the pad being truly random, at least as long as the message, secret, and never reused. Reuse turns perfect secrecy into a practical attack.

### Mini Example

```text
m1 = 1010
k  = 0110
c1 = 1100

c2 = 0011
k  = 0110
m2 = 0101
```

If `m1` and `c1` are known, the attacker computes `k = 1100 XOR 1010 = 0110`, then `m2 = 0011 XOR 0110 = 0101`.

**Covered in:** [[02 Cryptography/02 Cryptography|Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes]]

## Drill 3 — Hash, MAC, and Digital Signature

**Question.** Distinguish a cryptographic hash, a MAC, and a digital signature. Which security goals does each provide?

### Model Answer

| Primitive | Key material | Main goals | Who can verify |
|---|---|---|---|
| Hash | No secret key | Integrity evidence against accidental or malicious change, if trusted digest is known | Anyone |
| MAC | Shared secret key | Integrity + authentication between parties who share the key | Anyone with the shared key |
| Digital signature | Private signing key + public verification key | Integrity + origin authentication + non-repudiation style evidence | Anyone with the public key |

A hash alone does not authenticate the sender because anyone can recompute it after modifying the message. A MAC authenticates within a shared-key group, but it does not prove which holder of the shared key generated it. A digital signature is asymmetric: only the private key holder can sign, while anyone with the public key can verify, which is why signatures are used with certificates and public-key infrastructure.

**Covered in:** [[02 Cryptography/02 Cryptography|Hash Functions, Collision Resistance, and Digital Signatures]], [[02 Cryptography/02 Cryptography|Message Authentication Codes (MACs)]]

## Drill 4 — Online vs Offline Password Guessing

**Question.** Explain the difference between online and offline password guessing and the matching defenses.

### Model Answer

Online password guessing sends each candidate password to the live login service. The server sees every attempt, so the best defenses are rate limiting, lockout, MFA, monitoring, and suspicious-login alerts. The bottleneck is the server policy and network round trip.

Offline password guessing happens after the attacker steals password hashes and tests guesses locally without contacting the server. The best defenses are per-user salts plus slow password hashing or key-stretching algorithms such as PBKDF2, bcrypt, scrypt, or Argon2. These make every local guess expensive and prevent rainbow-table reuse across users.

| Attack | Attacker bottleneck | Best defenses |
|---|---|---|
| Online guessing | Server rate and account policy | MFA, lockout, backoff, alerts |
| Offline guessing | Local hash computations per second | Salt, pepper, stretching, strong passwords |

**Covered in:** [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

## Drill 5 — X.509 Certificate Trust

**Question.** Why does an X.509 certificate need an issuer signature? What attack would be possible without it?

### Model Answer

An X.509 certificate binds a subject name to a public key. The important fields include the subject, subject public key, issuer, validity period, and issuer digital signature. The issuer signature is computed by the CA over the certificate body, so anyone with the CA's public key can verify that the binding has not been forged or changed.

Without the issuer signature, an attacker could create a certificate claiming to be `bank.example.com` while inserting the attacker's own public key. A browser or client would have no reliable way to distinguish that forged binding from the real one. The signature turns the certificate from a self-asserted claim into a CA-endorsed statement.

**Covered in:** [[02 Cryptography/02 Cryptography|X.509 Certificates and Certification Authorities]]

## Related

- [[02 Cryptography/02 Cryptography|Cryptography]]
- [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Authentication and Secure Communication]]
- [[07 Exam Skills/07 Exam Skills|Sample Paper 2025 — Question Bank with Model Answers]]
