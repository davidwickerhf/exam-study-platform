---
tags:
  - university
  - bcs2420
  - computer-security
  - exam-skills
  - playbook
---

# Topic 07 — Exam Skills

## What the Exam Asks

- Sample paper answer style and model-answer structure.
- Part B/C templates: define, mechanism, attack/failure, defense, trade-off.
- Acronyms, formulas, contrasts, and timing strategy.
- Turn tutorial solution patterns into closed-book answer skeletons.

---


**Past exam coverage:** Sample Paper 2025-03-21 (the only past paper available — every question type used in this playbook traces back to it)
**Source PDFs:** `Materials/04 Past Exams/Sample Paper — 2025-03-21.pdf`, `Materials/04 Past Exams/Sample Paper Solution — 2025-03-21.pdf`

This is the exam playbook. Read it last, in the 48 hours before the exam, after the topic chapters already make sense. Three artifacts to memorise: the question-count split (12/3/3), the STRIDE letter-to-property mapping, and the risk equation $R = T \cdot V \cdot C$ with $V$ read as a conditional probability. Everything else in here is structure for delivering what you already know.

---

## Exam structure

> [!info] Must-know exam parameters
> - **Duration:** 120 minutes (12:00–14:00 on the sample paper).
> - **Format:** Closed-book. Pens and a simple (non-programmable) calculator only.
> - **Question count:** 18 total — 12 Part A multiple choice + 3 Part B short essays + 3 Part C longer problems.
> - **Admin rule:** Name and ID must appear on every page. The sample paper instructions flag this explicitly.

| Section | Questions | Style | Suggested time | Per-question budget |
|---|---|---|---|---|
| **Part A** | 12 | Single-correct multiple choice, four options $(a)$–$(d)$ | 36 min | $\approx 3$ min |
| **Part B** | 3 | Short essay (definition + mechanism + example) | 30 min | $\approx 10$ min |
| **Part C** | 3 | Longer problem (scenario + attack + defence) | 45 min | $\approx 15$ min |
| **Buffer** | — | Review flagged questions, check ID on every page | $\approx 9$ min | — |

> [!tip] Order-of-attack
> First pass Part A — these are the highest marks per minute. Mark any item taking longer than 3 minutes and move on. If Part C scenarios look familiar, do them before Part B: the marginal point is worth more per minute on the longer questions, and they tend to cluster around the major mechanisms (rootkits, MITM, malware classes) which you can either deliver in full or not at all.

---

## Sample paper walkthrough

The sample paper is the only past-paper signal available — treat every question as a template. For each item below: topic the question pins, what the full-marks answer needs, and the chapter that covers it.

### Part A — Multiple choice (12 questions)

| # | Question topic | Correct | What full marks needs | Chapter |
|---|---|---|---|---|
| A1 | STRIDE definition | (b) | Recite the six-letter mnemonic in order: Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Escalation of Privilege | 01 Foundations |
| A2 | Risk equation, meaning of $V$ | (c) | $V$ = conditional probability of successful compromise *given* an attack attempt — not damage, not motivation, not remediation cost | 01 Foundations |
| A3 | Adversary attribute for technical skill | (d) | Capabilities = resources, knowledge, technical proficiency. Distinguish from Methods (techniques) and Funding | 01 Foundations |
| A4 | Symmetric vs public-key | (c) | Symmetric: one pre-shared key for both ops. Public-key: separate public/private. Reject inverted distractors (sym keys larger; PK faster on bulk) | 02 Cryptography |
| A5 | Stream cipher | (c) | Bit/character-at-a-time, in lockstep with a keystream generator. Not block-at-a-time, not infinite-pad | 02 Cryptography |
| A6 | Why hash before signing | (b) | Two reasons: (1) shorten data to speed asymmetric signing, (2) bind to message — any alteration breaks the digest | 02 Cryptography |
| A7 | Per-user salt purpose | (c) | Defeats precomputed rainbow tables across users by forcing one table per account | 03 Authentication |
| A8 | Slowing offline guessing | (b) | Key stretching with salt + high iteration count (PBKDF2, bcrypt, scrypt, Argon2). Reject lockout (online-only), shorter alphabets, port-changing | 03 Authentication |
| A9 | Passive vs active attacker | (b) | Passive = read-only observation. Active = inject or modify. Textbook split — distractors conflate unrelated capabilities | 02 Cryptography |
| A10 | Default-allow firewall | (b) | Permissive posture: traffic flows unless a rule blocks it. Opposite of default-deny | 05 Web and Network Defense |
| A11 | Forum-comment XSS | (b) | Stored XSS — payload persisted server-side, served to every viewer. Reflected = bounces off one request; CSRF = forged action; DNS poisoning = unrelated | 05 Web and Network Defense |
| A12 | MITM illustration | (b) | Interception of key exchange, substitution of public keys, transparent relay. Both endpoints believe they talk directly | 03 Authentication / 05 Web |

### Part B — Short essays (3 questions, $\approx 10$ min each)

**B1 — Formal security policy and threat modelling.** What full marks needs: (1) define a formal policy as the explicit list of permitted/forbidden actions; (2) explain that threat modelling enumerates threats that, if realised, would violate the policy; (3) state that "non-secure state" is defined *relative to* the policy — a violation places the system there by definition; (4) one concrete example tying clause to violation (e.g. "only finance may modify financial records"). Chapter: 01 Foundations.

**B2 — Online vs offline password guessing.** What full marks needs: (1) online = attempts against the live server, which can throttle/lock/alert; (2) offline = local hashing against a stolen hash file, no server in the loop; (3) name the offline-specific defence (key stretching: PBKDF2, bcrypt, scrypt, Argon2 with high iteration counts and per-user salt); (4) explain why it does not help online — the bottleneck online is the server's rate-limit policy, not per-guess CPU cost. Chapter: 03 Authentication.

**B3 — X.509 certificate fields and issuer signature.** What full marks needs: (1) list the five core fields — Subject, Subject Public Key (with algorithm), Issuer, Validity Period (Not-Before / Not-After), CA Digital Signature; (2) explain that the CA's signature is taken over the entire body; (3) verification with the CA's known public key proves both integrity and origin; (4) name impersonation as the attack defeated — without the signature, anyone could mint a certificate for any name. Chapter: 02 Cryptography.

### Part C — Longer problems (3 questions, $\approx 15$ min each)

**C1 — Trojan horse vs worm.** Full marks needs both axes explicitly: (1) **user interaction** — Trojan requires it (user downloads and runs the disguised program), worm does not (autonomous propagation); (2) **propagation mechanism** — Trojan piggybacks on legitimate-looking distribution (one host at a time, social), worm exploits network-reachable vulnerabilities, scans for targets, replicates, immediately resumes scanning. Conclude with consequence: Trojan = one host backdoor; worm = thousands in minutes. Chapter: 04 Malware.

