---
tags:
  - university
  - bcs2420
  - computer-security
  - worked-drill
---

# Protocol and Network Defense Worked Drills

Use these drills to practice complete short-answer and long-answer responses under closed-book conditions.

**Best use:** draw the message flow or packet path before reading the model answer. Protocol questions reward sequence reasoning.

## Drill 1 — Replay, Reflection, and Relay

**Question.** Explain replay, reflection, and relay attacks and how nonces or timestamps help.

### Model Answer

| Attack | Mechanism | Main defense |
|---|---|---|
| Replay | Attacker records a valid old message and sends it again later | Fresh nonce, timestamp, sequence number, or challenge-response |
| Reflection | Attacker tricks one party into answering its own challenge or reuses a challenge in the opposite direction | Bind roles and identities into the protocol transcript |
| Relay | Attacker forwards live messages between parties to use one party as an oracle | Distance bounding, channel binding, transaction confirmation, context binding |

A **nonce** helps replay defense because each session uses a fresh unpredictable value. A response tied to one nonce should be invalid for a different session. A **timestamp** helps if parties have synchronized clocks and reject messages outside a short validity window. These mechanisms must be authenticated; otherwise an attacker may modify the freshness value itself.

### Marking Cues

- Replay is old-message reuse.
- Reflection abuses symmetry or missing role binding.
- Relay is live forwarding, so simple freshness alone may not stop it.

**Covered in:** [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Protocols for Secure Communication Nonces, Replay, Reflection, and Relay]]

## Drill 2 — Unauthenticated Diffie-Hellman MITM

**Question.** Explain why unauthenticated Diffie-Hellman is vulnerable to man-in-the-middle attack. Propose a countermeasure that preserves forward secrecy.

### Model Answer

In plain Diffie-Hellman, Alice sends `g^a` and Bob sends `g^b`. If these public shares are not authenticated, an active attacker can intercept both directions:

```text
Alice -> Attacker: g^a
Attacker -> Bob:   g^m

Bob -> Attacker:   g^b
Attacker -> Alice: g^n
```

Alice derives a shared key with the attacker, and Bob derives a different shared key with the attacker. The attacker decrypts traffic from one side, reads or modifies it, then re-encrypts it to the other side. The math of DH still works, but the identity of the peer is not proven.

A countermeasure is **signed ephemeral Diffie-Hellman**: each party signs its ephemeral DH share with a long-term identity key, and the peer verifies the signature using a certificate or pre-distributed public key. This authenticates the exchange while preserving forward secrecy, because the long-term key signs the transcript but does not encrypt the session; once the ephemeral exponents are erased, later long-term key compromise cannot recover past `g^(ab)`.

**Covered in:** [[03 Authentication and Secure Communication/03 Authentication and Secure Communication|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]], [[05 Web and Network Defense/05 Web and Network Defense|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

## Drill 3 — Firewall Packet Flow

**Question.** Explain the difference between stateless and stateful firewalls using one packet-flow example.

### Model Answer

A **stateless firewall** decides on each packet independently, using fields such as source IP, destination IP, port, and protocol. It does not remember whether a packet belongs to an established connection.

A **stateful firewall** maintains connection state. For TCP, it can observe the outbound SYN, the inbound SYN-ACK, and the outbound ACK, then allow later inbound packets only if they belong to that established flow.

Example: an internal client opens HTTPS to `203.0.113.10:443`.

| Step | Packet | Stateless rule issue | Stateful behavior |
|---|---|---|---|
| 1 | Internal client sends SYN to port 443 | Allow outbound 443 | Records pending connection |
| 2 | Server replies SYN-ACK from port 443 | Needs broad inbound return rule | Allows because it matches pending flow |
| 3 | Later inbound packets from server | May need permissive inbound rules | Allows only if part of tracked flow |

The stateful design is safer because it avoids opening broad inbound holes just to allow replies to internal clients.

**Covered in:** [[05 Web and Network Defense/05 Web and Network Defense|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]

## Drill 4 — Default-Allow vs Default-Deny

**Question.** Why is default-deny usually safer than default-allow?

### Model Answer

Default-deny blocks traffic unless an explicit allow rule exists. Its failure mode is usually visible service breakage: if the administrator forgets to allow a legitimate service, users complain and the rule can be added. Default-allow permits traffic unless an explicit deny rule exists. Its failure mode is silent exposure: if the administrator forgets to block a vulnerable or newly added service, it remains reachable until someone exploits it.

The security argument is therefore not just "deny is stricter." It is that default-deny fails closed, while default-allow fails open.

**Covered in:** [[05 Web and Network Defense/05 Web and Network Defense|Firewall Policy Design, Bastion Hosts, and Port Knocking]]

## Drill 5 — IDS, IPS, and Detection Models

**Question.** Compare IDS and IPS, then compare signature, anomaly, and specification-based detection.

### Model Answer

An **IDS** detects and alerts. It is usually out-of-band or monitoring traffic/logs; it can miss attacks or produce false alarms, but it does not normally block traffic directly. An **IPS** sits inline and can block or modify traffic, so false positives have a higher operational cost because legitimate traffic may be stopped.

| Detection model | What it looks for | Strength | Weakness |
|---|---|---|---|
| Signature-based | Known byte patterns, rules, exploit fingerprints | Precise for known attacks | Misses novel or modified attacks |
| Anomaly-based | Deviation from learned normal behavior | Can catch unknown attacks | High false positives if normal changes |
| Specification-based | Violation of manually defined allowed behavior | Clear policy logic | Requires accurate specifications |

Good exam answers separate **placement/action** (IDS vs IPS) from **detection logic** (signature/anomaly/specification).

**Covered in:** [[05 Web and Network Defense/05 Web and Network Defense|IDS, IPS, HIDS, NIDS, and Detection Models]]

## Drill 6 — Base-Rate Alarm Reasoning

**Question.** A NIDS monitors 100,000 events. Only 100 are real attacks. It detects 90% of attacks and has a 1% false-positive rate on benign events. How many true positives and false positives occur, and why does this matter?

### Model Answer

```text
Real attacks = 100
Benign events = 99,900

True positives = 0.90 * 100 = 90
False positives = 0.01 * 99,900 = 999
```

The IDS raises `90 + 999 = 1,089` alerts, but only 90 are real attacks. That means most alerts are false positives even though the false-positive rate is only 1%. This is the base-rate problem: when attacks are rare, even a small false-positive rate can overwhelm analysts and create alarm fatigue.

**Covered in:** [[05 Web and Network Defense/05 Web and Network Defense|IDS Confusion Matrix and Base-Rate Worked Examples]]

## Related

- [[05 Web and Network Defense/05 Web and Network Defense|Web and Network Defense]]
- [[07 Exam Skills/07 Exam Skills|Tutorial and Exam Problem Patterns]]
- [[07 Exam Skills/07 Exam Skills|Fast Facts, Formulas, and Core Terms]]
