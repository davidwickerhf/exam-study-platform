---
tags:
  - university
  - bcs2420
  - computer-security
---

# ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection

> [!abstract] Why this note matters
> - Tutorial L8 explicitly asks about ARP spoofing and DNS cache poisoning.
> - These attacks make good exam material because they require explaining name or address trust failures clearly.

## Overview

Both ARP spoofing and DNS cache poisoning redirect trust rather than breaking encryption directly. They exploit a naming or addressing layer that users and systems normally assume is correct.

Because they operate below or before the application logic, these attacks can redirect legitimate-looking traffic into malicious paths without requiring the victim to type a different URL or choose a different gateway manually.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **ARP spoofing**: Sending forged ARP messages to convince hosts that an IP address maps to the attacker's MAC address.
- **DNS cache poisoning**: Inserting false domain-to-IP mappings into a resolver cache so later users are redirected.
- **traffic redirection**: Manipulating the path or destination of communication so victims send data to the attacker or a malicious server.

## Detailed Explanation

ARP spoofing targets local networks. If a victim believes the gateway IP belongs to the attacker's MAC address, the victim can send traffic to the attacker instead of the real gateway. This is a classic man-in-the-middle setup on a LAN.

DNS cache poisoning attacks the translation from names to IP addresses. If the resolver cache contains a false mapping for a domain, users can be sent to a malicious host even when they typed the correct domain name.

These attacks differ in layer and scope, but the shared lesson is that secure systems depend on trustworthy resolution and routing context. A secure application sitting on top of poisoned resolution or link-layer deception can still fail in practice.

That is why these are traffic-redirection attacks rather than simple credential-theft attacks. The attacker wins first by changing where trust points, and only later may steal data or credentials from the redirected traffic.

This is also why mitigations often live in infrastructure rather than only in the application itself. Secure name resolution, network segmentation, authenticated higher-layer channels, and anomaly detection all help because they reduce the attacker's ability to silently rewrite who the victim thinks they are talking to.

### ARP Spoofing Mitigations

Tutorial L8 Part B explicitly asks for ARP-spoofing mitigations in a large corporate LAN. Three approaches:

- **Static ARP entries.** Hard-code the IP-to-MAC mapping for critical devices (e.g., the gateway) so the host ignores incoming ARP replies for those IPs. Downside: high maintenance overhead — every address or hardware change requires a configuration update across affected hosts.
- **802.1X port-based authentication.** Require every device to authenticate to the switch before it gets a usable port. An unauthorised attacker cannot even send ARP frames onto the network. Downside: needs modern switch hardware and supplicant configuration on every endpoint.
- **Dynamic ARP Inspection (DAI).** A switch feature that validates ARP packets against a trusted IP-to-MAC binding table (often built from DHCP snooping). Forged ARP replies are dropped at the switch port. Downside: complex configuration and only works on managed switches that support it.

### DNS Cache Poisoning Mitigations

DNS poisoning typically works by an attacker racing to send a forged response that matches the legitimate query's transaction ID and source port before the real reply arrives. Four mitigations narrow the attacker's window:

- **Source-port randomisation.** Instead of querying from a predictable UDP port, the resolver picks a random source port per query. The attacker must now guess port × transaction ID, raising the entropy by ~16 bits.
- **Transaction-ID randomisation.** The 16-bit DNS transaction ID is chosen unpredictably so the attacker cannot pre-compute it.
- **0x20 encoding.** The resolver randomly mixes the case of letters in the query name (e.g., `wWw.eXamplE.cOm`). Compliant authoritative servers preserve the case in the response. An attacker forging a response without knowing the random capitalisation produces a mismatch.
- **DNSSEC.** Records are cryptographically signed by the zone's authority. A resolver that validates DNSSEC signatures cannot accept a forged record at all, regardless of port or ID matching. This is the only countermeasure that defeats the attack outright rather than just narrowing the window.

## How It Works

ARP spoofing changes local link-layer destination decisions.

DNS poisoning changes application-layer name resolution results.

Both attacks redirect traffic by tampering with trust in supporting infrastructure.

If the redirection succeeds, the victim may continue to believe they are interacting with the correct destination because the visible workflow has not changed.

## What You Must Know

- How ARP spoofing works on a LAN.
- How DNS cache poisoning redirects users.
- Why these are traffic-redirection attacks rather than simple password attacks.

## 30-Second Oral Answer

- ARP spoofing lies about who owns an IP address on the local network; DNS poisoning lies about what IP a domain name should resolve to.
- Both attacks redirect traffic by corrupting trust in resolution layers.

## Typical Exam Questions

- How does ARP spoofing work?
- How does DNS cache poisoning redirect users?
- Why are switched LANs relevant to packet observation in network attacks?

## Common Pitfalls

- Confusing ARP spoofing with IP source-address spoofing in remote networks.
- Treating DNS poisoning as merely changing a local hosts file on one machine.
## Related Concepts

- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]
- [[Web Architecture, HTTP, Cookies, and the Browser Security Model|Web Architecture, HTTP, Cookies, and the Browser Security Model]]
- [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 08 — Intrusion Detection and WLAN Security.pdf](Materials/01 Lectures/Lecture 08 — Intrusion Detection and WLAN Security.pdf)
- [Tutorial L8.pdf](Materials/02 Tutorials/Tutorial L8.pdf)
- [Tutorial L8 Solution.pdf](Materials/02 Tutorials/Tutorial L8 Solution.pdf)