**C2 — Kernel-mode rootkit.** Two-part answer. **(a) Hooking mechanism:** rootkit modifies kernel data structures or rewrites syscall entries (system call table, VFS layer, `getdents` for `ls`, process-enumeration calls for `ps`, socket-list for `netstat`). When userland queries the kernel, the hooked code filters results to omit attacker-owned files/processes/connections before returning. Detection from the compromised host is unreliable because every observation channel runs through the poisoned kernel. **(b) Two removal steps:** (1) boot from trusted clean media (rescue disk or verified install image) and reinstall the OS so every modified kernel structure is wiped; (2) patch the entry vulnerability and enable Secure Boot plus driver/code signing so future unauthorised kernel modifications are blocked at load time. Chapter: 04 Malware.

**C3 — Unauthenticated Diffie-Hellman MITM.** Full marks needs the active-attack mechanism with algebra and a forward-secrecy-preserving countermeasure. **Attack:** attacker intercepts Alice's $g^a$ and forwards $g^m$ to Bob; intercepts Bob's $g^b$ and forwards $g^{m'}$ to Alice. Alice shares secret $g^{am}$ with the attacker; Bob shares $g^{bm'}$ with the attacker. Attacker decrypts and re-encrypts in both directions; both endpoints believe they share a key with each other. **Countermeasure:** each party signs its ephemeral DH share with its long-term identity private key (certified) and verifies the peer's signature before deriving the shared secret. **Why forward secrecy holds:** $a$ and $b$ are ephemeral and discarded after the session; the long-term signing key only authenticates the exchange, never encrypts traffic, so later compromise of the signing key cannot recover past $g^{ab}$. Chapter: 03 Authentication.

> [!warning] Common essay mistakes
> - Stating a definition with no mechanism (loses the "how it works" marks).
> - Mechanism with no defence or tradeoff (loses the closing-credit marks).
> - For C3 specifically: forgetting to explain *why* the countermeasure preserves forward secrecy. Signing the share is not enough — you must say the DH exponents are ephemeral and discarded.

---

## Topic-recognition guide

Map a question's keywords to the chapter that covers it. Built from sample paper coverage plus the Lecture 01–08 syllabus.

| Topic / keyword | Lecture | Chapter |
|---|---|---|
| CIA triad, security policy, non-secure state, risk equation $R = T \cdot V \cdot C$ | L01 | 01 Foundations and Security Principles |
| STRIDE, attack trees, threat modelling, model-reality gap | L01 | 01 Foundations and Security Principles |
| Adversary attributes (Objectives, Methods, Capabilities, Funding, Outsider/Insider) | L01 | 01 Foundations and Security Principles |
| Passive vs active attacker, attack models (COA, KPA, CPA, CCA) | L02 | 02 Cryptography |
| Symmetric vs asymmetric, hybrid encryption, PKI, key space $\lvert K\rvert = 2^n$ | L02 | 02 Cryptography |
| Stream vs block cipher, OTP, ECB / CBC / CTR / OFB modes | L02 | 02 Cryptography |
| Hash functions (preimage, second-preimage, collision resistance), digital signatures, "hash before sign" | L02 | 02 Cryptography |
| RSA, modular exponentiation, why asymmetric is slow, MACs | L02 | 02 Cryptography |
| X.509, certification authorities, certificate fields | L02 | 02 Cryptography |
| Authentication vs identification vs authorisation | L03 | 03 Authentication and Secure Communication |
| Password storage: salt, pepper, key stretching (PBKDF2, bcrypt, scrypt, Argon2), online vs offline guessing | L03 | 03 Authentication and Secure Communication |
| Biometrics (FAR/FRR), OTPs, tokens, graphical passwords | L03 | 03 Authentication and Secure Communication |
| Key transport vs key agreement, Diffie-Hellman, EKE, forward secrecy, MITM on DH | L04 | 03 Authentication and Secure Communication |
| Protocol notation, nonces, replay / reflection / relay attacks, SSO | L04 | 03 Authentication and Secure Communication |
| Malware taxonomy: virus, worm, trojan, ransomware, bots, botnets | L05 | 04 Malware and System Security |
| Polymorphic vs metamorphic malware, rootkits, hooking, DKOM | L05 | 04 Malware and System Security |
| System hardening, secure configuration, Secure Boot, code signing | L05 | 04 Malware and System Security |
| Web architecture, HTTP, cookies, same-origin, mixed content, `document.domain`, cookie scope | L06 | 05 Web and Network Defense |
| XSS (reflected, stored, DOM), CSRF, SQL injection, session defences, CSP | L06 | 05 Web and Network Defense |
| Firewalls (stateless/stateful), default-deny vs default-allow, bastion host, port knocking, DMZ | L07 | 05 Web and Network Defense |
| Proxy firewalls, SSH tunnels, VPNs, SSH protocol and authentication | L07 | 05 Web and Network Defense |
| IDS / IPS / HIDS / NIDS, confusion matrix, base-rate problem, signature vs anomaly | L08 | 05 Web and Network Defense |
| ARP spoofing, DNS cache poisoning, packet sniffing, MITM on LAN/DNS/wireless | L08 | 05 Web and Network Defense |
| 802.11, WLAN security, rogue APs, session hijacking, SYN flood, Smurf, amplification | L08 | 05 Web and Network Defense |

---

## Tutorial question patterns

Recurring shapes across Tutorials 1–5 and L6–L8. Recognise the shape and apply the matching answer template.

| Pattern | Where it appears | Answer template |
|---|---|---|
| **Compare-and-contrast two concepts** (e.g. symmetric vs asymmetric, online vs offline, stream vs block, IDS vs IPS) | T1–T3, sample paper Part A and B | Define both → state core structural difference → give one consequence per side |
| **Mechanism explanation** (how does a rootkit hide, how does DH MITM work, how does CSRF succeed) | T3–T5, L6, sample paper Part C | Identify attacker capability → vulnerable step → why it works → how to stop it |
| **Calculation + interpretation** (risk computation, IDS confusion matrix, alarm precision under low base rate) | T1, L8 | Formula → substitution → numeric result → operational meaning + decision it supports |
| **Identify the attack from a scenario** (sample paper A11 forum comment, A12 key substitution) | T3, T5, L6, sample paper Part A | Match scenario keywords (persisted, intercepted, forged request) to the canonical attack name; reject distractors that miss one keyword |
| **Protocol-flaw spotting** (given a protocol diagram, find the missing nonce / authentication / freshness check) | T2, L4 tutorial | State which property is missing (authenticity, freshness, integrity) → name the resulting attack (replay, reflection, MITM) → add the missing field (signature, nonce, MAC) |
| **Defence proposal** (propose two steps to remove a rootkit, propose a countermeasure for unauthenticated DH) | Sample paper Part C, L5/L7 tutorials | First step neutralises the *current* compromise; second step prevents recurrence (patch + harden) |
| **Map threat to STRIDE letter** | L01 tutorial | Pick the letter → name the violated property (S→authenticity, T→integrity, R→non-repudiation, I→confidentiality, D→availability, E→authorisation) |

