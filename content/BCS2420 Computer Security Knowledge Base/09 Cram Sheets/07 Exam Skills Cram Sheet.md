---
tags:
  - university
  - bcs2420
  - computer-security
  - cram-sheet
---

# 07 Exam Skills Cram Sheet

Morning-of-exam scan sheet. Dense facts, formulas, acronyms.

## Exam Structure

- **120 minutes total**, closed-book, allowed: pen + DACS-approved calculator.
- **Part A** — 12 multiple-choice questions.
- **Part B** — 3 short essay questions.
- **Part C** — 3 longer essay / problem questions.
- Total 18 items, must pass exam (>55%) for project (25%) to count.

## Time Budget

| Section | Count | Per-question | Total |
|---|---|---|---|
| Part A (MC) | 12 | ~3 min | 36 min |
| Part B (short essay) | 3 | ~10 min | 30 min |
| Part C (longer essay) | 3 | ~15 min | 45 min |
| Buffer | — | — | ~9 min |

- First pass on Part A (highest marks/min). Mark & move on if >3 min.
- Tackle Part C before B if scenarios look familiar.
- Reserve last 9 min for flagged items and to double-check name/ID on every page.

## Multiple-Choice Sanity Checklist

- Eliminate impossible distractors first. Reversed-direction claims (e.g. "RSA is faster than AES for bulk") are usually wrong by construction.
- Watch for absolute quantifiers: "always", "only", "never", "guarantees", "no offline attacks possible" — these are usually traps.
- **STRIDE** questions: map first to the letter (S/T/R/I/D/E), then to the answer.
- **"Best reason"** questions: pick the most directly causal option.
- **"Fundamental difference"** questions: state the defining structural property, not a peripheral consequence.

## Answer Templates

### Theory question — Define → Mechanism → Attack → Defense → Tradeoff

1. **Define** the concept precisely.
2. **Mechanism** — explain how it works.
3. **Attack** — name the failure mode it addresses.
4. **Defense** — state the control.
5. **Tradeoff** — note residual limitation.

### Scenario essay — Policy → Mechanism → Defense

1. Identify which **security property/policy** is violated (C / I / A / authenticity / non-repudiation / authorization).
2. Explain the **attack mechanism** step-by-step in the scenario's terms.
3. Propose a **concrete defense** and state which property it restores.

### Calculation — Formula → Substitution → Number → Interpretation

1. Write the formula symbolically.
2. Substitute values explicitly.
3. Compute with units.
4. **Interpret** what the number means operationally and what action it supports.

## Past-Exam Essay Topics — Model Skeletons

### Security Policy + Threat Modeling

- Define security policy (statement of allowed/disallowed).
- An attack = intentional attempt to violate policy.
- Apply STRIDE per component OR Diagram-Driven (DFD + trust boundaries, 5 steps).
- Identify residual risk via `R = T * V * C`.

### Online vs Offline Password Attacks + Offline-Specific Defense

- Online = guesses sent to live server → defend with rate limiting, lockouts, MFA.
- Offline = attacker has hash file, tests locally → defend with:
  - **Salts** (defeat rainbow tables, per-user uniqueness).
  - **Stretching** with bcrypt / scrypt / Argon2 / PBKDF2 (slow each guess).
  - **Pepper** (secret not in DB).
  - Strong passwords + protect hash store.
- **Key stretching defends ONLY offline** — per-guess slowness on server = self-DoS.

### X.509 Fields + Why Signature Prevents Impersonation (past Part B Q3)

- List 9 fields: Version, Serial-Number, Issuer, Validity-Period, Subject, Public-Key Info, Extension fields, Signature-Algorithm, Digital-Signature.
- CA's 3 pre-issuance checks: proof of private-key possession, control of computer-addressable identity, confirmation of natural-world name.
- Signature prevents impersonation because:
  1. Tampering any field → recomputed hash ≠ signature → verification fails.
  2. Forging a fresh signature → requires CA's private key (signature hardness).
  3. Tricking CA into issuing for wrong identity → blocked by 3 pre-issuance checks.

### Trojan vs Worm (past Part C Q1)

Two axes:
- **User interaction**: Trojan needs user to launch (deception); worm doesn't.
- **Propagation**: Trojan uses social deception (fake updates); worm uses autonomous network exploitation of software vulnerabilities.
- Model: "Trojan = user-mediated execution + social deception; Worm = autonomous + technical vulnerability exploitation."

### Kernel Rootkit Recovery — 2-Step (past Part C Q2)

- **Step 1 — Boot from trusted clean medium and rebuild**:
  - Live system can't audit itself (rootkit hooks the very interfaces).
  - Power down → rescue medium → reinstall OS from verified installer.
  - Restore data from **offline** backups only.
