# Topic 06 — Labs and Tooling

**Lab PDFs:** `Materials/03 Labs/Lab 1 — Confidentiality.pdf`, `Lab 2 — Confidentiality and Authentication.pdf`, `Lab 3 — Kernel Compromise and Rootkit Recon.pdf`, `Lab 4 — Web Exploitations.pdf`
**Past exam coverage:** 2025-03-21 Part C Q2 (kernel-mode rootkit recovery — Lab 3 Challenge 3 maps directly); Part A Q11 (stored XSS — Lab 4 Ch 5); Part A Q7–Q8 (salting and key-stretching — Lab 2 Ch 5); Part C Q1 (Trojan vs worm — Lab 3 stealth context)

This chapter consolidates the four labs and the operational toolkit used across them. The labs are the practical face of the course: each one operationalises a lecture (Lecture 1–2 in Lab 1, Lecture 3–5 in Lab 2, Lecture 5 in Lab 3, Lecture 6 in Lab 4). Tool selection is the most common form of practical exam question. Know which tool answers which class of question, what flags/options matter, and what the lab actually demonstrated.

> [!warning] Ethical scope
> All commands and workflows below are for the provided lab environment only. Running them against systems you do not own or have not been authorised to test is illegal and unprofessional. The syllabus is explicit: tools are reasoning aids, not licences.

## What the Exam Asks

- Tools as evidence-gathering: Kali, nmap, Wireshark, DevTools, Burp, Ghidra.
- Lab patterns: inspect, hypothesize, test, document, explain impact.
- /proc forensics, persistence, watchdog processes, browser/client-side evidence.
- Crypto/web lab lessons that become short exam explanations.

---

## Lab 1 — Confidentiality

**Source PDF:** `Materials/03 Labs/Lab 1 — Confidentiality.pdf`
**Companion lectures:** Lecture 1 (fundamentals), Lecture 2 (foundations of cryptography)
**Atomic note:** [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses]]

Lab 1 is about cryptographic thinking, not implementation. Five challenges train the student to classify a transformation, estimate the effective key space, and reason like a ciphertext-only attacker. The unifying skill is asking three questions of any transformation: *is there a secret, is the secret hard to guess, and does the operation actually hide structure?*

### Learning outcomes (from the PDF)

| # | Outcome |
|---|---|
| 1 | Explain confidentiality and why cryptography supports it. |
| 2 | Use the plaintext/ciphertext model correctly. |
| 3 | Reason about cipher security via key-space size and exhaustive search. |
| 4 | Adopt a ciphertext-only attacker viewpoint. |

### Challenge 1 — Multi-step Transformations

Five lines in `output.txt`, each a different transformation of one flag fragment. Classify each (Base64, hex, Caesar/ROT, simple substitution), reverse it, concatenate the pieces.

The teaching point is the **encoding vs encryption distinction**. Base64 and hex are encodings: no secret, freely reversible. Caesar is encryption with a 26-entry key space — encryption in form, but with $|K|=26$ the exhaustive search is trivial.

> [!tip] Exam phrasing
> "Why does reversing these transformations not require breaking strong cryptography?" — because either there is no key (encoding) or the key space is small enough to brute-force.

### Challenge 2 — One-Time Pad Misuse

`otp_challenge.txt` contains a known plaintext, its ciphertext, and a second ciphertext encrypting the flag. Both ciphertexts share the same XOR pad.

The recovery is two XORs:

$$\text{pad} = P_1 \oplus C_1, \qquad P_2 = C_2 \oplus \text{pad}$$

OTP is information-theoretically secure when the pad is uniform, secret, and **used exactly once**. Reuse collapses the guarantee: $C_1 \oplus C_2 = P_1 \oplus P_2$, so any known plaintext reveals the pad and therefore the other message. This is the canonical known-plaintext attack.

### Challenge 3 — The Penguin (ECB block leakage)

`flag.dat` is a file encrypted with a block cipher in ECB mode then re-encoded. Because ECB encrypts each block independently, identical plaintext blocks produce identical ciphertext blocks. Spatial structure in the original file (large flat regions of a bitmap, repeated headers) survives encryption visibly — the well-known "ECB penguin" effect.

Workflow:

```bash
# decode outer encoding (Base64 / hex / etc.)
base64 -d flag.dat > stage1.bin

# identify the original file format by header
file stage1.bin
hexdump -C stage1.bin | head

# render and visually inspect — patterns shouldn't survive
```

The lesson is mode-of-operation choice. Algorithm confidentiality is not enough if the mode leaks structure. CBC, CTR, or GCM would not exhibit this.

### Challenge 4 — Modified Vigenère, partial key recovery

A modified Vigenère cipher with key length 4. Three of the four key characters are known; the fourth is unknown. A "positional drift" adds a deterministic position-indexed shift on top of the Vigenère shift.

With three positions fixed, only the unknown position needs searching across the 26-letter alphabet — 26 candidate decryptions, ranked by English-language likeness or by spotting the flag prefix. Partial knowledge of a short key collapses the effective key space catastrophically, and a deterministic positional modification adds zero real security because it is reversible by construction.

### Challenge 5 — The Generator of Keys (binary reverse engineering)

A compiled binary `program` and a server share the same validation logic. Load `program` into Ghidra or Binary Ninja, run auto-analysis, locate the validator function, read the decompiled C-like view, and extract constraints: length, character set, positional equalities, checksums.

```bash
# minimal Ghidra workflow
# 1. New project -> import 'program' -> accept auto-analysis
# 2. Symbol Tree -> main -> follow call into validator
# 3. Decompile window -> read constraints
# 4. Translate constraints into a Python generator
```

The lesson is **security through obscurity fails**. Custom key validation is opaque only until the binary is opened.

---

## Lab 2 — Confidentiality and Authentication

**Source PDF:** `Materials/03 Labs/Lab 2 — Confidentiality and Authentication.pdf`
**Companion lectures:** Lecture 3 (authentication), Lecture 4 (secure protocols), Lecture 5 (web security)
**Atomic note:** [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses]]

Lab 2 shifts from theoretical cryptography failure to implementation failure. Each challenge demonstrates a different way that real systems leak secrets despite ostensibly correct cryptographic choices.

### Learning outcomes (from the PDF)

| # | Outcome |
|---|---|
| 1 | Identify client-side vs server-side validation flaws. |
| 2 | Recognise oversharing and predictable password patterns. |
| 3 | Detect information leakage in HTTP headers and traffic. |
| 4 | Exploit truncated-hash collisions; understand MD5 weakness. |
| 5 | Crack leaked database hashes with John the Ripper. |

### Challenge 1 — Insecure Login

Admin credentials are reachable from the client-side bundle. Open DevTools, look in Sources for a hidden file or hardcoded value left in JavaScript. **Client-side validation is never security**: the attacker controls the client.

### Challenge 2 — TMI on Social Media

A user's public profile leaks the components of their password (pet name + DOB + favourite number, in a predictable order). Reconstruct the password from the profile.

The lesson is that complexity policies do not help when the construction rule is public. A "complex" password generated by a deterministic formula has effective entropy bounded by the search space of the formula, not by the password's apparent length.

### Challenge 3 — Single Sign-On Secret Header

The 2FA/SSO one-time code is returned in a custom HTTP response header. Submit credentials, capture the response in DevTools → Network or in Burp's HTTP history, extract the code, replay it.

> [!warning] HTTP headers are not a secure channel
> Any proxy, browser tool, or network observer reads response headers. A 2FA code must travel over a separate authenticated channel — SMS, authenticator app, hardware token, or a server-stored short-lived token bound to the session.

### Challenge 4 — MD5 Truncated-Hash Collision

The server validates integrity using only the first 7 hex characters of MD5. The effective key space is $16^7 \approx 2.68 \times 10^{8}$ — 28 bits, brute-forceable in seconds.

```python
import hashlib
prefix = "REQUIRED_PREFIX"
target7 = "1a2b3c4"  # first 7 hex chars of the reference MD5
i = 0
while True:
    candidate = prefix + str(i)
    if hashlib.md5(candidate.encode()).hexdigest()[:7] == target7:
        print(candidate); break
    i += 1
```

The lesson: truncating a cryptographic primitive destroys its security margin. Truncated SHA-256 to 28 bits is no stronger than truncated MD5 to 28 bits — the entropy ceiling is the truncation length, not the algorithm.

### Challenge 5 — Full chain: robots.txt → MySQL → John → admin login

The capstone challenge chains five independent failures.

1. **`robots.txt`** lists paths the admin asked Google not to index. Often those are exactly the paths that need protection (admin panels, database dumps, backup files).
2. **Leaked DB credentials** in the indicated path let an attacker open a MySQL session and dump the `users` table.
3. **Weak hash + provided wordlist** lets John recover the admin password quickly. Date-pattern passwords fall to a small wordlist even when salted.
4. **Admin login** completes the kill chain.

```bash
# step 1: read robots.txt
curl https://target.example/robots.txt

# step 2: dump users table once credentials are leaked
mysql -h target.example -u leaked_user -pLEAKED_PASS appdb
> SELECT username, password_hash FROM users WHERE role='admin';

# step 3: crack with John
hashid 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3'
john --wordlist=passwords.txt --format=raw-sha1 hashes.txt
john --show --format=raw-sha1 hashes.txt
```

The defence chain that would have changed the outcome: omit sensitive paths from `robots.txt`, restrict DB ACLs by source, use adaptive hashes (bcrypt, Argon2) with per-user salts, require 2FA on admin accounts. See [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]].

---

## Lab 3 — Kernel Compromise and Rootkit Recon

