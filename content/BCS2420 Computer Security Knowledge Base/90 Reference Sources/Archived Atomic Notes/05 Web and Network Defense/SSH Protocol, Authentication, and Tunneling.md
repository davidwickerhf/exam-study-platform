---
tags:
  - university
  - bcs2420
  - computer-security
---

# SSH Protocol, Authentication, and Tunneling

> [!abstract] Why this note matters
> - Lecture 7 dedicates an entire section to SSH as the canonical replacement for insecure legacy protocols.
> - SSH is one of three protocols (along with TLS and IPsec) that the lecture maps to specific layers of the network stack — a frequent multiple-choice topic.
> - Port forwarding via SSH is the concrete tunneling example exam questions can build on.

## Overview

SSH (Secure Shell) is the encrypted replacement for a generation of insecure protocols (rsh, rlogin, telnet, ftp, rcp). The course frames SSH in three ways: as a layered protocol with transport, authentication, and connection sub-protocols; as a host-authenticated, client-authenticated channel; and as a tunneling tool that can carry traffic for other applications.

SSH also sits at the application layer of the stack, which matters because TLS, IPsec, and SSH each protect at different layers — and a common exam question asks where each lives.

## Exam Focus

- Tier 2 priority. SSH is well defined in Lecture 7 and asked in Tutorial L7.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **SSH (Secure Shell)**: A protocol that provides authenticated, encrypted communication over an untrusted network.
- **Transport Layer (SSH)**: The SSH sub-protocol that provides encryption and integrity.
- **Authentication (SSH)**: The SSH sub-protocol that manages client-server authentication.
- **Connection (SSH)**: The SSH sub-protocol that allows multiple multiplexed sessions over one connection.
- **SCP (Secure Copy)**: A file-transfer command that uses SSH as its transport, replacing rcp.
- **SSH host key**: The server's public key, verified by the client to authenticate the server.
- **port forwarding**: Redirecting traffic for one application through an SSH tunnel for encryption or to traverse a firewall.

## Detailed Explanation

### Three-Layer Architecture

SSH is built from three stacked sub-protocols:

| Sub-protocol | Responsibility |
|--------------|----------------|
| **Transport Layer** | Encrypts and integrity-protects the channel between client and server. |
| **Authentication** | Handles how the client proves identity to the server. |
| **Connection** | Multiplexes multiple logical sessions (interactive shell, port forwards, file transfers) over the single encrypted channel. |

The connection sub-protocol is what enables one SSH session to host an interactive shell and several port forwards at the same time.

### What SSH Replaces

Insecure legacy protocols sent passwords and data in cleartext. SSH replaces them one for one:

| Legacy (insecure) | SSH replacement | Functionality |
|-------------------|-----------------|---------------|
| `rsh` (remote shell) | `ssh` | Run shell commands on a remote host. |
| `rlogin` (remote login) | `ssh` | Log in to a remote host as if local. |
| `telnet` (teletype network) | `ssh` | Acquire an interactive terminal over TCP. |
| `ftp` (file transfer) | `sftp` / `ftps` (FTP over TLS) | Transfer files. |
| `rcp` (remote copy) | `scp` (secure copy) | Copy files between local and remote. |

### Three Client Authentication Methods

SSH supports three ways for the client to prove identity to the server:

1. **Client password**: The user supplies a password. Encrypted in transit by SSH, so safer than telnet passwords, but still vulnerable to password attacks if weak.
2. **Kerberos ticket**: The client presents a Kerberos ticket obtained from a trusted ticket-granting infrastructure.
3. **Client public key**: The client signs a challenge with its private key; the server verifies using the corresponding public key it has on file. This is the modern preferred method.

### Server Authentication: Two Trust Models

The server proves its identity using a public key (the SSH host key) that the client verifies. There are two trust models for how the client decides whether to trust a host key:

1. **Local database of host keys**: The client stores known host keys locally (the classic `~/.ssh/known_hosts` file). First connection is trust-on-first-use; subsequent connections check the stored fingerprint.
2. **CA-certified server keys**: The client trusts a Certificate Authority's public key, and the server presents a host key signed by that CA. This scales better in enterprise environments.

### SCP (Secure Copy)

SCP is a file-transfer tool that uses an SSH tunnel internally. From the user's view it behaves like `cp` between local and remote paths. Under the hood, the SCP client spawns an SSH connection, and a peer SCP process is started by `sshd` on the remote side. SCP replaces the insecure `rcp`.

### Port Forwarding

SSH can redirect arbitrary application traffic through its encrypted tunnel. Three flavours exist:

