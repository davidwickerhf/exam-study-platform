---
tags:
  - university
  - bcs2420
  - computer-security
---

# Wireless and WLAN Security, 802.11, Rogue APs, and Session Hijacking

> [!abstract] Why this note matters
> - Lecture 8 dedicates a large section to WLAN security and the fundamental flaws of 802.11.
> - This is the most visible gap in the existing notes; WLAN material can produce both factual MC questions (frame types, BSS vs ESS) and reasoning questions (why is a rogue AP a MITM vector? why does a disassociate frame enable hijacking?).
> - The lecture treats wireless as a different threat model from wired networks: physical-presence assumptions break, link-layer encryption stops at the AP, and shared keys in hotspots invite peer attackers.

## Overview

Wired LAN security implicitly assumes that an attacker must be physically present on the wire. WLANs erase that assumption — anyone within radio range can listen, transmit, or impersonate. The 802.11 standard therefore must rebuild trust without the cable.

The course treats WLAN security in two parts. First, the architecture: stations, access points, authentication servers, the distribution system, and how a station joins a network through probes, beacons, and association. Second, the attacks: rogue APs as a man-in-the-middle vector, session hijacking via forged disassociate frames, and war-driving for reconnaissance. Both parts share the same root cause: shared keys, lack of mutual authentication, and the loss of any physical-presence basis for trust.

## Exam Focus

- Tier 1 priority — this is a large lecture section with no existing concept note.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **IEEE 802.11**: The family of standards for wireless LANs (Wi-Fi). Analogous to IEEE 802.3 (Ethernet) for wired LANs.
- **STA (Station)**: A mobile device that connects to an access point via radio frequencies.
- **AP (Access Point)**: A device that connects wireless stations to a wired network.
- **AS (Authentication Server)**: A back-end server that handles authentication decisions for stations joining a WLAN.
- **DS (Distribution System)**: The infrastructure (typically wired) that links APs together and to the wider network.
- **SSID (Service Set Identifier)**: The WLAN name, up to 32 characters, visible in plaintext in management frames. Not a secret.
- **BSSID (Basic Service Set Identifier)**: The MAC address of the AP — uniquely identifies one AP.
- **ESSID (Extended Service Set Identifier)**: The identifier for an extended service set (a group of BSSs that look like one logical network).
- **BSS (Basic Service Set)**: One AP plus its associated stations.
- **ESS (Extended Service Set)**: Multiple BSSs that share an ESSID and form one logical WLAN.
- **IBSS (Independent Basic Service Set)**: An ad-hoc set of stations communicating directly without any AP.
- **rogue AP**: An unauthorised access point that impersonates a legitimate one to lure stations into associating with it.
- **disassociate frame**: An 802.11 management frame instructing a station to drop its connection to an AP.
- **war driving**: Scanning radio channels (often from a moving vehicle) to discover in-range wireless networks.

## Detailed Explanation

### 802.11 vs 802.3

Ethernet (802.3) dominates wired LANs. Wi-Fi (802.11) is the wireless analogue. Both expose the same upper-layer interface so that higher layers (IP, TCP, applications) do not need to know which medium is underneath. The differences live at the physical and data-link layers — and security depends on those differences.

### Frame Types in 802.11

802.11 uses three categories of frames:

| Frame type | Purpose |
|------------|---------|
| **Data** | Carry upper-layer payloads and authentication messages. |
| **Management** | Carry beacons, probes, association requests/responses, and disassociate frames. |
| **Control** | Coordinate access to the shared wireless medium (acknowledgements, request-to-send, clear-to-send). |

The split matters for attacks. Management frames such as disassociate are not authenticated in the original 802.11 design, which is why session hijacking by spoofed disassociates works.

### WLAN Components

- **STA**: the user's device (laptop, phone).
- **AP**: the bridge between wireless STAs and the wired network.
- **AS**: external authentication server (used in enterprise WPA2/3 with 802.1X).
- **DS**: the infrastructure connecting APs and the rest of the network.

### SSID vs BSSID vs ESSID

The SSID is just a network *name*. It is broadcast in plaintext in beacons and probes, so "hiding" the SSID is not security — only mild obscurity.

The BSSID is the MAC address of an AP. Every AP has one. The ESSID identifies an extended service set: when several APs coordinate to provide one logical Wi-Fi network (typical for offices and campuses), they share an ESSID even though each has its own BSSID.

