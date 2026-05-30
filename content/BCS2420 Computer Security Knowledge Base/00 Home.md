---
tags:
  - university
  - bcs2420
  - computer-security
  - hub
---

# BCS2420 Computer Security Knowledge Base

Course-aligned Obsidian knowledge base for BCS2420 Computer Security (BSc CS Year 2, Period 4, 4 ECTS). Built from the lectures, tutorials, labs, syllabus, and the 2025 sample exam.

## What This Vault Is

- Teaching-first notes that match the lectures slide-by-slide where it matters for the exam.
- Each topic has full notes, a cram sheet, a self test (with answer key), and where applicable a worked drill or essay template.
- Two artefacts are highest-yield for exam day: the [[07 Exam Skills/07 Exam Skills|Sample Paper 2025 Question Bank]] and [[07 Exam Skills/07 Exam Skills|Part B and C Essay Templates]].

## Course Logistics

- 75% closed-book final exam (120 min, calculator + pens only) + 25% project. Must pass the exam for the project to count.
- Exam structure (per 2025 sample): **Part A** = 12 MC, **Part B** = 3 short essays, **Part C** = 3 longer problem-solving.
- See [[01 Foundations and Security Principles/01 Foundations and Security Principles|Course Structure, Assessment, and Exam Rules]] and [[07 Exam Skills/07 Exam Skills|Sample Paper 2025]].

## Study Order

1. **Foundations** — vocabulary, CIA, STRIDE, risk equation. Everything else builds on these.
2. **Cryptography** — encryption, hash, signatures, X.509, RSA. Closed-book exam expects exact definitions.
3. **Authentication and Secure Communication** — passwords, OTPs, DH, signed DH, SSO. Heavy on protocol attacks.
4. **Malware and System Security** — taxonomy, rootkits, ransomware, hardening. Past-exam Part C anchor.
5. **Web and Network Defense** — XSS/CSRF/SQLi, firewalls, IDS, WLAN, MITM. Largest content section.
6. **Labs and Tooling** — concrete tools and forensic methodology, especially `/proc` for rootkit work.
7. **Exam Skills** — model answers, problem patterns, fast facts, time budget.

## Exam Master Checklist

