---
tags:
  - university
  - bcs2420
  - computer-security
---

# Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs

> [!abstract] Why this note matters
> - Lecture 7 and Tutorial L7 focus on network defense through gateways and tunnels.
> - This is a clean compare/contrast topic with recurring design principles like safe defaults and statefulness.

## Overview

Lecture 7 presents firewalls as perimeter controls that isolate damage and control traffic between trusted and untrusted zones. That is a strategic security function, not only a packet-filtering trick.

The course also treats tunnels as ways to protect or expose protocols differently, especially when insecure application traffic is wrapped inside an encrypted channel like SSH or a VPN.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **packet-filter firewall**: A firewall that allows or denies packets based on header fields and policy rules.
- **stateful firewall**: A firewall that tracks connection state and uses it in filtering decisions.
- **DMZ**: A network segment for public-facing services isolated from the internal network.
- **proxy firewall**: A gateway that relays traffic at the application or circuit level and can inspect higher-level content.
- **tunnel**: An encapsulated communication path that carries one protocol inside another, often with encryption.

## Detailed Explanation

Packet-filter firewalls apply rules based on header fields such as source address, destination address, ports, and flags. Stateless firewalls evaluate each packet independently. Stateful firewalls use memory of earlier traffic, which lets them allow return traffic only when it matches an established outbound flow.

Default-deny rulesets are a direct application of safe defaults. Instead of allowing everything except explicit bans, the firewall blocks everything unless an accept rule permits it. That reduces attack surface and surprises.

DMZs support isolated compartments by placing public services in a constrained segment rather than directly on the trusted internal network. Proxy firewalls go further by relaying traffic and potentially inspecting application-layer content or enforcing protocol constraints.

SSH port forwarding and VPN tunnel mode protect otherwise exposed or plaintext traffic by encapsulating it inside an encrypted channel. Tutorial L7 highlights how local forwarding can make an insecure application protocol safer by protecting it in transit.

The source material also implies that firewalling is part of a broader perimeter architecture. A ruleset is one layer, but screened subnets, bastion hosts, and careful default policy choices determine how much one ruleset mistake can expose.

## How It Works

Stateless rule: match headers only.

Stateful rule: match headers plus known connection context.

DMZ: public service zone with restricted connectivity to internal networks.

Tunnel mode VPN: encapsulate the full IP packet inside a new outer packet for protected transit.

## What You Must Know

- Differences between stateless and stateful firewalls.
- What a default-deny policy means.
- Purpose of a DMZ.
- What proxy firewalls, SSH port forwarding, and tunnel-mode VPNs do at a high level.

## 30-Second Oral Answer

- Firewalls are policy-enforcement gateways; stateful firewalls understand connection context while stateless ones do not.
- DMZs isolate public services, proxy firewalls relay and inspect, and tunnels encapsulate traffic to protect it.

## Typical Exam Questions

- Why are stateful firewalls often better than stateless ones for return traffic?
- What is a DMZ for?
- How does SSH local port forwarding improve confidentiality for an insecure protocol?
- What does tunnel mode VPN protect?

## Common Pitfalls

- Saying a firewall blocks malicious content completely just because a port is restricted.
- Confusing default-allow with default-deny.

## Concrete Examples and Commands

### Stateful filtering intuition

```text
Outbound HTTP request from internal host -> allow
Inbound response packet with matching session state -> allow
Unsolicited inbound packet to same port without matching state -> drop
```

### SSH local forwarding pattern

```bash
ssh -L 8080:internal.example:80 user@gateway.example
```

Traffic sent to local port 8080 is forwarded through the encrypted SSH session to the remote internal service.

## Related Concepts

- [[Defense in Depth, Security Strategy, and Security Posture|Defense in Depth, Security Strategy, and Security Posture]]
- [[Firewall Policy Design, Bastion Hosts, and Port Knocking|Firewall Policy Design, Bastion Hosts, and Port Knocking]]
- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 7.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 7.pdf)
- [Tutorial L7.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L7.pdf)
