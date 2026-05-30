---
tags:
  - university
  - bcs2420
  - computer-security
---

# Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses

> [!abstract] Why this note matters
> - These labs turn lecture content into concrete attacker-style reasoning problems.
> - They reveal what the course considers practical mastery rather than only recall.

## Overview

Lab 1 is about cryptographic thinking rather than heavyweight implementation. It asks whether a transformation is truly secret, whether a key space is brute-forceable, and what goes wrong when a one-time pad is reused.

Lab 2 shifts to authentication and web mistakes: hidden client-side information, oversharing that makes passwords guessable, leaked one-time codes in HTTP headers, truncated hash weaknesses, and password cracking against leaked database data.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **known-plaintext attack**: Using a known message to recover information about the key or about other encrypted messages.
- **client-side validation**: Checks performed in the browser that do not truly enforce security because the attacker controls the client.
- **information leakage**: Exposure of sensitive values through visible files, headers, or other externally observable channels.

## Detailed Explanation

Lab 1's transformation exercises teach an important discipline: do not call every transformation encryption. Ask whether there is a secret, whether the key space is large enough, and whether the operation is really confidentiality-preserving.

The OTP-reuse challenge is especially instructive because it shows that perfect-secrecy tools fail when used incorrectly. If the same XOR pad is reused, known plaintext from one message can reveal the pad and therefore the other message.

Lab 2 focuses on implementation failure rather than theoretical failure. Client-side validation does not protect secrets because the client can inspect or modify its own code. Public social-media information can collapse the password search space. Hidden response headers can leak one-time codes because headers are visible to traffic inspection and browser tooling.

Together, these labs train you to connect theory to practical exploitation conditions: weak assumptions, leaked context, predictable secrets, and visible transport artifacts.

## How It Works

For weak-transformation analysis, classify the transformation and estimate recovery effort.

For OTP reuse, recover pad information from known plaintext and reuse it against the second ciphertext.

For web/auth problems, check what the client can see, what headers or files leak, and what predictable patterns reduce the guess space.

## What You Must Know

- Why OTP reuse breaks confidentiality.
- Why client-side validation is not real security.
- Why leaked headers, hidden files, and overshared personal details can break authentication.
- Why predictable password formulas are still weak even if they look complex.

## 30-Second Oral Answer

- Lab 1 is about classifying transformations and reasoning like an attacker about key space and OTP reuse.
- Lab 2 is about implementation mistakes: client-visible secrets, predictable passwords, leaked authentication data, and weak hash practices.

## Typical Exam Questions

- Why does OTP reuse fail?
- Why is client-side validation insecure?
- How can a response header leak a one-time code?
- Why do predictable password formulas fail even when users think they are clever?

## Common Pitfalls

- Treating hidden client-side data as server-side secrecy.
- Calling OTP secure without checking whether the pad was reused.
## Challenge-by-Challenge Breakdown

### Lab 1 Challenge 1 — Multi-step Transformations

Five lines, each a different transformation of one flag fragment. The task is to classify each transformation (Base64, hex, Caesar shift, ROT-style, simple substitution, etc.) and reverse it. Teaches the difference between encoding (no secret, freely reversible) and encryption (requires a key).

### Lab 1 Challenge 2 — One-Time Pad Misuse

Two ciphertexts use the same XOR pad. With one known plaintext, the pad is recovered as `pad = plaintext XOR ciphertext1`, then `plaintext2 = ciphertext2 XOR pad`. OTP is information-theoretically secure if used correctly; reusing the pad collapses the guarantee. This is the canonical known-plaintext attack.

### Lab 1 Challenge 3 — The Penguin (ECB block leakage)

A reference to the well-known "ECB penguin" image. A file is encrypted with a block cipher in ECB mode and then re-encoded. Because ECB encrypts each block independently with no chaining, identical plaintext blocks produce identical ciphertext blocks, so spatial structure in the original file (e.g., the large flat regions of a bitmap) survives encryption visibly. The lesson is mode-of-operation choice: confidentiality of the algorithm is not enough if the mode leaks structure. Workflow: decode the outer transformation, identify the original file format from the header, and visually inspect the result — patterns that should not be visible reveal both the mode flaw and the hidden flag.

