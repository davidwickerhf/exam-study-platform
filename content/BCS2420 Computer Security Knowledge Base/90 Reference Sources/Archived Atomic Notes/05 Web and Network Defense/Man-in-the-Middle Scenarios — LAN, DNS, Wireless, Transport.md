---
tags:
  - university
  - bcs2420
  - computer-security
---

# Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport

> [!abstract] Why this note matters
> - The past exam included a MITM-style multiple-choice question asking which scenario "intercepts key exchange messages and substitutes public keys".
> - MITM is not one attack — it is a *family* of attacks that operate at different network layers with different mechanisms.
> - This note consolidates the four MITM variants the course covers so each can be recognised quickly from a scenario description.

## Overview

A man-in-the-middle (MITM) attack places an attacker between two communicating parties so that they each believe they are talking to the other, while in fact every message passes through the attacker. The defining feature is **substituted identity**: the attacker convinces each end that they are the other end.

MITM attacks can happen at any layer where identity is trusted but not cryptographically verified. The four variants in the course span the stack: link layer (ARP spoofing), name-resolution layer (DNS cache poisoning), wireless link layer (rogue AP and disassociation hijack), and transport layer (downgrade attacks and key-exchange substitution).

Exam questions usually describe a scenario and ask you to name the variant. The diagnostic question is always the same: **which trust relationship is being substituted, and at what layer?**

## Exam Focus

- Tier 1 priority — past exam asked for the "substituted public keys at key exchange" variant.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **MITM (man-in-the-middle)**: An attack where the adversary sits between two parties, relaying and possibly modifying messages while each party believes the other is the only peer.
- **ARP spoofing**: Forging ARP replies to bind an IP address (often the gateway) to the attacker's MAC.
- **DNS cache poisoning**: Inserting false name-to-IP mappings into a resolver's cache.
- **rogue AP**: An unauthorised wireless access point that impersonates a legitimate one.
- **disassociation hijack**: Forging an 802.11 disassociate frame so the attacker can take over the victim's session.
- **SSL strip / HTTPS downgrade**: Forcing or tricking a client into using HTTP rather than HTTPS so traffic can be read in cleartext.
- **key-exchange substitution**: An MITM during a key-establishment protocol where the attacker replaces each party's public key with their own.

## Detailed Explanation

### LAN Layer: ARP Spoofing

ARP maps an IP address to a MAC address on a local network. The protocol has no authentication — any host can send an ARP reply claiming any IP. If the victim caches the false mapping, traffic destined for the legitimate IP (typically the gateway) goes to the attacker's MAC instead.

The attacker then forwards traffic to the real gateway, completing the MITM. The victim sees normal connectivity; the attacker sees every packet.

Scope: local subnet only. ARP does not cross routers.

See [[ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection|ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection]] for mitigations.

### Name-Resolution Layer: DNS Cache Poisoning

DNS translates names to IP addresses. If an attacker can inject a false mapping into a resolver's cache, every subsequent client query for that name receives the attacker's IP. The client connects to the attacker thinking it is the legitimate server.

The attacker may then relay traffic to the real server (full MITM) or simply impersonate the server. Either way, the redirection happens before any application-layer handshake — the client never sees the "real" server in DNS at all.

Scope: as wide as the poisoned resolver's user base.

See [[ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection|ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection]] for source-port and transaction-ID mitigations.

### Wireless Link Layer: Rogue AP and Disassociation Hijack

Two wireless MITM variants exist:

**Rogue AP**: The attacker stands up an access point that advertises the same SSID and security policy as a legitimate AP. Because the standard does not require mutual authentication of the AP to the STA, the victim may associate with the rogue. The rogue then relays traffic to the real AP — a classic MITM at the wireless link layer.

**Disassociation hijack**: The attacker observes a legitimate STA's session and sends a forged disassociate frame to the STA spoofing the AP's MAC. The STA drops its end. The attacker, spoofing the STA's MAC, continues the session with the real AP. This is technically session theft rather than relay, but it has the same effect: the attacker is now the active party in the connection.

Both rely on the fact that 802.11 management frames are not cryptographically authenticated in the original design.

See [[Wireless and WLAN Security, 802.11, Rogue APs, and Session Hijacking|Wireless and WLAN Security, 802.11, Rogue APs, and Session Hijacking]] for the full sequence.

### Transport Layer: Downgrade Attacks and Key-Exchange Substitution

Two transport-layer MITM variants:

**SSL strip / HTTPS downgrade**: The attacker intercepts a victim's connection and rewrites HTTPS links to HTTP, or terminates HTTPS at the attacker and relays as HTTP to the victim. The victim sees a working but unencrypted connection. HSTS and HTTPS-only browsers mitigate this.

**Key-exchange substitution**: During a Diffie-Hellman or similar key exchange, the attacker intercepts each party's public value and substitutes their own. The victim establishes a key with the attacker, and the attacker establishes a separate key with the real peer. Both endpoints think they share a secret with each other; in fact each shares a secret with the attacker, who can decrypt and re-encrypt every message.

