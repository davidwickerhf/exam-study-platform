---
tags:
  - university
  - bcs2420
  - computer-security
---

# IDS, IPS, HIDS, NIDS, and Detection Models

> [!abstract] Why this note matters
> - Lecture 8 and Tutorial L8 are built around intrusion detection and prevention concepts.
> - This topic produces both conceptual and calculation-style exam questions because of base-rate reasoning.

## Overview

Firewalls are coarse gatekeepers. IDS and IPS exist because many threats still get through allowed channels or arise inside the perimeter. The course treats these systems as monitoring and response layers rather than as magic all-purpose defenses.

This topic also introduces a common reasoning trap in security: a detection system can have good raw rates and still produce mostly false alarms if actual attacks are rare. That is the base-rate problem.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **IDS**: Intrusion Detection System; monitors and reports suspicious activity.
- **IPS**: Intrusion Prevention System; can actively block or alter traffic or behavior to stop intrusions.
- **HIDS**: Host-based IDS; monitors one host's logs, file system, kernel activity, or similar local data.
- **NIDS**: Network-based IDS; monitors network packets at strategic points.
- **signature-based detection**: Detection based on known malicious patterns.
- **anomaly-based detection**: Detection based on deviations from a model of normal behavior.
- **specification-based detection**: Detection based on explicit rules for what acceptable behavior should look like.

## Detailed Explanation

An IDS observes and alerts; an IPS goes further by taking action, such as blocking traffic or changing configuration. The distinction matters because prevention introduces response power and the risk of automated mistakes.

NIDS see traffic at network points, while HIDS see host-local events such as logs, file changes, or kernel behavior. NIDS provide broader visibility into packet flows, while HIDS provide deeper host context.

Signature-based systems are good for known attacks but weak for novel ones. Anomaly-based systems can, in principle, detect new behavior, but they often suffer from false positives because normal behavior is hard to model perfectly. Specification-based systems rely on explicit allowed-behavior rules rather than learned baselines.

Tutorial L8 emphasizes the base-rate effect. If real attacks are rare, then even a low false-positive rate can generate many more false alarms than true ones. This is why operational context and human review matter so much in intrusion detection.

The tutorial material also makes the false-negative concept explicit. Missing a real attack can be quieter than raising too many alarms, but it may be more dangerous operationally because compromise continues unnoticed. So alarm quality must be judged using both kinds of error, not only false positives.

## How It Works

IDS -> alerting and evidence collection.

IPS -> active blocking or response.

HIDS -> host-local observations; NIDS -> network observations.

Low attack prevalence + nonzero false-positive rate -> many alarms may still be false.

## What You Must Know

- Difference between IDS and IPS.
- Difference between HIDS and NIDS.
- Differences among signature-based, anomaly-based, and specification-based detection.
- Why low base rates can make many alarms false alarms in practice.

## 30-Second Oral Answer

- IDS detects; IPS detects and can respond.
- HIDS watches a host, NIDS watches traffic, and each has different visibility strengths.
- Anomaly detection is flexible but noisy; signature detection is precise for known attacks but blind to unknown ones.

## Typical Exam Questions

- What is the difference between IDS and IPS?
- What is the base-rate problem in intrusion detection?
- Why can anomaly-based systems have many false positives?
- What does a HIDS monitor that a NIDS may not see directly?

## Common Pitfalls

- Assuming anomaly detection is automatically better because it can detect unknown attacks.
- Ignoring the prevalence of attacks when interpreting alarm quality.
## Related Concepts

- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility|Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility]]
- [[DDoS, Alarm Quality, and Detection Interpretation|DDoS, Alarm Quality, and Detection Interpretation]]
- [[ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection|ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 8.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 8.pdf)
- [Tutorial L8.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L8.pdf)