### Infrastructure vs Ad-Hoc Mode

- **Infrastructure mode**: STAs talk to an AP, which talks to the wired network. STAs + AP = BSS; many BSSs form an ESS.
- **Ad-hoc mode**: STAs talk directly to each other without an AP. This is an IBSS.

Most real Wi-Fi deployments are infrastructure mode.

### Multicast and Broadcast Addresses

A unicast address picks one recipient, a multicast address picks a group, and a broadcast address picks every device on the LAN. In infrastructure mode, APs send multicast messages directly; STAs send through the AP. Broadcasts use a group key shared by all devices on the WLAN — useful, but exposing the group key to all participants enlarges the attack surface.

### Association Sequence: Beacons, Probes, Authentication

For a STA to connect to an AP, four steps occur:

1. The STA sends probe messages looking for APs. APs also advertise themselves with periodic beacon frames.
2. The STA selects an AP and runs a low-level 802.11 authentication (shared-key or open-system).
3. The STA initiates the association request sequence.
4. Before data frames are accepted, an upper-layer 802.1X authentication (in enterprise setups) must complete successfully.

Each step is a candidate attack surface: spoofed beacons enable rogue APs, spoofed disassociate frames break the association.

### AP Security Policy in Beacons and Probes

The AP advertises its security policy inside elements carried in beacon and probe frames. Those elements list which authentication methods, which encryption suites, and which external authentication server the AP supports. The STA then picks a compatible security suite for the connection.

Because beacons are plaintext and unauthenticated, an attacker can read the AP's advertised policy and either downgrade negotiations or set up a rogue AP that advertises a weaker policy.

### Rogue AP as a Man-in-the-Middle Vector

A rogue AP exploits the lack of mutual authentication between STA and AP. The attacker stands up an AP that advertises the same SSID (and often the same security policy) as the legitimate one. The victim STA associates with the rogue AP because there is no cryptographic check that the AP is genuine.

Once associated, the rogue AP relays messages and credentials to the real AP, acting as a man-in-the-middle. From the STA's perspective, the network looks normal. From the AP's perspective, the rogue is just another station.

This is the wireless analogue of a transport-layer MITM. The relevant defence is mutual authentication — both ends must prove identity, which simple shared-key models do not provide.

### Session Hijacking via Forged Disassociate Frames

The session-hijacking attack exploits two facts. First, management frames in the original 802.11 design are not authenticated. Second, MAC addresses are not secrets — they are observable on the radio channel.

The attack sequence:

1. The victim STA authenticates and associates with the real AP.
2. The attacker, using the **AP's MAC address as the source**, sends a forged disassociate frame to the victim STA. The STA believes the AP is dropping it and disassociates.
3. The attacker, now using the **STA's MAC address as the source**, continues the session with the real AP. The AP cannot tell that the original STA is no longer present.

The attacker has hijacked the session at the link layer without ever cracking the encryption. The attack is possible whenever management frames are not cryptographically authenticated and only relies on link-layer encryption.

### War Driving and NetStumbler

War driving is the practice of scanning radio channels for in-range wireless networks, often while moving through an area. It can be passive (just listen to beacons) or active (send probe requests to trigger AP responses). NetStumbler is a classic tool for this kind of wireless enumeration.

The result is a map of nearby networks, their SSIDs, BSSIDs, security policies, and signal strengths — useful for reconnaissance before any actual attack.

### Link-Layer vs End-to-End Security

A WLAN link is **between the STA and the AP**, not end-to-end. WPA2/3 protects that single radio hop. Once the data reaches the AP, it is decrypted and forwarded over the wired network in cleartext (unless an end-to-end protocol such as TLS also covers it).

This is why link-layer wireless encryption does not protect data from the AP onward. An attacker who compromises the AP, or who can read traffic on the wired side, sees plaintext. The course emphasises that WLAN encryption is not a substitute for end-to-end protection.

### Shared-Key Risks in Hotspots

Public Wi-Fi hotspots often use a single shared key for all users (or no key at all). In that model, any user on the hotspot can decrypt other users' traffic, because everyone holds the same key. This is a structural risk, not an implementation bug: shared keys mean shared access.

### Loss of Physical-Presence Threat Assumption

The fundamental shift from wired to wireless is the **loss of physical-presence as a security assumption**. On a wired LAN, an attacker needs to be in the building and plugged in. On a WLAN, anyone within radio range can passively listen, actively probe, or impersonate.

