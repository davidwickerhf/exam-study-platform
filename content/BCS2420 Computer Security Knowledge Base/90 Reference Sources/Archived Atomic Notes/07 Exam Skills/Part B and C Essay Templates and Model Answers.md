---
tags:
  - university
  - bcs2420
  - computer-security
  - exam-skills
  - essay-templates
---

# Part B and C Essay Templates and Model Answers

> [!abstract] Why this note matters
> - Parts B and C carry more marks per question than the multiple choice and reward structured answers, not stream-of-consciousness lists.
> - This note pairs each past-exam essay with a 3–5 line skeleton (Define → Mechanism → Defense/Tradeoff) and a full 100–200 word model answer.
> - Internalize the skeletons first, then drill the model answers under timer.

## Exam Focus

- Tier 0 priority for Parts B (3 short essays, ~10 min each) and C (3 longer problems, ~15 min each).
- Always structure: state what the concept is → explain how the mechanism works → name the attack or violation → propose the defense → if relevant, name the tradeoff.
- Avoid: bullet dumps with no glue, single-sentence answers, definitions without mechanisms.

## Universal Skeletons

**Theory question (Define → Mechanism → Attack → Defense → Tradeoff):**
1. Define the concept precisely (one sentence, using course vocabulary).
2. Explain the underlying mechanism (how it works step by step).
3. Identify the attack or failure mode this concept addresses or enables.
4. Name the defense or mitigation (one concrete control).
5. Mention the tradeoff or remaining risk (one sentence).

**Scenario essay (Identify → Explain → Propose):**
1. Identify which policy, property, or assumption is violated.
2. Explain the mechanism that allows the violation step by step.
3. Propose the defense, naming the specific control and what property it restores.

## Part B Essays

### B1. Formal Security Policy and Threat Modeling

**Skeleton:**
1. Define a formal security policy as the explicit list of permitted and forbidden actions.
2. Explain that threat modeling uses the policy to enumerate violations attackers might cause.
3. Note that "non-secure state" is defined relative to the policy.
4. Give a concrete example tying policy clause → violation → non-secure state.

**Model answer:**
A formal security policy is the explicit definition of permitted and forbidden actions in a system. It anchors threat modeling by giving the analyst a fixed boundary: every threat to enumerate is one that, if realized, would violate a clause of the policy. Without a policy there is no defined "non-secure state," so threat enumeration becomes subjective. A policy violation by definition places the system in a non-secure state because the policy is the operational meaning of "secure." Example: a healthcare system's policy states "only members of the clinical group may read patient records." A SQL-injection bug that lets an outsider read records is a non-secure state — not because data was corrupted, but because the policy clause governing read access was broken. Threat modeling using STRIDE would have flagged Information Disclosure on the records endpoint, prompting the input-validation control that prevents the violation.