> [!tip] Multiple-choice sanity checks
> - Eliminate options with reversed-direction claims first ("public-key is faster than symmetric for bulk data" — wrong by construction).
> - Distrust absolute quantifiers: "always", "only", "never", "guarantees", "no offline attacks possible". Security claims rarely hold absolutely.
> - For "best reason" or "fundamental difference" questions, pick the option that names the *defining structural property*, not a peripheral consequence.

---

## Study priority order

Based on sample-paper question counts plus tutorial recurrence.

| Rank | Topic | Sample paper hits | Why prioritised |
|---|---|---|---|
| 1 | **Foundations: policy, risk, STRIDE, adversary attributes** | A1, A2, A3, B1 (4 questions, $\approx 22\%$) | Highest sample-paper density. STRIDE + risk equation + adversary attribute matrix are pure recall — guaranteed marks |
| 2 | **Password authentication: hashing, salts, stretching, online vs offline** | A7, A8, B2 (3 questions, $\approx 17\%$) | High density and one full Part B essay. Defence-mechanism mapping must be airtight |
| 3 | **Cryptography fundamentals: symmetric vs asymmetric, stream vs block, hash-before-sign, X.509** | A4, A5, A6, B3 (4 questions, $\approx 22\%$) | Heaviest section by question count. Mostly definitional — drill the distinctions |
| 4 | **MITM and Diffie-Hellman: unauthenticated key exchange, forward secrecy** | A12, C3 (2 questions, $\approx 18\%$ by marks since C3 is heavy) | C3 carries the most marks of any single question. Must reproduce the substitution algebra and the FS argument |
| 5 | **Malware: trojan/worm/virus, rootkits, hooking** | C1, C2 (2 questions, $\approx 18\%$ by marks) | Two of three Part C slots. C2 is two-part — practice both halves |
| 6 | **Web defence: XSS variants, CSRF, MITM scenarios** | A11, A12 (2 questions) | Recognising stored vs reflected vs DOM XSS is a typical Part A pattern |
| 7 | **Network defence: firewall policies, IDS/IPS, base-rate** | A10 (1 question) | Lower density on this paper, but heavy in tutorials — likely to expand on the live exam |
| 8 | **Attack models: passive vs active, COA/KPA/CPA/CCA** | A9 (1 question) | Lowest density. Memorise the four-letter ladder and the passive/active split |

---

## Fast facts

Pure recall layer. Each row should cue a fuller explanation from the linked chapter.

### Formulas

| Formula | What it is | Interpretation |
|---|---|---|
| $R = T \cdot V \cdot C$ | Risk equation | $T$ threat probability, $V$ conditional probability of successful compromise given attack, $C$ consequence. Multiplicative — any zero zeroes risk |
| $\lvert K\rvert = 2^n$ | Key space size, $n$ = key length in bits | DES: $n=56 \to 2^{56}$. AES: $n \in \{128, 192, 256\}$. Exhaustive search cost scales with key-space size |
| $\text{TPR} = \dfrac{TP}{TP + FN}$ | True positive rate, sensitivity, recall | Probability a real attack triggers an alarm |
| $\text{FPR} = \dfrac{FP}{FP + TN}$ | False positive rate | Probability a benign event triggers an alarm |
| $\text{AP} = \dfrac{TP}{TP + FP}$ | Precision, accuracy-of-positives | Probability an alarm is real. Dominated by base rate in practice |
| Base-rate problem | When prior $P(\text{attack})$ is tiny, even high-TPR / low-FPR detectors produce mostly false alarms | Always interpret AP in light of the attack base rate |

### STRIDE → violated property

| Letter | Threat | Property violated |
|---|---|---|
| **S** | Spoofing | Authenticity |
| **T** | Tampering | Integrity |
| **R** | Repudiation | Non-repudiation |
| **I** | Information Disclosure | Confidentiality |
| **D** | Denial of Service | Availability |
| **E** | Escalation of Privilege | Authorisation |

### Hash properties trio (weakest → strongest)

