---
tags:
  - university
  - bcs2420
  - computer-security
---

# /proc Filesystem and Process Forensics on Linux

> [!abstract] Why this note matters
> - Lab 3 Challenge 3 ("The Living Kernel") turns on this single insight: when `ps` and `top` lie, `/proc` is the kernel-backed view that a userland rootkit usually cannot scrub.
> - The 2025-03-21 past exam Part C Q2 on kernel-mode rootkit recovery maps directly to the methodology built here.

## Overview

`/proc` is a virtual filesystem exposed by the Linux kernel. It is not stored on disk. Each directory under `/proc/<PID>/` corresponds to a live process, and each file inside reflects current kernel state for that process. Because user-space tools such as `ps`, `top`, and `pgrep` are themselves binaries that can be replaced, hooked, or filtered by a rootkit, `/proc` provides an independent cross-check: it is the source the honest tools were supposed to be reading anyway.

## Exam Focus

- Tier 1 priority.
- Directly supports the past-exam pattern: "you suspect a kernel-mode rootkit; describe how to confirm and recover".

## Core Definitions

- **process**: A running instance of a program. Identified by a numeric PID.
- **PID**: Process ID, a kernel-assigned integer that uniquely identifies a running process.
- **PPID**: Parent PID, the PID of the process that started this one. Reveals the launcher chain.
- **/proc**: A virtual filesystem exposing live kernel and process state as readable files.
- **cmdline**: `/proc/<PID>/cmdline` — the exact argv that launched the process, NUL-separated.
- **environ**: `/proc/<PID>/environ` — the environment variables the process inherited at launch.
- **status**: `/proc/<PID>/status` — a text summary including PPid, UID, state, memory.
- **cross-checking**: Confirming a finding by comparing two independent views (e.g. `ps` against `/proc`).

## Detailed Explanation

A user-space rootkit hides processes by replacing or hooking the tools that enumerate them. `ps` parses `/proc` itself, so a tampered `ps` may filter out specific PIDs before printing. `top` and `pgrep` have the same exposure. If only one of these tools is consulted, the analyst inherits the rootkit's lie.

The defense is to read `/proc` directly. Even if `ps` filters PID 1337, the directory `/proc/1337/` still exists on a userland-only compromise, because the kernel populates it. Reading `/proc/1337/cmdline` reveals what was launched. Reading `/proc/1337/environ` shows the environment variables that may have been used to alter the behavior of tools the process invokes. Reading `/proc/1337/status` exposes the parent PID, which is the first thread you pull to find a watchdog (see [[Malware Persistence and Watchdog Processes]]).

This is why Lab 3 Challenge 3 calls the central rule "do not trust a single view of reality": the honest filesystem is the corroborating view.

A second technique addresses environment-driven misbehavior. If `PS_FILTER=hide_me` causes `ps` to suppress matching processes, then `env -u PS_FILTER ps -aux` runs `ps` without that variable in scope. The same idea applies to `LD_PRELOAD`, which lets an attacker inject a library that intercepts library calls inside any newly launched binary.

## How It Works

Enumerate PIDs from the kernel directly:

```bash
ls /proc | grep -E '^[0-9]+$'
```

Inspect what a suspicious process actually is:

```bash
cat /proc/<PID>/cmdline | tr '\0' ' '; echo
cat /proc/<PID>/environ | tr '\0' '\n'
cat /proc/<PID>/status | grep -E '^(Name|PPid|Uid|State)'
```

Run a tool with a poisoned environment variable removed:

```bash
env -u LD_PRELOAD ps -aux
env -u PS_HIDE_LIST top
```

Compare views. If `ps -aux | wc -l` disagrees with the number of numeric directories in `/proc`, something is hiding.

## What You Must Know

- `/proc/<PID>/cmdline`, `environ`, and `status` (for PPid) are the three core forensic reads.
- `ps`, `top`, and `pgrep` are user-space tools and may be hooked; `/proc` is kernel-backed.
- `env -u VAR <cmd>` runs a command with `VAR` unset for that invocation only.
- `printenv` shows the current shell's environment; useful for finding what is influencing tools.
- A discrepancy between `ps` output and `/proc` directory count is positive evidence of stealth.
- PPid is the lead for finding watchdog processes that restart killed malware.

## 30-Second Oral Answer

- On a compromised host, never trust `ps`, `top`, or `pgrep` alone. Cross-check against `/proc`, the kernel-backed virtual filesystem.
- For each suspect PID, read `/proc/<PID>/cmdline` to see how it was launched, `/proc/<PID>/environ` to see its environment, and `/proc/<PID>/status` for PPid to find what started it.
- Use `env -u VAR cmd` to neutralize an environment variable that may be skewing tool output.

## Typical Exam Questions

- Why is `/proc` more trustworthy than `ps` on a possibly compromised system?
- Given a PID, how do you determine how the process was launched and by whom?
- How would you detect that `ps` is hiding processes?
- What does `env -u LD_PRELOAD ps -aux` do, and why might an analyst run it?

## Common Pitfalls

- Treating `ps -aux` output as ground truth on a possibly compromised host.
- Forgetting that `/proc/<PID>/cmdline` is NUL-separated; raw `cat` runs args together.
- Looking only at the suspect process and not its PPid, missing the watchdog.
- Killing the visible process without finding the parent that restarts it.

## Concrete Examples and Commands

### Enumerate all PIDs from the kernel directly

```bash
ls /proc | grep -E '^[0-9]+$' | wc -l
ps -aux | tail -n +2 | wc -l
```

A mismatch suggests `ps` is filtering.

### Read a process command line and environment

```bash
cat /proc/1337/cmdline | tr '\0' ' '; echo
cat /proc/1337/environ | tr '\0' '\n'
```

### Find the parent that launched a suspect process

```bash
grep -E '^PPid:' /proc/1337/status
```

Then repeat against the parent PID. The chain often terminates at a watchdog, init/systemd, or cron-spawned shell.

### Run a tool with a poisoned variable removed

```bash
env -u LD_PRELOAD ps -aux
env -u PS_HIDE_LIST ps -aux
```

### Inspect your current environment for tampering

```bash
printenv | sort
```

Look for unexpected `LD_PRELOAD`, `PATH` prepends to writable directories, or custom variables named after the tools they influence.

## Related Concepts

- [[Rootkits, Hooking, DKOM, and Stealth Analysis|Rootkits, Hooking, DKOM, and Stealth Analysis]]
- [[Malware Persistence and Watchdog Processes|Malware Persistence and Watchdog Processes]]

- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lab 3 — Kernel Compromise and Rootkit Recon.pdf](Materials/03 Labs/Lab 3 — Kernel Compromise and Rootkit Recon.pdf)
