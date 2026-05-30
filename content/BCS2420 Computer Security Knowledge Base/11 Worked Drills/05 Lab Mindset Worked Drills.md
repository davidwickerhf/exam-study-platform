---
tags:
  - university
  - bcs2420
  - computer-security
  - worked-drill
---

# Lab Mindset Worked Drills

Use these drills to practice complete short-answer and long-answer responses under closed-book conditions.

**Best use:** treat these as practical short essays. The lab layer tests whether you can reason from evidence, not just recite definitions.

## Drill 1 — Analyst Skepticism on a Compromised Host

**Question.** Explain why analyst skepticism matters when the compromised system is the thing showing you the output.

### Model Answer

On a compromised host, ordinary tools may lie because their output depends on the same kernel, libraries, environment variables, and filesystem that the attacker may have modified. A rootkit can hide files from `ls`, hide processes from `ps`, alter `cat` output, or prune `/proc` entries. Clean output is therefore not proof of a clean system.

The analyst should cross-check multiple views: compare `ps`, `top`, `pgrep`, and `/proc`; inspect `/proc/<PID>/cmdline` and `/proc/<PID>/environ`; unset suspicious environment variables; boot from trusted media when needed; and preserve evidence before making destructive changes. The core mindset is "verify through independent channels."

**Covered in:** [[06 Labs and Tooling/06 Labs and Tooling|proc Filesystem and Process Forensics on Linux]], [[06 Labs and Tooling/06 Labs and Tooling|Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation]]

## Drill 2 — Hidden Files and Environment Variables

**Question.** A lab challenge says the flag exists, but `ls` shows nothing. What checks would you perform and why?

### Model Answer

First, run `pwd` to confirm the working directory, then `ls -la` to include hidden dotfiles. If output still looks suspicious, use alternative views such as `find`, shell globbing, or direct paths if known. Next, inspect the environment with `printenv`, because an environment variable can influence tool behavior or point to hidden paths. If a variable appears suspicious, run a command with that variable removed using `env -u NAME command`.

The reason is that stealth can happen through omission. The file may exist while the normal listing has been filtered, or the shell environment may be causing a tool to hide or rewrite output.

**Covered in:** [[06 Labs and Tooling/06 Labs and Tooling|Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation]]

## Drill 3 — Client-Side vs Server-Side Validation

**Question.** Explain the difference between client-side and server-side validation using a lab-style web challenge.

### Model Answer

Client-side validation runs in the browser: JavaScript checks fields, disables buttons, or hides controls. It improves usability but is not a security boundary because the user controls the browser. In a lab, an attacker can use DevTools to edit HTML, re-enable disabled fields, change JavaScript variables, replay requests, or send requests directly with Burp or `curl`.

Server-side validation runs on the application server after the request arrives. It is the enforceable control: the server must check authorization, parameter ranges, file types, object ownership, and CSRF tokens even if the browser UI claims the request should be impossible.

The exam phrasing: client-side validation is a convenience; server-side validation is the security control.

**Covered in:** [[06 Labs and Tooling/06 Labs and Tooling|Browser DevTools, Hidden Resources, and Client-Side Evidence]], [[06 Labs and Tooling/06 Labs and Tooling|Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation]]

## Drill 4 — Leaked Headers and Hidden Repository Files

**Question.** Explain why leaked response headers or hidden repository files are security failures rather than harmless mistakes.

### Model Answer

Leaked response headers can reveal server technology, framework versions, internal hostnames, debug modes, or security policy gaps. This helps attackers choose targeted exploits and reduces their uncertainty. Hidden repository files such as `.git/` are worse: if exposed, attackers may reconstruct source code, read commit history, discover secrets, find old vulnerable code, or recover configuration files.

These leaks matter because reconnaissance is part of exploitation. A system does not need to leak passwords directly to become easier to compromise; it only needs to leak enough structure for the attacker to plan accurately.

**Covered in:** [[06 Labs and Tooling/06 Labs and Tooling|Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]], [[06 Labs and Tooling/06 Labs and Tooling|Browser DevTools, Hidden Resources, and Client-Side Evidence]]

## Drill 5 — Tool Choice

**Question.** Match the tool to the task and explain why.

| Task | Best tool | Why |
|---|---|---|
| Discover open ports and services on a target host | Nmap | Network scanner; identifies reachable services and versions if configured |
| Inspect HTTP requests and modify them before forwarding | Burp Suite | Intercepting proxy for web traffic |
| Capture and inspect packets on the network | Wireshark | Packet capture and protocol analysis |
| Crack weak password hashes | John the Ripper | Offline password/hash cracking |
| Reverse engineer a binary | Ghidra | Disassembler/decompiler |
| Recover an exposed `.git` repository | git-dumper | Downloads reconstructable Git metadata from exposed web roots |

### Marking Cues

- Name the task, not only the tool.
- Mention responsible use: authorization matters. These are legitimate lab tools only when used on systems you are allowed to test.

**Covered in:** [[06 Labs and Tooling/06 Labs and Tooling|Kali Linux, Nmap, Wireshark, and Responsible Tool Use]], [[06 Labs and Tooling/06 Labs and Tooling|Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]]

## Drill 6 — XSS to CSRF Chain

**Question.** A lab app has a stored XSS in profile comments and a transfer form protected only by a hidden CSRF token in the page. Explain how XSS can bypass the CSRF defense.

### Model Answer

CSRF tokens protect against an external site that cannot read the target site's page due to the same-origin policy. Stored XSS changes the situation: the attacker's script runs inside the trusted site's origin. That script can request the transfer page, read the hidden CSRF token from the DOM or response, and submit a forged transfer request with the valid token attached. The browser also sends the user's cookies automatically.

So CSRF tokens are strong against cross-site request forgery, but XSS inside the target origin can defeat them. This is why XSS is often treated as a higher-priority bug and why output encoding, CSP, and safe DOM handling matter.

**Covered in:** [[06 Labs and Tooling/06 Labs and Tooling|Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation]], [[05 Web and Network Defense/05 Web and Network Defense|XSS, CSRF, SQL Injection, and Session Defenses]]

## Related

- [[06 Labs and Tooling/06 Labs and Tooling|Labs and Tooling]]
- [[06 Labs and Tooling/06 Labs and Tooling|Web Security Tools]]
- [[06 Labs and Tooling/06 Labs and Tooling|proc Filesystem and Process Forensics on Linux]]