**Source PDF:** `Materials/03 Labs/Lab 3 — Kernel Compromise and Rootkit Recon.pdf`
**Companion lecture:** Lecture 5 (malware, stealth, rootkits)
**Atomic notes:** [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation]], [[proc Filesystem and Process Forensics on Linux]], [[Malware Persistence and Watchdog Processes]]

Lab 3 trains forensic skepticism on a compromised Linux host. Each challenge raises the level of stealth: hidden files, lying tools, hidden processes, layered obfuscation, persistence. The unifying mindset: **do not trust a single view of reality**. Cross-check.

### Challenge 1 — Last Signal (hidden files, environment variables)

The flag is in a dotfile suppressed by default `ls` output. `ls -la` exposes it. Environment variables can also alter what tools display, so `printenv` is part of the diagnostic and `env -u VAR cmd` runs a command without a suspect variable in scope.

```bash
ls -la                # show hidden files
printenv | sort       # what's influencing the shell?
env -u SUSPECT_VAR ls # run without the variable
```

### Challenge 2 — Last Broadcast (output pruning, cross-checking)

Tools actively lie. `cat` returns a filtered version of a file. The defence is cross-checking the same data via a different path: a different tool, a different system view, or a known-good copy from another host.

### Challenge 3 — The Living Kernel (hidden process via /proc)

The central insight of the lab. `ps`, `top`, `pgrep` all report nothing; power and cooling indicate something runs. The fix is to enumerate processes directly from `/proc` — the kernel-backed virtual filesystem.

```bash
# enumerate PIDs from the kernel, bypassing ps
ls /proc | grep -E '^[0-9]+$'

# for each suspect PID
cat /proc/<PID>/cmdline | tr '\0' ' '; echo   # how it was launched
cat /proc/<PID>/environ | tr '\0' '\n'        # its environment
grep PPid /proc/<PID>/status                  # its parent

# detect filtering: kernel view vs ps view
ls /proc | grep -E '^[0-9]+$' | wc -l
ps -aux | tail -n +2 | wc -l
```

`ps` parses `/proc` itself, but a tampered `ps` filters PIDs before printing. Reading `/proc` directly is the corroborating view. See [[proc Filesystem and Process Forensics on Linux]] for the full methodology. This challenge maps directly to 2025-03-21 Part C Q2 on kernel-mode rootkit recovery.

### Challenge 4 — Encrypted Whisper (layered payload analysis)

The anomaly now hides meaning, not existence. The payload is wrapped in a chain — typically Base64 around a compression layer around the content. Peel layers in order, identifying each by its byte signature: Base64's `=` padding and limited charset; gzip's `1f 8b` magic.

```bash
# detect Base64 and decode
echo "$payload" | base64 -d > stage1.bin

# identify compression by magic bytes
file stage1.bin
hexdump -C stage1.bin | head

# decompress
gunzip < stage1.bin > stage2.bin
# or: python -c "import zlib,sys; sys.stdout.buffer.write(zlib.decompress(open('stage1.bin','rb').read()))"
```

The lesson: unreadable is not unimportant. Recognise the transformation, reverse it, look underneath.

### Challenge 5 — Survivor Protocol (watchdog persistence, PATH redirection)

The anomaly returns after being killed. This is **persistence**. The diagnostic loop is Symptom → Hypothesis → Evidence:

1. **Symptom.** Kill the process, it returns within seconds.
2. **Hypothesis.** Something is restoring it.
3. **Evidence.** Walk the parent chain from `/proc/<PID>/status`; audit cron, systemd timers, init/systemd units, shell startup files, and `$PATH` order.

```bash
# confirm and find the parent
pgrep -af suspect_name
kill <PID>; sleep 2; pgrep -af suspect_name
grep -E '^(Name|PPid):' /proc/<NEW_PID>/status

# walk up the parent chain
grep -E '^(Name|PPid):' /proc/<PARENT_PID>/status

# scheduled tasks
crontab -l
sudo cat /etc/crontab
sudo ls /etc/cron.{hourly,daily,weekly,monthly}
systemctl list-timers --all
systemctl --user list-timers --all

# init / services
systemctl list-units --type=service --state=running

# shell startup and PATH order
cat ~/.bashrc ~/.profile /etc/profile
echo "$PATH"
```

PATH-order redirection is the subtle variant. A writable directory early in `$PATH` lets an attacker drop `/usr/local/bin/ps` that re-launches the rootkit and then execs `/usr/bin/ps`, giving both stealth and persistence in one move. See [[Malware Persistence and Watchdog Processes]].

<figure class="diag-figure">
  <figcaption>Lab 3 Challenge 5 — persistence triage loop</figcaption>
  <svg viewBox="0 0 720 220" class="diag-svg" role="img" aria-label="Persistence triage">
    <defs>
      <marker id="arr-l3" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="20"  y="80" width="140" height="46" class="d-node"/>
    <text x="90"  y="100" text-anchor="middle" class="d-h-sm">Symptom</text>
    <text x="90"  y="116" text-anchor="middle" class="d-h-sm">(it returns)</text>

    <rect x="190" y="80" width="160" height="46" class="d-node"/>
    <text x="270" y="100" text-anchor="middle" class="d-h-sm">Hypothesis</text>
    <text x="270" y="116" text-anchor="middle" class="d-h-sm">(persistence)</text>

    <rect x="380" y="80" width="320" height="46" class="d-node"/>
    <text x="540" y="98"  text-anchor="middle" class="d-h-sm">Evidence:  PPid via /proc, cron,</text>
    <text x="540" y="116" text-anchor="middle" class="d-h-sm">systemd timers, .bashrc, $PATH order</text>

    <line x1="160" y1="103" x2="188" y2="103" class="d-edge" marker-end="url(#arr-l3)"/>
    <line x1="350" y1="103" x2="378" y2="103" class="d-edge" marker-end="url(#arr-l3)"/>
  </svg>
</figure>

---

## Lab 4 — Web Exploitations

**Source PDF:** `Materials/03 Labs/Lab 4 — Web Exploitations.pdf`
**Companion lecture:** Lecture 6 (web application security)
**Atomic notes:** [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation]], [[Browser DevTools, Hidden Resources, and Client-Side Evidence]], [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]]

Lab 4 trains the browser-side analogue of Lab 3's mindset. The interface may hide content that is already in the DOM. The server may expose resources not linked from any page. Client-side checks are theatre. The common thread: **what the browser can render or hide, it has already received**.

### Challenge 1 — Subscribe to Read More (paywall via DOM)

The article body is already in the DOM; the paywall overlay is purely CSS. DevTools → Elements, delete the overlay or set `display:none` on it, the content is readable. Client-side hiding is not access control.

### Challenge 2 — The Internet Never Forgets (exposed .git)

The site serves `/.git/`. Use git-dumper to reconstruct the repository, then search history for credentials that were committed and "removed" — git history retains them.

```bash
pip install git-dumper
git-dumper https://target.example/.git/ ./loot
cd loot
git log --all --oneline
git grep -i 'password\|secret\|token' $(git rev-list --all)
```

The PDF also names other paths worth probing: `.env`, `.bak`, `.old`, `.zip`, and `robots.txt`. The general lesson is **hidden does not mean inaccessible**.

### Challenge 3 — Feed The Machine (signed cookies, scoreboard)

The leaderboard depends on a server-signed session cookie carrying click count. Without the signing key the value cannot be forged. DevTools → Application → Cookies exposes the structure and reveals whether the protection is real (signed, server-verified) or decorative (plain client state). The teaching point is the distinction between a **session cookie** (an opaque server-trusted ID) and a **signed cookie** (server-verifiable state carried client-side via HMAC).

### Challenge 4 — No Injector Will Pass (SQL injection auth bypass)

The login form concatenates input into a SQL query. Test payloads in escalating order (PDF-listed):

```sql
' OR 1=1--                  -- confirm injection, log in as the first user
1' ORDER BY 1 --            -- find column count by incrementing until error
1' ORDER BY 2 --
' UNION SELECT NULL --      -- discover UNION-injectable columns
' UNION SELECT NULL,NULL --
```

To log in specifically as `elan_maks`, terminate the username field with a comment after the target: `elan_maks'--`. Iteration is fastest in Burp Repeater. Defence: parameterised queries, prepared statements, strict input validation. See [[XSS, CSRF, SQL Injection, and Session Defenses]].

### Challenge 5 — Equalizer Weapon (stored XSS chained to bypass CSRF)

Customisable display names render in admin-viewed contexts. Store an XSS payload in the display name, trigger admin review, the script runs in the admin's session.

```html
<script>
fetch('/admin/reset_all', {
  method: 'POST',
  headers: { 'X-CSRF-Token': document.querySelector('meta[name=csrf]').content }
})
</script>
```

The teaching point: **CSRF tokens defend against cross-origin forgery; XSS executes in-origin and can read the token directly**. Stored XSS therefore subsumes CSRF. Defence: contextual output encoding, Content Security Policy, treat all user-supplied display fields as untrusted in admin views. This challenge matches 2025-03-21 Part A Q11 (stored XSS).