1. **One-wayness (preimage resistance):** given $h = H(x)$, infeasible to find any $x'$ with $H(x') = h$.
2. **Second-preimage resistance:** given $x$, infeasible to find $x' \neq x$ with $H(x') = H(x)$.
3. **Collision resistance:** infeasible to find any pair $(x, x')$ with $x \neq x'$ and $H(x) = H(x')$.

Collision resistance is the strongest. Breaking it usually disqualifies the hash for signatures.

### Five adversary attributes

| Attribute | What it means |
|---|---|
| **Objectives** | What the attacker wants (financial, political, espionage, sabotage) |
| **Methods** | Techniques used (social engineering, exploitation, supply chain) |
| **Capabilities** | Resources, knowledge, skills — *maps to "technical means and skill set"* (sample paper A3) |
| **Funding Level** | Budget (script kiddie vs nation-state) |
| **Outsider vs Insider** | Whether they start outside or inside the trust boundary |

### Must-know distinctions

| Pair | Core difference |
|---|---|
| Symmetric vs asymmetric | Pre-shared single key vs public/private key pair |
| Stream vs block cipher | Bit/character-at-a-time with keystream vs fixed-size blocks |
| ECB vs CBC vs CTR vs OFB | ECB: no chaining (leaks patterns). CBC: prior-block chaining. CTR/OFB: stream-like from counter/feedback |
| Online vs offline guessing | Live server (rate-limited) vs stolen hash file (full hardware speed) |
| Salt vs pepper vs stretching | Per-user random (defeats rainbow tables) vs server-wide secret vs iteration count |
| Authentication vs identification vs authorisation | "Verify claim" vs "produce identity" vs "what they may do" |
| Key transport vs key agreement | One side sends the key vs both sides derive it (DH) |
| Replay vs reflection vs relay | Resend old message vs bounce to sender vs forward live to a third party |
| Virus vs worm vs trojan vs ransomware vs rootkit | Host-required + replicates vs autonomous propagation vs disguised vs encrypts-for-ransom vs kernel-level stealth |
| Polymorphic vs metamorphic | Encrypted body, varying decryptor vs rewrites own code |
| Stored vs reflected vs DOM XSS | Server-persisted vs single-request bounce vs client-side script source |
| Stateless vs stateful firewall | Per-packet rules vs connection-tracking |
| Default-deny vs default-allow | Block unless permitted vs permit unless blocked |
| IDS vs IPS, HIDS vs NIDS | Detect-only vs detect-and-prevent, host-based vs network-based |
| ARP spoofing vs DNS cache poisoning | Layer 2 MAC redirection vs Layer 7 name-resolution tampering |

### Attack models on ciphers

| Model | Attacker has |
|---|---|
| **Ciphertext-only (COA)** | Ciphertext samples only |
| **Known-plaintext (KPA)** | Some plaintext-ciphertext pairs |
| **Chosen-plaintext (CPA)** | Can choose plaintext and observe ciphertext |
| **Chosen-ciphertext (CCA)** | Can choose ciphertext and observe decryption |

Strength ordering: COA < KPA < CPA < CCA. A cipher secure against CCA is secure against the weaker models.

### Key X.509 fields (B3 anchor)

1. **Subject** — entity name being certified.
2. **Subject Public Key** (with algorithm parameters).
3. **Issuer** — the CA.
4. **Validity Period** — Not-Before and Not-After.
5. **CA Digital Signature** over the rest of the certificate.

---

## Related Concepts

- [[Sample Paper 2025 — Question Bank with Model Answers]] — full Q-by-Q with model answers and justifications.
- [[Part B and C Essay Templates and Model Answers]] — 100–200 word model essays under timer.
- [[Fast Facts, Formulas, and Core Terms]] — pure recall layer (this chapter compresses the same content into one table per group).
- [[Tutorial and Exam Problem Patterns]] — answer-pattern templates and multiple-choice sanity checklist.

## Sources

- Sample Paper — 2025-03-21 (`Materials/04 Past Exams/Sample Paper — 2025-03-21.pdf`)
- Sample Paper Solution — 2025-03-21 (`Materials/04 Past Exams/Sample Paper Solution — 2025-03-21.pdf`)
- Lectures 01–08 (`Materials/01 Lectures/`)
- Tutorials 1–5, L6–L8 (`Materials/02 Tutorials/`)

---

## Sample Paper 2025 — Question Bank with Model Answers

> [!abstract] Why this note matters
> - This is the single most exam-relevant artifact in the knowledge base.
> - It contains all 14 questions from the 2025-03-21 sample paper with correct answers, brief justifications, and direct links to the notes that cover each topic.
> - Use it as the spine of the final review pass: if you cannot reproduce both the answer and the reasoning, jump to the linked note.

### Exam Focus

- Tier 0 priority — past-exam signal is the strongest predictor of future question style.
- 12 Part A multiple-choice, 3 Part B short essays, 3 Part C longer problem-solving.
- Time budget: 120 minutes total (see [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]] for the strategy).

### Part A — Multiple Choice (12 questions)

#### A1. STRIDE threat-modeling method

**Correct answer:** (b) STRIDE stands for Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Escalation of Privilege and helps ensure common threats are not overlooked.

**Why:** STRIDE is a six-letter mnemonic. Each letter maps to a category of threat and to the security property it violates (S→authenticity, T→integrity, R→non-repudiation, I→confidentiality, D→availability, E→authorization). The other options misstate scope or compatibility.

**Covered in:** [[Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]

#### A2. Risk equation — meaning of V

**Correct answer:** (c) The probability that the system, if attacked, will be successfully compromised.

**Why:** In `R = T * V * C`, V is the conditional probability of successful compromise given an attack attempt — it captures the system's weakness, not money, attacker skill, or remediation cost.

**Covered in:** [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]

#### A3. Adversary attribute for technical means and skill

**Correct answer:** (d) Capabilities.

**Why:** Among the five adversary attributes (Objectives, Methods, Capabilities, Funding Level, Outsider vs Insider), Capabilities denotes the resources, knowledge, and technical proficiency available to the attacker. Methods describes the techniques used; Capabilities describes what they are able to do.

**Covered in:** [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]

#### A4. Symmetric vs public-key cryptography

**Correct answer:** (c) Symmetric systems require a pre-shared secret for both encryption and decryption, while public-key systems use separate public and private keys.

**Why:** This is the defining structural difference. Distractor (a) inverts the key-size relationship; (b) is the opposite of reality (asymmetric is slow on bulk data); (d) ignores that asymmetric is widely used for key exchange.

**Covered in:** [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]

#### A5. Stream ciphers

**Correct answer:** (c) They encrypt data one bit/character at a time, often combined with a keystream generator.

**Why:** Stream ciphers operate symbol-by-symbol in lockstep with a keystream (typically XOR). Distractor (a) describes block mode; (b) overstates pad length; (d) describes a CBC-like dependency that stream ciphers do not need.

**Covered in:** [[Stream Ciphers vs Block Ciphers — Formal Definitions|Stream Ciphers vs Block Ciphers — Formal Definitions]]

#### A6. Why hash before signing

**Correct answer:** (b) To reduce the data length for faster signature operations and to detect any message alteration.

**Why:** Public-key signing is expensive and bounded by key/modulus size; signing a short fixed-length digest is faster and more practical. The hash also acts as an integrity check — any modification changes the digest, invalidating the signature.

**Covered in:** [[Hash Functions, Collision Resistance, and Digital Signatures|Hash Functions, Collision Resistance, and Digital Signatures]]

#### A7. Random per-user salt

**Correct answer:** (c) It prevents the use of precomputed hash tables (rainbow tables) across multiple users.

**Why:** Per-user salt forces the attacker to build a separate table per account, defeating amortized precomputation. It does not speed up login, eliminate offline attacks, or invert the hash.

**Covered in:** [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

#### A8. Slowing offline password guessing

**Correct answer:** (b) Using a specialized key-stretching algorithm with salts and high iteration counts.

**Why:** Key stretching (PBKDF2, bcrypt, scrypt, Argon2) multiplies the cost of each guess by the iteration count, directly increasing attacker time. Account lockout (a) is an online-only defense; (c) reduces entropy; (d) is security through obscurity.

**Covered in:** [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

#### A9. Passive vs active attacker

**Correct answer:** (b) A passive attacker attempts to observe traffic, whereas an active attacker may inject or modify data.

**Why:** This is the textbook distinction: passive = read-only eavesdrop; active = read and write (inject, modify, drop, replay). The other options conflate the categories with unrelated capabilities.

**Covered in:** [[Attack Models and Adversary Capabilities|Attack Models and Adversary Capabilities]]

#### A10. Default-allow firewall policy

**Correct answer:** (b) It allows traffic by default, creating a risk that unrecognized services remain accessible.

**Why:** Default-allow is the permissive posture: anything not explicitly blocked is permitted, so newly exposed services slip through. Default-deny is the secure-by-default opposite.

**Covered in:** [[Firewall Policy Design, Bastion Hosts, and Port Knocking|Firewall Policy Design, Bastion Hosts, and Port Knocking]]

#### A11. Forum comment XSS

**Correct answer:** (b) Stored cross-site scripting.

**Why:** The payload is persisted on the server (in the comment) and served to every visitor who loads that page. Reflected XSS would bounce off a single request; CSRF tricks a logged-in user into issuing a request; DNS cache poisoning is name-resolution tampering.

**Covered in:** [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]

#### A12. Man-in-the-middle illustration

**Correct answer:** (b) An attacker intercepts key exchange messages and substitutes public keys, relaying data so both endpoints believe they communicate directly.

**Why:** The classic MITM signature: the attacker sits on the path, terminates each endpoint's session, and forwards transformed traffic. The other options describe offline brute force, physical access, and cross-origin leakage respectively.

**Covered in:** [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

### Part B — Short Essays (3 questions)

#### B1. Formal security policy and threat modeling

**Question:** Explain how a formal security policy helps guide threat modeling. Why can a policy violation lead to a non-secure state? Provide an example.

**Model answer:** A formal policy enumerates permitted and forbidden actions, fixing the boundary between secure and non-secure states. Threat modeling then enumerates threats whose realization would cross that boundary — without a policy there is no anchor for "violation." Any successful policy violation places the system in a non-secure state by definition. Example: a policy stating "only the finance group may modify financial records" makes any unauthorized write to those records a non-secure state, regardless of whether data is corrupted.

**Covered in:** [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]], [[Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]

#### B2. Online vs offline password guessing

**Question:** Define how online password guessing differs from offline. Identify one defense for offline attacks and explain why it does not help against online attacks.

**Model answer:** Online guessing sends each attempt to the live server, which sees and can throttle it. Offline guessing happens locally on a stolen hash file with no server in the loop. Key stretching (PBKDF2/bcrypt with high iteration counts) defends against offline attacks by making each hash computation expensive — millions of guesses per second become hundreds. It does not stop online attacks because the server already enforces rate limits and lockouts; the per-guess cost is dwarfed by the per-attempt network round trip, and the attacker is bottlenecked by the server's response policy, not by hashing speed.

**Covered in:** [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

#### B3. X.509 certificate fields and issuer signature

**Question:** Summarize the key X.509 fields binding name to public key. Why is the issuer signature essential against impersonation?

**Model answer:** An X.509 certificate binds an identity to a key via five core fields: Subject (the entity name), Subject Public Key (and algorithm parameters), Issuer (the CA), Validity Period (Not-Before and Not-After), and the CA's Digital Signature over the rest of the certificate. The issuer signature is the trust anchor: anyone holding the CA's public key can verify the certificate has not been forged or modified. Without it, an attacker could trivially create a certificate claiming any subject name with an attacker-controlled key, and clients would have no way to detect the substitution.

**Covered in:** [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]]

### Part C — Longer Problem Solving (3 questions)

#### C1. Trojan horse vs worm

**Question:** Outline how a Trojan horse differs from a worm in terms of user interaction and propagation.

**Model answer:** A Trojan horse is malware disguised as a benign or desirable program. Propagation requires the user to download and execute it — propagation is social, not autonomous. A worm propagates automatically by exploiting network or software vulnerabilities, scanning for new targets and replicating without user assistance. The axes are: user interaction (Trojan requires it; worm does not) and propagation mechanism (Trojan piggybacks on legitimate-looking distribution; worm uses self-propagating exploitation). A Trojan typically delivers a payload to one host; a worm fans out across many hosts on its own.

**Covered in:** [[Malware Taxonomy, Delivery Paths, and Botnets|Malware Taxonomy, Delivery Paths, and Botnets]]

#### C2. Kernel-mode rootkit

**Question:** (a) How does hooking or overwriting system calls let a rootkit hide files and processes? (b) Propose two steps to remove it and reduce reinfection risk.

**Model answer:** A kernel-mode rootkit modifies kernel data structures or rewrites system call entries (e.g., the system call table, the VFS layer, or `readdir`/`getdents` and process-list calls). When a tool like `ls` or `ps` queries the kernel, the hooked code filters the result to exclude attacker-owned files or processes before returning. Detection from the compromised host fails because every observation channel runs through the same poisoned kernel. Remediation: (1) boot the machine from a trusted, clean medium — a known-good rescue disk or fresh installation media — and reinstall the operating system from verified images so all kernel hooks are wiped; (2) patch the exploited entry vulnerability and enable Secure Boot plus driver/code signing, so future unauthorized kernel modifications are blocked at load time and detected if attempted.

**Covered in:** [[Rootkits, Hooking, DKOM, and Stealth Analysis|Rootkits, Hooking, DKOM, and Stealth Analysis]], [[System Hardening, Vulnerability Reduction, and Secure Configuration|System Hardening, Vulnerability Reduction, and Secure Configuration]]

#### C3. Unauthenticated Diffie-Hellman

**Question:** A chat app uses Diffie-Hellman without authenticating each party's public share. How could an attacker mount MITM? Propose one countermeasure that preserves forward secrecy and ensures authenticity.

**Model answer:** Without authentication, the attacker on the network path intercepts Alice's public share `g^a` and substitutes `g^m`, then intercepts Bob's `g^b` and substitutes `g^m'`. Alice computes a shared secret with the attacker (`g^am`), Bob computes a different shared secret with the attacker (`g^bm'`), and the attacker decrypts, reads, and re-encrypts every message in transit. Both endpoints believe they share a key with each other. Countermeasure: each side signs its ephemeral DH public share with its long-term identity private key, and verifies the peer's signature using the peer's certified long-term public key. This preserves forward secrecy because the ephemeral exponents `a` and `b` are discarded after the session, so compromise of the long-term signing key later cannot recover the past shared secret `g^ab`. Authenticity is enforced because the attacker cannot forge a valid signature over a substituted share.

**Covered in:** [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]], [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

### How to Use This Note

1. First pass: cover the answer column, attempt each question cold, then check.
2. Second pass: for each question you missed or hesitated on, open the linked note and re-read until you can re-derive the answer.
3. Third pass: practice writing the Part B and C answers in two paragraphs under timer — see [[Part B and C Essay Templates and Model Answers|Part B and C Essay Templates and Model Answers]].

### Related Concepts

- [[Fast Facts, Formulas, and Core Terms|Fast Facts, Formulas, and Core Terms]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]
- [[Part B and C Essay Templates and Model Answers|Part B and C Essay Templates and Model Answers]]

## Part B and C Essay Templates and Model Answers

> [!abstract] Why this note matters
> - Parts B and C carry more marks per question than the multiple choice and reward structured answers, not stream-of-consciousness lists.
> - This note pairs each past-exam essay with a 3–5 line skeleton (Define → Mechanism → Defense/Tradeoff) and a full 100–200 word model answer.
> - Internalize the skeletons first, then drill the model answers under timer.

### Exam Focus

- Tier 0 priority for Parts B (3 short essays, ~10 min each) and C (3 longer problems, ~15 min each).
- Always structure: state what the concept is → explain how the mechanism works → name the attack or violation → propose the defense → if relevant, name the tradeoff.
- Avoid: bullet dumps with no glue, single-sentence answers, definitions without mechanisms.

### Universal Skeletons

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

### Part B Essays

#### B1. Formal Security Policy and Threat Modeling

**Skeleton:**
1. Define a formal security policy as the explicit list of permitted and forbidden actions.
2. Explain that threat modeling uses the policy to enumerate violations attackers might cause.
3. Note that "non-secure state" is defined relative to the policy.
4. Give a concrete example tying policy clause → violation → non-secure state.

**Model answer:**
A formal security policy is the explicit definition of permitted and forbidden actions in a system. It anchors threat modeling by giving the analyst a fixed boundary: every threat to enumerate is one that, if realized, would violate a clause of the policy. Without a policy there is no defined "non-secure state," so threat enumeration becomes subjective. A policy violation by definition places the system in a non-secure state because the policy is the operational meaning of "secure." Example: a healthcare system's policy states "only members of the clinical group may read patient records." A SQL-injection bug that lets an outsider read records is a non-secure state — not because data was corrupted, but because the policy clause governing read access was broken. Threat modeling using STRIDE would have flagged Information Disclosure on the records endpoint, prompting the input-validation control that prevents the violation.

**Covered in:** [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]], [[Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]

#### B2. Online vs Offline Password Guessing

**Skeleton:**
1. Define online guessing as attempts against the live authentication endpoint.
2. Define offline guessing as local hashing attempts against a stolen credential file.
3. Name PBKDF2/bcrypt/Argon2 with high iteration counts as the offline-specific defense.
4. Explain that iterated hashing does not help online because the bottleneck is the server's rate-limit policy, not per-guess cost.

**Model answer:**
Online password guessing requires the attacker to submit each candidate to the legitimate authentication server, which observes and can throttle, lock, or alert on failed attempts. Offline guessing happens after the attacker has stolen the hashed password file: they hash candidates locally at full hardware speed with no server in the loop. The standard offline defense is key stretching — PBKDF2, bcrypt, scrypt, or Argon2 with a high iteration count and per-user salt — which multiplies the cost of each guess so that billions of attempts per second become thousands. This defense is largely ineffective against online attacks because the binding constraint is not per-guess CPU time but the server's policy: account lockout after N failed attempts, exponential back-off, and CAPTCHA already cap the rate at a few guesses per minute. Adding 100ms of hashing has negligible effect when the attacker is already limited to one attempt every ten seconds by the server's rate limit.

**Covered in:** [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

#### B3. X.509 Certificate Fields and Issuer Signature

**Skeleton:**
1. List the five core fields that bind name to key: Subject, Subject Public Key, Issuer, Validity Period, CA Digital Signature.
2. Explain that the signature is taken by the CA over the entire body of the certificate.
3. Explain that verification with the CA's known public key proves both integrity and origin.
4. Name impersonation as the attack defeated by this signature.

**Model answer:**
An X.509 certificate binds an identity to a public key through five core fields: the Subject (the entity name being certified), the Subject Public Key (with its algorithm parameters), the Issuer (the Certification Authority that vouches for the binding), the Validity Period (Not-Before and Not-After dates), and the CA's Digital Signature over the rest of the certificate. The issuer signature is essential against impersonation because it is the only field that prevents arbitrary forgery: a relying party verifies the signature with the CA's known public key, confirming both that the binding is endorsed by a trusted authority and that no field has been modified since signing. Without the signature, anyone could mint a certificate claiming the name "bank.example.com" with their own public key, and clients would have no way to distinguish a genuine binding from an attacker's fabrication. The CA's signature reduces the trust problem to the much smaller question of which root CAs to trust.

**Covered in:** [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]]

### Part C Essays

#### C1. Trojan Horse vs Worm

**Skeleton:**
1. Define a Trojan as malware disguised as a legitimate program, requiring user action to execute.
2. Define a worm as self-propagating malware exploiting network or software vulnerabilities.
3. Contrast on the user-interaction axis: Trojan needs it, worm does not.
4. Contrast on the propagation axis: Trojan rides legitimate distribution channels, worm self-replicates.

**Model answer:**
A Trojan horse is malicious code disguised as a benign or desirable program — pirated software, a "free" utility, a fake update — that the user must download and run for the payload to activate. Propagation is social and one-host-at-a-time: each new infection requires a new victim to take a deliberate action. A worm is autonomous malware that propagates by exploiting network-reachable vulnerabilities (unpatched services, weak credentials, code-execution flaws). It scans for vulnerable targets, exploits them remotely, copies itself across, and immediately resumes scanning from the new foothold — no user interaction required. The two malware classes differ on two axes: user interaction (Trojan: required; worm: not required) and propagation (Trojan: piggybacks on the trust the user grants to the host program; worm: leverages the trust the network grants to a reachable service). A Trojan typically installs and serves a backdoor on one host; a worm can compromise thousands of hosts within minutes of release.

**Covered in:** [[Malware Taxonomy, Delivery Paths, and Botnets|Malware Taxonomy, Delivery Paths, and Botnets]]

#### C2. Kernel Rootkit Removal

**Skeleton:**
1. Explain hooking: rootkit modifies kernel data structures or syscall entries (system call table, VFS layer, process list).
2. Explain that legitimate userland queries are filtered to omit attacker-owned files and processes.
3. Step 1 of recovery: boot from trusted clean media and reinstall the OS to wipe all kernel hooks.
4. Step 2 of recovery: patch the entry vulnerability and enable Secure Boot plus driver code-signing to block future unauthorized kernel modifications.

**Model answer:**
A kernel-mode rootkit hooks or rewrites system calls and kernel data structures to filter what userland tools can see. The classic mechanism modifies the system call table or the VFS layer so that `getdents` (used by `ls`), the process enumeration syscalls (used by `ps`), and the network socket listings (used by `netstat`) all run through attacker-controlled code that removes entries belonging to the rootkit's files, processes, and connections before returning to the caller. Detection from the compromised host is fundamentally unreliable because every observation channel goes through the poisoned kernel. Recovery requires two steps. First, boot the machine from trusted clean media — a known-good rescue disk or verified installation image — and reinstall the operating system so that every modified kernel structure and persistent hook is wiped. Second, patch the entry vulnerability that allowed the initial compromise, then enable Secure Boot and kernel-driver code signing so that any future attempt to load unsigned or modified kernel code is blocked at load time and logged for investigation.

**Covered in:** [[Rootkits, Hooking, DKOM, and Stealth Analysis|Rootkits, Hooking, DKOM, and Stealth Analysis]], [[System Hardening, Vulnerability Reduction, and Secure Configuration|System Hardening, Vulnerability Reduction, and Secure Configuration]]

#### C3. Unauthenticated Diffie-Hellman MITM

**Skeleton:**
1. Sketch the MITM: attacker substitutes its own DH share for Alice's and Bob's, deriving two separate shared secrets.
2. Explain that the attacker decrypts, reads, and re-encrypts in both directions; both endpoints believe they share a key with each other.
3. Countermeasure: sign each ephemeral DH share with a long-term identity key and verify the peer's signature.
4. Explain that forward secrecy is preserved because ephemeral exponents `a` and `b` are discarded — compromising the long-term key later does not recover past `g^ab`.

**Model answer:**
Without authentication of the DH public shares, an active attacker on the network path intercepts Alice's `g^a` and forwards `g^m` to Bob, then intercepts Bob's `g^b` and forwards `g^m'` to Alice. Alice now shares a secret `g^am` with the attacker; Bob shares a different secret `g^bm'` with the attacker. The attacker decrypts every message from each side with the appropriate secret, optionally reads or modifies it, then re-encrypts it under the other secret and forwards. Both Alice and Bob believe they share a confidential key with each other. The countermeasure is to digitally sign each ephemeral DH public share with the sender's long-term identity private key (certified by a CA or pre-distributed), and to require verification of the peer's signature before deriving the shared secret. This preserves forward secrecy because the DH exponents `a` and `b` remain ephemeral and are discarded after the session — later compromise of the long-term signing key cannot retroactively recover the past shared secret `g^ab`, since the signing key is used only to authenticate the exchange, never to encrypt traffic. Authenticity is enforced because the attacker cannot forge a valid signature over a substituted share.

**Covered in:** [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]], [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

### Drill Plan

1. Read each skeleton aloud and reproduce it from memory before looking at the model answer.
2. Write each model answer under a 10-minute (Part B) or 15-minute (Part C) timer, then compare for missing elements.
3. Focus rewrites on the two most underdeveloped sections (usually mechanism and tradeoff).

### Related Concepts

- [[Sample Paper 2025 — Question Bank with Model Answers|Sample Paper 2025 — Question Bank with Model Answers]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]
- [[Fast Facts, Formulas, and Core Terms|Fast Facts, Formulas, and Core Terms]]

## Tutorial and Exam Problem Patterns

> [!abstract] Why this note matters
> - The tutorials and their solutions reveal the stable question shapes used across the course.
> - This note compresses the answer patterns expected in the final closed-book exam.

### Overview

The course uses recurring question types. Some ask for crisp concept distinctions, such as symmetric vs asymmetric or stateless vs stateful. Some ask for mechanism explanations, such as replay defense or OTP reuse. Some ask for calculations, such as risk or alarm reasoning.

A good exam answer is usually short but structured. The best pattern is: define the concept, explain the mechanism, give one example or implication, and, if relevant, state the defense or tradeoff.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **compare-and-contrast question**: A question that asks you to distinguish two or more concepts clearly and structurally.
- **mechanism question**: A question asking how a protocol, attack, or defense actually works.
- **attack-defense mapping**: An answer structure that pairs a concrete vulnerability or attack with the control that mitigates it.

### Detailed Explanation

Tutorial Part A questions test precise vocabulary and mechanism recognition. These require confident definitions with no drift in terminology.

Tutorial Part B and lab-style questions require structured explanations. Here the expected move is to define the attack or mechanism, explain the key steps, compare with a nearby concept if useful, and finish with practical consequences or defenses.

Calculation questions still require words. When computing risk or interpreting false positives, you should state not only the number but what it means and what decision it supports.

### How It Works

For compare questions: define both items, state the core difference, then give one consequence.

For mechanism questions: identify attacker capability, vulnerable step, why it works, and how to stop it.

For calculations: show the formula, plug in values, compute, and interpret.

### Exam-Day Strategy

**Time budget (120 minutes total, 14 questions):**

| Section | Count | Per-question budget | Total |
|---|---|---|---|
| Part A (multiple choice) | 12 | ~3 min | 36 min |
| Part B (short essays) | 3 | ~10 min | 30 min |
| Part C (longer problems) | 3 | ~15 min | 45 min |
| Buffer for review and unsticking | — | — | ~9 min |

- Spend the first pass on Part A — most marks per minute. If a question takes longer than 3 minutes, mark it and move on.
- Tackle Part C before B if the C scenarios look more familiar — the marginal point is worth more per minute on the longer questions.
- Reserve the final ~9 minutes to revisit flagged items and to double-check that every page has your name and ID.

**Answer-pattern templates:**

- **Theory question (Define → Mechanism → Attack → Defense → Tradeoff):**
  1. Define the concept precisely.
  2. Explain how the mechanism works.
  3. Name the attack or failure mode this addresses.
  4. State the defense or control.
  5. Note the residual tradeoff or limitation.

- **Scenario essay (Identify the policy violated → Explain the mechanism → Propose the defense):**
  1. Identify which security property or policy clause is violated (confidentiality, integrity, availability, authenticity, non-repudiation, authorization).
  2. Explain the attack mechanism step by step in the scenario's terms.
  3. Propose a concrete defense and state which property it restores.

- **Calculation (Formula → Substitution → Number → Interpretation):**
  1. Write the formula symbolically.
  2. Substitute values explicitly.
  3. Compute the result with units.
  4. Interpret what the number means operationally and what action it supports.

**Multiple-choice sanity checklist:**

- Eliminate impossible distractors first. Options with reversed-direction claims (e.g., "public-key is faster than symmetric for bulk encryption") are usually wrong by construction.
- Watch for absolute quantifiers: "always," "only," "never," "guarantees," "no offline attacks possible." These are usually traps — security claims rarely hold absolutely.
- For STRIDE questions, the question typically asks about the *category* the threat falls in, not the specific exploit. Map first to the letter (S, T, R, I, D, E), then to the answer.
- For "best reason" questions, multiple options may be technically true; pick the one most directly causal to the asked property.
- For "fundamental difference" questions, the right answer states the defining structural property, not a peripheral consequence.

### What You Must Know

- How to structure short-answer and long-answer responses cleanly.
- How to connect definitions to examples and defenses.
- How to interpret calculations, not just compute them.

### 30-Second Oral Answer

- A high-quality answer defines, explains, gives an example, and states the defense or tradeoff.
- Exam responses should be structured, not stream-of-consciousness lists.

### Typical Exam Questions

- How should you answer a compare-and-contrast security question?
- What structure works well for an attack/defense explanation?
- What must be included in a risk or detection-rate calculation answer?

### Common Pitfalls

- Answering with only definitions and no mechanism.
- Answering with only stories and no precise terminology.
- Giving a computed number with no interpretation.
### Related Concepts

- [[Sample Paper 2025 — Question Bank with Model Answers|Sample Paper 2025 — Question Bank with Model Answers]]
- [[Part B and C Essay Templates and Model Answers|Part B and C Essay Templates and Model Answers]]
- [[Fast Facts, Formulas, and Core Terms|Fast Facts, Formulas, and Core Terms]]
- [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]

## Fast Facts, Formulas, and Core Terms

> [!abstract] Why this note matters
> - Closed-book exams reward strong recall of formulas, terms, and standard distinctions.
> - This note centralizes the highest-yield short facts without replacing the main explanatory notes.

### Overview

This note is intentionally compressed. Use it after the main notes already make sense. It is not the teaching layer; it is the recall layer.

The course often tests not only whether you know a term, but whether you can connect it to the correct neighboring terms. So the most useful fact list is one built around contrasts and formulas.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **CIA triad**: Confidentiality, integrity, availability.
- **risk equation**: The course formula `R = T * V * C` (Threat × Vulnerability × Consequence). V is the probability the system is compromised given an attack attempt.
- **FAR**: False Accept Rate in biometrics.
- **IDS vs IPS**: Detect-only versus detect-and-prevent systems.

### Formulas to Memorize

- **Risk:** `R = T * V * C`.
- **Key space:** `|K| = 2^n` where `n` is the key length in bits. DES `n = 56` → `2^56` keys; AES `n ∈ {128, 192, 256}` → `2^128`, `2^192`, `2^256` keys. Exhaustive search cost scales with key-space size.
- **IDS confusion matrix:**
  - True Positive Rate (sensitivity, recall): `TPR = TP / (TP + FN)`
  - False Positive Rate: `FPR = FP / (FP + TN)`
  - True Negative Rate (specificity): `TNR = 1 − FPR = TN / (TN + FP)`
  - False Negative Rate: `FNR = 1 − TPR = FN / (FN + TP)`
  - Precision (Accuracy of Positives): `AP = TP / (TP + FP)` — the probability that an alarm is real, dominated in practice by the base rate.
- **Base-rate problem:** even a high-TPR / low-FPR detector produces mostly false alarms when the prior probability of attack is very small. Always interpret AP in light of the attack base rate.

### Hashing Properties Trio

A cryptographic hash function `H` must satisfy three properties (ordered weakest to strongest):

1. **One-wayness (preimage resistance):** given `h = H(x)`, infeasible to find any `x'` with `H(x') = h`.
2. **Second-preimage resistance:** given `x`, infeasible to find a different `x' ≠ x` with `H(x') = H(x)`.
3. **Collision resistance:** infeasible to find any pair `(x, x')` with `x ≠ x'` and `H(x) = H(x')`.

Collision resistance is the strongest — breaking it does not necessarily break the others, but breaking it usually disqualifies the hash for digital signatures.

### STRIDE — Threat Category to Security Property Violated

| Letter | Threat | Property violated |
|---|---|---|
| **S** | Spoofing | Authenticity |
| **T** | Tampering | Integrity |
| **R** | Repudiation | Non-repudiation |
| **I** | Information Disclosure | Confidentiality |
| **D** | Denial of Service | Availability |
| **E** | Escalation of Privilege | Authorization |

Use the table to map a scenario directly to the violated property in a Part B/C essay.

### Five Adversary Attributes

1. **Objectives** — what the attacker wants to achieve (financial, political, espionage, sabotage).
2. **Methods** — the techniques they use (social engineering, exploitation, supply chain).
3. **Capabilities** — the resources, knowledge, and skills they possess (this is the one that maps to "technical means and skill set").
4. **Funding Level** — the budget available (script kiddie vs nation-state).
5. **Outsider vs Insider** — whether they start outside the trust boundary or already inside.

### Detailed Explanation

A fast-facts note helps because the final exam is closed-book, but rote memorization alone is not enough. Each item here should cue a fuller explanation from the main notes.

That also means this note should be treated as a retrieval map, not as a substitute for the full concept notes. Every item below corresponds to a contrast or mechanism that the source material uses repeatedly.

Use it as a compression layer after understanding the topic notes. If one line here feels too abstract to explain aloud in two or three sentences, that is the signal to revisit the linked concept note rather than to memorize the phrase more aggressively.

### How It Works

Use this note for active recall, then jump back into the linked full notes when a term feels thin.

For each item, practice a three-step response: define it, contrast it with the nearest similar concept, and give one course-specific example.

For formulas or rates, always add an interpretation step: what does the number mean operationally, and what control or judgment follows from it?

### What You Must Know

- CIA triad.
- Risk equation `R = T * V * C`.
- Passive vs active adversary.
- Ciphertext-only, known-plaintext, chosen-plaintext, chosen-ciphertext.
- One-time pad conditions and OTP reuse failure.
- ECB vs CBC vs CTR vs OFB.
- Authentication vs identification vs authorization.
- Salt vs pepper vs stretching.
- Replay vs reflection vs relay.
- Key transport vs key agreement.
- Virus vs worm vs trojan vs ransomware vs rootkit.
- Polymorphic vs metamorphic malware.
- Stored vs reflected vs DOM-based XSS.
- Mixed content, `document.domain`, and cookie scope across subdomains.
- Stateless vs stateful firewall.
- Default-deny vs default-allow; bastion host; port knocking.
- IDS vs IPS, HIDS vs NIDS.
- False positive vs false negative; base-rate problem.
- ARP spoofing vs DNS cache poisoning.

### 30-Second Oral Answer

- Use this note for quick recall, not as your only explanation source.

### Typical Exam Questions

- Can you define each pair or group and state the key difference from memory?
- Can you compute risk and then interpret the result?

### Common Pitfalls

- Using the recall list as a substitute for understanding.
### Related Concepts

- [[Sample Paper 2025 — Question Bank with Model Answers|Sample Paper 2025 — Question Bank with Model Answers]]
- [[Part B and C Essay Templates and Model Answers|Part B and C Essay Templates and Model Answers]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]