Three consequences follow:

- Trust is harder to assume — physical access used to imply trust by proxy.
- Rogue APs are always a concern because the medium is open.
- Shared keys in hotspots compound risk because the "perimeter" is now everyone in radio range.

## How It Works

Beacons/probes -> AP advertises -> STA selects AP -> low-level 802.11 auth -> association request -> (optional) 802.1X upper-layer auth -> data frames flow.

Rogue AP -> impersonates legitimate AP -> STA associates -> attacker relays to real AP -> MITM established.

Session hijack -> attacker spoofs disassociate (AP's MAC -> STA) -> STA drops -> attacker spoofs STA's MAC -> continues session with AP.

WLAN encryption -> protects STA-to-AP hop only -> AP decrypts -> wired side is cleartext unless end-to-end is added.

## What You Must Know

- Wi-Fi is 802.11, Ethernet is 802.3, and they expose the same upper-layer interface.
- Three frame types: data, management, control. Management frames carry beacons, probes, associations, and disassociates.
- WLAN components: STA, AP, AS, DS.
- SSID is the network name; BSSID is the AP's MAC; ESSID is the identifier for an ESS.
- BSS = AP + STAs; ESS = multiple BSSs; IBSS = ad-hoc, no AP.
- Association sequence: probe/beacon -> low-level auth -> association request -> (802.1X if enterprise).
- AP security policy is advertised in beacons and probes.
- A rogue AP is a MITM vector because there is no mutual authentication.
- Session hijacking uses forged disassociate frames spoofed from the AP's MAC.
- War driving with NetStumbler is for reconnaissance, not exploitation by itself.
- WLAN encryption is link-layer only — decrypted at the AP.
- Shared keys in hotspots let peers attack peers.
- The loss of physical presence as a trust basis is the structural shift in wireless threat models.

## 30-Second Oral Answer

- 802.11 frames split into data, management, and control; management frames carry the association sequence and disassociates.
- A rogue AP impersonates the legitimate AP because mutual authentication is missing, putting itself between the STA and the real AP.
- Session hijacking forges a disassociate frame with the AP's MAC, kicks the STA off, then continues the session under the STA's MAC.
- WLAN encryption is link-only — the AP decrypts on receipt, so wireless protection ends at the AP.

## Typical Exam Questions

- What is the difference between SSID, BSSID, and ESSID?
- Describe the association sequence a STA goes through to join an AP.
- Why is a rogue AP a man-in-the-middle attack?
- How does an attacker hijack a wireless session using disassociate frames?
- Why is link-layer wireless encryption not equivalent to end-to-end security?
- Why are shared keys in public Wi-Fi hotspots structurally risky?

## Common Pitfalls

- Thinking that hiding an SSID provides security. It is broadcast in management frames and visible to anyone listening.
- Confusing BSSID (one AP's MAC) with SSID (a network name).
- Believing WLAN encryption protects the whole path. It only protects the STA-to-AP hop.
- Forgetting that the attacker spoofs the AP's MAC for the disassociate and the STA's MAC for continuing the session.
- Treating ad-hoc (IBSS) and infrastructure (BSS/ESS) modes as interchangeable.

## Concrete Examples and Commands

### Rogue AP MITM shape

```text
Real AP (legit BSSID, SSID "CompanyWiFi")  ---  Authentication Server
                                                 |
Attacker stands up rogue AP advertising SSID "CompanyWiFi"
                                                 |
Victim STA associates with the rogue (no mutual auth)
                                                 |
Rogue AP relays frames to the real AP, reads/modifies in transit
```

### Session hijack via disassociate

```text
1. STA --(authenticates and associates)--> AP
2. Attacker --(disassociate, src = AP's MAC)--> STA
   STA drops its end of the connection.
3. Attacker --(continues session, src = STA's MAC)--> AP
   AP keeps the association open because frames arrive from "STA".
```

### War driving with NetStumbler (passive)

```text
NetStumbler listens to beacons on each channel.
Records: SSID, BSSID, channel, signal strength, advertised security policy.
Output: a map of all in-range APs — used for reconnaissance.
```

## Related Concepts

- [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]
- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection|ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection]]
- [[Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility|Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 08 — Intrusion Detection and WLAN Security.pdf](Materials/01 Lectures/Lecture 08 — Intrusion Detection and WLAN Security.pdf)