- [ ] **[[01 Foundations and Security Principles/01 Foundations and Security Principles|01 Foundations and Security Principles]]**
    - [ ] CIA triad with concrete examples — and the methods used for each pillar. [[01 Foundations and Security Principles/01 Foundations and Security Principles|Security Goals, Policy, Adversaries, and Risk]]
    - [ ] Goals beyond CIA — Authorization, Authentication, Accountability. [[01 Foundations and Security Principles/01 Foundations and Security Principles|Beyond CIA]]
    - [ ] Risk equation `R = T * V * C` and how controls lower each factor. [[01 Foundations and Security Principles/01 Foundations and Security Principles|Security Goals, Policy, Adversaries, and Risk]]
    - [ ] 5 adversary attributes (Objectives, Methods, Capabilities, Funding Level, Outsider vs Insider) + 7 named adversary groups. [[01 Foundations and Security Principles/01 Foundations and Security Principles|Security Goals, Policy, Adversaries, and Risk]]
    - [ ] Defense in depth, complete mediation, safe defaults, posture. [[01 Foundations and Security Principles/01 Foundations and Security Principles|Defense in Depth, Security Strategy, and Security Posture]]
    - [ ] Insider vs outsider; non-malicious employees as an adversary category. [[01 Foundations and Security Principles/01 Foundations and Security Principles|Human Factors, Insider Threats, and Ethical Security Practice]]
    - [ ] STRIDE letters → security property each violates; Attack Trees; 5-step Diagram-Driven; model-reality gaps. [[01 Foundations and Security Principles/01 Foundations and Security Principles|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]
- [ ] **[[02 Cryptography/02 Cryptography|02 Cryptography]]**
    - [ ] Plaintext, ciphertext, encryption, decryption, key space `|K| = 2^n`, exhaustive search. [[02 Cryptography/02 Cryptography|Encryption, Decryption, Key Space, and Exhaustive Search]]
    - [ ] Attack models — COA / KPA / CPA / CCA; passive vs active. [[02 Cryptography/02 Cryptography|Attack Models and Adversary Capabilities]]
    - [ ] Hash properties: one-wayness, second-preimage, collision resistance; why hash before signing. [[02 Cryptography/02 Cryptography|Hash Functions, Collision Resistance, and Digital Signatures]]
    - [ ] MAC `t = M_k(m)`; MAC vs digital signature table. [[02 Cryptography/02 Cryptography|MACs]]
    - [ ] Symmetric (pre-shared secret) vs asymmetric vs hybrid; 3-step hybrid encryption flow. [[02 Cryptography/02 Cryptography|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
    - [ ] X.509 9 fields; CA's role; why issuer signature prevents impersonation. [[02 Cryptography/02 Cryptography|X.509 Certificates]] ⭐ past Part B essay
    - [ ] RSA: `c = m^e mod n`, `m = c^d mod n`; why asymmetric is slow → motivates hybrid. [[02 Cryptography/02 Cryptography|RSA Basics]]
    - [ ] Stream cipher (bit/char + keystream) vs block cipher (blocklength, padding); DES 56-bit, AES 128/192/256. [[02 Cryptography/02 Cryptography|Stream vs Block Ciphers]]
    - [ ] Vernam / OTP; ECB/CBC/CTR/OFB; why OTP key reuse fails. [[02 Cryptography/02 Cryptography|Vernam Cipher, OTP Misuse, Block Cipher Modes]]
    - [ ] Differential and linear cryptanalysis; confusion vs diffusion. [[02 Cryptography/02 Cryptography|Differential and Linear Cryptanalysis]]
- [ ] **[[03 Authentication and Secure Communication/03 Authentication and Secure Communication|03 Authentication and Secure Communication]]**
    - [ ] Authentication vs identification vs authorization; claimant/verifier; unilateral vs mutual. [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Authentication, Identification, and Authorization]]
    - [ ] Password hashing, salts (rainbow tables), peppers, stretching (PBKDF2, bcrypt, scrypt, Argon2). [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Password Security]]
    - [ ] Online vs offline guessing; offline-specific defenses. [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Password Security]] ⭐ past Part B essay
    - [ ] OTPs, Lamport chains, hardware tokens, biometrics (FAR / FRR / FTE). [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|OTPs, Tokens, Biometrics]]
    - [ ] Replay, reflection, relay, interleaving, forward search, pre-capture; TVPs as umbrella defense. [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Protocols for Secure Communication]]
    - [ ] Diffie-Hellman math (g, p, DLP, `K = g^(ab) mod p`); EKE/DH-EKE notation. [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|DH, EKE, Forward Secrecy]] · [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Protocol Notation]]
    - [ ] Signed DH → forward secrecy AND authenticity (ephemeral exponents discarded; long-term key compromise can't recover past `g^ab`). [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|DH + Forward Secrecy]] ⭐ past Part C essay
    - [ ] Implicit vs explicit key auth; 3 SSO types (Credential Manager, Enterprise, Federated — SAML/OAuth/OIDC). [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Implicit/Explicit Key Auth and SSO]]
    - [ ] Two graphical password schemes; one advantage and one drawback each. [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Graphical Passwords]]