**Covered in:** [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]], [[Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]

### B2. Online vs Offline Password Guessing

**Skeleton:**
1. Define online guessing as attempts against the live authentication endpoint.
2. Define offline guessing as local hashing attempts against a stolen credential file.
3. Name PBKDF2/bcrypt/Argon2 with high iteration counts as the offline-specific defense.
4. Explain that iterated hashing does not help online because the bottleneck is the server's rate-limit policy, not per-guess cost.

**Model answer:**
Online password guessing requires the attacker to submit each candidate to the legitimate authentication server, which observes and can throttle, lock, or alert on failed attempts. Offline guessing happens after the attacker has stolen the hashed password file: they hash candidates locally at full hardware speed with no server in the loop. The standard offline defense is key stretching — PBKDF2, bcrypt, scrypt, or Argon2 with a high iteration count and per-user salt — which multiplies the cost of each guess so that billions of attempts per second become thousands. This defense is largely ineffective against online attacks because the binding constraint is not per-guess CPU time but the server's policy: account lockout after N failed attempts, exponential back-off, and CAPTCHA already cap the rate at a few guesses per minute. Adding 100ms of hashing has negligible effect when the attacker is already limited to one attempt every ten seconds by the server's rate limit.

**Covered in:** [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

### B3. X.509 Certificate Fields and Issuer Signature

**Skeleton:**
1. List the five core fields that bind name to key: Subject, Subject Public Key, Issuer, Validity Period, CA Digital Signature.
2. Explain that the signature is taken by the CA over the entire body of the certificate.
3. Explain that verification with the CA's known public key proves both integrity and origin.
4. Name impersonation as the attack defeated by this signature.

**Model answer:**
An X.509 certificate binds an identity to a public key through five core fields: the Subject (the entity name being certified), the Subject Public Key (with its algorithm parameters), the Issuer (the Certification Authority that vouches for the binding), the Validity Period (Not-Before and Not-After dates), and the CA's Digital Signature over the rest of the certificate. The issuer signature is essential against impersonation because it is the only field that prevents arbitrary forgery: a relying party verifies the signature with the CA's known public key, confirming both that the binding is endorsed by a trusted authority and that no field has been modified since signing. Without the signature, anyone could mint a certificate claiming the name "bank.example.com" with their own public key, and clients would have no way to distinguish a genuine binding from an attacker's fabrication. The CA's signature reduces the trust problem to the much smaller question of which root CAs to trust.

**Covered in:** [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]]

## Part C Essays

### C1. Trojan Horse vs Worm

**Skeleton:**
1. Define a Trojan as malware disguised as a legitimate program, requiring user action to execute.
2. Define a worm as self-propagating malware exploiting network or software vulnerabilities.
3. Contrast on the user-interaction axis: Trojan needs it, worm does not.
4. Contrast on the propagation axis: Trojan rides legitimate distribution channels, worm self-replicates.

**Model answer:**
A Trojan horse is malicious code disguised as a benign or desirable program — pirated software, a "free" utility, a fake update — that the user must download and run for the payload to activate. Propagation is social and one-host-at-a-time: each new infection requires a new victim to take a deliberate action. A worm is autonomous malware that propagates by exploiting network-reachable vulnerabilities (unpatched services, weak credentials, code-execution flaws). It scans for vulnerable targets, exploits them remotely, copies itself across, and immediately resumes scanning from the new foothold — no user interaction required. The two malware classes differ on two axes: user interaction (Trojan: required; worm: not required) and propagation (Trojan: piggybacks on the trust the user grants to the host program; worm: leverages the trust the network grants to a reachable service). A Trojan typically installs and serves a backdoor on one host; a worm can compromise thousands of hosts within minutes of release.

**Covered in:** [[Malware Taxonomy, Delivery Paths, and Botnets|Malware Taxonomy, Delivery Paths, and Botnets]]

### C2. Kernel Rootkit Removal

**Skeleton:**
1. Explain hooking: rootkit modifies kernel data structures or syscall entries (system call table, VFS layer, process list).
2. Explain that legitimate userland queries are filtered to omit attacker-owned files and processes.
3. Step 1 of recovery: boot from trusted clean media and reinstall the OS to wipe all kernel hooks.
4. Step 2 of recovery: patch the entry vulnerability and enable Secure Boot plus driver code-signing to block future unauthorized kernel modifications.

**Model answer:**
A kernel-mode rootkit hooks or rewrites system calls and kernel data structures to filter what userland tools can see. The classic mechanism modifies the system call table or the VFS layer so that `getdents` (used by `ls`), the process enumeration syscalls (used by `ps`), and the network socket listings (used by `netstat`) all run through attacker-controlled code that removes entries belonging to the rootkit's files, processes, and connections before returning to the caller. Detection from the compromised host is fundamentally unreliable because every observation channel goes through the poisoned kernel. Recovery requires two steps. First, boot the machine from trusted clean media — a known-good rescue disk or verified installation image — and reinstall the operating system so that every modified kernel structure and persistent hook is wiped. Second, patch the entry vulnerability that allowed the initial compromise, then enable Secure Boot and kernel-driver code signing so that any future attempt to load unsigned or modified kernel code is blocked at load time and logged for investigation.

**Covered in:** [[Rootkits, Hooking, DKOM, and Stealth Analysis|Rootkits, Hooking, DKOM, and Stealth Analysis]], [[System Hardening, Vulnerability Reduction, and Secure Configuration|System Hardening, Vulnerability Reduction, and Secure Configuration]]

### C3. Unauthenticated Diffie-Hellman MITM

**Skeleton:**
1. Sketch the MITM: attacker substitutes its own DH share for Alice's and Bob's, deriving two separate shared secrets.
2. Explain that the attacker decrypts, reads, and re-encrypts in both directions; both endpoints believe they share a key with each other.
3. Countermeasure: sign each ephemeral DH share with a long-term identity key and verify the peer's signature.
4. Explain that forward secrecy is preserved because ephemeral exponents `a` and `b` are discarded — compromising the long-term key later does not recover past `g^ab`.

**Model answer:**
Without authentication of the DH public shares, an active attacker on the network path intercepts Alice's `g^a` and forwards `g^m` to Bob, then intercepts Bob's `g^b` and forwards `g^m'` to Alice. Alice now shares a secret `g^am` with the attacker; Bob shares a different secret `g^bm'` with the attacker. The attacker decrypts every message from each side with the appropriate secret, optionally reads or modifies it, then re-encrypts it under the other secret and forwards. Both Alice and Bob believe they share a confidential key with each other. The countermeasure is to digitally sign each ephemeral DH public share with the sender's long-term identity private key (certified by a CA or pre-distributed), and to require verification of the peer's signature before deriving the shared secret. This preserves forward secrecy because the DH exponents `a` and `b` remain ephemeral and are discarded after the session — later compromise of the long-term signing key cannot retroactively recover the past shared secret `g^ab`, since the signing key is used only to authenticate the exchange, never to encrypt traffic. Authenticity is enforced because the attacker cannot forge a valid signature over a substituted share.

**Covered in:** [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]], [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

## Drill Plan

1. Read each skeleton aloud and reproduce it from memory before looking at the model answer.
2. Write each model answer under a 10-minute (Part B) or 15-minute (Part C) timer, then compare for missing elements.
3. Focus rewrites on the two most underdeveloped sections (usually mechanism and tradeoff).

## Related Concepts

- [[Sample Paper 2025 — Question Bank with Model Answers|Sample Paper 2025 — Question Bank with Model Answers]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]
- [[Fast Facts, Formulas, and Core Terms|Fast Facts, Formulas, and Core Terms]]

## Sources

- Sample Paper — 2025-03-21 (`Materials/04 Past Exams/Sample Paper — 2025-03-21.pdf`)
- Sample Paper Solution — 2025-03-21 (`Materials/04 Past Exams/Sample Paper Solution — 2025-03-21.pdf`)
