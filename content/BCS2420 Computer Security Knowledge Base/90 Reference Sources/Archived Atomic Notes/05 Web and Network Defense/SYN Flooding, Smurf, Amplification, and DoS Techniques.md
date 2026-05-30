---
tags:
  - university
  - bcs2420
  - computer-security
---

# SYN Flooding, Smurf, Amplification, and DoS Techniques

> [!abstract] Why this note matters
> - Tutorial L8 Part B Q8 asks to explain SYN flooding and how SYN cookies mitigate it.
> - Tutorial L8 Part B Q9 asks about Smurf/amplification attacks and modern mitigations.
> - Tutorial L8 Part C Q4 calculates DoS bandwidth — directly numeric.

## Overview

Denial-of-Service attacks exhaust a target's resources so legitimate users cannot be served. The course covers two specific mechanisms: SYN flooding (resource exhaustion via incomplete TCP handshakes) and Smurf/amplification attacks (traffic amplification using spoofed broadcast requests). Both are instructive models for how modern DDoS attacks are structured.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **SYN flood**: A DoS attack where the attacker sends many TCP SYN packets but never completes the three-way handshake, exhausting the server's half-open connection table.
- **half-open connection**: A TCP connection in the SYN_RECEIVED state, waiting for the client's final ACK, consuming server resources.
- **SYN cookies**: A mitigation technique where the server encodes connection state into the SYN-ACK's initial sequence number rather than allocating a table entry; resources are only committed when the final ACK arrives.
- **Smurf attack**: An ICMP-based amplification DoS where the attacker sends ICMP echo requests with a spoofed source IP (the victim's IP) to a broadcast address, causing all hosts on the subnet to reply to the victim.
- **amplification factor**: The ratio of response traffic to request traffic; a factor of 100 means 1 byte of attacker traffic produces 100 bytes of traffic at the victim.
- **directed broadcast**: A broadcast sent to all hosts on a specific subnet (e.g., 192.168.1.255), now typically blocked by modern routers.

## Detailed Explanation

### SYN Flooding

The TCP three-way handshake is: SYN → SYN-ACK → ACK.

In a SYN flood:
1. Attacker sends many SYN packets, often with spoofed source IPs.
2. Server allocates a half-open connection entry and sends SYN-ACKs.
3. No ACK ever arrives (spoofed source IP means replies go nowhere).
4. The half-open connection table fills up.
5. Legitimate connection attempts are rejected because the table is full.

**SYN Cookies (mitigation):**

Instead of allocating a table entry on SYN arrival, the server encodes all necessary connection state (IP addresses, port numbers, timestamp, etc.) into a cryptographic hash and places it in the ISN (Initial Sequence Number) of the SYN-ACK:

```text
Server receives SYN → computes ISN = hash(src_ip, src_port, dst_ip, dst_port, timestamp, secret)
Server sends SYN-ACK with that ISN — no table entry allocated
If legitimate client sends ACK: ISN-1 is in the ACK number
Server recomputes the hash to verify, then allocates connection
If no ACK: no resources consumed
```

Effect: Spoofed SYN packets never produce resource consumption because no table entry is made. The state is reconstructed from the packet if a real ACK arrives.

**Limitation of SYN cookies:** Some TCP options (like window scaling) cannot be preserved in the cookie; these connections fall back to default settings.

### Smurf Attack

1. Attacker sends ICMP echo request (ping) to a subnet's broadcast address (e.g., 255.255.255.255 or 192.168.1.255).
2. Source IP is spoofed to the victim's IP.
3. All hosts on the subnet reply to the victim's IP with ICMP echo replies.
4. With N hosts on the subnet, the victim receives N packets for every 1 the attacker sent → amplification factor = N.

**Modern mitigations:**
- **Block directed broadcasts at routers**: Most modern routers disable `ip directed-broadcast` by default, preventing forwarding of broadcast ICMP to the subnet.
- **Ingress filtering (BCP38)**: Network providers drop packets with source IPs that don't belong to their address space, preventing IP spoofing at the source.

### General Amplification Attacks (DRDoS)

The Smurf principle generalises to any protocol where a small request produces a large response, especially when the source IP can be spoofed (UDP-based protocols):

- **DNS amplification**: Small DNS query → large DNS response (50x+ amplification).
- **NTP amplification**: `monlist` command → dump of 600 recent clients (hundreds of bytes per 8-byte request).
- **SSDP, Memcached**: Similar amplification ratios.

All share the same structure: spoofed source + stateless protocol + large response.

### DoS Bandwidth Calculation

```text
Attacker sends: 100,000 packets per second (pps)
Each packet: 512 bytes

Traffic in bytes/sec = 100,000 × 512 = 51,200,000 bytes/sec
In MB/s = 51,200,000 / 1,000,000 = 51.2 MB/s
In Mbps = 51.2 × 8 = 409.6 Mbps ≈ 410 Mbps

If target uplink = 100 Mbps → yes, this saturates it.
```

## How It Works

SYN flood → fill half-open connection table → server refuses new connections → DoS.

SYN cookies → encode state in SYN-ACK's ISN → no table entry → resource only committed on real ACK.

Smurf → spoof victim IP + broadcast ping → all subnet hosts reply to victim → amplified flood.

DRDoS → spoof victim IP + stateless UDP request → large response floods victim.

## What You Must Know

- The mechanics of SYN flooding and why it exhausts server resources.
- How SYN cookies work and why they prevent resource exhaustion.
- How the Smurf attack achieves amplification and how modern networks block it.
- The amplification factor concept and that it generalises to DNS/NTP/SSDP.
- DoS bandwidth calculation: pps × bytes/packet × 8 = Mbps.

## 30-Second Oral Answer

- SYN flooding fills the server's half-open connection table by sending SYNs without ACKs; SYN cookies solve this by encoding state in the sequence number so no table entry is needed until the real ACK arrives.
- Smurf attacks amplify traffic by spoofing the victim's IP and pinging a broadcast address; modern routers block directed broadcasts; BCP38 prevents IP spoofing at the source.
- The amplification principle generalises to any stateless UDP protocol with larger responses than requests.

## Typical Exam Questions

- Explain how a SYN flood causes a DoS and how SYN cookies mitigate the resource exhaustion.
- What is the Smurf attack? If the amplification factor is 100, how does that occur?
- How do modern networks mitigate Smurf-style amplification attacks?
- Calculate the bandwidth of a DoS attack: 100,000 pps at 512 bytes each.

## Common Pitfalls

- Thinking SYN cookies prevent the flood — they don't. They prevent resource exhaustion by not allocating table entries.
- Confusing the Smurf attack (ICMP broadcast) with DNS amplification (reflection) — same principle, different protocol.
- Forgetting that IP spoofing is the prerequisite for both SYN flooding and Smurf attacks.

## Related Concepts

- [[DDoS, Alarm Quality, and Detection Interpretation|DDoS, Alarm Quality, and Detection Interpretation]]
- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]
- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]

## Sources

- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial L8.pdf](100 Extra Materials/Tutorial L8.pdf)
- [Tutorial L8 Solution.pdf](100 Extra Materials/Tutorial L8 Solution.pdf)
- [Lecture 8.pdf](100 Extra Materials/Lecture 8.pdf)