- **Step 2 — Close entry path + enable cryptographic boot integrity**:
  - Patch the entry vulnerability before re-exposing host.
  - Enable **Secure Boot** + **code-signing for kernel modules**.
  - Blocks future unsigned-LKM / bootkit installations.

### Signed Diffie-Hellman: Forward Secrecy + Authenticity (past Part C Q3)

- Countermeasure: each side signs ephemeral DH public value with long-term identity signing key.
- **Authenticity**: substituted shares fail signature verification → MITM blocked.
- **Forward secrecy**: ephemeral exponents `a, b` discarded after session. Compromise of long-term signing key cannot recover past `K`:
  - Long-term key only signs, never encrypts.
  - `K = g^(ab) mod p` derived purely from ephemerals.
  - Attacker still faces DLP from recorded `g^a, g^b`.
- Essential separation: long-term key authenticates *who is speaking now*; ephemeral DH determines *the secret protecting this session*.

## Highest-Yield Recall Anchors

- **CIA** + authentication + authorization + accountability + non-repudiation.
- **R = T * V * C**.
- **STRIDE** — Spoofing/Tampering/Repudiation/Info Disclosure/DoS/Escalation; each maps to one violated property.
- Passive vs active adversary; COA / KPA / CPA / CCA.
- OTP perfect-secrecy conditions: truly random, ≥ message length, used once.
- **ECB / CBC / CTR / OFB** modes.
- **AES**: blocklength 128, keylength 128/192/256, Rijndael, KU Leuven.
- **DES**: 56-bit, deprecated.
- Hash properties: one-wayness / second-preimage / collision-resistance.
- MAC = no non-repudiation; signature = non-repudiation.
- **9 X.509 fields** (memorise).
- **Hybrid encryption 3 steps**: generate `k`, `E_k(m)`, `E_{e_B}(k)`.
- Auth vs ID vs authz.
- Salt vs pepper vs stretching. **PBKDF2 / bcrypt / scrypt / Argon2**.
- Online vs offline guessing.
- TVPs = nonces + timestamps + sequence numbers.
- Replay / reflection / relay / interleaving / forward search / pre-capture.
- DH: `K = g^(ab) mod p`, DLP.
- Signed-DH preserves FS because ephemerals are discarded.
- 3 SSO types: CM / Enterprise / Federated (SAML, OAuth, OIDC).
- Implicit vs explicit key auth.
- Virus / worm / trojan / ransomware / rootkit / keylogger / botnet.
- Virus lifecycle: Dormancy → Propagation → Trigger → Payload.
- Polymorphic = mutating decryptor + fixed body. Metamorphic = body rewriting.
- 3 syscall hijacking: Hooking / Overwriting / Substituting. Targets: SSDT (kernel) / IAT (user) / ntdll.
- 5 rootkit install: LKM / vuln exploit / bootkit / memory swap / DMA.
- Ransomware = hybrid AES + RSA; per-file k, per-victim (e_v, d_v), master (e_r, d_r).
- 3 botnet C2: client-server / P2P / multi-tier.
- Stored / reflected / DOM-based XSS.
- CSP `default-src` / `script-src` / nonce — blocks **execution**, not injection.
- CSRF + token + SameSite.
- SQL injection → prepared statements (`?`).
- Default-deny vs default-allow → failure modes.
- 4 firewall types: packet / stateful / proxy / application.
- DMZ + bastion + dual-homed.
- IDS vs IPS; HIDS vs NIDS; signature/anomaly/specification.
- Confusion matrix: TPR / FPR / AP / TNR / FNR.
- Base-rate problem.
- SYN flood + SYN cookies; Smurf + BCP38.
- ARP spoofing + DAI; DNS poisoning + DNSSEC.
- MITM layers: LAN / DNS / wireless / transport.
- WLAN: SSID/BSSID/ESSID; rogue AP; disassociation hijack.
- SSH: 3 sub-protocols, 3 client auth methods.
- TLS = transport, IPsec = network, SSH = application.

## Common Pitfalls

- Answering with only definitions, no mechanism.
- Computing a number with no interpretation.
- Listing 2 botnet architectures (there are 3).
- Inverting polymorphic and metamorphic.
- Claiming MAC gives non-repudiation.
- Saying CSP prevents injection (it prevents execution).
- Treating MITM as one attack instead of naming the layer + mechanism.
- Calling MAC "encryption" or signature "for confidentiality".
- Forgetting Step 2 of rootkit recovery (patch + Secure Boot).
- Listing the 9 X.509 fields in wrong order or omitting `Serial-Number` / `Signature-Algorithm`.
- Saying "I have backups" without specifying **offline**.
- Saying salts are secret (they're not — uniqueness, not secrecy).
- Saying default-allow can be made equally safe with a few deny rules.
