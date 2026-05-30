---
tags:
  - university
  - bcs2420
  - computer-security
  - cram-sheet
---

# 03 Authentication and Secure Communication Cram Sheet

Morning-of-exam scan sheet. Dense facts, formulas, acronyms.

## Authentication vs Identification vs Authorisation

| Term | Question answered | Cardinality |
|---|---|---|
| **Authentication** | "Are you who you claim to be?" | 1-to-1 (verify claimed identity) |
| **Identification** | "Who are you?" | 1-to-many (no prior claim) |
| **Authorisation** | "What are you allowed to do?" | After identity established |

- Knowing a password proves **knowledge of the password**, not legitimate personhood.
- Authentication ≠ authorisation. Strong auth + weak authz model = still vulnerable to privilege escalation.

## Password Storage — Hierarchy

| Storage | Resistance |
|---|---|
| Cleartext | None — catastrophic on breach |
| Plain hash | Vulnerable to rainbow tables |
| Salted hash | Per-user salt defeats precomputed tables |
| Salted + stretched | Slow per-guess; resists offline brute force |
| Salted + stretched + peppered | + secret pepper not in DB |

- **Salt** = non-secret random value per user. Stored alongside hash. Defeats rainbow tables (would need one table per salt value).
- **Pepper** = secret value, NOT stored in DB, used to slow offline attacks if hash file is leaked but pepper is not.
- **Stretching (key stretching)** = make verification slow (~100 ms/guess) by iterated/expensive hashing.

## Key Stretching Algorithms (named)

- **PBKDF2** — NIST standard, iterates a base hash.
- **bcrypt** — Blowfish-based, configurable cost.
- **scrypt** — memory-hard, resists GPU/ASIC.
- **Argon2** — winner of Password Hashing Competition; tunable for memory, time, parallelism.

## Rainbow Tables

- Precomputed table mapping common passwords → hashes.
- Inverts unsalted hashes in O(1) lookup after big upfront cost.
- **Salts defeat rainbow tables** — every salt would need its own table.

## Online vs Offline Guessing

| | Online | Offline |
|---|---|---|
| Setting | Attacker queries live server | Attacker has hash file, tests locally |
| Rate | Limited by server (rate-limit, lockout, MFA) | Limited only by attacker's compute |
| Defense | Rate limiting, lockouts, MFA, CAPTCHAs | Salts, slow hashing (bcrypt/Argon2), strong passwords, protect hash store |

- **Key stretching defends only against OFFLINE** — slowing the server hurts legitimate users equally (self-DoS).
- **Past-exam essay**: offline-specific defense = slow adaptive hash (bcrypt/scrypt/Argon2) + salts + pepper.

## OTPs and Tokens

- **OTP** = one-time password. Replay-resistant (each value valid once or briefly).
- **Lamport hash chain** — server stores `H^n(s)`; client reveals `H^{n-1}(s)`, then `H^{n-2}(s)`, ... server hashes once and checks.
- **Time-based tokens (TOTP)** — code derived from secret + current time step; both sides synchronised.
- **Hardware tokens** — physical device generates OTP.

## Biometric Rates

- **FAR** (False Accept Rate) — unauthorized user accepted.
- **FRR** (False Reject Rate) — legitimate user rejected.
- **FTE** (Failure To Enroll) — legitimate user cannot register at all.
- Tighter threshold → ↓ FAR, ↑ FRR. Looser → opposite. Cannot minimise both.

## Time-Variant Parameters (TVPs)

- Lecture 4 umbrella term covering nonces, timestamps, sequence numbers.
- **Nonce** — random value used once → freshness via randomness.
- **Timestamp** — current time → freshness via absolute time (needs clock sync).
- **Sequence number** — incrementing counter → ordering, duplicate detection.

## Protocol Attacks (6 types)

| Attack | Mechanism | Defense |
|---|---|---|
| **Replay** | Resend captured message later | TVPs (nonce/timestamp/seq) |
| **Reflection** | Bounce challenge back to originator (symmetric protocols) | Asymmetric protocol structure, explicit role binding |
| **Relay** | Forward live messages between distinct protocol runs (impersonate proximity) | Proximity-bound, MITM-resistant design |
| **Interleaving** | Weave messages from concurrent runs; use response in run X to satisfy challenge in run Y | Bind session ID / role tag into every protected msg |
| **Forward search** | Precompute hash(guess) outputs; match against captured traffic | Salts, slow hashes, large input space |
| **Pre-capture** | Social-engineer the OTP out of user before legit use, then replay within window | User training, short OTP validity windows |

- Bare `H(secret)` proof of identity is replayable — must bind a freshness value.

## Key Establishment