This second variant is the one the past exam targets — the "intercepts key exchange messages and substitutes public keys" wording is the verbatim signature of a key-exchange MITM. The standard defence is **authenticated key exchange**: the public values must be signed by a trusted identity (certificate, pre-shared key, or out-of-band fingerprint) so the receiver can detect substitution.

## How It Works

ARP spoofing -> forged ARP reply -> victim's ARP cache maps gateway IP to attacker MAC -> traffic flows through attacker.

DNS cache poisoning -> false A/AAAA record in resolver cache -> client connects to attacker's IP for that name.

Rogue AP -> impersonates SSID/policy -> STA associates -> attacker relays to real AP.

Disassociation hijack -> spoof AP's MAC to disassociate STA -> spoof STA's MAC to continue session with AP.

SSL strip -> rewrite HTTPS to HTTP between victim and attacker; relay to real server over HTTPS.

Key-exchange substitution -> intercept and replace each party's public key with attacker's own -> attacker holds separate keys with each side -> attacker decrypts and re-encrypts every message.

## What You Must Know

- The four MITM variants and the layer each operates at: link (ARP), name (DNS), wireless link (rogue AP / disassociation), transport (downgrade / key substitution).
- The diagnostic question: which trust relationship is being substituted, and at what layer?
- The key-exchange substitution variant is detected only with authenticated key exchange (signed public values, certificates, or out-of-band verification).
- The wireless variants exploit the lack of mutual authentication and unauthenticated management frames.
- SSL strip / HTTPS downgrade is defeated by HSTS and HTTPS-only browser behaviour.

## 30-Second Oral Answer

- MITM is a family: ARP spoofing on a LAN, DNS cache poisoning at name resolution, rogue APs and disassociation hijacking on wireless, and transport-layer downgrade or key-exchange substitution.
- They differ in which trust relationship is substituted and at what layer.
- Key-exchange substitution is the "intercepts public keys" variant and is defeated by authenticated key exchange.

## Typical Exam Questions

- An attacker intercepts key exchange messages and substitutes public keys. Which class of attack is this? *(Answer: a transport-layer MITM via key-exchange substitution; mitigate with authenticated key exchange.)*
- Name a MITM attack that operates at the link layer of a LAN.
- How does a rogue AP enable a MITM on a wireless network?
- What is SSL strip and how is it defeated?
- Why does an unauthenticated Diffie-Hellman exchange permit MITM?

## Common Pitfalls

- Treating MITM as one attack. The exam expects you to name the layer and mechanism.
- Confusing ARP spoofing with IP source-address spoofing. ARP spoofing happens on the local segment; IP spoofing happens at the network layer and does not require subnet membership.
- Forgetting that the wireless session-hijack uses *two* MAC addresses (attacker spoofs the AP's MAC for the disassociate and the STA's MAC to continue the session).
- Believing that encryption alone defeats MITM. Encryption without authentication of the key exchange leaves the channel open to substitution.

## Concrete Examples and Commands

### Key-exchange substitution (past-exam variant)

```text
Alice and Bob attempt Diffie-Hellman key exchange.
Eve sits between them.

Alice -> Eve: g^a
Eve   -> Bob: g^e1     (substitute)
Bob   -> Eve: g^b
Eve   -> Alice: g^e2   (substitute)

Alice and Eve share key K1 = g^(a*e2).
Bob and Eve share key K2 = g^(b*e1).
Each thinks they share a key with the other.
Eve decrypts each message with one key, re-encrypts with the other.
```

### MITM diagnostic table

| Scenario clue | Layer | Variant |
|---------------|-------|---------|
| "Forged ARP reply" / "gateway IP mapped to attacker MAC" | Link (LAN) | ARP spoofing |
| "Resolver cache" / "false name-to-IP mapping" | Name resolution | DNS cache poisoning |
| "Impersonated SSID" / "STA associates with attacker AP" | Wireless link | Rogue AP |
| "Disassociate frame with AP's MAC" | Wireless link | Disassociation hijack |
| "Rewrites HTTPS to HTTP" | Transport | SSL strip / HTTPS downgrade |
| "Intercepts public keys during key exchange" | Transport | Key-exchange substitution |

## Related Concepts

- [[ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection|ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection]]
- [[Wireless and WLAN Security, 802.11, Rogue APs, and Session Hijacking|Wireless and WLAN Security, 802.11, Rogue APs, and Session Hijacking]]
- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[SSH Protocol, Authentication, and Tunneling|SSH Protocol, Authentication, and Tunneling]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 07 — Network Defense, Firewalls, Tunnels.pdf](Materials/01 Lectures/Lecture 07 — Network Defense, Firewalls, Tunnels.pdf)
- [Lecture 08 — Intrusion Detection and WLAN Security.pdf](Materials/01 Lectures/Lecture 08 — Intrusion Detection and WLAN Security.pdf)
- [Tutorial L8.pdf](Materials/02 Tutorials/Tutorial L8.pdf)