- [ ] **[[04 Malware and System Security/04 Malware and System Security|04 Malware and System Security]]**
    - [ ] Taxonomy: virus / worm / trojan / ransomware / botnet / keylogger / rootkit. [[04 Malware and System Security/04 Malware and System Security|Malware Taxonomy]]
    - [ ] Trojan vs worm — user-interaction + propagation axes. [[04 Malware and System Security/04 Malware and System Security|Malware Taxonomy]] ⭐ past Part C essay
    - [ ] Virus lifecycle (Dormancy → Propagation → Trigger → Payload); historical examples. [[04 Malware and System Security/04 Malware and System Security|Malware Taxonomy]]
    - [ ] Polymorphic = fixed encrypted body + mutating decryptor; Metamorphic = body rewriting. [[04 Malware and System Security/04 Malware and System Security|Polymorphic and Metamorphic Evasion]]
    - [ ] 3 syscall hijacking methods (Hooking / Overwriting / Substituting); SSDT/IAT; DKOM. [[04 Malware and System Security/04 Malware and System Security|Rootkits and Hooking]]
    - [ ] Kernel rootkit recovery: trusted clean boot + OS reinstall, then patch + Secure Boot/code-signing. [[04 Malware and System Security/04 Malware and System Security|Rootkits — Recovery Essay]] ⭐ past Part C essay
    - [ ] Ransomware hybrid AES+RSA, per-victim and master keypairs; WannaCry. [[04 Malware and System Security/04 Malware and System Security|Ransomware]]
    - [ ] 3 botnet C2 architectures with strength/weakness. [[04 Malware and System Security/04 Malware and System Security|Botnets and C2]]
    - [ ] Hardening: patching, least privilege, secure config, code-signing. [[04 Malware and System Security/04 Malware and System Security|System Hardening]]
- [ ] **[[05 Web and Network Defense/05 Web and Network Defense|05 Web and Network Defense]]**
    - [ ] URLs, DNS, HTTP, cookies, DOM, SOP, scheme+host+port triplet. [[05 Web and Network Defense/05 Web and Network Defense|Web Architecture]]
    - [ ] Mixed content, `document.domain`, cookie subdomain scope. [[05 Web and Network Defense/05 Web and Network Defense|Mixed Content + document.domain]]
    - [ ] XSS (stored vs reflected with payload examples); CSRF; SQL injection + prepared statements. [[05 Web and Network Defense/05 Web and Network Defense|XSS, CSRF, SQLi]] ⭐ past Part A MC
    - [ ] CSP directives (default-src, script-src, nonces) — blocks execution, not injection. [[05 Web and Network Defense/05 Web and Network Defense|CSP + Secure File Upload]]
    - [ ] Secure file upload measures. [[05 Web and Network Defense/05 Web and Network Defense|CSP + Secure File Upload]]
    - [ ] Stateless vs stateful firewalls; DMZ; proxy firewalls; SSH port forwarding; tunnel-mode VPN. [[05 Web and Network Defense/05 Web and Network Defense|Firewalls, DMZs, Proxies]]
    - [ ] SSH 3-layer architecture, 3 client auth methods, TLS/IPsec/SSH stack placement. [[05 Web and Network Defense/05 Web and Network Defense|SSH Protocol]]
    - [ ] Default-allow vs default-deny failure modes; bastion; dual-homed; port knocking. [[05 Web and Network Defense/05 Web and Network Defense|Firewall Policy Design]] ⭐ past Part A MC
    - [ ] IDS vs IPS; HIDS vs NIDS; signature vs anomaly vs specification. [[05 Web and Network Defense/05 Web and Network Defense|IDS/IPS/HIDS/NIDS]]
    - [ ] Confusion matrix formulas; base-rate problem; alarm fatigue. [[05 Web and Network Defense/05 Web and Network Defense|IDS Confusion Matrix]]
    - [ ] Promiscuous mode; switched-LAN limits; SPAN/TAP. [[05 Web and Network Defense/05 Web and Network Defense|Packet Sniffing]]
    - [ ] DDoS, false positives, false negatives, low base rates. [[05 Web and Network Defense/05 Web and Network Defense|DDoS + Alarm Quality]]
    - [ ] SYN flooding + SYN cookies; Smurf / amplification. [[05 Web and Network Defense/05 Web and Network Defense|SYN Flooding, Smurf]]
    - [ ] ARP spoofing + mitigations (static, 802.1X, DAI); DNS poisoning + mitigations (source-port + TXID randomization, 0x20, DNSSEC). [[05 Web and Network Defense/05 Web and Network Defense|ARP/DNS Poisoning]]
    - [ ] MITM scenario taxonomy (LAN / DNS / Wireless / Transport). [[05 Web and Network Defense/05 Web and Network Defense|MITM Scenarios]] ⭐ past Part A MC
    - [ ] WLAN: 802.11, SSID/BSSID/ESSID, rogue AP, disassociation hijack. [[05 Web and Network Defense/05 Web and Network Defense|Wireless and WLAN Security]]
    - [ ] IDS evasion techniques and counters; vulnerability scanners + limitations. [[05 Web and Network Defense/05 Web and Network Defense|IDS Evasion + Scanners]]
