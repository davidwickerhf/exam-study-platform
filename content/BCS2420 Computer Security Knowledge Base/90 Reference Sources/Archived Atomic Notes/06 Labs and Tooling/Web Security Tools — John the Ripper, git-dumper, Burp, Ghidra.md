---
tags:
  - university
  - bcs2420
  - computer-security
---

# Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra

> [!abstract] Why this note matters
> - These are the tools that actually appear in Labs 1 through 4 — not the syllabus-headline tools (nmap, Wireshark) but the operational toolkit a student must be ready to name and describe.
> - The exam can ask "what tool would you use to do X" for any of: cracking a leaked hash, recovering source from `.git`, modifying HTTP requests, reversing a binary key validator, brute-forcing a truncated hash, or querying a leaked database.

## Overview

The four labs collectively use a small, focused toolkit. Each tool answers a specific class of question:

- **John the Ripper**: given a hash and a wordlist, recover the plaintext password.
- **git-dumper**: given an exposed `.git/` directory, reconstruct the full source repository.
- **Burp Suite**: intercept and modify HTTP/HTTPS traffic between the browser and server.
- **Ghidra (or Binary Ninja)**: reverse engineer a compiled binary to recover logic.
- **Python brute-force scripting**: search small key spaces, particularly truncated-hash collisions.
- **MySQL client + nc**: connect to and query an exposed database service.

This note covers what each tool does, when you reach for it, and the minimal workflow demonstrated in the labs.

## Exam Focus

- Tier 1 priority.
- The Lab 2 PDF explicitly enumerates the "Tools and Techniques" list — these names are course-syllabus, not optional.

## Core Definitions

- **John the Ripper**: An offline password cracker. Tries candidate passwords from a wordlist (or generated rules), hashes them with the matching algorithm, and compares to the target hash.
- **git-dumper**: A tool that reconstructs a Git repository from an exposed `.git/` directory served over HTTP. Recovers full history and source.
- **Burp Suite**: An intercepting HTTP/HTTPS proxy. Sits between the browser and server so the analyst can inspect, modify, replay, and intruder-test requests.
- **Ghidra**: An open-source reverse engineering platform from the NSA. Disassembles and decompiles binaries to a C-like view.
- **Binary Ninja**: A commercial alternative to Ghidra with similar disassembly and decompilation capability.
- **netcat (`nc`)**: A general-purpose TCP/UDP client. Used to talk to raw services such as the truncated-hash collision server in Lab 2 Ch 4.
- **MySQL client**: Command-line tool to connect to a MySQL/MariaDB server and run SQL queries.

## Detailed Explanation

### John the Ripper — Lab 2 Challenge 5

The Lab 2 final challenge ends with a `users` table dump containing hashed passwords. John takes the hash file plus a wordlist and recovers the plaintext.

Hash format identification matters: John needs to know what algorithm produced the hash (MD5, SHA-1, bcrypt, etc.). The `--format=` flag or `john --list=formats` are the entry points. Lab 2 uses leaked database hashes consistent with SHA-1 style storage; identification is by hash length and prefix structure.

Minimal workflow:

```bash
# Identify format by inspection or hashid
hashid 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3'

# Crack with a provided wordlist
john --wordlist=passwords.txt --format=raw-sha1 hashes.txt

# Show recovered passwords
john --show --format=raw-sha1 hashes.txt
```

### git-dumper — Lab 4 Challenge 2

Some web servers misconfigure directory restrictions and end up serving `/.git/`. If `.git/HEAD`, `.git/config`, and `.git/objects/` are reachable, git-dumper walks the object tree and reconstructs the working repository — full source, full history, commit messages, the lot.

```bash
pip install git-dumper
git-dumper https://target.example/.git/ ./recovered
cd recovered
git log --all
git show <commit>
```

Once recovered, search the history for credentials, hard-coded secrets, and removed-but-not-purged sensitive files.

### Burp Suite — Labs 2 and 4

Burp is the intercepting proxy. The browser is configured to send all HTTP traffic through Burp on `127.0.0.1:8080`. The analyst can then:

- **Proxy → Intercept**: Pause a request, edit headers/body, forward.
- **Repeater**: Send the same request many times with small variations (excellent for SQL injection tests in Lab 4 Ch 4).
- **Intruder**: Automated request fuzzing — wordlists into specific positions.
- **HTTP history**: Full log of all requests for inspection of leaked headers (Lab 2 Ch 3, where the SSO code is in a response header).

Burp Community is sufficient for the lab challenges. The Lab 4 PDF treats it as optional, recommending it for students "who feel like a hacker"; in practice the Lab 2 SSO-header challenge is much easier with Burp than with browser DevTools alone.

### Ghidra and Binary Ninja — Lab 1 Challenge 5

Lab 1 Challenge 5 ships a compiled binary `program` that implements a custom key validator. Ghidra (or Binary Ninja) loads the binary, runs auto-analysis, and exposes the decompiled functions. The student inspects the validator function to extract the constraints on a valid key — length, character set, positional relationships — and writes a generator that produces a key passing all checks.

Minimal workflow:

1. Create a new Ghidra project, import `program`, accept auto-analysis.
2. Locate `main` in the Symbol Tree, follow the call into the validator.
3. Read the decompiled C-like view; identify checks (length comparisons, character ranges, indexed equalities).
4. Translate the checks into a small Python search and submit candidates to the server.

### Python brute-force scripting — Lab 2 Challenge 4

The MD5 truncated-hash challenge reduces the effective key space to 28 bits ($16^7$ possible 7-hex-char prefixes — about 268 million). Brute force from Python is feasible:

```python
import hashlib
prefix = "abc"  # required input prefix
target7 = "1a2b3c4"
i = 0
while True:
    candidate = prefix + str(i)
    if hashlib.md5(candidate.encode()).hexdigest()[:7] == target7:
        print(candidate); break
    i += 1
```

This is the practical demonstration that truncating cryptographic output to a short prefix destroys its security margin.

### MySQL client and netcat — Lab 2 Challenge 5

Once `robots.txt` leaks database credentials, the MySQL client opens the door:

```bash
mysql -h target.example -u leaked_user -pLEAKED_PASS appdb
> SELECT username, password_hash FROM users WHERE role='admin';
```

`nc` is the lowest-level option for raw TCP services, including the truncated-hash challenge server in Lab 2 Ch 4 if it exposes a custom TCP protocol rather than HTTP.

```bash
nc target.example 4000
```

## How It Works

The general pattern across the labs is:

1. **Find the leaked artifact** (exposed `.git`, leaked `robots.txt`, response header, hidden DOM element, compiled binary).
2. **Pick the matching tool** (git-dumper, MySQL client, Burp, DevTools, Ghidra).
3. **Extract the secret or logic** (credentials, validator constraints, prefix collision).
4. **Use it to authenticate or bypass** (John for the recovered hash, generator for the validator, modified request via Burp).

## What You Must Know

- The mapping from problem class to tool: leaked hash → John; exposed `.git` → git-dumper; HTTP traffic inspection or modification → Burp; compiled binary → Ghidra/Binary Ninja; small key space → Python script; leaked DB credentials → MySQL client; raw TCP service → nc.
- John the Ripper requires format identification before cracking.
- git-dumper recovers full history, not just current files.
- Burp's Repeater is the natural tool for SQL-injection iteration.
- Truncated hashes (Lab 2 Ch 4) are brute-forceable from a small Python loop because effective entropy collapses to 28 bits.
- These are the lab tools; nmap and Wireshark are syllabus tools but not used in the lab challenges.

## 30-Second Oral Answer

- The lab toolkit is small and tool-to-problem matched: John the Ripper for leaked password hashes, git-dumper for exposed `.git/` directories, Burp Suite for intercepting and modifying HTTP traffic, Ghidra (or Binary Ninja) for reverse engineering compiled binaries, Python for small-keyspace brute force such as truncated-hash collisions, and the MySQL client plus netcat for talking to exposed services.
- Each tool answers a specific question; choosing the wrong tool is the most common student mistake.

## Typical Exam Questions

- Given a dumped `users` table with SHA-1 hashes and a wordlist, what tool do you use and how?
- A web server exposes `/.git/`. What tool reconstructs the source and what do you do next?
- The server validates integrity using only the first 7 hex chars of MD5. How do you find a colliding input, and why is this feasible?
- A compiled binary implements a custom key validator. How do you defeat it without knowing the source?
- An SSO code is leaked in an HTTP response header. What tool exposes it most cleanly?

## Common Pitfalls

- Running John without specifying `--format=`; it guesses, and guesses wrong on database-style hashes.
- Treating git-dumper output as a snapshot — forgetting to inspect history with `git log --all` for secrets that were committed then deleted.
- Forgetting Burp must have its CA certificate installed in the browser to intercept HTTPS.
- Reaching for Ghidra when DevTools would have worked — over-tooling a simple problem.
- Assuming a 28-bit search is too large to brute-force; it completes in seconds on a laptop.

## Concrete Examples and Commands

### John the Ripper end-to-end (Lab 2 Ch 5)

```bash
# Suppose hashes.txt contains lines of the form: username:hash
hashid "$(awk -F: '{print $2; exit}' hashes.txt)"
john --wordlist=rockyou.txt --format=raw-sha1 hashes.txt
john --show --format=raw-sha1 hashes.txt
```

### git-dumper end-to-end (Lab 4 Ch 2)

```bash
pip install git-dumper
git-dumper https://target.example/.git/ ./loot
cd loot
git log --all --oneline
git grep -i 'password\|secret\|token' $(git rev-list --all)
```

### Python brute-force for truncated MD5 (Lab 2 Ch 4)

```python
import hashlib, itertools, string
prefix = "REQUIRED_PREFIX"
target_prefix = "1a2b3c4"  # 7 hex chars = 28 bits

for n in range(1, 12):
    for suffix in itertools.product(string.ascii_lowercase + string.digits, repeat=n):
        candidate = prefix + ''.join(suffix)
        if hashlib.md5(candidate.encode()).hexdigest()[:7] == target_prefix:
            print("Found:", candidate)
            raise SystemExit
```

### Burp Repeater workflow for SQLi (Lab 4 Ch 4)

1. Proxy the login request through Burp.
2. Right-click the request → Send to Repeater.
3. In the password field, try `' OR 1=1--`, `' UNION SELECT NULL--`, `' ORDER BY 1--` etc.
4. Diff the responses to detect injection point and column count.

## Related Concepts

- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]
- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]
- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]
- [[Browser DevTools, Hidden Resources, and Client-Side Evidence|Browser DevTools, Hidden Resources, and Client-Side Evidence]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lab 1 — Confidentiality.pdf](Materials/03 Labs/Lab 1 — Confidentiality.pdf)
- [Lab 2 — Confidentiality and Authentication.pdf](Materials/03 Labs/Lab 2 — Confidentiality and Authentication.pdf)
- [Lab 4 — Web Exploitations.pdf](Materials/03 Labs/Lab 4 — Web Exploitations.pdf)