<figure class="diag-figure">
  <figcaption>Lab 4 Ch 5 — stored XSS chains through admin to bypass CSRF</figcaption>
  <svg viewBox="0 0 760 230" class="diag-svg" role="img" aria-label="Stored XSS bypassing CSRF">
    <defs>
      <marker id="arr-l4" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-l4d" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-dan"/>
      </marker>
    </defs>

    <rect x="20"  y="20" width="180" height="46" class="d-node"/>
    <text x="110" y="40"  text-anchor="middle" class="d-h-sm">Attacker stores</text>
    <text x="110" y="56"  text-anchor="middle" class="d-h-sm">payload in display name</text>

    <rect x="20"  y="160" width="180" height="46" class="d-node"/>
    <text x="110" y="180" text-anchor="middle" class="d-h-sm">Admin views profile</text>
    <text x="110" y="196" text-anchor="middle" class="d-h-sm">(reports trigger review)</text>

    <rect x="270" y="90" width="200" height="46" class="d-node"/>
    <text x="370" y="110" text-anchor="middle" class="d-h-sm">Payload runs in admin's</text>
    <text x="370" y="126" text-anchor="middle" class="d-h-sm">origin and session</text>

    <rect x="530" y="90" width="210" height="46" class="d-node-acc"/>
    <text x="635" y="110" text-anchor="middle" class="d-h-sm">Reads CSRF token from DOM,</text>
    <text x="635" y="126" text-anchor="middle" class="d-h-sm">issues privileged request</text>

    <line x1="200" y1="44"  x2="268" y2="100" class="d-edge" marker-end="url(#arr-l4)"/>
    <line x1="200" y1="180" x2="268" y2="126" class="d-edge" marker-end="url(#arr-l4)"/>
    <line x1="470" y1="113" x2="528" y2="113" class="d-edge-dan" marker-end="url(#arr-l4d)"/>
  </svg>
</figure>

---

## Tooling reference

The four labs use a small, focused toolkit. Each tool answers a specific class of question — choosing the wrong tool is the most common student mistake. nmap and Wireshark are syllabus-named but **not actually used in the four lab challenges**.

### Tool roster

| Tool | Purpose | Typical command |
|---|---|---|
| **Browser DevTools (F12)** | Inspect DOM, network, cookies, storage, sources | `F12` → Elements / Network / Application / Sources |
| **Burp Suite** | Intercept and replay HTTP/HTTPS; SQLi iteration | Proxy → Intercept; Repeater for payload iteration |
| **git-dumper** | Reconstruct a repo from exposed `/.git/` | `git-dumper https://target/.git/ ./loot` |
| **John the Ripper** | Crack password hashes against a wordlist | `john --wordlist=W --format=raw-sha1 hashes.txt` |
| **hashid** | Identify hash algorithm from format | `hashid '<hash>'` |
| **Ghidra / Binary Ninja** | Decompile binaries; recover validator logic | New project → import → auto-analysis → decompile |
| **MySQL client** | Query a leaked database | `mysql -h H -u U -pP db` |
| **netcat (`nc`)** | Talk to raw TCP services | `nc target.example 4000` |
| **Python + hashlib** | Brute force small key spaces | `hashlib.md5(...).hexdigest()[:7]` loop |
| **`/proc` reads** | Kernel-backed view of running processes | `cat /proc/<PID>/{cmdline,environ,status}` |
| **`env -u VAR cmd`** | Run a command with `VAR` unset | `env -u LD_PRELOAD ps -aux` |
| **nmap** *(syllabus, not used in labs)* | Discover hosts, ports, services | `nmap -sV target.example` |
| **Wireshark** *(syllabus, not used in labs)* | Packet capture and inspection | GUI / `tshark -i eth0` |
| **Kali Linux** | The lab environment bundling these tools | n/a — distro |

### Lab-by-lab tool map

| Tool | Lab 1 | Lab 2 | Lab 3 | Lab 4 |
|---|---|---|---|---|
| Ghidra / Binary Ninja | Ch 5 | — | — | — |
| Python brute-force | Ch 4, Ch 5 (key gen) | Ch 4 (truncated MD5) | Ch 4 (decode chain) | — |
| Browser DevTools | — | Ch 1, Ch 3 | — | Ch 1, Ch 3, Ch 5 |
| Burp Suite | — | Ch 3 (optional, easier) | — | Ch 4 (Repeater), Ch 5 |
| MySQL client | — | Ch 5 | — | — |
| John the Ripper | — | Ch 5 | — | — |
| netcat | — | Ch 4 | — | — |
| `/proc` reads | — | — | Ch 3, Ch 5 | — |
| `env -u`, `printenv` | — | — | Ch 1, Ch 5 | — |
| git-dumper | — | — | — | Ch 2 |
| Base64 + gunzip / `file` / `hexdump` | Ch 1 | — | Ch 4 | — |

### Tool deep-dives

> [!info] John the Ripper
> Offline password cracker. Takes a hash file and a wordlist (or generated rules), hashes each candidate with the matching algorithm, compares to the target. **Identify the hash format first** — John guesses, and guesses wrong on database-style hashes. Use `hashid` or `john --list=formats`. Lab 2 Ch 5 uses SHA-1 style storage; identification is by hash length and prefix.

```bash
hashid '<one_example_hash>'
john --wordlist=rockyou.txt --format=raw-sha1 hashes.txt
john --show --format=raw-sha1 hashes.txt
```

> [!info] git-dumper
> Reconstructs a Git repository from an exposed `/.git/` directory served over HTTP. Recovers full source **and full history**, so secrets committed and later removed are still retrievable. Do not treat the recovered tree as a snapshot — `git log --all` is the second step.

> [!info] Burp Suite
> Intercepting HTTP/HTTPS proxy. Configure the browser to send all traffic through Burp on `127.0.0.1:8080`. Three views matter for the labs: **Proxy → Intercept** (pause and edit a request), **Repeater** (resend with variations — ideal for SQLi iteration), **HTTP history** (full log, ideal for spotting leaked headers in Lab 2 Ch 3). Burp Community is sufficient for all lab challenges. HTTPS interception requires installing Burp's CA in the browser.

> [!info] Ghidra and Binary Ninja
> Disassemble and decompile compiled binaries to a C-like view. Lab 1 Ch 5 workflow: new project → import the binary → accept auto-analysis → locate `main` in the Symbol Tree → follow the call into the validator → read the decompiled checks → translate to a Python generator.

> [!info] `/proc` (Linux virtual filesystem)
> Kernel-backed view of live process state. Each running process has a directory `/proc/<PID>/` populated by the kernel directly. Because user-space tools (`ps`, `top`, `pgrep`) can be hooked or replaced by a userland rootkit, `/proc` provides the corroborating view those tools were supposed to be reading anyway. Three files matter: `cmdline` (NUL-separated argv), `environ` (NUL-separated env vars), `status` (text summary including `PPid`).

> [!info] netcat (`nc`)
> Lowest-level TCP/UDP client. Useful for talking to raw services such as the truncated-hash challenge server in Lab 2 Ch 4 if it exposes a non-HTTP protocol. Also handy for quick port-knock testing during exploration.

> [!info] nmap and Wireshark *(syllabus, not in lab challenges)*
> nmap answers "what is exposed?" — service/version detection via `nmap -sV target.example` reveals open ports and likely services. Wireshark answers "what is actually on the wire?" — request and response headers, cookies, suspicious cleartext values. Both are syllabus-named tools you should be able to describe at a high level, but the four lab challenges did not use them.

### General workflow pattern

Across all four labs the operational shape is consistent:

1. **Find the leaked artifact** — exposed `.git`, sensitive path in `robots.txt`, response header, hidden DOM element, compiled binary, hidden process in `/proc`.
2. **Pick the matching tool** — git-dumper, MySQL client, Burp, DevTools, Ghidra, `/proc` reads.
3. **Extract the secret or the logic** — credentials, validator constraints, prefix collision, signing key structure.
4. **Use it to authenticate or bypass** — John for the recovered hash, generator for the validator, modified request via Burp.

> [!tip] Exam tip
> "What tool would you use to do X?" is the canonical practical-side question. Memorise the mapping: leaked hash → John; exposed `.git` → git-dumper; HTTP traffic inspection or modification → Burp; compiled binary → Ghidra/Binary Ninja; small key space → Python; leaked DB credentials → MySQL client; raw TCP service → netcat; lying `ps` → read `/proc` directly.

---

## Cross-lab themes

The four labs are linked by recurring mindsets, each of which appears across multiple challenges and is exam-relevant in its own right.

### Cryptographic correctness vs cryptographic theatre

Lab 1 Ch 1 (encoding vs encryption), Lab 1 Ch 2 (OTP reuse), Lab 1 Ch 3 (ECB mode leakage), Lab 2 Ch 4 (truncated MD5), Lab 2 Ch 5 (weak hash without stretching) all attack the **misuse of correct primitives** rather than the primitives themselves. The general defence pattern: use the primitive at full strength, with the right mode, with unique inputs (salts, IVs, nonces), and with an adaptive cost where applicable.

### Client-side hiding is not access control

Lab 2 Ch 1 (credentials in client bundle), Lab 4 Ch 1 (paywall via CSS), Lab 4 Ch 3 (cookie inspection) all share one shape: the secret reached the client, so the client can read it. Server-side enforcement is the only real control.

### Forensic skepticism on a compromised host

Lab 3 Ch 1–3 (hidden files, lying tools, hidden processes), Lab 3 Ch 5 (PATH-order redirection) all train the same habit: do not trust one tool, cross-check with a kernel-backed view, isolate environment variables, audit `$PATH` order. The summary phrase from the PDF: *do not trust a single view of reality*.

### Hidden does not mean inaccessible

Lab 2 Ch 5 (paths in `robots.txt`), Lab 4 Ch 2 (`.git`, `.env`, `.bak`), Lab 4 Ch 3 (cookie internals via DevTools) all demonstrate that resources unlinked from the visible interface are still served by the same HTTP server. URL discovery, repository reconstruction, and DOM inspection turn these into accessible artifacts.

### Persistence is what makes incidents expensive

Lab 3 Ch 5 makes the point on its own and is the most exam-aligned of the lab teaching points after Ch 3. The diagnostic is **Symptom → Hypothesis → Evidence**, with the five canonical persistence surfaces: parent process / watchdog, cron, systemd (services + timers), shell startup files, PATH-order shadowing.