| | Key Transport | Key Agreement |
|---|---|---|
| Who picks the key | One side chooses, sends to other | Both contribute; derived from both inputs |
| Example | RSA wrap a session key | Diffie-Hellman |

## Diffie-Hellman Math

- Public parameters: large prime `p`, generator `g` (primitive root mod p).
- Alice picks secret `a`, sends `g^a mod p`.
- Bob picks secret `b`, sends `g^b mod p`.
- Shared key: `K = (g^b)^a = (g^a)^b = g^(ab) mod p`.
- Security: **Discrete Logarithm Problem (DLP)** — given `g^x mod p`, find `x`. Hard for large `p`.
- Unauthenticated DH is vulnerable to MITM (no proof of who sent `g^a`).

## Signed Diffie-Hellman — Forward Secrecy + Authenticity (past-exam Part C Q3)

- Each side signs their ephemeral DH public value with their long-term identity key.
- **Authenticity**: substituted shares fail signature verification → MITM blocked.
- **Forward Secrecy**: ephemeral exponents `a, b` discarded after session. Future leak of long-term signing key cannot recover past `K` because:
  - Long-term key only signs, never encrypts.
  - `K = g^(ab) mod p` was derived from ephemerals.
  - Attacker still faces DLP from recorded `g^a, g^b`.
- **Model answer**: long-term key authenticates *who is speaking now*; ephemeral DH determines *the secret protecting this session*. Compromise of first ≠ leak of second.

## EKE / DH-EKE — Symbol Legend

- **A, B** — Alice, Bob.
- **W** — password-derived symmetric encryption key (NOT the password itself; via KDF).
- **e_A** — Alice's temporary public key for this run.
- **K** — session key.
- **T** — test value Alice sends encrypted under K to prove she recovered it.
- **g^a, g^b** — DH public values.
- **{X}_K** — X encrypted under key K. Can nest: `{E_{e_A}(K)}_W`.

### Basic EKE — 3 messages

```text
1.  A -> B : A, {e_A}_W
2.  A <- B : {E_{e_A}(K)}_W
3.  A -> B : {T}_K
```

### DH-EKE — 3 messages (forward secrecy)

```text
1.  A -> B : A, {g^a}_W
2.  A <- B : {g^b}_W
3.  Both compute K = g^(ab) mod p
```

## Implicit vs Explicit Key Authentication

- **Implicit** — Lec 4: *"key access scope is narrowed but not confirmed."* Only intended party *could* hold the key, but no proof they actually do.
- **Explicit** — confirmation message (MAC over a known value, keyed with K) proves the other side *did* derive the correct key.
- Explicit = stronger; mismatch fails immediately.

## Forward Secrecy

- Compromise of long-term keys does NOT reveal past session keys.
- Requires ephemeral key material that is discarded after the session.
- DH with ephemeral exponents = forward-secret. Direct RSA key-transport of session key = not forward-secret.

## SSO — 3 Types (Lec 4)

1. **Credential Manager (CM)** — local password manager. One master unlock releases stored per-site creds. No central IdP. Examples: browser pw managers, OS keychain.
2. **Enterprise SSO** — central IdP within one org issues tickets/tokens. Example: Kerberos in Active Directory.
3. **Federated identity** — identity asserted across organisational boundaries.
   - **SAML** — XML assertions, enterprise federations.
   - **OAuth** — delegation of access (API authorisation).
   - **OpenID Connect (OIDC)** — identity layer built on OAuth 2.0.

## SSO Risks + Mitigations

| Risk | Mitigation |
|---|---|
| IdP compromise = compromise of all services | Harden IdP, MFA on IdP, monitoring |
| Token replay / forgery | Sign tokens, verify signatures at SP |
| Long token lifetime → big replay window | Short lifetimes + refresh tokens |
| Token reuse across services | Validate `audience` claim at each SP |

## Graphical Passwords — 2 Types

- **Cued recall (click-based)** — click pre-selected points on an image. e.g., PassPoints.
  - Advantage: spatial cues aid memory.
  - Drawback: shoulder-surfing visible; click hotspots predictable.
- **Pure recall / Pattern lock** — trace path on a grid (e.g., Android 3×3).
  - Advantage: fast, motor memory.
  - Drawback: **smudge attacks** (finger grease reveals pattern); users pick predictable patterns.

## Common Pitfalls

- Saying salts are secret.
- Claiming rate-limiting defeats offline cracking after DB leak.
- Saying ephemeral DH is "no authentication" — it provides implicit auth once shares are signed.
- Confusing key transport vs key agreement (orthogonal to implicit/explicit auth).
- Forgetting that DH-EKE's W is not the password itself — it is derived from the password.
- Mixing reflection (single run, bounce back) with relay (live forward between distinct endpoints).
