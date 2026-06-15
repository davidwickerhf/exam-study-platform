# Topic 01 — Foundations and Security Principles

**Lecture slides:** `Materials/01 Lectures/Lecture 01 — Introduction and Security Fundamentals.pdf`
**Tutorial coverage:** Tutorial 1 (Parts A, B, C — MCQ, short answer, risk-equation drills)
**Past exam coverage:** Sample Paper 2025-03-21 Part A Q1 (STRIDE), Q2 (vulnerability $V$), Q3 (Capabilities); Part B Q1 (security policy and threat modeling)

This chapter sets the vocabulary the rest of the course assumes. Memorise the six foundational goals (CIA plus Authorization, Authentication, Accountability), the exact phrasing of risk $R = T \times V \times C$, the five adversary attributes, the seven named adversary groups, the four threat-modelling approaches, and the three sources of model-reality gaps. Sample exam Q2 tested $V$ verbatim; Q3 tested the Capabilities attribute by definition; Q1 tested the STRIDE expansion.

## What the Exam Asks

- CIA plus goals beyond CIA: confidentiality, integrity, availability, authentication, authorization, accountability.
- Risk/threat/adversary framing: assets, threats, vulnerabilities, controls, residual risk.
- STRIDE and attack trees as structured ways to reason about threats.
- Defense in depth and human/insider factors as recurring essay glue.

---

## Why Computer Security Matters

Computer security is the combined art, science, and engineering practice of protecting computer-related assets from unauthorized actions and their consequences, either by *preventing* such actions or by *detecting and recovering* from them. The scope covers software, computers, and computer networks, including PCs, laptops, tablets, smartphones, servers, and network devices (firewalls, routers, switches).

Annual cybercrime cost reached $\$6\text{T}$ in 2021; if treated as a country, it would have the third-largest GDP worldwide. The lecture grounds the topic with four canonical incidents:

| Incident | Date | Nature | Impact |
|---|---|---|---|
| **WannaCry** | May 2017 | Ransomware exploiting Windows EternalBlue, demanding Bitcoin | Over 230,000 computers in 150+ countries; UK NHS appointments cancelled |
| **NotPetya** | June 2017 | Malware disguised as ransomware, Ukrainian-targeted, spread globally | Maersk, Merck disrupted; damages over $\$10$ billion |
| **Stuxnet** | Discovered 2010 | Worm targeting Siemens PLCs at Iran's Natanz facility | Damaged centrifuges, delayed nuclear progress |
| **TRITON** | August 2017 | Malware targeting safety systems of a Saudi petrochemical plant | Detected before harm; first known attack aimed at disabling industrial safety mechanisms |

The pattern: ransomware harms availability and often confidentiality; targeted ICS malware harms integrity and physical safety. A single incident usually violates more than one security goal at once.

> [!tip] Tutorial 1 Part B Q1
> Pick one incident, name the exploit (e.g. EternalBlue for WannaCry), describe the broader impact across financial, operational, and reputational axes, and explain why it was a turning point — for WannaCry, global awareness of ransomware and the cost of unpatched systems.

---

## The Six Foundational Security Goals

The CIA triad is the classical starting set, but Lecture 1 names **six** foundational goals: Confidentiality, Integrity, Availability, Authorization, Authentication, Accountability. Each has a precise definition and supporting methods.

> [!info] Memorise this verbatim
> The six foundational goals are **C, I, A, Authorization, Authentication, Accountability**. Non-repudiation is a useful property and appears in STRIDE's Repudiation category, but it is *not* one of the six foundational goals in this course — Accountability is.

### Definitions and methods

| Goal | Definition | Methods |
|---|---|---|
| **Confidentiality** | Non-public information remains accessible only to authorized parties | Access control (OS-enforced), data encryption (crypto algorithms), procedural means (physical access restriction to offline storage) |
| **Integrity** | Data, software, or hardware remains unaltered except by authorized parties | Error detection/correction codes (benign errors); access controls plus cryptographic checksums (malicious alteration) |
| **Availability** | Information, services, and computing resources are accessible for authorized use | Reliable hardware and software; protection mechanisms against intentional disruption (DoS) |
| **Authorization** | Computing resources accessible only by authorized entities | Access control mechanisms restricting physical devices, software services, and information |
| **Authentication** | Assurance that a principal, data, or software is genuine | Entity authentication (verifies identity of users); data-origin authentication (verifies source of data) |
| **Accountability** | Ability to identify principals responsible for actions | Transaction evidence and logs — electronic means to record actions and identify principals |

### How the goals interlock

Lecture 1's central diagram places **access control** as the enforcement hub: it consumes an authenticated identity together with a policy, then enforces confidentiality, integrity, and authorization. Accountability sits to the side, supported by digital evidence such as logs.

The lecture slide itself, kept here for reference (the cleaned-up reconstruction follows):

![[security-goals-and-access-control-map.png]]

In the slide's colour coding: **green** ovals are the six goals; **blue** boxes are the mechanisms (access control + the two flavours of authentication); **orange** boxes are the raw inputs (`msg data`, `secret`, `identity`, `policy`, `digital evidence`). Read it bottom-up: inputs feed mechanisms, mechanisms enforce goals.

<figure class="diag-figure">
  <figcaption>Security goal dependencies — access control is the enforcement hub; identity, secret, and policy are the inputs</figcaption>
  <svg viewBox="0 0 820 320" class="diag-svg" role="img" aria-label="Six security goals and their dependencies">
    <defs>
      <marker id="arr-g-goals" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>

    <!-- top row: enforced goals -->
    <rect x="20"  y="20" width="170" height="50" class="d-node-acc"/>
    <text x="105" y="42" text-anchor="middle" class="d-h-sm">Confidentiality</text>
    <text x="105" y="60" text-anchor="middle" class="d-sub">only authorised read</text>

    <rect x="220" y="20" width="170" height="50" class="d-node-acc"/>
    <text x="305" y="42" text-anchor="middle" class="d-h-sm">Integrity</text>
    <text x="305" y="60" text-anchor="middle" class="d-sub">no unauthorised change</text>

    <rect x="420" y="20" width="170" height="50" class="d-node-acc"/>
    <text x="505" y="42" text-anchor="middle" class="d-h-sm">Authorization</text>
    <text x="505" y="60" text-anchor="middle" class="d-sub">policy-bound resource use</text>

    <rect x="620" y="20" width="170" height="50" class="d-node-acc"/>
    <text x="705" y="42" text-anchor="middle" class="d-h-sm">Availability</text>
    <text x="705" y="60" text-anchor="middle" class="d-sub">reachable when needed</text>

    <!-- middle row: enforcement hub -->
    <rect x="280" y="130" width="260" height="50" class="d-node-ink"/>
    <text x="410" y="152" text-anchor="middle" class="d-h-inv">Access Control</text>
    <text x="410" y="170" text-anchor="middle" class="d-sub">enforcement mechanism</text>

    <!-- accountability island, right -->
    <rect x="620" y="130" width="170" height="50" class="d-node-acc"/>
    <text x="705" y="152" text-anchor="middle" class="d-h-sm">Accountability</text>
    <text x="705" y="170" text-anchor="middle" class="d-sub">identify principal</text>

    <!-- arrows from access control up to goals -->
    <line x1="350" y1="130" x2="120" y2="74" class="d-edge" marker-end="url(#arr-g-goals)"/>
    <line x1="380" y1="130" x2="305" y2="74" class="d-edge" marker-end="url(#arr-g-goals)"/>
    <line x1="440" y1="130" x2="490" y2="74" class="d-edge" marker-end="url(#arr-g-goals)"/>
    <line x1="500" y1="130" x2="660" y2="74" class="d-edge" marker-end="url(#arr-g-goals)"/>

    <!-- bottom row: inputs -->
    <rect x="40"  y="240" width="170" height="50" class="d-node"/>
    <text x="125" y="262" text-anchor="middle" class="d-h-sm">Entity Auth</text>
    <text x="125" y="280" text-anchor="middle" class="d-sub">who is the principal?</text>

    <rect x="240" y="240" width="170" height="50" class="d-node"/>
    <text x="325" y="262" text-anchor="middle" class="d-h-sm">Data-Origin Auth</text>
    <text x="325" y="280" text-anchor="middle" class="d-sub">who produced the data?</text>

    <rect x="440" y="240" width="120" height="50" class="d-node"/>
    <text x="500" y="262" text-anchor="middle" class="d-h-sm">Policy</text>
    <text x="500" y="280" text-anchor="middle" class="d-sub">what is allowed?</text>

    <rect x="590" y="240" width="180" height="50" class="d-node"/>
    <text x="680" y="262" text-anchor="middle" class="d-h-sm">Digital Evidence</text>
    <text x="680" y="280" text-anchor="middle" class="d-sub">logs, transaction records</text>

    <!-- arrows up to hub / accountability -->
    <line x1="170" y1="240" x2="310" y2="184" class="d-edge" marker-end="url(#arr-g-goals)"/>
    <line x1="325" y1="240" x2="370" y2="184" class="d-edge" marker-end="url(#arr-g-goals)"/>
    <line x1="500" y1="240" x2="450" y2="184" class="d-edge" marker-end="url(#arr-g-goals)"/>
    <line x1="680" y1="240" x2="705" y2="184" class="d-edge" marker-end="url(#arr-g-goals)"/>
  </svg>