### One exploit class can subsume another

Lab 4 Ch 5 demonstrates that **stored XSS subsumes CSRF**: a CSRF token defends against cross-origin forgery, but an in-origin script can read the token from the DOM directly. The general lesson is that defences are not composable in the naive sense — XSS in any rendered surface invalidates several other defences.

---

## Past exam coverage

- **2025-03-21 Part A Q7 — random salt purpose (MC).** Expected (c): prevents the use of precomputed hash tables (rainbow tables) across multiple users. Lab 2 Ch 5 demonstrates the bracketing failure: salt alone is not enough when the hash is non-adaptive (raw SHA-1) and the password is predictable. The salt blocks rainbow tables but does not slow a per-user wordlist run against a leaked DB.
- **2025-03-21 Part A Q8 — slowing offline guessing (MC).** Expected (b): a specialised key-stretching algorithm with salts and high iteration counts. Lab 2 Ch 5 is the practical demonstration of why this matters: with raw SHA-1, John recovers a date-pattern password in seconds; with bcrypt or Argon2 at appropriate cost, the same wordlist run would take infeasibly long.
- **2025-03-21 Part A Q11 — stored XSS identification (MC).** Expected (b): stored XSS. Lab 4 Ch 5 is the direct lab-side analogue — payload stored in a display name, rendered to all viewers including the admin.
- **2025-03-21 Part C Q1 — Trojan vs worm.** Lab 3 supplies the framing for malware behaviour: stealth, persistence, hiding rather than deleting. Worms self-propagate without user interaction; Trojans require the user to run them. Both can leverage the persistence mechanisms catalogued in Lab 3 Ch 5.
- **2025-03-21 Part C Q2 — kernel-mode rootkit recovery.** Lab 3 Ch 3 maps directly. Hooking or overwriting system calls lets the rootkit filter what `ps`, `top`, and `pgrep` return; the analyst's response is to read `/proc` directly, cross-check process counts (`ls /proc | grep -E '^[0-9]+$' | wc -l` vs `ps -aux | tail -n +2 | wc -l`), inspect `/proc/<PID>/{cmdline,environ,status}` for each suspect, and walk PPid upward to find the watchdog. Two removal/reinfection-reduction steps: boot from known-good media to verify and remove the kernel module out-of-band; rebuild the host from clean images and rotate all credentials that were present on the compromised machine.
- **2025-03-21 Part C Q3 — unauthenticated Diffie-Hellman MITM.** Lab 2 Ch 3 (SSO code leaked via HTTP header) is the closest practical analogue to "secret exchanged over a channel the attacker can read or substitute on". The countermeasure pattern is the same: authenticate the channel — for DH, sign the public shares; for the SSO code, deliver it over an authenticated side channel rather than inline in a response header.

---

## Kali Linux, Nmap, Wireshark, and Responsible Tool Use

> [!warning] Scope of this note
> nmap and Wireshark are syllabus-mentioned but are NOT used in the four lab assignments. The labs rely on browser DevTools, John the Ripper, git-dumper, Burp Suite, Ghidra/Binary Ninja, the MySQL client, and Python scripting. This note covers the syllabus-named tools for completeness; for the actual lab toolset see [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]].

> [!abstract] Why this note matters
> - The syllabus explicitly names Kali, nmap, Wireshark, and official tool documentation.
> - The labs expect command-line comfort and careful observation, not blind command copying.

### Overview

The course uses tools as thinking aids. The syllabus explicitly says the goal is not to type commands blindly but to understand vulnerabilities and how to fix them. That means tool usage should always be tied back to a security question.

Kali is the lab environment, but the ethical boundary matters as much as the command syntax. Security tools are only appropriate within lab systems or with explicit permission.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **Kali Linux**: A security-focused Linux distribution bundling many penetration-testing and analysis tools.
- **nmap**: A network scanning tool used to discover hosts, ports, and some service characteristics.
- **Wireshark**: A packet analysis tool used to inspect captured network traffic.
- **scope**: The authorized boundary of what systems and activities are permitted for testing.

### Detailed Explanation

nmap helps answer questions such as: what ports are open, what services appear to be running, and what network exposure exists? It does not itself 'secure' a system; it reveals attack surface.

Wireshark helps answer a different class of question: what traffic is actually present on the wire, what headers or cookies are being sent, what hidden values leak in requests or responses, and how protocol behavior looks in practice.

Official documentation matters because tools can do far more than the minimal lab tasks. The course encourages exploring docs for correct use rather than relying on folklore or random snippets.

### How It Works

Use nmap to inspect exposure.

Use Wireshark or browser/network tooling to inspect traffic and headers.

Always work inside authorized scope and recorded lab context.

### What You Must Know

- The role of Kali Linux in the lab environment.
- What nmap and Wireshark are used for at a high level.
- Why ethical and legal scope boundaries matter.

### 30-Second Oral Answer

- Kali provides the lab tooling environment; nmap reveals exposed services; Wireshark reveals network behavior.
- The tool is not the goal. The goal is to answer a security question about exposure, leakage, or protocol behavior.

### Typical Exam Questions

- What kinds of questions can nmap help answer?
- Why is Wireshark useful in web or authentication labs?
- What does responsible tool use require?

### Common Pitfalls

- Memorizing commands without understanding what evidence they produce.
- Treating Kali as permission to scan arbitrary systems.

### Concrete Examples and Commands

#### Basic tool examples

```bash
nmap -sV target.example
```

Use service/version detection to see what is exposed.

```text
In Wireshark, inspect request and response headers, cookies, and suspicious cleartext values.
```

### Related Concepts

- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]
- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]
- [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra|Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]]

## Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra

> [!abstract] Why this note matters
> - These are the tools that actually appear in Labs 1 through 4 — not the syllabus-headline tools (nmap, Wireshark) but the operational toolkit a student must be ready to name and describe.
> - The exam can ask "what tool would you use to do X" for any of: cracking a leaked hash, recovering source from `.git`, modifying HTTP requests, reversing a binary key validator, brute-forcing a truncated hash, or querying a leaked database.

### Overview

The four labs collectively use a small, focused toolkit. Each tool answers a specific class of question:

- **John the Ripper**: given a hash and a wordlist, recover the plaintext password.
- **git-dumper**: given an exposed `.git/` directory, reconstruct the full source repository.
- **Burp Suite**: intercept and modify HTTP/HTTPS traffic between the browser and server.
- **Ghidra (or Binary Ninja)**: reverse engineer a compiled binary to recover logic.
- **Python brute-force scripting**: search small key spaces, particularly truncated-hash collisions.
- **MySQL client + nc**: connect to and query an exposed database service.

This note covers what each tool does, when you reach for it, and the minimal workflow demonstrated in the labs.

### Exam Focus

- Tier 1 priority.
- The Lab 2 PDF explicitly enumerates the "Tools and Techniques" list — these names are course-syllabus, not optional.

### Core Definitions

- **John the Ripper**: An offline password cracker. Tries candidate passwords from a wordlist (or generated rules), hashes them with the matching algorithm, and compares to the target hash.
- **git-dumper**: A tool that reconstructs a Git repository from an exposed `.git/` directory served over HTTP. Recovers full history and source.
- **Burp Suite**: An intercepting HTTP/HTTPS proxy. Sits between the browser and server so the analyst can inspect, modify, replay, and intruder-test requests.
- **Ghidra**: An open-source reverse engineering platform from the NSA. Disassembles and decompiles binaries to a C-like view.
- **Binary Ninja**: A commercial alternative to Ghidra with similar disassembly and decompilation capability.
- **netcat (`nc`)**: A general-purpose TCP/UDP client. Used to talk to raw services such as the truncated-hash collision server in Lab 2 Ch 4.
- **MySQL client**: Command-line tool to connect to a MySQL/MariaDB server and run SQL queries.

### Detailed Explanation

#### John the Ripper — Lab 2 Challenge 5

The Lab 2 final challenge ends with a `users` table dump containing hashed passwords. John takes the hash file plus a wordlist and recovers the plaintext.

Hash format identification matters: John needs to know what algorithm produced the hash (MD5, SHA-1, bcrypt, etc.). The `--format=` flag or `john --list=formats` are the entry points. Lab 2 uses leaked database hashes consistent with SHA-1 style storage; identification is by hash length and prefix structure.

Minimal workflow:

```bash
## Identify format by inspection or hashid
hashid 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3'

## Crack with a provided wordlist
john --wordlist=passwords.txt --format=raw-sha1 hashes.txt

## Show recovered passwords
john --show --format=raw-sha1 hashes.txt
```

#### git-dumper — Lab 4 Challenge 2

Some web servers misconfigure directory restrictions and end up serving `/.git/`. If `.git/HEAD`, `.git/config`, and `.git/objects/` are reachable, git-dumper walks the object tree and reconstructs the working repository — full source, full history, commit messages, the lot.

```bash
pip install git-dumper
git-dumper https://target.example/.git/ ./recovered
cd recovered
git log --all
git show <commit>
```

Once recovered, search the history for credentials, hard-coded secrets, and removed-but-not-purged sensitive files.

#### Burp Suite — Labs 2 and 4

Burp is the intercepting proxy. The browser is configured to send all HTTP traffic through Burp on `127.0.0.1:8080`. The analyst can then:

- **Proxy → Intercept**: Pause a request, edit headers/body, forward.
- **Repeater**: Send the same request many times with small variations (excellent for SQL injection tests in Lab 4 Ch 4).
- **Intruder**: Automated request fuzzing — wordlists into specific positions.
- **HTTP history**: Full log of all requests for inspection of leaked headers (Lab 2 Ch 3, where the SSO code is in a response header).

