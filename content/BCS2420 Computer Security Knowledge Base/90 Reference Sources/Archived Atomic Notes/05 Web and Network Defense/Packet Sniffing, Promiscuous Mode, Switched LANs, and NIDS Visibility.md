---
tags:
  - university
  - bcs2420
  - computer-security
---

# Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility

> [!abstract] Why this note matters
> - Lecture 8 and Tutorial L8 explicitly include packet sniffing and switched-LAN capture limitations.
> - This fills the source gap between generic IDS ideas and what a network sensor can actually observe.

## Overview

NIDS quality depends on visibility as much as on detection logic. If the sensor cannot see the traffic, it cannot analyze it, regardless of how good its detection algorithm is.

The course includes switched-LAN reasoning to make this operational point explicit: network architecture limits passive observation.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **packet sniffing**: Capturing and inspecting traffic in transit for analysis.
- **promiscuous mode**: A NIC mode that accepts more observed traffic for software inspection instead of only strictly addressed frames.
- **switched LAN**: A LAN where switches selectively forward frames instead of flooding all traffic to every port.
- **sensor visibility**: The subset of traffic a monitoring system can actually observe from its placement and network context.

## Detailed Explanation

Packet sniffing is how many NIDS implementations gather traffic. The sniffer captures packets and passes them to analysis logic. That sounds simple until the network only forwards relevant traffic to specific ports.

Promiscuous mode helps a NIC accept traffic that reaches it, but it does not magically make a switched network behave like a hub. If the switch never forwards unrelated frames to the sensor port, those packets remain invisible to the sensor.

This is why strategic placement matters. On a switched LAN, observation often depends on mirror ports, taps, or gateway placement rather than simply running a sniffer on any host.

The security lesson is broader than one hardware detail: monitoring quality depends on vantage point. If defenders forget that, they may overestimate what their NIDS can see and therefore overestimate what their alerts or silence actually mean.

## How It Works

Hub-like forwarding -> broad passive visibility.

Switched forwarding -> visibility depends on placement and mirroring.

Promiscuous mode helps consume available traffic, not create unavailable traffic.

## What You Must Know

- What packet sniffing is.
- What promiscuous mode does and does not do.
- Why switched LANs reduce arbitrary passive visibility.
- Why NIDS placement matters.

## 30-Second Oral Answer

- A NIDS can only inspect what it can actually see.
- Promiscuous mode does not override switching decisions; switched LANs therefore make passive observation placement-sensitive.

## Typical Exam Questions

- Why is packet sniffing harder on a switched LAN than on a hub?
- What does promiscuous mode do?
- Why does NIDS placement matter?

## Common Pitfalls

- Thinking promiscuous mode alone guarantees full LAN visibility.
- Ignoring network topology when discussing NIDS effectiveness.
## Related Concepts

- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]
- [[Kali Linux, Nmap, Wireshark, and Responsible Tool Use|Kali Linux, Nmap, Wireshark, and Responsible Tool Use]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 8.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 8.pdf)
- [Tutorial L8.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L8.pdf)
