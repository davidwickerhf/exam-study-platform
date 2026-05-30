---
tags:
  - university
  - bcs2420
  - computer-security
---

# Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks

> [!abstract] Why this note matters
> - Lecture 3 and Tutorial 3 are heavily centered on password security.
> - This topic directly supports labs and likely exam problem types.

## Overview

Password systems are central because they show the difference between storing secrets, storing evidence of secrets, and resisting attacks after a breach. The course expects you to understand both the storage side and the attack side.

A secure password system does not merely hash passwords. It uses salts to stop precomputed reuse, stretching to slow offline attacks, and operational controls like rate limiting to resist online guessing.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **salt**: A non-secret random value combined with a password before hashing to make identical passwords hash differently. Prevents reuse of precomputed tables (e.g. rainbow tables) across users.
- **pepper**: A secret extra value used with password hashing and not stored openly in the password database.
- **password stretching (key stretching)**: Making password verification intentionally expensive by iterating the hash or using a slow password-hashing scheme. Named algorithms in this category: **PBKDF2**, **bcrypt**, **scrypt**, **Argon2**.
- **rainbow table**: A precomputed table mapping common password guesses to their hash outputs, used to invert unsalted hashes in O(1) lookup after the precomputation cost.
- **offline attack**: An attack where the adversary tests password guesses locally without querying the legitimate server.
- **online attack**: An attack where guesses are submitted to the real authentication service.

## Detailed Explanation

Cleartext storage is catastrophic because stealing the file reveals every password immediately. Hash storage is better because the attacker must guess passwords and compare digests rather than reading secrets directly.

But unsalted hashes remain weak against precomputed dictionary attacks and **rainbow tables**. A rainbow table is built once (large up-front cost) and then used to invert any unsalted hash by lookup. Salts defeat this by making the same password hash differently for each user: with per-user salts, an attacker would need a separate rainbow table per salt value, which makes precomputation across users useless. Salts are stored in cleartext alongside the hash — their value comes from uniqueness, not secrecy.

**Key stretching** slows offline attacks by making each guess computationally expensive. Named stretching algorithms include **PBKDF2** (NIST-standardised, iterates a base hash), **bcrypt** (based on the Blowfish key schedule, configurable cost), **scrypt** (memory-hard, designed to resist GPU/ASIC parallelism), and **Argon2** (winner of the Password Hashing Competition, configurable for memory, time, and parallelism). Each guess might take 100 ms instead of 1 microsecond, cutting an attacker's guess rate by a factor of 100 000 or more.

Crucially, key stretching defends **only against offline guessing**. Online guessing is already rate-limited by the server (a few attempts per minute before lockout); per-guess slowness on the server side becomes a *self-DoS* — it slows legitimate logins as much as attacker requests, and the server bears the CPU cost. The threat model that justifies expensive password hashing is the post-breach scenario where the attacker has stolen the hash database and is running guesses locally.

Peppering adds another hurdle: even if the attacker gets the hash database, they may still lack the secret pepper value needed to reproduce the verification function.

Online attacks are different. The attacker must interact with the live server, so rate limiting, delays, and lockouts become useful. Those do not help much against offline attacks after a database leak, which is why both storage design and service-side controls matter.

## How It Works

Online attack -> defend with rate limits, lockouts, MFA, and monitoring.

Offline attack -> defend with salts, slow password hashing, strong passwords, and protecting the hash store.

Salt is stored and non-secret; pepper is secret and not left openly in the database.

## What You Must Know

- Why storing cleartext passwords is unacceptable.
- What salts, peppers, and stretching do, and why salts prevent reuse of precomputed rainbow tables across users.
- The named key-stretching algorithms: **PBKDF2**, **bcrypt**, **scrypt**, **Argon2**.
- That **key stretching defends only against offline guessing** — online guessing is rate-limited by the server, so per-guess slowness on the server is a self-DoS.
- The difference between online and offline guessing attacks.
- Why rate limiting mainly helps against online guessing, not offline database cracking.

## 30-Second Oral Answer

- Hashing alone is not enough; you need salts and slow verification to resist offline attacks well.
- Online and offline guessing are different threat models and need different defenses.
- A salt is public uniqueness; a pepper is hidden extra secrecy.

## Typical Exam Questions

- Why do salts prevent precomputed dictionary attacks?
- Why does password stretching help?
- What is the difference between online and offline password guessing?
- What side effect can rate limiting have on legitimate users?

## Common Pitfalls

- Saying salts are secret by definition.
- Claiming rate limiting prevents offline cracking after a database leak.
- Treating peppers as replacements for salts rather than as different tools.
## Worked Examples

### Offline vs online contrast

If an attacker steals the password hash file, they can test guesses locally without server interaction. That is offline guessing.

If the attacker must submit guesses to the real login page and wait for success/failure responses, that is online guessing.

## Related Concepts

- [[Hash Functions, Collision Resistance, and Digital Signatures|Hash Functions, Collision Resistance, and Digital Signatures]]
- [[OTPs, Tokens, Biometrics, and Derived Passwords|OTPs, Tokens, Biometrics, and Derived Passwords]]
- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 03 — User Authentication Methods.pdf](../Materials/01 Lectures/Lecture 03 — User Authentication Methods.pdf)
- [Tutorial 3.pdf](../Materials/02 Tutorials/Tutorial 3.pdf)
- [Tutorial 3 Solution.pdf](../Materials/02 Tutorials/Tutorial 3 Solution.pdf)
