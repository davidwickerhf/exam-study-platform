---
tags:
  - university
  - bcs2420
  - computer-security
---

# Firewall Policy Design, Bastion Hosts, and Port Knocking

> [!abstract] Why this note matters
> - Tutorial L7 and the retained corpus explicitly include default-allow vs default-deny, bastion hosts, and port knocking.
> - These architectural details were part of the source scope but not yet promoted into the concept layer.

## Overview

Firewall security is not only about matching packets against rules. It also depends on how the policy is framed and what architecture exists around the firewall.

Default-deny, bastion hosts, and port knocking are all examples of shaping exposure rather than only reacting to bad packets after exposure already exists.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **default-deny**: A policy where traffic is blocked unless a rule explicitly allows it.
- **default-allow**: A policy where traffic is allowed unless a rule explicitly blocks it.
- **bastion host**: A hardened, deliberately exposed system placed at a network boundary for controlled access.
- **port knocking**: A stealth-oriented technique where a port opens only after a secret sequence of connection attempts is observed.

## Detailed Explanation

### Default-Deny vs Default-Allow — the Failure-Mode Argument

Default-deny is safer because it forces administrators to enumerate what truly needs to be reachable. Unknown services and forgotten exposures are therefore less likely to remain accessible accidentally. Default-allow is easier operationally at first, but it is riskier because unlisted traffic remains open by default.

The exam-grade framing is in terms of **failure modes**:

- **Default-deny's failure mode is service breakage.** If a rule is missing, a legitimate service stops working. The failure is loud, visible, and recoverable — someone files a ticket, the admin adds the rule.
- **Default-allow's failure mode is silent unauthorised access.** If a denial rule is missing, the unwanted service stays exposed. The failure is invisible, undetected, and unrecoverable once exploited.

Default-deny is the safer policy because the failure mode is service breakage (visible, recoverable), whereas default-allow's failure mode is silent unauthorised access (invisible, unrecoverable). Lecture 7 calls this the principle of **SAFE-DEFAULTS**.

### Worked Two-Rule Comparison

Consider a simple policy with two rules and a default action. The intent: allow inbound HTTP traffic to the web server only.

**Default-deny ruleset.**

```text
Rule 1:  ALLOW  dst-port 80  dst-ip 10.0.0.5     # web server
Rule 2:  (no other rules)
Default: DENY everything else

Effect: SSH (port 22), database (port 5432), and everything else are
        blocked unless explicitly added later.
A forgotten admin port stays closed; if a service needs it, it breaks
visibly and the admin must add a rule.
```

**Default-allow ruleset.**

```text
Rule 1:  DENY   dst-port 22                       # block SSH
Rule 2:  DENY   dst-port 5432                     # block database
Default: ALLOW everything else

Effect: Only the explicitly denied ports are closed. If a new service
        appears on port 9000 with a vulnerability, it is open by default.
The admin must remember every dangerous port and add a deny rule for it.
A forgotten port stays open silently.
```

The two rulesets implement opposite philosophies. The first one fails closed; the second one fails open.

### Enterprise Firewall Architectures — From Lecture 7

The lecture walks through a progression of architectures, each one tightening the perimeter relative to the previous.

**1. Single screening router.** A single packet-filtering router between the Internet and the internal network. Basic protection, limited configurability, single point of failure. Suitable only for small or low-risk deployments.

**2. Screening router + bastion host.** A screening router in front, plus a hardened bastion host behind it. The bastion accepts external interaction in a controlled way; the router filters traffic to and from the bastion. More configurable, more defensible, but still effectively one perimeter.

**3. DMZ with two screening routers (or a dual-homed host).** A demilitarised zone — a subnetwork between the Internet and the internal network — sits between two screening routers (or behind a dual-homed host with two network interfaces). Public-facing services (web server, DNS server) live in the DMZ; internal hosts live behind a second router. A compromise in the DMZ does not automatically reach the internal network because a second filter sits in the way. This is the standard enterprise pattern.

The DMZ design is the practical application of the **isolated-compartments** principle: don't let a single perimeter breach reach the crown jewels.

### Bastion Host

A bastion host is a specially hardened system that accepts external interaction in a controlled way. Instead of letting the outside world talk broadly to internal systems, the architecture narrows exposure to one carefully defended boundary component. Non-essential services are disabled to minimise attack surface.

### Port Knocking

Port knocking is an exposure-management tactic. It hides a service until a client presents the correct secret sequence of connection attempts. This can reduce scanning visibility and opportunistic probing, but it should be understood as a stealth aid rather than a substitute for real authentication and encryption.

## How It Works

Default-deny -> allowlist mindset.

Default-allow -> denylist mindset.

Bastion host -> hardened exposed boundary point.

Port knocking -> open port only after the right knock sequence is observed.

## What You Must Know

- Difference between default-allow and default-deny.
- What a bastion host is for.
- Why port knocking may be used and what it does not replace.

## 30-Second Oral Answer

- Default-deny is safer because unknown traffic is blocked unless explicitly permitted.
- A bastion host narrows and hardens perimeter exposure, while port knocking reduces visible exposed services.

## Typical Exam Questions

- Compare default-allow and default-deny policies.
- What is a bastion host?
- Why might port knocking be used with a firewall?

## Common Pitfalls

- Treating port knocking as complete authentication.
- Assuming default-allow can be made equally safe just by adding a few deny rules.
## Related Concepts

- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[Defense in Depth, Security Strategy, and Security Posture|Defense in Depth, Security Strategy, and Security Posture]]
- [[SSH Protocol, Authentication, and Tunneling|SSH Protocol, Authentication, and Tunneling]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 07 — Network Defense, Firewalls, Tunnels.pdf](Materials/01 Lectures/Lecture 07 — Network Defense, Firewalls, Tunnels.pdf)
- [Tutorial L7.pdf](Materials/02 Tutorials/Tutorial L7.pdf)
