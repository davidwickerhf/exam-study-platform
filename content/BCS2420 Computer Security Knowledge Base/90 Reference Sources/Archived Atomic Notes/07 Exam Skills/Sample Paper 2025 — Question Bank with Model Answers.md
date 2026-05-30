---
tags:
  - university
  - bcs2420
  - computer-security
  - exam-skills
  - past-paper
---

# Sample Paper 2025 — Question Bank with Model Answers

> [!abstract] Why this note matters
> - This is the single most exam-relevant artifact in the knowledge base.
> - It contains all 14 questions from the 2025-03-21 sample paper with correct answers, brief justifications, and direct links to the notes that cover each topic.
> - Use it as the spine of the final review pass: if you cannot reproduce both the answer and the reasoning, jump to the linked note.

## Exam Focus

- Tier 0 priority — past-exam signal is the strongest predictor of future question style.
- 12 Part A multiple-choice, 3 Part B short essays, 3 Part C longer problem-solving.
- Time budget: 120 minutes total (see [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]] for the strategy).

## Part A — Multiple Choice (12 questions)

### A1. STRIDE threat-modeling method

**Correct answer:** (b) STRIDE stands for Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Escalation of Privilege and helps ensure common threats are not overlooked.

**Why:** STRIDE is a six-letter mnemonic. Each letter maps to a category of threat and to the security property it violates (S→authenticity, T→integrity, R→non-repudiation, I→confidentiality, D→availability, E→authorization). The other options misstate scope or compatibility.

