---
tags:
  - university
  - bcs2420
  - computer-security
  - self-test
---

# 03 Authentication and Secure Communication Self Test

Answer these without checking the notes. Then expand the Answer Key callout at the bottom to grade yourself.

## Authentication, Identification, and Authorization

1. What is the difference between authentication and identification?
2. What role does authorization play after authentication?

## Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks

3. Why do salts prevent precomputed dictionary attacks (rainbow tables)?
4. Why does password stretching help? Name three concrete key-stretching algorithms.
5. What is the difference between online and offline password guessing?
6. What side effect can rate limiting have on legitimate users?
7. **Key stretching defends against which attack model?** Why is making the hash slow on the server side a poor defence against the *other* model?

## OTPs, Tokens, Biometrics, and Derived Passwords

8. What is the purpose of a Lamport hash chain?
9. How does a time-based token work at a high level?
10. How do threshold choices affect FAR and FRR?
11. What problem do derived passwords try to solve?

## Protocols for Secure Communication: Nonces, Replay, Reflection, and Relay

12. How does a nonce help prevent replay?
13. What is the difference between a reflection attack and a relay attack?
14. Why is a simple `H(K)` proof insecure if reused across sessions?
15. What is the umbrella term Lecture 4 uses for nonces + timestamps + sequence numbers, and what threat family do they defeat?

## Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy

16. What is the difference between key transport and key agreement?
17. Why can MITM break unauthenticated Diffie-Hellman? Draw or describe the message flow.
18. What is forward secrecy?
19. Why is DH-EKE stronger than a naive password-based key exchange?

## Essay-style (past exam patterns)

20. **Online vs offline guessing + offline-specific defence.** A web application stores `SHA-1(password)` in its user database. The database is leaked. Explain why the existing defences (account lockout, captcha on the login form) do **nothing** to help, and propose one storage-side defence that specifically targets the offline attacker. Justify why your defence works and what the operational cost is.
21. **DH MITM + countermeasure preserving FS + authenticity (past exam 2025-03-21 Part C Q3).** A developer implements Diffie-Hellman key exchange but does not authenticate the public shares. (a) Describe how a MITM attacker exploits this. (b) Propose a single countermeasure that preserves **both** authenticity *and* forward secrecy. (c) Explain why your countermeasure preserves forward secrecy even if the attacker later compromises the long-term key.