</figure>

### Entity vs data-origin authentication

Authentication splits into two flavours that answer different questions:

- **Entity authentication** verifies the **identity of users** (or of a process acting on their behalf). Example: a login asks you to prove who you are before granting a session. The question is *who is at the other end of this channel right now?*
- **Data-origin authentication** verifies the **source of data**. Example: a digital signature on an email lets the receiver verify which principal produced it, independently of when or how it was delivered. The question is *who produced this artifact?*

Both rely on a secret or a verifiable uniqueness property bound to an asserted identity.

### Why the goals are interdependent

- Authorization without authentication is meaningless: you cannot enforce "only X may do Y" if you cannot tell who X is.
- Accountability without integrity is fragile: logs that can be silently edited prove nothing.
- Confidentiality without authorization collapses to whoever can read the bits.

> [!warning] Sample exam pitfall — Sample Paper Q1
> Listing only the CIA triad when asked for the foundational goals loses marks. List all six. Also avoid claiming non-repudiation is one of the six — Accountability is the named goal.

---

## Security Policy, Attacks, and Secure States

Security in this course starts from **policy and goals**, not from tools. A **security policy** specifies system rules and practices, defining what is *allowed* and *not allowed*. It is the formal expression of the desired secure state.

An **attack** is a *deliberate* step intended to cause a security violation — to drive the system from a **secure state** (no policy violation) into a **non-secure state** (policy violated). The framing matters: an attack is not "anything bad" but specifically an action that contradicts the policy.

<figure class="diag-figure">
  <figcaption>Secure-state model and attack anatomy — a threat agent becomes an attacker who reaches the target asset through an attack vector exploiting a vulnerability</figcaption>
  <svg viewBox="0 0 820 240" class="diag-svg" role="img" aria-label="Secure state and attack anatomy">
    <defs>
      <marker id="arr-g-att" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-d-att" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-dan"/>
      </marker>
    </defs>

    <!-- left: state machine -->
    <rect x="20"  y="80" width="140" height="60" class="d-node-acc"/>
    <text x="90"  y="105" text-anchor="middle" class="d-h-sm">Secure</text>
    <text x="90"  y="123" text-anchor="middle" class="d-h-sm">state</text>

    <rect x="230" y="80" width="160" height="60" class="d-node-dan"/>
    <text x="310" y="105" text-anchor="middle" class="d-h-sm">Non-secure</text>
    <text x="310" y="123" text-anchor="middle" class="d-h-sm">state</text>

    <path d="M 30 60 C 30 30, 150 30, 150 60" class="d-edge" marker-end="url(#arr-g-att)"/>
    <text x="90" y="40" text-anchor="middle" class="d-sub">action not violating policy</text>

    <line x1="160" y1="110" x2="228" y2="110" class="d-edge-dan" marker-end="url(#arr-d-att)"/>
    <text x="194" y="100" text-anchor="middle" class="d-label-danger">violation</text>

    <!-- separator -->
    <line x1="420" y1="20" x2="420" y2="220" class="d-edge dashed"/>

    <!-- right: attack anatomy -->
    <rect x="450" y="30" width="150" height="46" class="d-node"/>
    <text x="525" y="58" text-anchor="middle" class="d-h-sm">Threat agent</text>

    <line x1="525" y1="76" x2="525" y2="100" class="d-edge" marker-end="url(#arr-g-att)"/>
    <text x="540" y="92" class="d-sub">activated</text>

    <rect x="450" y="104" width="150" height="46" class="d-node-acc"/>
    <text x="525" y="132" text-anchor="middle" class="d-h-sm">Attacker</text>

    <!-- three attack vectors -->
    <path d="M 525 150 L 720 180" class="d-edge-dan" marker-end="url(#arr-d-att)"/>
    <path d="M 525 150 L 720 160" class="d-edge-dan" marker-end="url(#arr-d-att)"/>
    <path d="M 525 150 L 720 200" class="d-edge-dan" marker-end="url(#arr-d-att)"/>
    <text x="630" y="148" class="d-sub">attack vector</text>
    <text x="640" y="222" class="d-sub">vulnerability</text>

    <rect x="720" y="150" width="80" height="60" class="d-node-acc"/>
    <text x="760" y="178" text-anchor="middle" class="d-h-sm">Target</text>
    <text x="760" y="196" text-anchor="middle" class="d-h-sm">asset</text>
  </svg>
</figure>

Attack examples from Lecture 1: unauthorized access, data breaches, denial-of-service. Each is a *type* of policy violation, not a general label for "bad outcome."

> [!tip] Tutorial 1 Part B Q2 / Sample Paper Part B Q1
> A complete answer states: (1) the policy defines allowed and disallowed actions; (2) an attack is a deliberate step to violate that policy, moving the system into a non-secure state; (3) a concrete example, e.g. *"only the finance group may modify financial records"* — any threat vector that lets another principal modify them breaks the policy and creates a non-secure state.

---

## Risk Assessment

Risk is the **expected loss** due to harmful future events relative to assets, over a fixed time period. The lecture compresses this into a multiplicative equation:

$$R = T \times V \times C$$

where the terms are defined precisely:

| Term | Meaning | Note |
|---|---|---|
| $T$ | Probability the threat is **activated** in the time window | "Threat occurrence" |
| $V$ | Probability the threat **succeeds in compromising** the system, given that it fired | Conditional on $T$ — *tested verbatim on Sample Paper Q2* |
| $C$ | **Cost** if the attack succeeds: tangible plus intangible | Not just monetary — includes reputation, regulatory penalties, loss of trust |

> [!warning] $V$ is a probability, not a count
> A common error is to define $V$ as "the vulnerability level" loosely, or worse as "the number of vulnerabilities." The lecture and the sample exam are explicit: $V$ is the probability that *if the threat is activated, the system is successfully compromised*. Sample Paper Q2 marks only option (c) — "the probability that the system, if attacked, will be successfully compromised."

### Worked example — single risk calculation

Given an internal financial application:

- $T = 0.02$ (2% annual probability)
- $V = 0.7$ (70% chance of successful compromise if attempted)
- $C = €5{,}000{,}000$

$$R = 0.02 \times 0.7 \times 5{,}000{,}000 = €70{,}000$$

The annual expected loss is $€70{,}000$. A patch programme would mostly drive $V$ down; user training drives $T$ down (fewer phishing-induced firings) and can reduce $C$ via faster response.

### Worked example — comparing two controls

A university with $T = 0.1$, $V = 0.8$, $C = €2{,}000{,}000$ considers:

- **Option A** (firewall upgrade): $V$ drops from $0.8 \to 0.3$, $T$ unchanged
- **Option B** (IDS plus staff training): $T$ drops from $0.1 \to 0.02$, $V$ unchanged

$$R_A = 0.1 \times 0.3 \times 2{,}000{,}000 = €60{,}000$$

$$R_B = 0.02 \times 0.8 \times 2{,}000{,}000 = €32{,}000$$

Option B yields lower expected risk at the same cost, so it is the rational choice. The lecture pattern: different controls act on different terms, and the cheapest reduction depends on which term is most reducible.

---

## Adversary Modeling

Adversary modeling identifies and understands potential attackers: their objectives, methods, capabilities, and resources. Lecture 1 enumerates **five attributes** of an adversary.

### The five adversary attributes

| # | Attribute | Meaning | Example |
|---|---|---|---|
| 1 | **Objectives** | Goals of the adversary, suggesting target assets | Stealing sensitive data, disrupting services, financial gain |
| 2 | **Methods** | Anticipated attack techniques or types of attack | Phishing, malware, social engineering, direct network attacks |
| 3 | **Capabilities** | Resources, skills, knowledge available — computing power, knowledge of vulnerabilities, skilled personnel, opportunity (e.g. physical access) | Access to high-powered computers, vulnerability research, skilled personnel |
| 4 | **Funding Level** | Financial resources influencing determination and methods | Government-funded agencies vs individual hackers |
| 5 | **Outsider vs Insider** | Origin of the attack | Outsiders launch without prior special access; insiders begin with credentials |