### Lab 1 Challenge 4 — Modified Vigenère, partial key recovery with positional drift

Classical Vigenère with a key length of 4. Three of the four key characters are known. A "positional drift" modifies the shift at each position (a deterministic add-on tied to position index). With three positions fixed, the unknown position only needs to be searched across the 26-letter alphabet — 26 candidate decryptions, ranked by English-language likeness or by recognizing the flag prefix in the output. The teaching point: partial knowledge of a short key reduces effective key space catastrophically, and predictable positional modifications add no real security because they are deterministic and reversible.

### Lab 1 Challenge 5 — The Generator of Keys (binary reverse engineering)

A compiled binary `program` and a server share the same validator. Load `program` in Ghidra or Binary Ninja, run auto-analysis, find the validator function, and read the decompiled C-like view. Identify the constraints: length, character-set, positional equalities, checksum. Translate the constraints into a small Python search and submit candidates to the server. The course point: custom key validation is risky because reverse engineering exposes the rules — security through obscurity fails. See [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]] for the Ghidra workflow.

### Lab 2 Challenge 1 — Insecure Login

Credentials are reachable from the client-side bundle. DevTools → Sources reveals a hidden file or a hardcoded value left in the JavaScript by a developer. Client-side validation never provides real security because the attacker controls the client.

### Lab 2 Challenge 2 — TMI on Social Media

A user's public profile leaks the components of their password (pet name + date of birth + favorite number, etc., in a predictable order). Reconstruct the password from the profile and log in. Predictable formulas defeat complexity policies; oversharing collapses the dictionary search.

### Lab 2 Challenge 3 — Single Sign-On Secret Header

The 2FA / SSO one-time code is sent in a custom HTTP response header rather than a secure side channel. Submit the initial credentials, capture the response in DevTools → Network or in Burp's HTTP history, extract the leaked code from the response headers, and reuse it to complete authentication. The teaching point: HTTP headers are not a secure channel for secrets — any proxy, browser tool, or network observer sees them. A 2FA code must travel over a separate authenticated channel (SMS, authenticator app, hardware token), not be returned inline.

### Lab 2 Challenge 4 — MD5 Truncated-Hash Collision

The server validates integrity using only the first 7 hex characters of MD5 — 28 bits of effective entropy ($16^7 \approx 268$ million possibilities). Connect with `nc`, note the required prefix and target 7-hex-char value, and run a Python brute-force loop that iterates candidates until `md5(prefix + suffix).hexdigest()[:7] == target`. Completes in seconds on a laptop. The lesson: truncating a cryptographic primitive destroys its security margin — 28 bits is brute-forceable, period. SHA-256 truncated similarly would have the same problem. See [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]] for the script.

### Lab 2 Challenge 5 — Full chain: robots.txt → MySQL dump → John → admin login

The full kill chain in one challenge:

1. Read `/robots.txt` — it lists paths the admin asked Google not to index, which often include the database admin interface or a backup file with credentials.
2. Use the leaked DB host and credentials with the MySQL client to dump the `users` table: `SELECT username, password_hash FROM users WHERE role='admin';`.
3. Feed the recovered hashes to John the Ripper with the provided wordlist: `john --wordlist=passwords.txt --format=raw-sha1 hashes.txt`. Salted SHA-1 still falls quickly to a small wordlist when passwords follow date patterns.
4. Log in to the web app as admin with the cracked password; collect the flag.

This challenge is the most exam-relevant of Lab 2: it chains five separate failures (sensitive paths in robots.txt, weak DB ACLs, weak hash choice, predictable passwords, single-factor admin auth). Each is independently a bad practice. Tie back to [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]] for why adaptive hashes (bcrypt, Argon2) would have changed the outcome.

## Related Concepts

- [[Encryption, Decryption, Key Space, and Exhaustive Search|Encryption, Decryption, Key Space, and Exhaustive Search]]
- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]
- [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra|Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lab 1 — Confidentiality.pdf](Materials/03 Labs/Lab 1 — Confidentiality.pdf)
- [Lab 2 — Confidentiality and Authentication.pdf](Materials/03 Labs/Lab 2 — Confidentiality and Authentication.pdf)