> [!info]- Answer Key
> 1. Authentication = one-to-one test: the user claims an identity (e.g., a username) and the system verifies the claim against evidence (e.g., the password). Identification = one-to-many: the system must decide which identity matches observed data (e.g., a biometric search across a population) without a prior claim.
> 2. Authorization decides what an authenticated entity is *allowed to do*. Even with a correct password, the user may not be authorised to install software or read certain records. Authentication answers "who"; authorization answers "what may they do".
> 3. Without salts, all users with the same password share the same hash, and an attacker can precompute one rainbow table that inverts any unsalted hash by lookup. Per-user salts (non-secret, unique random values) make the same password hash differently for each user, so precomputation across users is useless — the attacker would need a separate table per salt.
> 4. Key stretching makes each guess intentionally expensive (e.g., 100 ms instead of 1 microsecond), cutting an attacker's offline guess rate by orders of magnitude. Named algorithms: **PBKDF2** (NIST-standard, iterated hashing), **bcrypt** (Blowfish-based, configurable cost), **scrypt** (memory-hard), **Argon2** (Password Hashing Competition winner; configurable time/memory/parallelism).
> 5. **Online**: the attacker submits guesses to the live login service and must wait for the server response — rate-limited, lockable, observable. **Offline**: the attacker has stolen the hash database and tests guesses locally on their own hardware — not rate-limitable from the application's side.
> 6. Aggressive rate limiting can lock out legitimate users who mistype their password (denial-of-service against real users), and attackers can deliberately trigger lockouts (account-lockout DoS).
> 7. Key stretching defends only against **offline** guessing. Against online guessing, the server is already rate-limited by lockout/captcha; making the hash slow per-attempt is a **self-DoS** — it slows legitimate logins as much as attacker attempts and burns server CPU. The justification for expensive password hashing is the post-breach scenario where the attacker has the hash file and is running guesses on their own hardware.
> 8. A one-time password scheme: a chain `h^n(secret), h^(n-1)(secret), ..., h(secret)` is built by repeated hashing. The server stores `h^n(secret)`; on each authentication, the client reveals the next preimage in reverse order. Each value is valid exactly once, and one-wayness of `h` means a captured value cannot be used to compute future ones. Reduces replay risk versus static passwords.
> 9. Client and server share a long-term secret and both know the current time step. Each derives the same short-lived code by combining the secret with the time window (e.g., HMAC of seed + time). Code is valid only for the current window, so capture-and-replay outside the window fails. The "challenge" is implicit — it is the time itself.
> 10. Biometrics are probabilistic. **Tighter threshold** → fewer false accepts (FAR ↓) but more legitimate users rejected (FRR ↑). **Looser threshold** → easier for legitimate users (FRR ↓) but more impostors get in (FAR ↑). Threshold choice is a usability/security trade-off; FTE (Failure to Enroll) is a separate issue at registration.
> 11. Password reuse across sites. A derived-password scheme combines a master secret with site context (e.g., domain name) to produce a unique site-specific password per service, so a leak from one site does not compromise the others — without requiring the user to memorise many independent passwords.
> 12. The verifier sends a fresh random value (the nonce); the responder must produce a proof that is bound to that nonce (e.g., `H(K, nonce)` or `E_K(nonce)`). An old captured response was bound to an old nonce, so it is rejected when the verifier checks the current nonce. Each run gets a fresh challenge → freshness is enforced.
> 13. **Reflection**: attacker exploits *symmetric* protocol structure — sends a challenge or response back toward the originator to obtain a useful answer from them (one party against itself). **Relay**: attacker is a live messenger between two genuine endpoints — forwards each side's traffic in real time, often without understanding it, impersonating proximity or identity.
> 14. `H(K)` is the same value every time — no freshness. An attacker who captures it once can replay it forever to authenticate without knowing K. The fix is to bind the proof to a fresh per-session value (a nonce/timestamp/sequence number).
> 15. **Time-Variant Parameters (TVPs)** — the lecture's umbrella term for nonces, timestamps, and sequence numbers. They defeat **freshness-related** attacks: replay, basic interleaving, and stale-message acceptance. Each variant has different costs (nonces need randomness, timestamps need clock sync, sequence numbers need state).
> 16. **Key transport**: one party chooses the session key and securely sends it to the other (e.g., sender encrypts a fresh K under receiver's public key). **Key agreement**: both parties contribute and the shared key is derived from both contributions; neither chooses it alone (e.g., Diffie-Hellman).
> 17. Plain DH has no authentication of the exchanged public values, so Eve can sit between Alice and Bob: Alice→Eve: g^a; Eve→Bob: g^e1; Bob→Eve: g^b; Eve→Alice: g^e2. Now Alice shares K1=g^(a·e2) with Eve, and Bob shares K2=g^(b·e1) with Eve. Each thinks they share a secret with the other, but Eve holds both keys, can decrypt each direction, and re-encrypt to the other side.
> 18. Forward secrecy = compromise of long-term keys at some future date does not let the attacker recover *past* session keys. Past recorded sessions remain confidential even if the long-term private key later leaks.
> 19. Naive password-based exchange typically sends a key wrapped under the password — an offline attacker who captures one transcript can dictionary-attack the password directly. DH-EKE hides the DH exchange messages under a password-derived secret without giving the offline attacker enough verifiable structure to test password guesses; combined with ephemeral DH it also retains forward secrecy.
> 20. Lockout and captcha defend the *online* attack surface — but the attacker now has the hash database offline and never touches the login form. SHA-1 is fast (billions of guesses per second on GPUs) so the attacker can crack realistic passwords in minutes. **Defence**: switch to a salted, stretched password hash — bcrypt, scrypt, or Argon2 — with a per-user random salt and a tuned cost factor. This makes each guess attempt 10^4-10^6× slower and salts prevent precomputed-table reuse. Cost: each legitimate login also incurs the stretching cost (typically ~100 ms is acceptable) and server CPU rises slightly on login. The defence works because the attacker's guess rate becomes the bottleneck; with a strong hash and an adequate password, brute-force becomes infeasible.
> 21. (a) MITM substitutes each party's DH public share: Alice→Eve g^a; Eve→Bob g^e1; Bob→Eve g^b; Eve→Alice g^e2 — Eve holds K1 with Alice and K2 with Bob, decrypts and re-encrypts every message. (b) **Sign each ephemeral DH public value with the sender's long-term identity key** (or use a certificate that binds the identity key). This is the Station-to-Station / signed-DH construction. Eve cannot forge the signature without the long-term private key, so substitution is detected and the session is aborted. (c) Forward secrecy is preserved because the **DH exponents a and b are ephemeral** — generated fresh per session, discarded after K is derived — and the long-term key is used **only to sign**, never to derive the session key. The session key K = g^(ab) mod p depends only on ephemeral values. If the long-term signing key leaks later, the attacker gains the power to impersonate the party in *future* sessions but gains no information about past K's: reconstructing any past K from recorded g^a and g^b would still require solving the Discrete Logarithm Problem, which the long-term key compromise does nothing to ease.