> [!warning] Sample exam — Q3 tested Capabilities by definition
> Q3 phrased Capabilities as "the adversary's technical means and skill set." Funding Level (Q3 of Tutorial 1) is *specifically the financial backing*, not skill. Confusing the two costs the mark.

### The seven named adversary groups

Lecture 1 lists seven named adversary groups, ordered roughly from most to least capable:

1. **Foreign intelligence** (including government-funded agencies)
2. **Cyber-terrorists** or politically-motivated adversaries
3. **Industrial espionage agents** (perhaps funded by competitors)
4. **Organized crime** (groups)
5. **Lesser criminals and crackers** (individuals who break into computers)
6. **Malicious insiders** (including disgruntled employees)
7. **Non-malicious employees** (often security-unaware)

The split between rows 6 and 7 is important. Malicious insiders act with intent; non-malicious employees harm the organization through error — clicking a phishing link, mis-sharing a document, plugging in an unknown USB. Both are insiders, but they need different defences (see Insider vs Outsider below).

---

## Threat Modeling

Threat modeling is the structured process of identifying, classifying, and prioritising potential threats *before* an attacker finds them first. A **threat model** identifies the threats, threat agents, and attack vectors considered in scope to defend against. The lecture covers **four approaches**, each with different strengths.

### The four threat-modelling approaches

| Approach | How it identifies threats | Strength | Weakness |
|---|---|---|---|
| **Diagram-Driven** | Architectural diagram → mark gateways → define trust domains → assess violations → simplify to data-flow diagram | Highly contextual; surfaces system-specific issues; matches complex architectures | Time-intensive; depends on diagram completeness; no predefined threat list |
| **Attack Trees** | Hierarchical decomposition with attacker goal at the root, methods as branches, concrete actions as leaves; AND/OR nodes | Visualises attack paths and dependencies; good for comparing attack costs | Time-consuming for large systems; quality depends on analyst |
| **Checklists** | Static list of known threats, used to verify coverage | Fast, consistent, requires little expertise | Misses anything not on the list; biased toward known patterns |
| **STRIDE** | Walk each component/data flow against six predefined categories | Systematic mnemonic; great for brainstorming | May miss novel threats outside the six categories; less architectural detail than diagram-driven |

> [!tip] Tutorial 1 Part B Q3
> When asked to compare two approaches, name *how each identifies threats*, then list one advantage and one disadvantage of each. The most defensible pairing is Diagram-Driven (architectural, contextual, slow) vs STRIDE (categorical, fast, may miss novel issues).

### STRIDE — six categories

STRIDE is a mnemonic for six threat categories. Sample Paper Q1 tested the expansion verbatim.

| Letter | Threat | Property Violated |
|---|---|---|
| **S** | **S**poofing | Authentication |
| **T** | **T**ampering | Integrity |
| **R** | **R**epudiation | Non-repudiation |
| **I** | **I**nformation Disclosure | Confidentiality |
| **D** | **D**enial of Service | Availability |
| **E** | **E**scalation of Privilege | Authorisation |

Applied to a login form, the walkthrough is:

```
S - Spoofing:        Can attacker impersonate the user?     → strong authentication
T - Tampering:       Can credentials be modified in transit? → HTTPS
R - Repudiation:     Can a user deny they logged in?         → audit logs
I - Info Disclosure: Can passwords leak in error messages?   → sanitise output
D - DoS:             Can the form be flooded?                → rate-limit
E - Escalation:      Can low-privilege gain admin access?    → enforce RBAC
```

### Attack Trees

An attack tree has the attacker's overall goal as the **root**, sub-goals as **branches**, and concrete actions as **leaves**. Nodes can be **AND** (all children needed) or **OR** (any child suffices). Each path from leaf to root represents an attack vector. The lecture's canonical example uses "enter house" as the root, with children "by window," "by door," "by tunnel," and leaves like "lift sash" or the AND combination "use glass cutter" + "remove cut glass with suction lifter."

Tutorial 1 Part A Q4 tested this structure directly: the hierarchical model starting with the overall attack goal as root and leaves as methods is the Attack Tree.

### Diagram-Driven Modeling — the five named steps

Lecture 1 specifies five steps for the diagram-driven approach:

1. **Draw an architectural diagram** with system components and communication links.
2. **Mark gateways** where controls restrict communication (firewalls, routers, proxies).
3. **Define trust domains** based on trust assumptions (e.g. authenticated users, DMZ-facing services). Trust domains are areas with shared security policies or trust levels.
4. **Assess how trust assumptions could be violated** for each component, link, and domain. *What could go wrong here?*
5. **Simplify into a data flow diagram (DFD)** tracing data flow through the tasks the system performs.

Step 5 is critical: the architectural diagram shows *what exists*; the DFD shows *what data moves where*, which is what threats actually exploit.

#### Considering user workflow

Trace user actions from task initiation to completion, including *uncommon tasks like account creation and software updates*. These flows happen rarely and are easy to forget, but provisioning often has weaker checks and update channels are high-value supply-chain targets. Highlight where sensitive data is stored and ensure every access path is shown, not just the happy path.

---

## Model-Reality Gaps

A security model is only as good as its assumptions. A **model-reality gap** is a mismatch between an assumption the model depends on and the actual properties of the real system. The lecture states explicitly: threat modeling is difficult due to *invalid assumptions* and *focusing on the wrong threats*.

> [!info] Quality of a threat model
> The quality of a threat model depends on how accurately it reflects system details and the operating environment.

### The three sources of gaps

Lecture 1 names exactly three sources:

1. **Abstraction** — the model deliberately omits detail; the omitted detail turns out to matter.
2. **Invalid assumptions** — an assumption (about an interface, a user, a provider) is simply wrong.
3. **Misplaced trust** — a component or actor was trusted to behave correctly but does not.

### The Hotel Safebox example

The canonical example: a guest checks into a hotel with a small safe and chooses a combination. The guest's threat model assumes only those who know the combination can open the safe. Reality includes hotel staff with master keys.

```
Model:    "Only someone who knows the combination can open the safe."
Reality:  Hotel staff hold master keys that bypass the combination.
Source:   Abstraction (hotel was abstracted out) + misplaced trust (in hotel as benign).
Fix:      Re-model with the hotel as an actor with master-key capability;
          for items that truly need a guest-only secret, use external storage.
```

The locking mechanism works as advertised; the gap is in the threat model, which never represented the hotel as an actor.

### Cloud isolation example

```
Model:    "Cloud provider enforces strict tenant isolation."
Reality:  Provider uses a hypervisor with a known VM-escape vulnerability.
Effect:   Cross-tenant attacks possible even though the model treated them as impossible.
Source:   Misplaced trust in the provider's hypervisor.
Fix:      Request provider's security audit, conduct independent pen-testing,
          establish explicit SLAs and security contracts.
```

### Mitigations

- Regular audits and penetration tests to probe assumptions.
- Third-party certification reviews.
- Explicit SLAs and security contracts with providers.
- Assume adversarial conditions for critical components, not benign ones.
- Re-examine what has been abstracted away; abstraction itself is a source of gaps.

> [!tip] Tutorial 1 Part B Q5
> A full-marks cloud answer pairs a *defensive assumption* with a *real-world condition that breaks it*, names the gap source (typically misplaced trust or invalid assumptions), and proposes one concrete mitigation such as third-party penetration testing or SLAs that detail security responsibilities.

---

## Human Factors, Insider Threats, and Ethical Use

Many security failures begin with people: weak password choices, oversharing, developer secrets left in client-visible files, administrators trusting compromised output. The lecture does not treat these as side issues; they are core causes of compromise.

### Insider vs outsider threats

- **Outsiders** lack legitimate access and must breach perimeter defences. They may still be sophisticated, often relying on phishing and malware.
- **Insiders** start with trust, credentials, or contextual knowledge. That starting advantage often makes them more dangerous, not because of greater skill but because they begin closer to valuable assets.

### Malicious insiders vs non-malicious employees

Lecture 1 separates groups 6 and 7 deliberately. Each requires a different defensive style:

| Category | Intent | Defensive style |
|---|---|---|
| **Malicious insider** | Deliberate harm — credential abuse, exfiltration | *Detection-oriented*: least privilege, separation of duties, monitoring, auditing, fast revocation when behaviour changes |
| **Non-malicious employee** | No intent to harm; harm via error — phishing clicks, mis-sharing, unsafe USBs | *Design-oriented*: safer defaults, simpler secure workflows, mandatory training, phishing-resistant authentication, minimising rights so mistakes cannot escalate |

A single control set rarely covers both. A monitoring rule flags exfiltration but does not stop a security-unaware employee from emailing a sensitive spreadsheet to the wrong address. Tutorial 1 Part B Q4 expects this distinction.

### Ethical use of security tools