- **Local port forwarding**: Forward a port on the local machine through the SSH tunnel to a destination reachable from the SSH server. Use case: secure an unsecured local-to-remote application by routing it through SSH.
- **Remote port forwarding**: Forward a port on the SSH server back through the tunnel to a destination reachable from the local machine. Use case: expose a local service to the remote side.
- **Dynamic port forwarding**: Turn the SSH client into a SOCKS proxy. Any application configured to use that proxy has its traffic tunneled through SSH.

Each variant lets SSH carry traffic for protocols that have no encryption of their own.

### Where SSH Sits in the Stack: SSH vs TLS vs IPsec

The Lecture 7 stack diagram is a frequent exam topic. The three security protocols sit at different layers:

| Protocol | Layer | What it protects |
|----------|-------|------------------|
| **TLS** | Transport (sits between application and TCP/UDP) | One application connection (e.g., HTTPS = HTTP over TLS). |
| **IPsec** | Network (sits beside IP) | All IP traffic between two endpoints or networks. |
| **SSH** | Application | One SSH connection, which may carry multiple tunneled streams. |

Memory trick: **TLS = transport, IPsec = network, SSH = application**.

## How It Works

SSH transport sub-protocol -> encrypts and integrity-protects the channel.
SSH authentication sub-protocol -> proves the client identity (password / Kerberos / public key).
SSH connection sub-protocol -> multiplexes sessions and port forwards inside one encrypted channel.

Server authentication -> host key verified against local known-hosts DB or via CA.

Port forwarding -> SSH client listens on a local port -> tunnels traffic through SSH -> SSH server delivers to the actual destination.

SSH sits at the application layer, TLS at transport, IPsec at network.

## What You Must Know

- The three SSH sub-protocols and what each does.
- The three client authentication methods (password, Kerberos ticket, public key).
- The two server-authentication trust models (local known-hosts DB vs CA-certified keys).
- SSH replaces rsh, rlogin, telnet, ftp, rcp.
- SCP is file transfer over an SSH tunnel.
- Local, remote, and dynamic port forwarding.
- TLS = transport, IPsec = network, SSH = application.

## 30-Second Oral Answer

- SSH has three sub-protocols: transport for encryption, authentication for client identity, connection for multiplexed sessions.
- Clients authenticate with passwords, Kerberos tickets, or public keys; servers prove identity with a host key trusted via a local database or a CA.
- SSH replaces insecure legacy protocols and can tunnel other applications via local, remote, or dynamic port forwarding.
- TLS is at the transport layer, IPsec at the network layer, SSH at the application layer.

## Typical Exam Questions

- Describe the three sub-protocols that make up SSH.
- Name the three client authentication methods SSH supports.
- Compare local and remote port forwarding.
- At which layer of the network stack does each of TLS, IPsec, and SSH operate?
- What insecure protocols does SSH replace, and why does the replacement matter?

## Common Pitfalls

- Calling SSH a transport-layer protocol because of the "transport sub-protocol" inside SSH. SSH sits at the application layer of the network stack; "transport" inside SSH is one of SSH's own layers.
- Believing that SSH and TLS protect the same things. TLS protects a specific TCP connection; SSH provides a multiplexable channel and can tunnel other protocols.
- Forgetting that local known-hosts is trust-on-first-use — the first connection establishes trust, so an attacker active at first connection can substitute their key.

## Concrete Examples and Commands

### Local port forwarding example

```text
ssh -L 8080:internal-db:5432 user@bastion

Effect: a connection to localhost:8080 is tunneled through SSH to bastion,
        which then connects to internal-db:5432.
```

### Remote port forwarding example

```text
ssh -R 9000:localhost:3000 user@server

Effect: a connection to server:9000 is tunneled back through SSH to the
        local machine and delivered to localhost:3000.
```

### Dynamic port forwarding (SOCKS proxy)

```text
ssh -D 1080 user@bastion

Effect: any application configured to use SOCKS proxy localhost:1080 has
        its traffic tunneled through SSH to bastion.
```

### Layered protocol picture

```text
Application:      HTTP, FTP, DNS, ...           SSH
Transport:        TCP, UDP                      TLS
Network:          IP, ICMP                      IPsec
Link:             Ethernet, Wi-Fi, ARP
```

## Related Concepts

- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[Firewall Policy Design, Bastion Hosts, and Port Knocking|Firewall Policy Design, Bastion Hosts, and Port Knocking]]
- [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 07 — Network Defense, Firewalls, Tunnels.pdf](Materials/01 Lectures/Lecture 07 — Network Defense, Firewalls, Tunnels.pdf)
- [Tutorial L7.pdf](Materials/02 Tutorials/Tutorial L7.pdf)