Burp Community is sufficient for the lab challenges. The Lab 4 PDF treats it as optional, recommending it for students "who feel like a hacker"; in practice the Lab 2 SSO-header challenge is much easier with Burp than with browser DevTools alone.

#### Ghidra and Binary Ninja — Lab 1 Challenge 5

Lab 1 Challenge 5 ships a compiled binary `program` that implements a custom key validator. Ghidra (or Binary Ninja) loads the binary, runs auto-analysis, and exposes the decompiled functions. The student inspects the validator function to extract the constraints on a valid key — length, character set, positional relationships — and writes a generator that produces a key passing all checks.

Minimal workflow:

1. Create a new Ghidra project, import `program`, accept auto-analysis.
2. Locate `main` in the Symbol Tree, follow the call into the validator.
3. Read the decompiled C-like view; identify checks (length comparisons, character ranges, indexed equalities).
4. Translate the checks into a small Python search and submit candidates to the server.

#### Python brute-force scripting — Lab 2 Challenge 4

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

#### MySQL client and netcat — Lab 2 Challenge 5

Once `robots.txt` leaks database credentials, the MySQL client opens the door:

```bash
mysql -h target.example -u leaked_user -pLEAKED_PASS appdb
> SELECT username, password_hash FROM users WHERE role='admin';
```

`nc` is the lowest-level option for raw TCP services, including the truncated-hash challenge server in Lab 2 Ch 4 if it exposes a custom TCP protocol rather than HTTP.

```bash
nc target.example 4000
```

### How It Works

The general pattern across the labs is:

1. **Find the leaked artifact** (exposed `.git`, leaked `robots.txt`, response header, hidden DOM element, compiled binary).
2. **Pick the matching tool** (git-dumper, MySQL client, Burp, DevTools, Ghidra).
3. **Extract the secret or logic** (credentials, validator constraints, prefix collision).
4. **Use it to authenticate or bypass** (John for the recovered hash, generator for the validator, modified request via Burp).

### What You Must Know

- The mapping from problem class to tool: leaked hash → John; exposed `.git` → git-dumper; HTTP traffic inspection or modification → Burp; compiled binary → Ghidra/Binary Ninja; small key space → Python script; leaked DB credentials → MySQL client; raw TCP service → nc.
- John the Ripper requires format identification before cracking.
- git-dumper recovers full history, not just current files.
- Burp's Repeater is the natural tool for SQL-injection iteration.
- Truncated hashes (Lab 2 Ch 4) are brute-forceable from a small Python loop because effective entropy collapses to 28 bits.
- These are the lab tools; nmap and Wireshark are syllabus tools but not used in the lab challenges.

### 30-Second Oral Answer

- The lab toolkit is small and tool-to-problem matched: John the Ripper for leaked password hashes, git-dumper for exposed `.git/` directories, Burp Suite for intercepting and modifying HTTP traffic, Ghidra (or Binary Ninja) for reverse engineering compiled binaries, Python for small-keyspace brute force such as truncated-hash collisions, and the MySQL client plus netcat for talking to exposed services.
- Each tool answers a specific question; choosing the wrong tool is the most common student mistake.

### Typical Exam Questions

- Given a dumped `users` table with SHA-1 hashes and a wordlist, what tool do you use and how?
- A web server exposes `/.git/`. What tool reconstructs the source and what do you do next?
- The server validates integrity using only the first 7 hex chars of MD5. How do you find a colliding input, and why is this feasible?
- A compiled binary implements a custom key validator. How do you defeat it without knowing the source?
- An SSO code is leaked in an HTTP response header. What tool exposes it most cleanly?

### Common Pitfalls

- Running John without specifying `--format=`; it guesses, and guesses wrong on database-style hashes.
- Treating git-dumper output as a snapshot — forgetting to inspect history with `git log --all` for secrets that were committed then deleted.
- Forgetting Burp must have its CA certificate installed in the browser to intercept HTTPS.
- Reaching for Ghidra when DevTools would have worked — over-tooling a simple problem.
- Assuming a 28-bit search is too large to brute-force; it completes in seconds on a laptop.

### Concrete Examples and Commands

#### John the Ripper end-to-end (Lab 2 Ch 5)

```bash
## Suppose hashes.txt contains lines of the form: username:hash
hashid "$(awk -F: '{print $2; exit}' hashes.txt)"
john --wordlist=rockyou.txt --format=raw-sha1 hashes.txt
john --show --format=raw-sha1 hashes.txt
```

#### git-dumper end-to-end (Lab 4 Ch 2)

```bash
pip install git-dumper
git-dumper https://target.example/.git/ ./loot
cd loot
git log --all --oneline
git grep -i 'password\|secret\|token' $(git rev-list --all)
```

#### Python brute-force for truncated MD5 (Lab 2 Ch 4)

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

#### Burp Repeater workflow for SQLi (Lab 4 Ch 4)

1. Proxy the login request through Burp.
2. Right-click the request → Send to Repeater.
3. In the password field, try `' OR 1=1--`, `' UNION SELECT NULL--`, `' ORDER BY 1--` etc.
4. Diff the responses to detect injection point and column count.

### Related Concepts

- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]
- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]
- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]
- [[Browser DevTools, Hidden Resources, and Client-Side Evidence|Browser DevTools, Hidden Resources, and Client-Side Evidence]]

## Browser DevTools, Hidden Resources, and Client-Side Evidence

> [!abstract] Why this note matters
> - Lab 4 repeatedly relies on browser-side inspection rather than blind trust in the page interface.
> - This note promotes practical browser-analysis habits from the labs into the concept layer.

### Overview

Browser DevTools matter because the browser is already the execution environment for the application. If a page loads data, scripts, headers, or hidden resources, the client often has direct ways to inspect them even when the visible UI tries to obscure them.

This is one of the central practical lessons of the web labs: do not confuse hidden in the interface with inaccessible in the system.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **DevTools**: Browser tooling for inspecting the DOM, network requests, storage, scripts, styles, and console behavior.
- **client-side evidence**: Security-relevant data that is already present in the browser and can be inspected locally.
- **hidden resource**: A retrievable file or endpoint not exposed directly through the visible interface.

### Detailed Explanation

The Elements or DOM view helps answer whether content is present client-side but hidden through CSS or script logic. If the data is already in the DOM, then the page did not truly enforce server-side access control for that content.

The Network view reveals requests, headers, response bodies, cookies, and downloaded artifacts. That makes it useful for spotting leaked one-time codes, configuration mistakes, mixed-content requests, or hidden API calls.

Storage inspection reveals cookies and sometimes local browser state that explains how a session or challenge is being maintained. This connects directly to the course's emphasis on cookie scope, session management, and client-visible trust assumptions.

The Console and Sources views matter because they expose client-side validation logic and JavaScript behavior. If the client is checking a password rule or access condition locally, then the attacker can often inspect or bypass that logic.

### How It Works

DOM inspection answers: is the content already present in the page?

Network inspection answers: what requests, headers, cookies, and bodies are really exchanged?

Storage inspection answers: what client-side state is present?

Console and source inspection answer: what browser-side logic is enforcing or exposing behavior?

### What You Must Know

- Why DevTools can reveal supposedly hidden browser-side content.
- How network and storage inspection support web-security analysis.
- Why client-side validation and client-side hiding are weak security controls.

### 30-Second Oral Answer

- DevTools expose what the browser already knows, so they are ideal for proving whether a web app is protecting data server-side or only hiding it client-side.

### Typical Exam Questions

- Why can DevTools reveal content hidden behind a weak paywall?
- What kinds of security evidence can the Network tab reveal?
- Why is client-side validation not a trustworthy security boundary?

### Common Pitfalls

- Assuming hidden in the rendered interface means hidden from the attacker.
- Looking only at page source and forgetting that dynamically loaded data may appear in network requests or the DOM later.

### Concrete Examples and Commands

#### DevTools reasoning pattern

```text
1. Open Elements -> is the secret content already in the DOM?
2. Open Network -> are codes, headers, or hidden files being transferred?
3. Open Storage -> are session cookies or other tokens present?
4. Open Console/Sources -> is the client deciding something that should be enforced server-side?
```

### Related Concepts

- [[Web Architecture, HTTP, Cookies, and the Browser Security Model|Web Architecture, HTTP, Cookies, and the Browser Security Model]]
- [[Mixed Content, documentdomain, and Cookie Scope Across Subdomains|Mixed Content, document.domain, and Cookie Scope Across Subdomains]]
- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]
- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]

## /proc Filesystem and Process Forensics on Linux

> [!abstract] Why this note matters
> - Lab 3 Challenge 3 ("The Living Kernel") turns on this single insight: when `ps` and `top` lie, `/proc` is the kernel-backed view that a userland rootkit usually cannot scrub.
> - The 2025-03-21 past exam Part C Q2 on kernel-mode rootkit recovery maps directly to the methodology built here.

### Overview

`/proc` is a virtual filesystem exposed by the Linux kernel. It is not stored on disk. Each directory under `/proc/<PID>/` corresponds to a live process, and each file inside reflects current kernel state for that process. Because user-space tools such as `ps`, `top`, and `pgrep` are themselves binaries that can be replaced, hooked, or filtered by a rootkit, `/proc` provides an independent cross-check: it is the source the honest tools were supposed to be reading anyway.

### Exam Focus

- Tier 1 priority.
- Directly supports the past-exam pattern: "you suspect a kernel-mode rootkit; describe how to confirm and recover".

### Core Definitions

