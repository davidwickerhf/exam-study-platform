---
tags:
  - university
  - bcs2420
  - computer-security
  - self-test
---

# 07 Exam Skills Self Test

Answer these without checking the notes. Then expand the Answer Key callout at the bottom to grade yourself.

## Tutorial and Exam Problem Patterns

1. How should you answer a **compare-and-contrast** security question? What structure works best?
2. What structure works well for an **attack/defense** explanation?
3. What must be included in a risk or detection-rate **calculation** answer beyond the number itself?

## Fast Facts, Formulas, and Core Terms — From-Memory Pairs

For each pair or group below, state the key difference in one or two sentences (no notes, no peeking):

4. **CIA triad** — name all three and a one-line definition of each.
5. **Risk equation** — write it and state what each variable is.
6. **Passive vs active adversary.**
7. **The four attack models** in order of increasing power.
8. **One-time pad conditions** — name all three.
9. **ECB vs CBC vs CTR vs OFB** — one sentence each.
10. **Authentication vs identification vs authorization.**
11. **Salt vs pepper vs key stretching.**
12. **Replay vs reflection vs relay.**
13. **Key transport vs key agreement.**
14. **Virus vs worm vs trojan vs ransomware vs rootkit.**
15. **Polymorphic vs metamorphic malware.**
16. **Stored vs reflected vs DOM-based XSS.**
17. **Stateless vs stateful firewall.**
18. **Default-deny vs default-allow** — and which is the SAFE-DEFAULTS choice.
19. **IDS vs IPS, HIDS vs NIDS.**
20. **False positive vs false negative; base-rate problem.**
21. **ARP spoofing vs DNS cache poisoning.**

## Computation Drills

22. Given T = 0.05, V = 0.4, C = €2,000,000, compute R and state the operational interpretation.
23. A NIDS has FPR = 0.5% and detects 95% of attacks (TPR). On 100,000 daily events with 50 real attacks, how many of the alarms are real? What is P(real attack | alarm)?

## STRIDE recall

24. Write out STRIDE letter-by-letter with the security property each violates.

> [!info]- Answer Key
> 1. Define both items first (one sentence each), state the **core difference** in one sentence, then give **one consequence or example**. Avoid drift in terminology. End with the defence or trade-off if the comparison is between attacks/controls.
> 2. Identify (a) **attacker capability/assumption**, (b) **vulnerable step** in the system, (c) **why it works** (mechanism), (d) **how to stop it** (defence). Connect the defence specifically to the mechanism, not generic "use HTTPS".
> 3. State the **formula**, **substitute values**, **compute**, and then **interpret** — what does the number mean operationally and what decision does it support? A bare number with no interpretation loses marks.
> 4. **Confidentiality** = keep info accessible only to authorised parties. **Integrity** = no unauthorised modification of data/state. **Availability** = systems/services are usable when needed.
> 5. `R = T * V * C`. **T** = threat probability (likelihood of attempt). **V** = vulnerability (likelihood the attempt succeeds — the weakness). **C** = cost/impact if it succeeds.
> 6. **Passive** = observes only (eavesdropper). **Active** = injects, modifies, blocks, or replays messages (MITM, replay attacker).
> 7. Ciphertext-only < known-plaintext < chosen-plaintext < chosen-ciphertext. Each gives the attacker more leverage.
> 8. (1) Key truly random; (2) key at least as long as the message; (3) key never reused.
> 9. **ECB**: encrypt each block independently — repeats leak. **CBC**: XOR each plaintext block with the previous ciphertext before encryption — chains dependency. **CTR**: encrypt counters to form a keystream, XOR with plaintext — parallel-friendly, no padding. **OFB**: repeatedly encrypt evolving state to form a keystream.
> 10. **Authentication** = verify a *claimed* identity (one-to-one). **Identification** = discover identity from observed data (one-to-many). **Authorization** = decide what an authenticated entity is allowed to do.
> 11. **Salt** = non-secret per-user random value combined with the password before hashing → prevents rainbow tables. **Pepper** = secret extra value not stored with the hash → adds defence even if DB leaks. **Key stretching** = make each hash intentionally slow (PBKDF2/bcrypt/scrypt/Argon2) → slows offline guessing.
> 12. **Replay** = retransmit a captured valid message in a later run. **Reflection** = bounce a party's own challenge/response back at them, exploiting symmetric protocol structure. **Relay** = forward live messages between two genuine endpoints, impersonating proximity/identity.
> 13. **Key transport** = one party chooses the session key and securely sends it. **Key agreement** = both parties contribute and the shared key is derived from both contributions (e.g., Diffie-Hellman).
> 14. **Virus** = needs user/host execution to spread. **Worm** = autonomous network propagation. **Trojan** = masquerades as legitimate software, deceives the user into running it. **Ransomware** = denies availability (often by encryption) and demands payment. **Rootkit** = stealth malware that hides while maintaining privileged control.
> 15. **Polymorphic** = fixed encrypted body, mutating decryptor each instance. **Metamorphic** = no encryption; the body itself is rewritten each instance with semantics-preserving transformations. Do not invert these.
> 16. **Stored** = payload saved server-side, served to every later viewer. **Reflected** = payload in a single request, reflected in the response, affects only the user lured into that request. **DOM-based** = injection happens entirely in client-side JS via unsafe DOM manipulation, with no server reflection step.
> 17. **Stateless** = evaluate each packet by header rules in isolation. **Stateful** = track connection state, recognise valid return traffic for established outbound flows.
> 18. **Default-deny** = block unless explicitly allowed; failure mode = service breakage (visible, recoverable). **Default-allow** = allow unless explicitly blocked; failure mode = silent unauthorised access (invisible, unrecoverable). **Default-deny** is the SAFE-DEFAULTS choice.
> 19. **IDS** = detect and alert only. **IPS** = detect and actively block/respond. **HIDS** = host-local monitoring (logs, FS, kernel, in-process). **NIDS** = network packet monitoring at sensor points.
> 20. **False positive** = benign event flagged as malicious. **False negative** = real attack missed. **Base-rate problem**: when attacks are rare, even a low FPR over many benign events produces far more false alarms than true positives, so P(real | alarm) can be small despite good raw rates.
> 21. **ARP spoofing** = forge ARP replies on a local LAN to bind an IP (often the gateway) to attacker's MAC — link-layer MITM, subnet scope only. **DNS cache poisoning** = inject false name→IP mappings into a resolver cache so later queries are redirected — name-resolution layer, scope = users of that resolver.
> 22. R = 0.05 × 0.4 × 2,000,000 = €40,000 expected annual loss. Interpretation: this is the budget reference for controls — if a control costs less than €40k/year and reduces T, V, or C meaningfully, it is worth considering. Reducing V (patching, hardening) shrinks the second factor; reducing C (backups, segmentation) shrinks the third.
> 23. Real attacks = 50 (assume TPR = 95% → ~48 true positives). Benign events = 99,950 → false positives = 0.005 × 99,950 ≈ 500. Total alarms ≈ 548. **P(real | alarm) ≈ 48 / 548 ≈ 8.8%**. So ~91% of alarms are false despite the detector having a "good" 99.5% specificity and 95% sensitivity — the base-rate problem in action.
> 24. **S**poofing → Authentication. **T**ampering → Integrity. **R**epudiation → Non-repudiation. **I**nformation Disclosure → Confidentiality. **D**enial of Service → Availability. **E**scalation of Privilege → Authorisation.