Lecture 1 closes with a hard line: the skills taught are for **lawful and protective purposes only**. All practical exercises must be performed *exclusively within the lab environment*. Penetration testing, network scanning, and vulnerability exploitation outside the lab are strictly prohibited and can violate local, national, and international laws, with consequences including fines and imprisonment.

The capability/authorization distinction matters: being technically able and being authorized are different questions. The same technique can be legal or illegal depending on scope.

---

## Defense in Depth and Security Posture

A secure system is rarely protected by a single mechanism. **Defense in depth** uses multiple overlapping controls so that one failure does not cause total compromise. A phishing email might be blocked by mail filtering, then by browser protections, then by least privilege on the host, then by network segmentation, and finally detected by monitoring if execution still occurs.

**Security posture** is the system-wide view: not only *what controls exist?* but *what is exposed, what assumptions are wrong, what happens when one layer fails, and how quickly can the system detect and recover?*

<figure class="diag-figure">
  <figcaption>Security posture as concentric layers — hardware at the centre, surrounded by built-in software security, surrounding mechanisms, and operational procedures</figcaption>
  <svg viewBox="0 0 760 320" class="diag-svg" role="img" aria-label="Defense-in-depth layers around a target system">
    <!-- outermost: operational procedures -->
    <circle cx="380" cy="160" r="140" class="d-node"/>
    <text x="380" y="40" text-anchor="middle" class="d-h-sm">Operational procedures</text>

    <!-- security mechanisms around product -->
    <circle cx="380" cy="160" r="110" class="d-node-acc"/>
    <text x="380" y="70" text-anchor="middle" class="d-h-sm">Mechanisms around product</text>

    <!-- security mechanisms built into product -->
    <circle cx="380" cy="160" r="76" class="d-node-acc"/>
    <text x="380" y="100" text-anchor="middle" class="d-h-sm">Built-in software security</text>

    <!-- software within product -->
    <circle cx="380" cy="160" r="44" class="d-node-ink"/>
    <text x="380" y="160" text-anchor="middle" class="d-h-inv">Software</text>
    <text x="380" y="176" text-anchor="middle" class="d-sub-inv">in product</text>

    <!-- hardware core -->
    <circle cx="380" cy="160" r="16" class="d-node-dan"/>
    <text x="380" y="220" text-anchor="middle" class="d-h-sm">Hardware</text>
    <text x="380" y="238" text-anchor="middle" class="d-sub">at the core</text>

    <!-- right-side annotations -->
    <text x="600" y="100" class="d-sub">SLAs, training, audits</text>
    <text x="600" y="130" class="d-sub">firewalls, IDS, segmentation</text>
    <text x="600" y="160" class="d-sub">access control, crypto, RBAC</text>
    <text x="600" y="190" class="d-sub">app code: validated, signed</text>
    <text x="600" y="220" class="d-sub">trusted boot, secure enclave</text>
  </svg>
</figure>

### Strategic design principles

Three principles from the firewall lecture generalise here:

- **Safe defaults** — deny access or restrict functionality unless explicitly allowed. A default-deny firewall is one example; tutorial Q10 of the sample paper specifically warns that *default-allow* policies let unrecognised services remain accessible.
- **Complete mediation** — check every access to every object, rather than assuming prior checks remain valid forever.
- **Isolated compartments** — segment via DMZs or access boundaries so one compromise does not propagate.

### Evaluating posture

Good posture asks which job each control is doing. Some controls *reduce attack surface*; some reduce *exploitation success* (drive $V$ down); some reduce *impact* (drive $C$ down); some only *detect* after the fact. Posture improves only when controls are matched to real risks, not when more controls are added blindly.

> [!warning] Common pitfalls
> - Assuming more controls means better posture, without checking whether they address real risks.
> - Confusing detection controls with prevention controls — they reduce different terms of the risk equation.
> - Treating physical and organizational security as separate from technical computer security — many purely technical defences can be bypassed if procedures and people are weak.

---

## Why Computer Security is Hard

Three forces from Lecture 1's closing slide:

1. **Rapid technological changes** — new systems, new interfaces, new attack surfaces.
2. **Evolving attack techniques** — yesterday's defence is tomorrow's bypass.
3. **Human factors and usability issues** — if the secure path is awkward, users and administrators route around it.

Security is an ongoing process requiring constant vigilance and adaptation, not a one-time engineering decision.

---

## Course Logistics

The course is 4 ECTS combining theory with labs. Final exam is 75%, project is 25%, with one hard pass condition.

| Component | Weight | Rule |
|---|---|---|
| Final exam | 75% | Must score $>55\%$ for the project grade to count |
| Project | 25% | Counts only if the final exam is passed |

Grade scale: $10$ for $>95\%$, $9$ for $>85\%$, $8$ for $>75\%$, $7$ for $>65\%$, $6$ for $>55\%$, $F$ below $55\%$. Exam is closed-book, 120 minutes, pens and a non-programmable calculator only. Late work loses 2 points per day past deadline.

Course scope per the syllabus and Lecture 1 objectives: foundational security concepts, cryptographic building blocks, user authentication, authentication and key establishment protocols, malicious software, web and browser security, firewalls and tunnels, intrusion detection, wireless LAN security, and blockchain technologies.

---

## Past Exam Coverage

- **Sample Paper Part A Q1 — STRIDE expansion.** Answer (b): "Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Escalation of Privilege, and helps ensure common threats are not overlooked." Be ready to map each letter to the security property it violates (S → Authentication, T → Integrity, R → Non-repudiation, I → Confidentiality, D → Availability, E → Authorisation).
- **Sample Paper Part A Q2 — $V$ in the risk equation.** Answer (c): "the probability that the system, if attacked, will be successfully compromised." Reject the dollar-amount, attacker-motivation, and remediation-cost distractors — $V$ is a conditional probability, not a count or a cost.
- **Sample Paper Part A Q3 — adversary attribute for technical means and skill set.** Answer (d) Capabilities. Distinguish from Funding Level (Q3 of Tutorial 1, financial backing only) and Methods (techniques used).
- **Sample Paper Part B Q1 — security policy and threat modeling.** Three required elements: (1) the policy defines permitted and forbidden actions; (2) threat modeling uses the policy to find possible violations, and a violation drives the system into a non-secure state; (3) a concrete example, e.g. "only the finance group may modify financial records" — any threat vector that lets another principal modify them breaks the policy.
- **Tutorial 1 Part A — five MCQs** covering: foundational goals (Repudiation is the *not* answer), authentication (identity/genuineness), Funding Level (financial resources), Attack Trees (root-to-leaf hierarchy), and $V$ in $R = T \times V \times C$ (vulnerability level).
- **Tutorial 1 Part C — risk calculations.** Be fluent computing $R = T \times V \times C$ in Euros and discussing which term each control reduces; sample answers compute $R = €70{,}000$ for the first scenario and compare $R_A = €60{,}000$ vs $R_B = €32{,}000$ for two controls at equal cost.

---

## Course Structure, Assessment, and Exam Rules

> [!abstract] Why this note matters
> - This note defines the grading rules and pass conditions that determine how the course is actually passed.
> - The syllabus also tells you what kinds of materials and behaviors the course expects.

### Overview

BCS2420 is a 4-ECTS course that combines theory with labs. The course is designed to teach security reasoning, not only tool usage. That matters because the final exam is closed-book and requires you to explain concepts cleanly from memory rather than searching for commands or definitions.

The assessment structure is simple but strict: the final exam is worth 75% and the project 25%, yet the project only counts if you pass the final exam. In practical terms, that means exam mastery is the gating condition for passing the course.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **closed-book exam**: An exam where you cannot consult notes or other course materials during the sitting.
- **resit**: A second exam attempt after failing or missing the regular attempt.
- **pass condition**: A rule that must be satisfied regardless of other scores, such as the requirement to pass the final exam for the project to count.

### Detailed Explanation

The syllabus makes the course philosophy explicit. Lectures build the conceptual framework, while labs are where you test, question, and apply the ideas. That means the knowledge base must prepare you for both explanation questions and lab-style reasoning questions.

The grading rule is especially important. A strong project cannot rescue a failed final exam. So your revision should prioritize examinable lecture concepts, the recurring tutorial question types, and the kinds of reasoning used in labs.

The resit rule is also worth understanding early because it affects strategy. Your project grade from the normal period still counts, but the resit calculation protects you by taking the maximum of the weighted-combination grade and the exam-only resit grade.

The syllabus also gives a useful planning signal about scope. Roughly ten examinable topics are spread across the lecture series, with the remaining study hours expected to be used for revision, labs, and tool exploration. So an effective study plan should not treat the course as a loose collection of facts; it should treat each lecture block as a coherent topic with theory, tutorial reasoning, and lab consequences.