- **process**: A running instance of a program. Identified by a numeric PID.
- **PID**: Process ID, a kernel-assigned integer that uniquely identifies a running process.
- **PPID**: Parent PID, the PID of the process that started this one. Reveals the launcher chain.
- **/proc**: A virtual filesystem exposing live kernel and process state as readable files.
- **cmdline**: `/proc/<PID>/cmdline` — the exact argv that launched the process, NUL-separated.
- **environ**: `/proc/<PID>/environ` — the environment variables the process inherited at launch.
- **status**: `/proc/<PID>/status` — a text summary including PPid, UID, state, memory.
- **cross-checking**: Confirming a finding by comparing two independent views (e.g. `ps` against `/proc`).

### Detailed Explanation

A user-space rootkit hides processes by replacing or hooking the tools that enumerate them. `ps` parses `/proc` itself, so a tampered `ps` may filter out specific PIDs before printing. `top` and `pgrep` have the same exposure. If only one of these tools is consulted, the analyst inherits the rootkit's lie.

The defense is to read `/proc` directly. Even if `ps` filters PID 1337, the directory `/proc/1337/` still exists on a userland-only compromise, because the kernel populates it. Reading `/proc/1337/cmdline` reveals what was launched. Reading `/proc/1337/environ` shows the environment variables that may have been used to alter the behavior of tools the process invokes. Reading `/proc/1337/status` exposes the parent PID, which is the first thread you pull to find a watchdog (see [[Malware Persistence and Watchdog Processes]]).

This is why Lab 3 Challenge 3 calls the central rule "do not trust a single view of reality": the honest filesystem is the corroborating view.

A second technique addresses environment-driven misbehavior. If `PS_FILTER=hide_me` causes `ps` to suppress matching processes, then `env -u PS_FILTER ps -aux` runs `ps` without that variable in scope. The same idea applies to `LD_PRELOAD`, which lets an attacker inject a library that intercepts library calls inside any newly launched binary.

### How It Works

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

### What You Must Know

- `/proc/<PID>/cmdline`, `environ`, and `status` (for PPid) are the three core forensic reads.
- `ps`, `top`, and `pgrep` are user-space tools and may be hooked; `/proc` is kernel-backed.
- `env -u VAR <cmd>` runs a command with `VAR` unset for that invocation only.
- `printenv` shows the current shell's environment; useful for finding what is influencing tools.
- A discrepancy between `ps` output and `/proc` directory count is positive evidence of stealth.
- PPid is the lead for finding watchdog processes that restart killed malware.

### 30-Second Oral Answer

- On a compromised host, never trust `ps`, `top`, or `pgrep` alone. Cross-check against `/proc`, the kernel-backed virtual filesystem.
- For each suspect PID, read `/proc/<PID>/cmdline` to see how it was launched, `/proc/<PID>/environ` to see its environment, and `/proc/<PID>/status` for PPid to find what started it.
- Use `env -u VAR cmd` to neutralize an environment variable that may be skewing tool output.

### Typical Exam Questions

- Why is `/proc` more trustworthy than `ps` on a possibly compromised system?
- Given a PID, how do you determine how the process was launched and by whom?
- How would you detect that `ps` is hiding processes?
- What does `env -u LD_PRELOAD ps -aux` do, and why might an analyst run it?

### Common Pitfalls

- Treating `ps -aux` output as ground truth on a possibly compromised host.
- Forgetting that `/proc/<PID>/cmdline` is NUL-separated; raw `cat` runs args together.
- Looking only at the suspect process and not its PPid, missing the watchdog.
- Killing the visible process without finding the parent that restarts it.

### Concrete Examples and Commands

#### Enumerate all PIDs from the kernel directly

```bash
ls /proc | grep -E '^[0-9]+$' | wc -l
ps -aux | tail -n +2 | wc -l
```

A mismatch suggests `ps` is filtering.

#### Read a process command line and environment

```bash
cat /proc/1337/cmdline | tr '\0' ' '; echo
cat /proc/1337/environ | tr '\0' '\n'
```

#### Find the parent that launched a suspect process

```bash
grep -E '^PPid:' /proc/1337/status
```

Then repeat against the parent PID. The chain often terminates at a watchdog, init/systemd, or cron-spawned shell.

#### Run a tool with a poisoned variable removed

```bash
env -u LD_PRELOAD ps -aux
env -u PS_HIDE_LIST ps -aux
```

#### Inspect your current environment for tampering

```bash
printenv | sort
```

Look for unexpected `LD_PRELOAD`, `PATH` prepends to writable directories, or custom variables named after the tools they influence.

### Related Concepts

- [[Rootkits, Hooking, DKOM, and Stealth Analysis|Rootkits, Hooking, DKOM, and Stealth Analysis]]
- [[Malware Persistence and Watchdog Processes|Malware Persistence and Watchdog Processes]]

- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]

## Malware Persistence and Watchdog Processes

> [!abstract] Why this note matters
> - Lab 3 Challenge 5 ("Survivor Protocol") teaches the pattern that distinguishes incident response from one-shot cleanup: malware does not disappear when you kill it, because something else is watching.
> - The exam-ready insight is the diagnostic loop: Symptom (returns after kill) → Hypothesis (watchdog / persistence mechanism) → Evidence (parent process, scheduled task, init hook, cron, PATH redirection).

### Overview

Persistence is the property by which a malicious component continues to exist on a host across termination, reboot, or cleanup attempts. It is rarely a single mechanism. A watchdog is one common implementation: a second process whose job is to detect when the malicious process disappears and to re-spawn it. Other implementations include init or systemd units, cron entries, login scripts, and binaries hijacked by PATH ordering so that a benign-looking command silently re-launches the payload.

Persistence is the trait that makes a real incident expensive. Finding the artifact is easy. Finding the mechanism that keeps recreating the artifact is the actual investigation.

### Exam Focus

- Tier 1 priority.
- Closely linked to the past-exam rootkit-recovery question pattern: students must describe both the diagnostic loop and concrete evidence to collect.

### Core Definitions

- **persistence**: The ability of a malicious component to remain active across termination, reboot, or cleanup.
- **watchdog (monitor)**: A supervising process that restarts a target if it disappears. Legitimate in HA systems, abused for malware.
- **PPid**: Parent process ID, found in `/proc/<PID>/status`. The first thing to inspect when investigating a returning process.
- **PATH-order redirection**: Placing a malicious binary earlier in `$PATH` than the legitimate one so that the command name resolves to the attacker's binary first.
- **scheduled task**: A cron entry, systemd timer, or at-job that periodically launches a process.

### Detailed Explanation

The diagnostic pattern from Lab 3 Challenge 5 is the central content of this note:

1. **Symptom.** You kill a process and it comes back, or you delete a file and it reappears, or you remove a cron entry and it returns.
2. **Hypothesis.** Something else is restoring it. That something is the persistence mechanism.
3. **Evidence.** Collect, in order:
   - The PPid of the returning process from `/proc/<PID>/status`. Repeat upward until the chain bottoms out somewhere informative.
   - Scheduled task listings: `crontab -l` for the user, `ls /etc/cron.*` and `cat /etc/crontab` for system cron, `systemctl list-timers`.
   - Init / systemd hooks: `systemctl list-units --type=service`, look for unfamiliar units, check their `ExecStart=`.
   - Shell startup files: `~/.bashrc`, `~/.profile`, `/etc/profile.d/`, `~/.bash_logout`.
   - `$PATH` order: `echo $PATH`. If writable directories (e.g. `~/bin`, `/tmp`) appear before `/usr/bin`, a malicious binary can shadow a legitimate command and re-launch the payload on every shell invocation.

The Lab 3 phrasing — "if something returns, ask: what mechanism is restoring it?" — is the form the exam tends to favor.

PATH-order redirection deserves separate attention because it is subtle. If `/usr/local/bin` is writable by a compromised user and earlier in `$PATH` than `/usr/bin`, then dropping `/usr/local/bin/ps` containing a wrapper that launches the rootkit and then execs `/usr/bin/ps` gives the attacker both stealth (the user sees normal `ps` output) and persistence (the rootkit is relaunched whenever any user types `ps`). See [[proc Filesystem and Process Forensics on Linux|/proc Filesystem and Process Forensics on Linux]] for the cross-checking strategy that bypasses this.

### How It Works

The triage workflow:

```bash
## 1. Confirm the symptom: process returns after kill
pgrep -af suspect_name
kill <PID>
sleep 2
pgrep -af suspect_name   # back already?

## 2. Find the parent (the watchdog candidate)
grep -E '^(Name|PPid):' /proc/<NEW_PID>/status

## 3. Walk the parent chain
grep -E '^(Name|PPid):' /proc/<PARENT_PID>/status

## 4. Check scheduled tasks
crontab -l
sudo cat /etc/crontab
sudo ls /etc/cron.{hourly,daily,weekly,monthly}
systemctl list-timers --all

## 5. Check init/systemd units
systemctl list-units --type=service --state=running
systemctl cat <suspect-unit>

## 6. Check shell startup files and PATH order
echo "$PATH"
cat ~/.bashrc ~/.profile /etc/profile
```

### What You Must Know

- The Symptom → Hypothesis → Evidence triage loop, in that order.
- The five canonical persistence locations: parent process / watchdog, cron, systemd (services + timers), shell startup files, PATH-order shadowing.
- Why killing the visible process without finding the parent guarantees recurrence.
- That `/proc/<PID>/status` PPid is the entry point into the parent chain.
- PATH-order redirection as a stealth + persistence combo, and why writable directories early in `$PATH` are dangerous.

### 30-Second Oral Answer