**Covered in:** [[Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]

### A2. Risk equation — meaning of V

**Correct answer:** (c) The probability that the system, if attacked, will be successfully compromised.

**Why:** In `R = T * V * C`, V is the conditional probability of successful compromise given an attack attempt — it captures the system's weakness, not money, attacker skill, or remediation cost.

**Covered in:** [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]

### A3. Adversary attribute for technical means and skill

**Correct answer:** (d) Capabilities.

**Why:** Among the five adversary attributes (Objectives, Methods, Capabilities, Funding Level, Outsider vs Insider), Capabilities denotes the resources, knowledge, and technical proficiency available to the attacker. Methods describes the techniques used; Capabilities describes what they are able to do.

**Covered in:** [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]

### A4. Symmetric vs public-key cryptography

**Correct answer:** (c) Symmetric systems require a pre-shared secret for both encryption and decryption, while public-key systems use separate public and private keys.

**Why:** This is the defining structural difference. Distractor (a) inverts the key-size relationship; (b) is the opposite of reality (asymmetric is slow on bulk data); (d) ignores that asymmetric is widely used for key exchange.

**Covered in:** [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]

### A5. Stream ciphers

**Correct answer:** (c) They encrypt data one bit/character at a time, often combined with a keystream generator.

**Why:** Stream ciphers operate symbol-by-symbol in lockstep with a keystream (typically XOR). Distractor (a) describes block mode; (b) overstates pad length; (d) describes a CBC-like dependency that stream ciphers do not need.

**Covered in:** [[Stream Ciphers vs Block Ciphers — Formal Definitions|Stream Ciphers vs Block Ciphers — Formal Definitions]]

### A6. Why hash before signing

**Correct answer:** (b) To reduce the data length for faster signature operations and to detect any message alteration.

**Why:** Public-key signing is expensive and bounded by key/modulus size; signing a short fixed-length digest is faster and more practical. The hash also acts as an integrity check — any modification changes the digest, invalidating the signature.

**Covered in:** [[Hash Functions, Collision Resistance, and Digital Signatures|Hash Functions, Collision Resistance, and Digital Signatures]]

### A7. Random per-user salt

**Correct answer:** (c) It prevents the use of precomputed hash tables (rainbow tables) across multiple users.

**Why:** Per-user salt forces the attacker to build a separate table per account, defeating amortized precomputation. It does not speed up login, eliminate offline attacks, or invert the hash.

**Covered in:** [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

### A8. Slowing offline password guessing

**Correct answer:** (b) Using a specialized key-stretching algorithm with salts and high iteration counts.

**Why:** Key stretching (PBKDF2, bcrypt, scrypt, Argon2) multiplies the cost of each guess by the iteration count, directly increasing attacker time. Account lockout (a) is an online-only defense; (c) reduces entropy; (d) is security through obscurity.

**Covered in:** [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

### A9. Passive vs active attacker

**Correct answer:** (b) A passive attacker attempts to observe traffic, whereas an active attacker may inject or modify data.

**Why:** This is the textbook distinction: passive = read-only eavesdrop; active = read and write (inject, modify, drop, replay). The other options conflate the categories with unrelated capabilities.

**Covered in:** [[Attack Models and Adversary Capabilities|Attack Models and Adversary Capabilities]]

### A10. Default-allow firewall policy

**Correct answer:** (b) It allows traffic by default, creating a risk that unrecognized services remain accessible.

**Why:** Default-allow is the permissive posture: anything not explicitly blocked is permitted, so newly exposed services slip through. Default-deny is the secure-by-default opposite.

**Covered in:** [[Firewall Policy Design, Bastion Hosts, and Port Knocking|Firewall Policy Design, Bastion Hosts, and Port Knocking]]

### A11. Forum comment XSS

**Correct answer:** (b) Stored cross-site scripting.

**Why:** The payload is persisted on the server (in the comment) and served to every visitor who loads that page. Reflected XSS would bounce off a single request; CSRF tricks a logged-in user into issuing a request; DNS cache poisoning is name-resolution tampering.

**Covered in:** [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]

### A12. Man-in-the-middle illustration

**Correct answer:** (b) An attacker intercepts key exchange messages and substitutes public keys, relaying data so both endpoints believe they communicate directly.

**Why:** The classic MITM signature: the attacker sits on the path, terminates each endpoint's session, and forwards transformed traffic. The other options describe offline brute force, physical access, and cross-origin leakage respectively.

**Covered in:** [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

## Part B — Short Essays (3 questions)

### B1. Formal security policy and threat modeling

**Question:** Explain how a formal security policy helps guide threat modeling. Why can a policy violation lead to a non-secure state? Provide an example.

**Model answer:** A formal policy enumerates permitted and forbidden actions, fixing the boundary between secure and non-secure states. Threat modeling then enumerates threats whose realization would cross that boundary — without a policy there is no anchor for "violation." Any successful policy violation places the system in a non-secure state by definition. Example: a policy stating "only the finance group may modify financial records" makes any unauthorized write to those records a non-secure state, regardless of whether data is corrupted.

**Covered in:** [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]], [[Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]

### B2. Online vs offline password guessing

**Question:** Define how online password guessing differs from offline. Identify one defense for offline attacks and explain why it does not help against online attacks.

**Model answer:** Online guessing sends each attempt to the live server, which sees and can throttle it. Offline guessing happens locally on a stolen hash file with no server in the loop. Key stretching (PBKDF2/bcrypt with high iteration counts) defends against offline attacks by making each hash computation expensive — millions of guesses per second become hundreds. It does not stop online attacks because the server already enforces rate limits and lockouts; the per-guess cost is dwarfed by the per-attempt network round trip, and the attacker is bottlenecked by the server's response policy, not by hashing speed.

**Covered in:** [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

### B3. X.509 certificate fields and issuer signature

**Question:** Summarize the key X.509 fields binding name to public key. Why is the issuer signature essential against impersonation?

**Model answer:** An X.509 certificate binds an identity to a key via five core fields: Subject (the entity name), Subject Public Key (and algorithm parameters), Issuer (the CA), Validity Period (Not-Before and Not-After), and the CA's Digital Signature over the rest of the certificate. The issuer signature is the trust anchor: anyone holding the CA's public key can verify the certificate has not been forged or modified. Without it, an attacker could trivially create a certificate claiming any subject name with an attacker-controlled key, and clients would have no way to detect the substitution.

**Covered in:** [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]]

## Part C — Longer Problem Solving (3 questions)

### C1. Trojan horse vs worm

**Question:** Outline how a Trojan horse differs from a worm in terms of user interaction and propagation.

**Model answer:** A Trojan horse is malware disguised as a benign or desirable program. Propagation requires the user to download and execute it — propagation is social, not autonomous. A worm propagates automatically by exploiting network or software vulnerabilities, scanning for new targets and replicating without user assistance. The axes are: user interaction (Trojan requires it; worm does not) and propagation mechanism (Trojan piggybacks on legitimate-looking distribution; worm uses self-propagating exploitation). A Trojan typically delivers a payload to one host; a worm fans out across many hosts on its own.

**Covered in:** [[Malware Taxonomy, Delivery Paths, and Botnets|Malware Taxonomy, Delivery Paths, and Botnets]]

### C2. Kernel-mode rootkit

**Question:** (a) How does hooking or overwriting system calls let a rootkit hide files and processes? (b) Propose two steps to remove it and reduce reinfection risk.

**Model answer:** A kernel-mode rootkit modifies kernel data structures or rewrites system call entries (e.g., the system call table, the VFS layer, or `readdir`/`getdents` and process-list calls). When a tool like `ls` or `ps` queries the kernel, the hooked code filters the result to exclude attacker-owned files or processes before returning. Detection from the compromised host fails because every observation channel runs through the same poisoned kernel. Remediation: (1) boot the machine from a trusted, clean medium — a known-good rescue disk or fresh installation media — and reinstall the operating system from verified images so all kernel hooks are wiped; (2) patch the exploited entry vulnerability and enable Secure Boot plus driver/code signing, so future unauthorized kernel modifications are blocked at load time and detected if attempted.

**Covered in:** [[Rootkits, Hooking, DKOM, and Stealth Analysis|Rootkits, Hooking, DKOM, and Stealth Analysis]], [[System Hardening, Vulnerability Reduction, and Secure Configuration|System Hardening, Vulnerability Reduction, and Secure Configuration]]

### C3. Unauthenticated Diffie-Hellman

**Question:** A chat app uses Diffie-Hellman without authenticating each party's public share. How could an attacker mount MITM? Propose one countermeasure that preserves forward secrecy and ensures authenticity.

**Model answer:** Without authentication, the attacker on the network path intercepts Alice's public share `g^a` and substitutes `g^m`, then intercepts Bob's `g^b` and substitutes `g^m'`. Alice computes a shared secret with the attacker (`g^am`), Bob computes a different shared secret with the attacker (`g^bm'`), and the attacker decrypts, reads, and re-encrypts every message in transit. Both endpoints believe they share a key with each other. Countermeasure: each side signs its ephemeral DH public share with its long-term identity private key, and verifies the peer's signature using the peer's certified long-term public key. This preserves forward secrecy because the ephemeral exponents `a` and `b` are discarded after the session, so compromise of the long-term signing key later cannot recover the past shared secret `g^ab`. Authenticity is enforced because the attacker cannot forge a valid signature over a substituted share.

**Covered in:** [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]], [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

## How to Use This Note

1. First pass: cover the answer column, attempt each question cold, then check.
2. Second pass: for each question you missed or hesitated on, open the linked note and re-read until you can re-derive the answer.
3. Third pass: practice writing the Part B and C answers in two paragraphs under timer — see [[Part B and C Essay Templates and Model Answers|Part B and C Essay Templates and Model Answers]].

## Related Concepts

- [[Fast Facts, Formulas, and Core Terms|Fast Facts, Formulas, and Core Terms]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]
- [[Part B and C Essay Templates and Model Answers|Part B and C Essay Templates and Model Answers]]

## Sources

- Sample Paper — 2025-03-21 (`Materials/04 Past Exams/Sample Paper — 2025-03-21.pdf`)
- Sample Paper Solution — 2025-03-21 (`Materials/04 Past Exams/Sample Paper Solution — 2025-03-21.pdf`)