- [ ] **[[06 Labs and Tooling/06 Labs and Tooling|06 Labs and Tooling]]**
    - [ ] Syllabus tools: Kali, nmap, Wireshark, ethics. [[06 Labs and Tooling/06 Labs and Tooling|Kali, Nmap, Wireshark]]
    - [ ] Lab toolset: DevTools, John the Ripper, git-dumper, Burp, Ghidra, Python brute-force. [[06 Labs and Tooling/06 Labs and Tooling|Web Security Tools]]
    - [ ] `/proc` filesystem and process forensics on Linux. [[06 Labs and Tooling/06 Labs and Tooling|/proc Forensics]] ⭐ supports Part C rootkit essay
    - [ ] Malware persistence and watchdog detection. [[06 Labs and Tooling/06 Labs and Tooling|Malware Persistence]]
    - [ ] Browser DevTools, hidden resources, client-side evidence. [[06 Labs and Tooling/06 Labs and Tooling|Browser DevTools]]
    - [ ] Lab 1 + Lab 2 lessons: OTP reuse, ECB Penguin, modified Vigenère, reverse engineering, MD5 truncated collisions, full leak chain. [[06 Labs and Tooling/06 Labs and Tooling|Lab 1 + Lab 2]]
    - [ ] Lab 3 + Lab 4 lessons: rootkit recon methodology, persistence, SQL injection, XSS→CSRF chaining. [[06 Labs and Tooling/06 Labs and Tooling|Lab 3 + Lab 4]]
- [ ] **[[07 Exam Skills/07 Exam Skills|07 Exam Skills]]**
    - [ ] Walk the 2025 sample paper end-to-end with model answers. [[07 Exam Skills/07 Exam Skills|Sample Paper 2025]] ⭐
    - [ ] Memorise Part B / C essay skeletons for the 6 known essay topics. [[07 Exam Skills/07 Exam Skills|Essay Templates]] ⭐
    - [ ] Internalize answer-pattern templates (Define → Mechanism → Attack → Defense → Tradeoff). [[07 Exam Skills/07 Exam Skills|Tutorial and Exam Problem Patterns]]
    - [ ] Drill the formulas, acronym expansions, and pair contrasts. [[07 Exam Skills/07 Exam Skills|Fast Facts]]

## Highest-Yield Notes (study these first)

- [[07 Exam Skills/07 Exam Skills|Sample Paper 2025 — Question Bank]] — exam-day priority #1.
- [[07 Exam Skills/07 Exam Skills|Part B and C Essay Templates]] — 6 essay model answers.
- [[07 Exam Skills/07 Exam Skills|Fast Facts, Formulas, and Core Terms]]
- [[07 Exam Skills/07 Exam Skills|Tutorial and Exam Problem Patterns]]
- [[01 Foundations and Security Principles/01 Foundations and Security Principles|Security Goals, Policy, Adversaries, and Risk]]
- [[01 Foundations and Security Principles/01 Foundations and Security Principles|STRIDE and Threat Modeling]]
- [[02 Cryptography/02 Cryptography|X.509 Certificates]]
- [[02 Cryptography/02 Cryptography|Symmetric vs Asymmetric vs Hybrid]]
- [[02 Cryptography/02 Cryptography|Hash Functions and Signatures]]
- [[02 Cryptography/02 Cryptography|Stream vs Block Ciphers]]
- [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Password Security]]
- [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|DH + Forward Secrecy]]
- [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Protocols, Replay, Reflection, Relay]]
- [[04 Malware and System Security/04 Malware and System Security|Rootkits — Recovery Essay]]
- [[04 Malware and System Security/04 Malware and System Security|Ransomware]]
- [[05 Web and Network Defense/05 Web and Network Defense|XSS, CSRF, SQL Injection]]
- [[05 Web and Network Defense/05 Web and Network Defense|Firewall Policy Design]]
- [[05 Web and Network Defense/05 Web and Network Defense|IDS Confusion Matrix]]
- [[05 Web and Network Defense/05 Web and Network Defense|MITM Scenarios]]
- [[06 Labs and Tooling/06 Labs and Tooling|/proc Forensics]]