- Persistence is the property that makes malware survive cleanup. The exam-relevant diagnostic is: Symptom (it returns) → Hypothesis (a watchdog or scheduled mechanism) → Evidence (parent PID via `/proc/<PID>/status`, cron and systemd timers, init/systemd units, shell startup files, `$PATH` order).
- Watchdogs are processes whose job is to relaunch the target. PATH-order redirection lets an attacker make a legitimate command name silently re-launch the payload.
- You must locate and disable the mechanism before killing the artifact; otherwise it returns.

### Typical Exam Questions

- A process you kill reappears within seconds. Describe your investigation.
- Name five places persistence can hide on a Linux host.
- What is a watchdog process, and how do you find one from a known suspect PID?
- Why does removing the visible binary not end the incident?

### Common Pitfalls

- Killing the artifact without identifying the parent or scheduler.
- Assuming `crontab -l` covers system cron; it does not — check `/etc/cron*` and systemd timers separately.
- Forgetting that PATH-order redirection makes `ps`, `ls`, and `crontab` themselves potentially untrustworthy on a compromised host.
- Treating the absence of a systemd unit as proof there is no service; check user units too: `systemctl --user list-units`.

### Concrete Examples and Commands

#### Parent-chain walk from a returning process

```bash
PID=$(pgrep suspect_name | head -1)
while [ -n "$PID" ] && [ "$PID" != "0" ]; do
  grep -E '^(Name|PPid):' /proc/$PID/status
  PID=$(awk '/^PPid:/ {print $2}' /proc/$PID/status)
  echo ---
done
```

#### Audit `$PATH` for writable shadowing directories

```bash
IFS=':' read -ra DIRS <<< "$PATH"
for d in "${DIRS[@]}"; do
  [ -w "$d" ] && echo "WRITABLE in PATH: $d"
done
```

#### Audit all scheduling surfaces

```bash
crontab -l 2>/dev/null
sudo cat /etc/crontab
sudo ls -la /etc/cron.{hourly,daily,weekly,monthly}
systemctl list-timers --all
systemctl --user list-timers --all
atq
```

### Related Concepts

- [[proc Filesystem and Process Forensics on Linux|/proc Filesystem and Process Forensics on Linux]]
- [[Rootkits, Hooking, DKOM, and Stealth Analysis|Rootkits, Hooking, DKOM, and Stealth Analysis]]
- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]

## Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses

> [!abstract] Why this note matters
> - These labs turn lecture content into concrete attacker-style reasoning problems.
> - They reveal what the course considers practical mastery rather than only recall.

### Overview

Lab 1 is about cryptographic thinking rather than heavyweight implementation. It asks whether a transformation is truly secret, whether a key space is brute-forceable, and what goes wrong when a one-time pad is reused.

Lab 2 shifts to authentication and web mistakes: hidden client-side information, oversharing that makes passwords guessable, leaked one-time codes in HTTP headers, truncated hash weaknesses, and password cracking against leaked database data.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **known-plaintext attack**: Using a known message to recover information about the key or about other encrypted messages.
- **client-side validation**: Checks performed in the browser that do not truly enforce security because the attacker controls the client.
- **information leakage**: Exposure of sensitive values through visible files, headers, or other externally observable channels.

### Detailed Explanation

Lab 1's transformation exercises teach an important discipline: do not call every transformation encryption. Ask whether there is a secret, whether the key space is large enough, and whether the operation is really confidentiality-preserving.

The OTP-reuse challenge is especially instructive because it shows that perfect-secrecy tools fail when used incorrectly. If the same XOR pad is reused, known plaintext from one message can reveal the pad and therefore the other message.

Lab 2 focuses on implementation failure rather than theoretical failure. Client-side validation does not protect secrets because the client can inspect or modify its own code. Public social-media information can collapse the password search space. Hidden response headers can leak one-time codes because headers are visible to traffic inspection and browser tooling.

Together, these labs train you to connect theory to practical exploitation conditions: weak assumptions, leaked context, predictable secrets, and visible transport artifacts.

### How It Works

For weak-transformation analysis, classify the transformation and estimate recovery effort.

For OTP reuse, recover pad information from known plaintext and reuse it against the second ciphertext.

For web/auth problems, check what the client can see, what headers or files leak, and what predictable patterns reduce the guess space.

### What You Must Know

- Why OTP reuse breaks confidentiality.
- Why client-side validation is not real security.
- Why leaked headers, hidden files, and overshared personal details can break authentication.
- Why predictable password formulas are still weak even if they look complex.

### 30-Second Oral Answer

- Lab 1 is about classifying transformations and reasoning like an attacker about key space and OTP reuse.
- Lab 2 is about implementation mistakes: client-visible secrets, predictable passwords, leaked authentication data, and weak hash practices.

### Typical Exam Questions

- Why does OTP reuse fail?
- Why is client-side validation insecure?
- How can a response header leak a one-time code?
- Why do predictable password formulas fail even when users think they are clever?

### Common Pitfalls

- Treating hidden client-side data as server-side secrecy.
- Calling OTP secure without checking whether the pad was reused.
### Challenge-by-Challenge Breakdown

#### Lab 1 Challenge 1 — Multi-step Transformations

Five lines, each a different transformation of one flag fragment. The task is to classify each transformation (Base64, hex, Caesar shift, ROT-style, simple substitution, etc.) and reverse it. Teaches the difference between encoding (no secret, freely reversible) and encryption (requires a key).

#### Lab 1 Challenge 2 — One-Time Pad Misuse

Two ciphertexts use the same XOR pad. With one known plaintext, the pad is recovered as `pad = plaintext XOR ciphertext1`, then `plaintext2 = ciphertext2 XOR pad`. OTP is information-theoretically secure if used correctly; reusing the pad collapses the guarantee. This is the canonical known-plaintext attack.

#### Lab 1 Challenge 3 — The Penguin (ECB block leakage)

A reference to the well-known "ECB penguin" image. A file is encrypted with a block cipher in ECB mode and then re-encoded. Because ECB encrypts each block independently with no chaining, identical plaintext blocks produce identical ciphertext blocks, so spatial structure in the original file (e.g., the large flat regions of a bitmap) survives encryption visibly. The lesson is mode-of-operation choice: confidentiality of the algorithm is not enough if the mode leaks structure. Workflow: decode the outer transformation, identify the original file format from the header, and visually inspect the result — patterns that should not be visible reveal both the mode flaw and the hidden flag.

#### Lab 1 Challenge 4 — Modified Vigenère, partial key recovery with positional drift

Classical Vigenère with a key length of 4. Three of the four key characters are known. A "positional drift" modifies the shift at each position (a deterministic add-on tied to position index). With three positions fixed, the unknown position only needs to be searched across the 26-letter alphabet — 26 candidate decryptions, ranked by English-language likeness or by recognizing the flag prefix in the output. The teaching point: partial knowledge of a short key reduces effective key space catastrophically, and predictable positional modifications add no real security because they are deterministic and reversible.

#### Lab 1 Challenge 5 — The Generator of Keys (binary reverse engineering)

A compiled binary `program` and a server share the same validator. Load `program` in Ghidra or Binary Ninja, run auto-analysis, find the validator function, and read the decompiled C-like view. Identify the constraints: length, character-set, positional equalities, checksum. Translate the constraints into a small Python search and submit candidates to the server. The course point: custom key validation is risky because reverse engineering exposes the rules — security through obscurity fails. See [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]] for the Ghidra workflow.

#### Lab 2 Challenge 1 — Insecure Login

Credentials are reachable from the client-side bundle. DevTools → Sources reveals a hidden file or a hardcoded value left in the JavaScript by a developer. Client-side validation never provides real security because the attacker controls the client.

#### Lab 2 Challenge 2 — TMI on Social Media

A user's public profile leaks the components of their password (pet name + date of birth + favorite number, etc., in a predictable order). Reconstruct the password from the profile and log in. Predictable formulas defeat complexity policies; oversharing collapses the dictionary search.

#### Lab 2 Challenge 3 — Single Sign-On Secret Header

The 2FA / SSO one-time code is sent in a custom HTTP response header rather than a secure side channel. Submit the initial credentials, capture the response in DevTools → Network or in Burp's HTTP history, extract the leaked code from the response headers, and reuse it to complete authentication. The teaching point: HTTP headers are not a secure channel for secrets — any proxy, browser tool, or network observer sees them. A 2FA code must travel over a separate authenticated channel (SMS, authenticator app, hardware token), not be returned inline.

#### Lab 2 Challenge 4 — MD5 Truncated-Hash Collision

The server validates integrity using only the first 7 hex characters of MD5 — 28 bits of effective entropy ($16^7 \approx 268$ million possibilities). Connect with `nc`, note the required prefix and target 7-hex-char value, and run a Python brute-force loop that iterates candidates until `md5(prefix + suffix).hexdigest()[:7] == target`. Completes in seconds on a laptop. The lesson: truncating a cryptographic primitive destroys its security margin — 28 bits is brute-forceable, period. SHA-256 truncated similarly would have the same problem. See [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]] for the script.

#### Lab 2 Challenge 5 — Full chain: robots.txt → MySQL dump → John → admin login

The full kill chain in one challenge:

1. Read `/robots.txt` — it lists paths the admin asked Google not to index, which often include the database admin interface or a backup file with credentials.
2. Use the leaked DB host and credentials with the MySQL client to dump the `users` table: `SELECT username, password_hash FROM users WHERE role='admin';`.
3. Feed the recovered hashes to John the Ripper with the provided wordlist: `john --wordlist=passwords.txt --format=raw-sha1 hashes.txt`. Salted SHA-1 still falls quickly to a small wordlist when passwords follow date patterns.
4. Log in to the web app as admin with the cracked password; collect the flag.