### How It Works

Read the course as having two simultaneous goals: learn the theory well enough to explain it under closed-book conditions, and learn the practical material well enough to reason about vulnerabilities and defenses.

Because the exam is 120 minutes and closed-book, short, structured answers matter: definition, mechanism, attack path, defense, and consequence.

The syllabus also explicitly requires ethical use of tools. Kali, nmap, and Wireshark are part of the learning environment, not permission to probe arbitrary systems.

Use the course structure itself as a revision guide: lecture note -> tutorial compare/explain questions -> lab mindset and evidence collection -> closed-book recall.

### What You Must Know

- Project counts for 25%, final exam for 75%.
- You must score **>55% on the final exam** for the project grade to count. Score ≤55% and you fail the course regardless of your project grade.
- Grade scale: 10 = 95–100% | 9 = 85–94% | 8 = 75–84% | 7 = 65–74% | 6 = 55–64% | F = below 55%.
- The final exam is closed-book, 120 minutes, and only allows writing instruments and a DACS-approved calculator.
- Late work: −2 points per day past the deadline.
- Resit formula: `max( (resit_exam/7.5) + (project/2.5), (resit_exam/10) )` — project grade from the normal period still counts.

### 30-Second Oral Answer

- This course is theory plus labs, but the final exam is the main gatekeeper.
- The project only counts if the final exam is passed, so the exam is the critical constraint.
- Closed-book means I need active recall of concepts, attacks, defenses, and tradeoffs, not just tool familiarity.

### Typical Exam Questions

- How is the course graded?
- What happens if the final exam is failed?
- Why does the course emphasize both theory and labs?

### Common Pitfalls

- Assuming the project can compensate for a failed final exam.
- Treating the labs as separate from the theory instead of as applications of it.
### Related Concepts

- [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]

## Security Goals, Policy, Adversaries, and Risk

> [!abstract] Why this note matters
> - Lecture 1 and Tutorial 1 define the vocabulary that the rest of the course assumes.
> - The risk equation and policy-based view of attacks are exam-style building blocks.

### Overview

Security in this course starts from policy and goals, not from tools. Tools matter only because they help defend confidentiality, integrity, availability, or related properties such as authentication and accountability.

Lecture 1 uses major incidents like WannaCry, NotPetya, Stuxnet, and TRITON to show that security failures are not abstract. They affect hospitals, shipping, industry, and safety systems. The correct mental model is therefore broad: a system is secure only relative to a policy and a threat environment.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **confidentiality**: Non-public information remains accessible only to authorized parties.
- **integrity**: Data, software, or hardware remains unaltered except by authorized parties.
- **availability**: Information, services, and computing resources remain accessible for authorized use.
- **security policy**: A statement of what is allowed and disallowed in a system or organization.
- **attack**: Deliberate steps intended to cause a security violation — to drive the system from a secure state into a non-secure state.
- **risk** (verbal): The expected loss due to harmful future events relative to assets, over a fixed time period.
- **risk** (equation): `R = T * V * C` — threat probability times vulnerability times cost.
- **V (vulnerability)**: Probability of a successful compromise, given that the threat is activated. (Tested verbatim on the 2025-03-21 past exam.)
- **C (cost)**: Tangible plus intangible cost if the attack succeeds — not just monetary loss.

### Detailed Explanation

A security policy describes the desired secure state. An attack is not merely 'something bad'; it is an intentional effort to violate the policy. That framing matters because it links technical events back to organizational intent and acceptable behavior.

The CIA triad is the classical foundation, but Lecture 1 names three more — Authorization, Authentication, Accountability — as foundational goals alongside it. See [[Security Goals Beyond CIA — Authorization, Authentication, Accountability|Security Goals Beyond CIA — Authorization, Authentication, Accountability]] for those.

Confidentiality protects secrecy, integrity protects correctness and trustworthiness, and availability protects access and operational continuity. Real incidents often violate more than one pillar at once. Ransomware harms availability, often confidentiality, and sometimes integrity as well.

#### CIA Methods (Lecture 1, slides 16-21)

Each pillar of the CIA triad is supported by specific defensive methods. Lecture 1 lists them explicitly:

| Goal | Methods | Notes |
|------|---------|-------|
| **Confidentiality** | Access Control, Data Encryption, Procedural Means | Access control is OS-enforced; encryption uses cryptographic algorithms; procedural means = physical access restrictions to offline storage media. |
| **Integrity** | Error Detection/Correction Codes (for benign errors); Access Controls + Cryptographic Checksums (against malicious alteration) | The benign vs malicious split is the key distinction. Example: ensuring software updates are not tampered with. |
| **Availability** | Reliable Hardware and Software; Protection Mechanisms | Reliable HW/SW addresses faults; protection mechanisms address intentional disruption such as denial of service. |

#### Adversary Modeling (Lecture 1)

Adversary modeling identifies and understands potential attackers, their objectives, methods, capabilities, and resources. Lecture 1 lists **five** attributes of an adversary (the original four plus Outsider vs Insider):

1. **Objectives**: Goals of the adversary — what assets they target (stealing sensitive data, disrupting services, financial gain).
2. **Methods**: Anticipated attack techniques or types of attacks (phishing, malware, social engineering, direct network attacks).
3. **Capabilities**: Resources, skills, and knowledge available — computing power, knowledge of system vulnerabilities, skilled personnel, opportunity (e.g. physical access). *Tested on 2025-03-21 exam Q3 as "technical means and skill set."*
4. **Funding Level**: Financial resources influencing determination and methods (government-funded agencies vs individual hackers).
5. **Outsider vs Insider**: Origin of the attack. Outsiders launch attacks without prior special access; insiders have some starting advantage, such as employees with network credentials.

#### Named Groups of Adversaries (Lecture 1)

Lecture 1 also lists seven named adversary groups, ordered loosely from most to least capable:

1. **Foreign intelligence** (including government-funded agencies)
2. **Cyber-terrorists** or politically-motivated adversaries
3. **Industrial espionage agents** (perhaps funded by competitors)
4. **Organized crime** (groups)
5. **Lesser criminals and crackers** (individuals who break into computers)
6. **Malicious insiders** (including disgruntled employees)
7. **Non-malicious employees** (often security-unaware) — distinct from malicious insiders; their harm is accidental but real. See [[Human Factors, Insider Threats, and Ethical Security Practice|Human Factors, Insider Threats, and Ethical Security Practice]].

#### Risk Equation

The risk equation gives a planning model: threat probability times vulnerability times cost. It is not perfect, but it trains the right habit: security is about reducing either the likelihood of attacks, the likelihood of success, or the impact of compromise.

Note carefully:
- **T** is the probability the threat is activated.
- **V** is the probability that, if activated, the threat *succeeds in compromising the system* — i.e. vulnerability is conditional on the threat firing.
- **C** is the cost if the attack succeeds, and includes both **tangible** (revenue loss, replacement hardware) and **intangible** (reputation, regulatory penalties, loss of trust) components.

### How It Works

If the policy says only authorized payroll staff may access salary records, then unauthorized disclosure is a confidentiality violation and therefore an attack success.

If `R = T * V * C`, then you can lower risk by reducing threat probability, reducing vulnerability, or reducing impact. Different controls act on different terms.

Attack trees and similar threat-modeling methods work by starting from an attacker goal and breaking it into feasible subgoals or techniques.

### What You Must Know

- CIA triad and the supporting methods for each pillar (access control / encryption / procedural for C; error codes vs access control + checksums for I; reliable HW/SW + protection mechanisms for A).
- That Lecture 1's foundational goals are six, not three — CIA *plus* Authorization, Authentication, Accountability.
- The relation between security policy and attacks: an attack is a deliberate step intended to drive the system from secure to non-secure state.
- All **five** adversary attributes: objectives, methods, capabilities, funding level, **outsider vs insider**.
- The **seven** named adversary groups (foreign intelligence through non-malicious employees).
- The verbal definition of risk: expected loss due to harmful future events relative to assets, over a fixed time period.
- The risk equation `R = T * V * C`, the precise meaning of V (probability of successful compromise), and that C includes intangible costs.

### 30-Second Oral Answer

- Security is defined relative to policy: an attack is a policy violation or an attempt to cause one.
- The CIA triad gives the basic goals, while risk reasoning adds probability, weakness, and impact.
- Good answers connect a concrete threat to the policy it violates and the control that reduces the risk.

### Typical Exam Questions

- What is the relationship between a security policy and an attack?
- How would you explain the CIA triad using a real system, and what defensive methods support each pillar?
- What does each variable in `R = T * V * C` represent? (V was tested verbatim on 2025-03-21.)
- Name the five adversary attributes from Lecture 1.
- Name three of the seven named adversary groups and place them on the capability spectrum.
- Why can cyber incidents have operational and reputational impacts beyond pure technical damage?