## Section Indexes

- [[01 Foundations and Security Principles/01 Foundations and Security Principles|01 Foundations and Security Principles]]
- [[02 Cryptography/02 Cryptography|02 Cryptography]]
- [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|03 Authentication and Secure Communication]]
- [[04 Malware and System Security/04 Malware and System Security|04 Malware and System Security]]
- [[05 Web and Network Defense/05 Web and Network Defense|05 Web and Network Defense]]
- [[06 Labs and Tooling/06 Labs and Tooling|06 Labs and Tooling]]
- [[07 Exam Skills/07 Exam Skills|07 Exam Skills]]


## Reference Sources

- [[90 Reference Sources/00 Index|Reference Sources Index]]
- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]

## Cram Sheets

- [[01 Foundations and Security Principles Cram Sheet|01 Foundations and Security Principles Cram Sheet]]
- [[02 Cryptography Cram Sheet|02 Cryptography Cram Sheet]]
- [[03 Authentication and Secure Communication Cram Sheet|03 Authentication and Secure Communication Cram Sheet]]
- [[04 Malware and System Security Cram Sheet|04 Malware and System Security Cram Sheet]]
- [[05 Web and Network Defense Cram Sheet|05 Web and Network Defense Cram Sheet]]
- [[06 Labs and Tooling Cram Sheet|06 Labs and Tooling Cram Sheet]]
- [[07 Exam Skills Cram Sheet|07 Exam Skills Cram Sheet]]

## Self Tests (with collapsible answer keys)

- [[01 Foundations and Security Principles Self Test|01 Foundations and Security Principles Self Test]]
- [[02 Cryptography Self Test|02 Cryptography Self Test]]
- [[03 Authentication and Secure Communication Self Test|03 Authentication and Secure Communication Self Test]]
- [[04 Malware and System Security Self Test|04 Malware and System Security Self Test]]
- [[05 Web and Network Defense Self Test|05 Web and Network Defense Self Test]]
- [[06 Labs and Tooling Self Test|06 Labs and Tooling Self Test]]
- [[07 Exam Skills Self Test|07 Exam Skills Self Test]]

## Worked Drills

- [[01 Security Foundations Worked Drills|Security Foundations Worked Drills]]
- [[02 Cryptography and Authentication Worked Drills|Cryptography and Authentication Worked Drills]]
- [[03 Protocol and Network Defense Worked Drills|Protocol and Network Defense Worked Drills]]
- [[04 Web and Malware Worked Drills|Web and Malware Worked Drills]]
- [[05 Lab Mindset Worked Drills|Lab Mindset Worked Drills]]

## Source Materials

Organized under `Materials/`:

- `Materials/01 Lectures/` — Lectures 01-08 (and Lecture 04 Legend notation).
- `Materials/02 Tutorials/` — Tutorials 1-5 + L6-L8 with model solutions.
- `Materials/03 Labs/` — Labs 1-4 (Confidentiality, Confidentiality+Auth, Rootkit Recon, Web Exploitations).
- `Materials/04 Past Exams/` — Sample Paper 2025-03-21 + Solution.

Lecture-to-section mapping:

| Lecture | Topic | Section |
|---|---|---|
| 01 | Introduction and Security Fundamentals | 01 Foundations |
| 02 | Cryptography Basics | 02 Cryptography |
| 03 | User Authentication Methods | 03 Authentication |
| 04 | Authentication and Key Establishment (+ Legend) | 03 Authentication |
| 05 | Malware Threats | 04 Malware |
| 06 | Securing Web Applications | 05 Web/Network |
| 07 | Network Defense, Firewalls, Tunnels | 05 Web/Network |
| 08 | Intrusion Detection and WLAN Security | 05 Web/Network |