This challenge is the most exam-relevant of Lab 2: it chains five separate failures (sensitive paths in robots.txt, weak DB ACLs, weak hash choice, predictable passwords, single-factor admin auth). Each is independently a bad practice. Tie back to [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks]] for why adaptive hashes (bcrypt, Argon2) would have changed the outcome.

### Related Concepts

- [[Encryption, Decryption, Key Space, and Exhaustive Search|Encryption, Decryption, Key Space, and Exhaustive Search]]
- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]
- [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra|Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]]

## Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation

> [!abstract] Why this note matters
> - Lab 3 and Lab 4 encode the course's practical mindset particularly clearly.
> - These labs reveal what the instructors consider normal analyst behavior: skepticism, tooling, and structured observation.

### Overview

Lab 3 is about compromised-system thinking. Hidden files, environment variables, pruned outputs, and manipulated results are used to teach that the system's own tools may be untrustworthy under rootkit-style compromise.

Lab 4 moves into web exploitation. It emphasizes that browser-side content, hidden resources, Git metadata, DOM manipulation, and client/server separation all matter when analyzing web defenses and failures.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **forensic skepticism**: The habit of not trusting a single compromised source of evidence.
- **DevTools**: Browser developer tools used to inspect the DOM, scripts, styles, storage, and network activity.
- **hidden resource**: A file or endpoint not linked in the normal interface but still retrievable if its path or metadata is discovered.

### Detailed Explanation

Lab 3's key lesson is that malware often hides rather than deletes. If a system lies about files, processes, or output, then analysts must compare views and deliberately bypass suspicious influences such as environment variables. That is a transferable security habit, not only a lab trick.

Lab 4 teaches the browser-side lesson that if your browser can render or hide something, then that content reached the client somehow. Paywalls, hidden sections, or disabled controls are not necessarily access control if the data is already in the DOM or recoverable through DevTools.

The Git metadata challenge adds another operational lesson: exposure often happens because developers leave artifacts accessible. Security failures are frequently accidental exposures of data or history, not only sophisticated exploits.

The lab sequence is also about trust placement. On the host side, you should not trust one command view because the host may be lying. On the browser side, you should not trust one interface view because the page may simply be hiding already delivered content. In both settings, the analyst learns to ask where the evidence actually comes from and whether that evidence path is itself trustworthy.

These labs therefore reinforce the same analytical habit from two angles. On a compromised system, do not trust one tool view. In a web browser, do not trust one interface claim about what is 'hidden' or 'protected'. In both cases, the student learns to look underneath the first representation.

### How It Works

In compromised environments, compare commands, views, and contexts rather than trusting one output.

In browsers, inspect the DOM, network activity, storage, and hidden paths before assuming content is truly protected server-side.

Look for repository metadata or forgotten resources when a web app seems oddly bare or exclusive.

### What You Must Know

- Why Lab 3 emphasizes distrust of system output and cross-checking views.
- How browser DevTools support DOM inspection and client-side analysis.
- Why hidden resources or exposed `.git`-style artifacts are security issues.

### 30-Second Oral Answer

- Lab 3 teaches forensic skepticism under stealth compromise; Lab 4 teaches that browser-visible content and hidden resources can still be exploitable.
- The common lesson is to verify assumptions about what is really hidden, trusted, or protected.

### Typical Exam Questions

- Why is 'what you see' not necessarily what exists on a compromised system?
- Why can a paywall be bypassed if the content is already in the DOM?
- Why is exposed repository metadata dangerous?

### Common Pitfalls

- Assuming hidden in the UI means hidden from the user.
- Assuming one clean output proves the host is clean.
### Challenge-by-Challenge Breakdown

#### Lab 3 Challenge 1 — Last Signal (hidden files, environment variables)

Filesystem navigation under stealth conditions. The flag is in a dotfile hidden by `ls` default output; `ls -la` exposes it. Environment variables can also alter what tools display, so `printenv` is part of the diagnostic, and `env -u VAR cmd` runs a command with a suspect variable removed. Core habit: do not trust default output.

#### Lab 3 Challenge 2 — Last Broadcast (output pruning, cross-checking)

Tools actively lie. `cat` may return a filtered version of a file. The defense is cross-checking the same data via a different path (different tool, different system view). This is the warm-up for Challenge 3.

#### Lab 3 Challenge 3 — The Living Kernel (hidden process via /proc)

The central insight. `ps`, `top`, and `pgrep` all report no anomaly, but power and cooling indicate something is running. The fix is to enumerate processes directly from `/proc` — the kernel-backed view that the user-space tools were supposed to be reading. For each suspect PID:

```bash
cat /proc/<PID>/cmdline   # how it was launched (NUL-separated)
cat /proc/<PID>/environ   # its environment variables
grep PPid /proc/<PID>/status   # its parent
```

This challenge is the direct foundation for the past-exam Part C Q2 on kernel-mode rootkit recovery. See [[proc Filesystem and Process Forensics on Linux|/proc Filesystem and Process Forensics on Linux]] for the full methodology and command reference.

#### Lab 3 Challenge 4 — Encrypted Whisper (layered payload analysis)

Mindset shift: the anomaly now hides meaning, not existence. The payload arrives wrapped in a chain — typically Base64 encoding around a compression layer (gzip/zlib) around the actual content. The student peels layers in order, recognizing each by its byte signature (Base64's `=` padding and limited charset; gzip's `1f 8b` magic). Workflow:

```bash
## Detect Base64 (letters/digits/+//= only) and decode
echo "$payload" | base64 -d > stage1.bin

## Identify compression by magic bytes
file stage1.bin
hexdump -C stage1.bin | head

## Decompress
gunzip < stage1.bin > stage2.bin
## or: python -c "import zlib,sys; sys.stdout.buffer.write(zlib.decompress(open('stage1.bin','rb').read()))"
```

The transferable lesson: unreadable does not mean unimportant. Recognize the transformation, reverse it, and look at what is underneath.

#### Lab 3 Challenge 5 — Survivor Protocol (watchdog persistence, PATH redirection)

The anomaly returns after being killed. This is persistence, and the canonical mechanism is a watchdog process that re-spawns the target. The diagnostic loop is Symptom → Hypothesis → Evidence:

1. Confirm: kill the process, see it return within seconds.
2. Hypothesize a persistence mechanism.
3. Collect evidence: walk PPid from `/proc/<PID>/status` up to the watchdog; audit `crontab -l`, `/etc/cron.*`, `systemctl list-timers`; check `~/.bashrc` and `$PATH` order for writable-directory shadowing.

PATH-order redirection is the subtle variant: a writable directory early in `$PATH` lets the attacker drop `/usr/local/bin/ps` that re-launches the rootkit and then execs `/usr/bin/ps`. See [[Malware Persistence and Watchdog Processes]] for full triage workflow.

#### Lab 4 Challenge 1 — Subscribe to Read More (paywall via DOM)

The article body is already in the DOM; the paywall overlay is purely CSS. DevTools → Elements, remove the overlay or set `display:none`, content is readable. Lesson: client-side hiding is not access control.

#### Lab 4 Challenge 2 — The Internet Never Forgets (exposed .git)

The site serves `/.git/`. Run `git-dumper https://target/.git/ ./loot` to reconstruct the repository, then `git log --all` and `git grep` the history for credentials that were committed and "removed". See [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]] for tool usage.

#### Lab 4 Challenge 3 — Feed The Machine (signed cookies, scoreboard)

The leaderboard depends on a server-signed session cookie carrying click count. Without the signing key the value cannot be forged, but inspection in DevTools → Application → Cookies reveals the structure and whether protection is real or decorative. The teaching point is the distinction between a session cookie (server-trusted state) and a signed cookie (server-verifiable state).

#### Lab 4 Challenge 4 — No Injector Will Pass (SQL injection auth bypass)

The login form concatenates input into a SQL query. Test payloads in order:

```sql
' OR 1=1--                  -- confirm injection, log in as first user
1' ORDER BY 1 --            -- find column count by incrementing until error
1' ORDER BY 2 --
' UNION SELECT NULL --      -- discover UNION-injectable columns
' UNION SELECT NULL,NULL --
```

To log in specifically as `elan_maks`, terminate the username field with a comment after the target: `elan_maks'--`. Iteration is fastest in Burp Repeater. Tie back to [[XSS, CSRF, SQL Injection, and Session Defenses]].

#### Lab 4 Challenge 5 — Equalizer Weapon (XSS chained to bypass CSRF)

The new feature: customizable display names that other users (including admins) render. The pattern:

1. Store an XSS payload in the display name (stored XSS): `<script>fetch('/admin/reset_all', {method:'POST', headers:{'X-CSRF-Token': document.querySelector('meta[name=csrf]').content}})</script>`.
2. Trigger admin review of the profile (e.g., by reporting it). The admin's browser renders the payload.
3. The script runs in the admin's session — same origin, same cookies, same CSRF token (which the script reads from the admin's own DOM).
4. The request to reset balances succeeds because the CSRF token is valid and the session is the admin's.

The teaching point: CSRF tokens defend against cross-origin forgery, but XSS executes in-origin and can read the token directly. XSS therefore subsumes CSRF.

### Related Concepts

- [[Rootkits, Hooking, DKOM, and Stealth Analysis|Rootkits, Hooking, DKOM, and Stealth Analysis]]
- [[Web Architecture, HTTP, Cookies, and the Browser Security Model|Web Architecture, HTTP, Cookies, and the Browser Security Model]]
- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]
- [[proc Filesystem and Process Forensics on Linux|/proc Filesystem and Process Forensics on Linux]]
- [[Malware Persistence and Watchdog Processes|Malware Persistence and Watchdog Processes]]
- [[Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra|Web Security Tools — John the Ripper, git-dumper, Burp, Ghidra]]
