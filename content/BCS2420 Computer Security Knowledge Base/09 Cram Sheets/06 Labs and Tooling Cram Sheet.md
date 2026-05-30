---
tags:
  - university
  - bcs2420
  - computer-security
  - cram-sheet
---

# 06 Labs and Tooling Cram Sheet

Morning-of-exam scan sheet. Dense facts, formulas, acronyms.

## Tool → Problem Map

| Problem | Tool | Why |
|---|---|---|
| Leaked password hash | **John the Ripper** | Offline cracker; needs `--format=` |
| Exposed `/.git/` directory | **git-dumper** | Reconstructs full repo + history |
| Intercept/modify HTTP(S) | **Burp Suite** | Proxy with Repeater, Intruder, history |
| Reverse engineer binary | **Ghidra** / Binary Ninja | Decompile to C-like view |
| Small key-space brute force | **Python script** | e.g. truncated-hash collision (28 bits = 268M) |
| Leaked DB credentials | **MySQL client** | Query `users` table |
| Raw TCP service | **netcat (`nc`)** | Send/receive on arbitrary TCP port |
| DOM / network inspection | **Browser DevTools** | Elements, Network, Storage, Console |
| Service exposure | **nmap** | Port scan, service version |
| Packet capture | **Wireshark** | Inspect headers, cookies, plaintext |

- Lab tools = DevTools, John, git-dumper, Burp, Ghidra. nmap/Wireshark = syllabus-named but not used in labs.

## /proc Forensics Quick Reference (Lab 3)

- `/proc/<PID>/cmdline` — argv that launched the process (NUL-separated → `tr '\0' ' '`).
- `/proc/<PID>/environ` — environment variables at launch.
- `/proc/<PID>/status` — read `PPid` to find parent (= watchdog candidate).
- `ls /proc | grep -E '^[0-9]+$'` — enumerate all PIDs from kernel directly.
- `printenv` — show current shell environment (look for `LD_PRELOAD`, weird `PATH`).
- `env -u VAR cmd` — run cmd with VAR unset (e.g. `env -u LD_PRELOAD ps -aux`).
- Mismatch between `ps -aux | wc -l` and `/proc` numeric-dir count → positive evidence of hiding.

## Why /proc beats `ps`/`top`

- `ps`, `top`, `pgrep` are user-space binaries → can be replaced, hooked, filtered.
- `/proc` is kernel-backed virtual filesystem; userland rootkit usually can't scrub it.
- Cross-check view = the defense.

## Persistence / Watchdog Pattern (Lab 3 Ch 5)

Diagnostic loop: **Symptom → Hypothesis → Evidence**.

- Symptom: process you killed comes back; deleted file reappears.
- Hypothesis: a persistence mechanism is restoring it.
- Evidence (5 places to check):
  1. **Parent PID** via `/proc/<PID>/status` → walk chain up.
  2. **Cron**: `crontab -l`, `/etc/cron.*`, `/etc/crontab`, `systemctl list-timers`.
  3. **Init/systemd**: `systemctl list-units --type=service`, `systemctl --user list-units`.
  4. **Shell startup**: `~/.bashrc`, `~/.profile`, `/etc/profile.d/`.
  5. **PATH order**: writable dir early in `$PATH` → attacker shadows legit binary.

- Killing the visible process without finding the parent → recurrence guaranteed.

## DevTools Reasoning Pattern

1. **Elements/DOM** — is the "hidden" content already in the DOM?
2. **Network** — what requests, headers, cookies, bodies are exchanged? (Leaked OTPs!)
3. **Storage / Application** — cookies, localStorage, session tokens.
4. **Console / Sources** — what is the client enforcing locally?

- **Rule**: hidden in interface ≠ hidden from system.

## Lab 1 — Cryptography Lessons

- **Ch 1 — Multi-step transformations**: Base64, hex, Caesar → classify as encoding (no key) vs encryption (key).
- **Ch 2 — OTP reuse**: `c1 XOR c2 = m1 XOR m2`; pad cancels → known-plaintext recovers other message.
- **Ch 3 — ECB Penguin**: identical plaintext blocks → identical ciphertext blocks → spatial patterns leak. ECB unsafe for structured data.
- **Ch 4 — Vigenère partial key**: 3 of 4 key chars known → 26 candidates for last → brute over alphabet.
- **Ch 5 — Binary key validator**: load in Ghidra → read decompiled validator → extract constraints → Python generator. Security through obscurity fails.

## Lab 2 — Authentication / Web

