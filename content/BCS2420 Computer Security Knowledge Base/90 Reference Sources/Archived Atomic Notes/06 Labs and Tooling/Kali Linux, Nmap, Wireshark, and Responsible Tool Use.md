---
tags:
  - university
  - bcs2420
  - computer-security
---

# Kali Linux, Nmap, Wireshark, and Responsible Tool Use

> [!warning] Scope of this note
> nmap and Wireshark are syllabus-mentioned but are NOT used in the four lab assignments. The labs rely on browser DevTools, John the Ripper, git-dumper, Burp Suite, Ghidra/Binary Ninja, the MySQL client, and Python scripting. This note covers the syllabus-named tools for completeness; for the actual lab toolset see [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]].

> [!abstract] Why this note matters
> - The syllabus explicitly names Kali, nmap, Wireshark, and official tool documentation.
> - The labs expect command-line comfort and careful observation, not blind command copying.

## Overview

The course uses tools as thinking aids. The syllabus explicitly says the goal is not to type commands blindly but to understand vulnerabilities and how to fix them. That means tool usage should always be tied back to a security question.

Kali is the lab environment, but the ethical boundary matters as much as the command syntax. Security tools are only appropriate within lab systems or with explicit permission.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **Kali Linux**: A security-focused Linux distribution bundling many penetration-testing and analysis tools.
- **nmap**: A network scanning tool used to discover hosts, ports, and some service characteristics.
- **Wireshark**: A packet analysis tool used to inspect captured network traffic.
- **scope**: The authorized boundary of what systems and activities are permitted for testing.

## Detailed Explanation

nmap helps answer questions such as: what ports are open, what services appear to be running, and what network exposure exists? It does not itself 'secure' a system; it reveals attack surface.

Wireshark helps answer a different class of question: what traffic is actually present on the wire, what headers or cookies are being sent, what hidden values leak in requests or responses, and how protocol behavior looks in practice.

Official documentation matters because tools can do far more than the minimal lab tasks. The course encourages exploring docs for correct use rather than relying on folklore or random snippets.

## How It Works

Use nmap to inspect exposure.

Use Wireshark or browser/network tooling to inspect traffic and headers.

Always work inside authorized scope and recorded lab context.

## What You Must Know

- The role of Kali Linux in the lab environment.
- What nmap and Wireshark are used for at a high level.
- Why ethical and legal scope boundaries matter.

## 30-Second Oral Answer

- Kali provides the lab tooling environment; nmap reveals exposed services; Wireshark reveals network behavior.
- The tool is not the goal. The goal is to answer a security question about exposure, leakage, or protocol behavior.

## Typical Exam Questions

- What kinds of questions can nmap help answer?
- Why is Wireshark useful in web or authentication labs?
- What does responsible tool use require?

## Common Pitfalls

- Memorizing commands without understanding what evidence they produce.
- Treating Kali as permission to scan arbitrary systems.

## Concrete Examples and Commands

### Basic tool examples

```bash
nmap -sV target.example
```

Use service/version detection to see what is exposed.

```text
In Wireshark, inspect request and response headers, cookies, and suspicious cleartext values.
```

## Related Concepts

- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]
- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]
- [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra|Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