### Common Pitfalls

- Treating CIA as isolated buzzwords without examples or supporting methods.
- Listing only four adversary attributes (missing Outsider vs Insider).
- Treating non-malicious employees as the same category as malicious insiders.
- Defining V as "vulnerability count" rather than "probability of successful compromise."
- Treating C as monetary only — the lecture explicitly says tangible + intangible.
- Calling every failure an 'attack' without referencing the policy being violated.
- Thinking risk can only be reduced by buying more tools rather than by reducing vulnerability or impact.

### Concrete Examples and Commands

#### Risk calculation pattern

```text
Given:
T = 0.02
V = 0.7
C = 5,000,000 EUR

R = T * V * C
R = 0.02 * 0.7 * 5,000,000
R = 70,000 EUR expected annual risk
```

A technical control such as better patching mostly lowers `V`, while staff training or improved monitoring may lower `T` or reduce `C` indirectly by speeding response.

### Worked Examples

#### Policy violation example

Suppose a university policy states that only enrolled students may access exam solutions before the review session.

If an attacker exposes the solution files through a misconfigured web directory, the secure state is broken because unauthorized access became possible. The exploit is an attack success because it violated the policy, not just because 'a file leaked'.

### Related Concepts

- [[Security Goals Beyond CIA — Authorization, Authentication, Accountability|Security Goals Beyond CIA — Authorization, Authentication, Accountability]]
- [[Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]
- [[Defense in Depth, Security Strategy, and Security Posture|Defense in Depth, Security Strategy, and Security Posture]]
- [[Human Factors, Insider Threats, and Ethical Security Practice|Human Factors, Insider Threats, and Ethical Security Practice]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]

## Security Goals Beyond CIA — Authorization, Authentication, Accountability

> [!abstract] Why this note matters
> - Lecture 1 lists six foundational security goals, not three. The CIA triad is only half the picture; Authorization, Authentication, and Accountability complete it.
> - Past exam (2025-03-21) Q3 tested an adversary-modeling attribute by definition; the same style of "match the definition to the named concept" question recurs for the security goals.
> - Distinguishing entity authentication from data-origin authentication is a recurring source of confusion that the lecture explicitly disambiguates.

### Overview

The CIA triad (confidentiality, integrity, availability) is the classical starting point, but Lecture 1 places it inside a wider set of six foundational security goals. The other three — Authorization, Authentication, Accountability — are what tie security back to identities, permissions, and evidence after the fact.

In the Lecture 1 diagram, access control sits in the middle: it depends on authentication (who is the principal?) and policy (what are they allowed to do?), and it is the mechanism that enforces confidentiality, integrity, and authorization. Accountability sits to the side and is supported by digital evidence such as logs.

> [!info] Non-repudiation is *not* one of the six foundational goals
> Non-repudiation is a useful security property (and STRIDE's "Repudiation" threat maps to it), but Lecture 1's list of foundational goals is CIA plus Authorization, Authentication, and Accountability. Do not list non-repudiation as a foundational goal in an exam answer — list Accountability instead, since the lecture defines accountability as the property that supports holding principals responsible.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **authorization**: Computing resources accessible only by authorized entities.
- **authentication**: Assurance that a principal, data, or software is genuine.
- **entity authentication**: Verifies the identity of users (or processes acting on their behalf).
- **data-origin authentication**: Verifies the source of data (which principal produced this message?).
- **accountability**: Ability to identify principals responsible for actions.
- **principal**: An identified entity (user, process, device) to which actions can be attributed.

### Detailed Explanation

#### Authorization

Authorization is the property that computing resources — physical devices, software services, information — are accessible only by authorized entities. It is enforced by **access control mechanisms**, which restrict access according to a policy.

Authorization is distinct from authentication. Authentication answers *who are you?*; authorization answers *what are you allowed to do?* In the Lecture 1 diagram, access control depends on both: it consumes an authenticated identity together with a policy, and decides whether the operation is permitted.

#### Authentication: Entity vs Data-Origin

Lecture 1 splits authentication into two types because they answer different questions:

- **Entity Authentication** verifies the **identity of users** (or of a principal acting on a user's behalf). Example: a login asking you to prove who you are before granting a session.
- **Data-Origin Authentication** verifies the **source of data**. Example: a digital signature on an email that lets the receiver verify which principal produced it, independently of when or how it was delivered.

Both rely on a secret or a verifiable uniqueness property tied to an asserted identity. Entity authentication is about *who is at the other end right now*; data-origin authentication is about *who produced this artifact*.

#### Accountability

Accountability is the ability to identify the principals responsible for actions taken in the system. It is what makes after-the-fact investigation possible: when something goes wrong, accountability lets you answer "who did this?"

The lecture lists the supporting method as **transaction evidence and logs** — electronic means to record actions and identify principals. Logs only give accountability if (i) the recorded identifier maps back to a real principal (depends on authentication) and (ii) the log itself is protected from tampering (depends on integrity).

### How It Works

Authentication establishes who a principal is. Authorization, given that identity plus a policy, decides what they may do. Access control enforces that decision against confidentiality, integrity, and authorization properties. Accountability layers on top: every consequential action is logged with the authenticated principal, so responsibility can be assigned afterward.

The six goals are interdependent, not independent. Authorization without authentication is meaningless (you cannot enforce "only X may do Y" if you cannot tell who X is). Accountability without integrity is fragile (logs that can be silently edited prove nothing). Confidentiality without authorization collapses to whoever can read the bits.

### What You Must Know

- The six foundational security goals: Confidentiality, Integrity, Availability, Authorization, Authentication, Accountability.
- The Authorization definition: computing resources accessible only by authorized entities.
- The two types of authentication and what each verifies: entity (identity of users) vs data-origin (source of data).
- The Accountability definition: ability to identify principals responsible for actions, supported by transaction evidence and logs.
- That non-repudiation is a property, not one of the six foundational goals in this course.

### 30-Second Oral Answer

- The CIA triad is the starting set; Authorization, Authentication, and Accountability complete the six foundational goals.
- Authorization restricts resources to authorized entities; authentication splits into entity (identity) and data-origin (source) flavors; accountability uses transaction evidence and logs to identify the principals responsible for actions.
- These goals are interdependent: authorization needs authentication, accountability needs integrity, and access control is the central enforcement mechanism that ties them together.

### Typical Exam Questions

- What does it mean for a system to provide *authorization*?
- Distinguish entity authentication from data-origin authentication with one example each.
- Define accountability and name one mechanism that supports it.
- Is non-repudiation one of the foundational security goals in this course? Justify.

### Common Pitfalls

- Listing only the CIA triad when asked for the foundational goals of security.
- Conflating authentication and authorization — they answer different questions.
- Treating "authentication" as a single concept and missing the entity vs data-origin split.
- Listing non-repudiation as one of the six foundational goals (it is a property; the foundational goal is Accountability).
- Claiming logs alone provide accountability, ignoring that they depend on authentication and integrity of the log store.

### Concrete Examples and Commands

#### Login with logged operations

```text
Step 1 (entity authentication):
  User submits username + password / token.
  System verifies credentials → principal P established.

Step 2 (authorization):
  Policy: "only role=admin may delete records."
  Access control consults policy and P's role → permit or deny.

Step 3 (accountability):
  System writes log entry: [timestamp] P deleted record R via op O.
  Log is append-only and integrity-protected so a later auditor
  can identify the responsible principal.
```

#### Data-origin authentication

```text
Sender P signs message M with private key:
  sig = Sign_P(M)

Receiver verifies with P's public key:
  Verify_P(M, sig) → true means M originated from P.

Note: this is data-origin authentication, not entity authentication.
It tells you "who produced this message" — not "who is talking to
me on this channel right now."
```

### Related Concepts

- [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]
- [[Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps|Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps]]
- [[Defense in Depth, Security Strategy, and Security Posture|Defense in Depth, Security Strategy, and Security Posture]]

## Defense in Depth, Security Strategy, and Security Posture

> [!abstract] Why this note matters
> - The syllabus explicitly requires physical, operational, and organizational security as part of a broader strategy.
> - Later notes on firewalls, IDS, hardening, and web defenses all fit under this strategic layer.

### Overview

A secure system is rarely protected by a single mechanism. Firewalls, authentication controls, hardening, network monitoring, and organizational procedures work together. This layered approach is what makes a realistic security strategy possible.

The syllabus broadens security beyond cryptography and attacks. Physical security, operational discipline, and organizational practices are all part of the posture because many security failures originate in weak processes, weak defaults, or bad assumptions rather than in broken algorithms alone.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **defense in depth**: Using multiple overlapping controls so that one failure does not immediately cause total compromise.
- **security posture**: The overall state of a system's defenses, vulnerabilities, exposure, and ability to resist or respond to threats.
- **safe defaults**: A design principle where access is denied or functionality restricted unless explicitly allowed.
- **complete mediation**: Checking each access to each object rather than assuming prior checks remain valid forever.

### Detailed Explanation

Defense in depth means there are several chances to stop or limit an attack. For example, a phishing email might be blocked by mail filtering, then by browser protections, then by least privilege on the host, then by network segmentation, and finally detected by monitoring if execution still occurs.

Security posture is the big-picture view. It asks not only 'what controls exist?' but also 'what is exposed, what assumptions are wrong, what happens when one layer fails, and how quickly can the system detect and recover?'

The firewall lecture later uses principles such as safe defaults, isolated compartments, and complete mediation. Those are not only firewall ideas. They are strategic design ideas that generalize across the course. A default-deny firewall is one example of a safe default; compartmentalization via DMZs or access boundaries is one example of isolation.

Because the course emphasizes critical thinking, a strong answer should compare controls. Some controls reduce attack surface. Some reduce exploitation success. Some reduce impact. Some only detect. Security posture improves when you know which job each control is actually doing.

### How It Works

Defense in depth is not duplication for its own sake. Each layer should address either a different attack step or the same step in a different way.

Security posture improves when defaults are restrictive, privileges are minimal, services are segmented, and monitoring is present to catch what prevention misses.

Physical, operational, and organizational controls matter because many purely technical defenses can be bypassed if procedures and people are weak.

### What You Must Know

- What defense in depth means and why it matters.
- What security posture means in a system-wide sense.
- How safe defaults, complete mediation, and isolated compartments fit into strategy.
- Why physical, operational, and organizational security belong in the same discussion as technical controls.

### 30-Second Oral Answer

- Defense in depth means no single control is trusted as the only barrier.
- Security posture is the combined picture of exposure, controls, weaknesses, and response capability.
- Good security strategy uses restrictive defaults, segmentation, least privilege, monitoring, and sound operational practice together.

### Typical Exam Questions

- What is defense in depth?
- How would you evaluate the security posture of a system?
- Why are physical and organizational controls part of computer security?

### Common Pitfalls

- Assuming more controls automatically means better posture without checking whether they address real risks.
- Confusing detection controls with prevention controls.
### Related Concepts

- [[System Hardening, Vulnerability Reduction, and Secure Configuration|System Hardening, Vulnerability Reduction, and Secure Configuration]]
- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]

## Threat Modeling, STRIDE, Attack Trees, and Model-Reality Gaps

> [!abstract] Why this note matters
> - STRIDE appeared directly in Sample Paper Part A Q1 and Tutorial 1 MCQ.
> - Attack Trees and Diagram-Driven Modeling are compared in Tutorial 1 Part B.
> - Model-Reality Gaps appear in Tutorial 1 Part B Q5 and are a recurring exam theme.

### Overview

Threat modeling is the practice of systematically identifying what can go wrong in a system before an attacker finds it first. The course covers four structured approaches: STRIDE, Attack Trees, Diagram-Driven Modeling, and Checklists. Each uses a different lens to enumerate threats.

Model-Reality Gaps arise when the security model assumes something about the real system that is false — the most dangerous kind of security failure because it is invisible under normal conditions.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **threat modeling**: A structured process for identifying, classifying, and prioritizing potential threats to a system.
- **STRIDE**: A mnemonic for six threat categories: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Escalation of Privilege.
- **attack tree**: A hierarchical diagram where the root is the attacker's top-level goal and leaves are concrete methods to achieve sub-goals.
- **diagram-driven modeling**: A threat modeling approach based on architectural diagrams, data flow diagrams (DFDs), and trust boundary analysis.
- **checklist-based modeling**: Using a predefined list of known threat types to ensure completeness.
- **model-reality gap**: A mismatch between the assumptions made in a security model and the actual properties of the real system.

### Detailed Explanation

#### STRIDE

STRIDE is a structured mnemonic developed to ensure common threat categories are not overlooked when reviewing a system.

| Letter | Threat | Violates |
|--------|--------|----------|
| **S** | Spoofing | Authentication |
| **T** | Tampering | Integrity |
| **R** | Repudiation | Non-repudiation |
| **I** | Information Disclosure | Confidentiality |
| **D** | Denial of Service | Availability |
| **E** | Escalation of Privilege | Authorisation |

Usage: Walk through each system component and data flow. For each, ask: can someone spoof this? Tamper with it? Repudiate their actions? etc.

Advantage: Systematic, easy to remember, good for brainstorming sessions.
Disadvantage: May miss novel or unusual threats not in the six categories; gives less architectural detail than diagram-driven approaches.

#### Attack Trees

Attack trees represent threats as a hierarchical decomposition of an attacker's goal.

- **Root node**: The attacker's ultimate objective (e.g., "steal customer passwords").
- **Children nodes**: Sub-goals or alternative methods.
- **Leaves**: Concrete, actionable attack steps.

Nodes can be AND (all children must succeed) or OR (any child is enough).

Advantage: Visualises the space of attacks; makes dependencies explicit; good for comparing attack paths and costs.
Disadvantage: Time-consuming for large systems; quality depends on analyst completeness.

#### Diagram-Driven Modeling

A visual approach that starts with an architectural representation of the system: components, data flow links, gateways, and trust domains (areas with shared security policies or trust levels).

**Lecture 1's five named steps:**

1. **Draw an architectural diagram** with system components and communication links.
2. **Mark gateways** where controls restrict communication (firewalls, routers, proxies).
3. **Define trust domains** based on trust assumptions (e.g. "authenticated users," "DMZ-facing services").
4. **Assess how trust assumptions could be violated** for each component, link, and domain. ("What could go wrong here?")
5. **Simplify into a data flow diagram (DFD)** that traces data flow through the tasks the system performs.

The fifth step is critical: the architectural diagram shows *what exists*, but the DFD shows *what data moves where*, which is what threats actually exploit.

##### Consider user workflow

A diagram-driven model is only as complete as the workflows it covers. Lecture 1 stresses:

- **Trace user actions from task initiation to completion**, including *uncommon tasks like account creation and software updates*. These are easy to forget because they happen rarely, but they are exactly where attackers concentrate (provisioning flows often have weaker access checks; update channels are high-value supply-chain targets).
- **Highlight where sensitive data is stored** and ensure all access paths are shown — not just the obvious "happy path."

Advantage: Highly contextual; finds system-specific issues; good for complex architectures.
Disadvantage: Time-intensive; relies on accurate, complete diagrams; does not provide a predefined threat checklist.

#### Checklists

A static list of known threats or vulnerabilities used to quickly verify coverage. Often used alongside other methods.

Advantage: Fast, requires little expertise, consistent.
Disadvantage: Misses threats not on the list; tends toward known patterns, not novel ones.

#### Model-Reality Gaps

A security model is only as good as its assumptions. A model-reality gap is when an assumption the model depends on does not hold in practice. Threat modeling is difficult precisely *because* of invalid assumptions and the tendency to focus on the wrong threats.

##### Quality of a Threat Model (Lecture 1)

> The quality of a threat model depends on how accurately it reflects system details and the operating environment.

Lecture 1 names **three sources** from which model-reality gaps arise:

1. **Abstraction** — the model deliberately omits detail; the omitted detail turns out to matter.
2. **Invalid assumptions** — an assumption (about an interface, a user, a provider) is simply wrong.
3. **Misplaced trust** — a component or actor was trusted to behave correctly but does not.

##### Examples

- **Hotel Safebox** (Lecture 1's canonical example): Checking into a hotel room with a small safe, the combination *chosen by the guest* might not be secure against hotel staff with master keys. The guest's threat model assumes only people who know the combination can open the safe; reality includes a master key the guest never sees. The misplaced trust is in the hotel, not in the safe's locking mechanism.
- **Cloud isolation assumption**: A model assumes the cloud provider enforces strong tenant isolation, but the underlying hypervisor has a known VM-escape vulnerability.
- **Trusted insider assumption**: A model assumes all employees are trustworthy, but insider threats exist.
- **Cryptographic assumption**: A model treats encryption as unconditional, but the key management is broken.

Notice the pattern: each example pairs a *defensive assumption* with a *real-world condition that breaks it*. The hotel safebox is especially clean because the security mechanism (the safe) works exactly as advertised — the gap is in the threat model that ignored the hotel itself.

##### How to mitigate

- Regular audits and penetration tests to probe assumptions.
- Third-party certification reviews.
- Establishing explicit SLAs and security contracts.
- Assume adversarial conditions rather than benign ones for critical components.
- Re-examine what you have abstracted away — abstraction itself is a source of gaps.

### How It Works

STRIDE -> apply six categories to each component and data flow to enumerate threats systematically.

Attack Tree -> root = goal, branches = subgoals, leaves = concrete actions; AND/OR nodes model dependencies.

Diagram-Driven -> follow the five named steps: architectural diagram → mark gateways → define trust domains → assess trust-assumption violations → simplify to a DFD. Trace user workflow from initiation to completion, including uncommon tasks like account creation and software updates.

Model-Reality Gap -> assumption fails in the real world → security model provides false guarantees. Gaps come from abstraction, invalid assumptions, or misplaced trust.

### What You Must Know

- STRIDE: the full mnemonic and what security property each letter violates.
- Attack Trees: structure (root, branches, leaves), AND vs OR nodes.
- Diagram-Driven: the five named steps (architectural diagram → gateways → trust domains → assess violations → DFD), the role of trust domains as areas with shared security policy, and the user-workflow consideration including uncommon tasks.
- How to compare STRIDE vs Diagram-Driven: strengths and weaknesses of each.
- What a model-reality gap is; the **Hotel Safebox** and Cloud examples; and the three sources of gaps — abstraction, invalid assumptions, misplaced trust.

### 30-Second Oral Answer

- STRIDE ensures six threat categories are systematically checked; Attack Trees hierarchically decompose attacker goals; Diagram-Driven Modeling follows data flows across trust boundaries; Checklists offer a quick completeness check.
- Model-Reality Gaps are dangerous because they look secure on paper while being exploitable in practice.
- Good threat modeling uses at least two methods together: STRIDE for coverage, Diagram-Driven for architecture context.

### Typical Exam Questions

- What does STRIDE stand for and what security property does each letter relate to?
- Compare Diagram-Driven and STRIDE threat modeling: how does each identify threats, and what are their trade-offs?
- What is an attack tree? How does the root-to-leaf structure represent attacker goals?
- Describe a model-reality gap in a cloud service context and suggest one mitigation.

### Common Pitfalls

- Thinking STRIDE only applies to network protocols — it applies to any component or data flow.
- Confusing Attack Trees (goal-based hierarchy) with STRIDE (category-based checklist).
- Treating a model-reality gap as simply a "bug" — it is a structural mismatch between assumption and reality.
- Forgetting that Repudiation (R in STRIDE) relates to non-repudiation as a security property.

### Concrete Examples and Commands

#### STRIDE applied to a login form

```text
Component: login form receiving username + password

S - Spoofing: Can attacker impersonate the user? → Use strong authentication.
T - Tampering: Can credentials be modified in transit? → Use HTTPS.
R - Repudiation: Can a user deny they logged in? → Maintain audit logs.
I - Info Disclosure: Can passwords leak in error messages? → Sanitize error output.
D - DoS: Can the form be flooded to lock users out? → Rate-limit login attempts.
E - Escalation: Can a low-privilege user gain admin access? → Enforce RBAC.
```

#### Model-Reality Gap example — Cloud

```text
Security Model assumes:
  "Cloud provider enforces strict tenant isolation."

Reality:
  Provider uses a hypervisor with a known VM-escape vulnerability.

Gap effect:
  Cross-tenant attacks are possible even though the model treated them as impossible.

Source of gap:
  Misplaced trust (in the provider's hypervisor isolation).

Mitigation:
  Request provider's security audit report; conduct independent penetration testing.
```

#### Model-Reality Gap example — Hotel Safebox

```text
Security Model assumes:
  "Only someone who knows the combination can open the safe."

Reality:
  Hotel staff hold master keys that bypass the combination.

Gap effect:
  The guest believes the combination secures their valuables, but the
  hotel itself is a trusted party in the real system that the guest's
  model never represented.

Source of gap:
  Abstraction (the hotel was abstracted out of the model) +
  misplaced trust (in the hotel as a benign environment).

Mitigation:
  Re-draw the threat model to include the hotel as an actor with
  master-key capability; use external storage for valuables that
  truly require a guest-only secret.
```

### Related Concepts

- [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]
- [[Security Goals Beyond CIA — Authorization, Authentication, Accountability|Security Goals Beyond CIA — Authorization, Authentication, Accountability]]
- [[Defense in Depth, Security Strategy, and Security Posture|Defense in Depth, Security Strategy, and Security Posture]]
- [[Tutorial and Exam Problem Patterns|Tutorial and Exam Problem Patterns]]

## Human Factors, Insider Threats, and Ethical Security Practice

> [!abstract] Why this note matters
> - The syllabus explicitly names human factors as a learning objective.
> - Tutorial prompts compare insiders and outsiders, and the labs repeatedly show how developer mistakes create exploitable conditions.

### Overview

Many security failures begin with people: weak password choices, oversharing on social media, developer secrets left in web files, administrators trusting compromised output, or users running suspicious attachments. The course does not treat these as side issues. They are core causes of compromise.

Human factors matter in both attack and defense. Attackers exploit trust, habits, and convenience. Defenders must design systems that are usable enough to be followed and strict enough to resist abuse.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **human factors**: The ways human behavior, mistakes, incentives, habits, and usability constraints affect security.
- **insider threat**: Risk originating from someone with legitimate access or trusted position inside the organization.
- **malicious insider**: An insider acting with intent to harm — for example, a disgruntled employee abusing credentials or exfiltrating data.
- **non-malicious employee**: An insider who causes harm *without intent* — typically security-unaware staff who fall for phishing, mis-share data, or skip secure procedures because the secure path is awkward.
- **outsider threat**: Risk from a person or system without legitimate internal access.
- **ethical use**: Using security tools and techniques only with authorization and for legitimate learning, defense, or testing.

### Detailed Explanation

Tutorial 1 asks you to compare insiders and outsiders. Outsiders may lack direct access, but insiders may already possess trust, credentials, or contextual knowledge. That can make insider threats especially dangerous, not because they are always more skilled, but because they start closer to valuable assets.

#### Malicious insiders vs non-malicious employees

Lecture 1's named-adversary list distinguishes **malicious insiders** (including disgruntled employees) from **non-malicious employees** (often security-unaware) as *two separate categories*. The distinction matters for both reasoning and defense:

- A **malicious insider** has intent. The defense is detection-oriented: least privilege, separation of duties, monitoring, auditing, and quick revocation when behavior changes.
- A **non-malicious employee** has no intent to harm but causes harm through error — clicking a phishing link, mis-sharing a document, plugging in a USB. The defense is *design-oriented*: safer defaults, simpler secure workflows, mandatory training, phishing-resistant authentication, removing rights that they do not need so that mistakes cannot escalate.

Both are insiders, but a single control set rarely covers both. A monitoring rule that flags suspicious data movement will catch a malicious insider's exfiltration; it will not stop a security-unaware employee from emailing a sensitive spreadsheet to the wrong address in the first place.

Tutorial 3 and Lab 2 show the same theme from another angle. A user may reveal personal details that make their password predictable. A developer may leave hidden data or a secret header in a client-visible place. These are human failures that become technical vulnerabilities — most often the *non-malicious* variety.

Ethics matters because the course uses real security tools and attacker-style reasoning. The syllabus is explicit: only test systems you own or have explicit permission to test. In security, being technically capable and being authorized are different questions.

Usability is part of the same story. If a system makes the secure path confusing, expensive, or irritating, users and administrators often route around it. That is why human factors are not only about careless users; they are also about how system design encourages or discourages secure behavior.

### How It Works

Insider risk is often addressed through least privilege, auditing, separation of duties, and monitoring rather than by assuming trust forever.

Human-factor risk is reduced by better defaults, simpler secure workflows, clearer training, and minimizing the amount of sensitive information exposed to users or developers unnecessarily.

Ethical use means following scope boundaries in labs and professional work. The same techniques can be legal or illegal depending on authorization.

### What You Must Know

- Why human behavior can create or amplify technical vulnerabilities.
- The difference between insider and outsider threats.
- The distinction between **malicious insiders** and **non-malicious employees** — Lecture 1 lists them as separate adversary groups, and each calls for a different defensive style (detection vs design).
- Why ethical and legal scope matters when using security tools.

### 30-Second Oral Answer

- Security fails when people, processes, and technical controls do not support each other.
- Insiders can be especially risky because they begin with trust or access.
- Security tools must be used within explicit authorization boundaries.

### Typical Exam Questions

- Why are human factors important in security?
- Why might insider threats be more dangerous than outsider threats?
- What does ethical use of security tools mean in this course?

### Common Pitfalls

- Treating human issues as separate from technical security.
- Assuming insider threats are only malicious rather than also accidental — Lecture 1's list explicitly separates malicious insiders from non-malicious employees.
- Picking a single defensive strategy (monitoring *or* training) and expecting it to cover both categories.
### Related Concepts

- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]