- **Ch 1 — Client-side validation**: DevTools → Sources reveals hardcoded creds. Client can never enforce security against itself.
- **Ch 2 — Social media TMI**: predictable password = pet name + DOB + favorite number. Oversharing collapses password search space.
- **Ch 3 — SSO secret in response header**: capture via DevTools → Network or Burp HTTP history. Headers are NOT a secure channel for secrets.
- **Ch 4 — MD5 truncated to 7 hex chars**: 28 bits = ~268M → brute-force in seconds with Python:

```python
import hashlib
prefix = "REQUIRED_PREFIX"
target = "1a2b3c4"  # first 7 hex chars
i = 0
while True:
    cand = prefix + str(i)
    if hashlib.md5(cand.encode()).hexdigest()[:7] == target:
        print(cand); break
    i += 1
```

- **Ch 5 — Full chain**: `robots.txt` → leaked DB creds → MySQL dump → John on SHA-1 hashes → admin login. 5 independent failures chained.

```bash
john --wordlist=passwords.txt --format=raw-sha1 hashes.txt
john --show --format=raw-sha1 hashes.txt
```

## Lab 3 — Rootkit Recon

- **Ch 1 Last Signal**: `ls -la` reveals dotfiles; `printenv` shows environment; `env -u VAR cmd` for poisoned variables.
- **Ch 2 Last Broadcast**: cross-check same data via different paths.
- **Ch 3 The Living Kernel**: enumerate `/proc/<PID>/{cmdline,environ,status}` to bypass hooked `ps`/`top`.
- **Ch 4 Encrypted Whisper**: peel layers — Base64 → gzip (`1f 8b` magic) → real payload. `base64 -d`, `gunzip`, `zlib.decompress`.
- **Ch 5 Survivor Protocol**: watchdog/persistence triage (see above).

## Lab 4 — Web Exploitation

- **Ch 1 Subscribe to Read More**: paywall is CSS overlay; DOM has article → DevTools → remove overlay.
- **Ch 2 Internet Never Forgets**: `git-dumper https://target/.git/ ./loot` → `git log --all` → `git grep` for `password|secret|token`.
- **Ch 3 Feed The Machine**: signed cookie vs plain session cookie. Without signing key, value can't be forged.
- **Ch 4 No Injector Will Pass** (SQL injection):

```sql
' OR 1=1--                  -- confirm injection, log in as first user
1' ORDER BY 1 --            -- find column count
1' ORDER BY 2 --
' UNION SELECT NULL --      -- find UNION-injectable cols
elan_maks'--                -- log in specifically as 'elan_maks'
```

- **Ch 5 Equalizer Weapon** (XSS chained to bypass CSRF):

```javascript
// stored XSS payload in display name
<script>
  fetch('/admin/reset_all', {
    method: 'POST',
    headers: {'X-CSRF-Token': document.querySelector('meta[name=csrf]').content}
  })
</script>
```

- XSS reads the CSRF token from the admin's DOM → CSRF defense bypassed because script runs in-origin.

## Burp Suite Workflow

- Configure browser to use proxy `127.0.0.1:8080`.
- **Proxy → Intercept**: pause request, edit headers/body, forward.
- **Repeater**: replay with variations — ideal for SQLi iteration.
- **Intruder**: automated fuzzing with positions + wordlists.
- **HTTP history**: full log — quickly spot leaked headers.
- Install Burp CA cert in browser to intercept HTTPS.

## Ghidra Workflow (Lab 1 Ch 5)

1. New project → import `program` → accept auto-analysis.
2. Find `main` in Symbol Tree.
3. Follow call into validator function.
4. Read decompiled C-like view: length checks, char-range checks, positional equalities.
5. Translate constraints to Python search → submit candidates.

## git-dumper Quick Recipe

```bash
pip install git-dumper
git-dumper https://target.example/.git/ ./recovered
cd recovered
git log --all --oneline
git grep -i 'password\|secret\|token' $(git rev-list --all)
```

## Hash Format ID + John

```bash
hashid 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3'
john --wordlist=passwords.txt --format=raw-sha1 hashes.txt
john --show --format=raw-sha1 hashes.txt
```

## Common Pitfalls

- Running John without `--format=` (guesses wrong on DB hashes).
- Treating git-dumper output as snapshot (forget `git log --all` for deleted secrets).
- Reaching for Ghidra when DevTools suffices (over-tooling).
- Forgetting Burp needs CA cert in browser to intercept HTTPS.
- Treating `ps -aux` as ground truth on compromised host.
- Forgetting `/proc/<PID>/cmdline` is NUL-separated (raw `cat` runs args together).
- Killing visible process without finding parent → it returns.
- Assuming 28-bit search is too big to brute-force (seconds on a laptop).
- Treating "hidden in UI" as "hidden from attacker".
