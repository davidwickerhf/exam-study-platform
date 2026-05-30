---
tags:
  - university
  - bcs2420
  - computer-security
  - self-test
---

# 06 Labs and Tooling Self Test

Answer these without checking the notes. Then expand the Answer Key callout at the bottom to grade yourself.

## Kali Linux, Nmap, Wireshark, and Responsible Tool Use

1. What kinds of questions can nmap help answer?
2. Why is Wireshark useful in web or authentication labs?
3. What does responsible tool use require?

## Browser DevTools, Hidden Resources, and Client-Side Evidence

4. Why can DevTools reveal content hidden behind a weak paywall?
5. What kinds of security evidence can the Network tab reveal?
6. Why is client-side validation not a trustworthy security boundary?
7. Walk through the four DevTools panels (Elements, Network, Storage, Console/Sources) and state one security question each helps answer.

## Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses

8. Why does OTP reuse fail? (Show the XOR relation.)
9. Why is client-side validation insecure?
10. How can a response header leak a one-time code? (Lab 2 Challenge 3 scenario.)
11. Why do predictable password formulas (pet name + birth year, etc.) fail even when users think they are clever?
12. Lab 2 Challenge 4 truncated `MD5` to 7 hex chars for integrity. Why is this brute-forceable? Approximate the search space.

## Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation

13. Why is "what you see" not necessarily what exists on a compromised system?
14. Why can a paywall be bypassed if the content is already in the DOM?
15. Why is exposed `.git` repository metadata dangerous? What tool reconstructs a repo from an exposed `.git/`?
16. Lab 4 Challenge 5 chained stored XSS to defeat CSRF protection on an admin reset. Briefly explain why XSS subsumes CSRF.

> [!info]- Answer Key
> 1. nmap reveals **attack surface**: what hosts are reachable, what ports are open, what services and versions appear to run, and rough OS/service fingerprinting. It does not secure anything — it answers "what is exposed?" so defenders or attackers can reason about that exposure.
> 2. Wireshark reveals **what is actually on the wire**: requests, response headers, cookies, cleartext credentials, leaked tokens, mixed-content fetches, protocol behaviour. In web/auth labs it confirms whether a value the page claims is "secure" really is, and exposes side-channel leaks (e.g., a 2FA code returned in an HTTP header).
> 3. Authorised scope only: test systems you own or have explicit written permission to test. Tools like Kali/nmap/Wireshark are powerful and the same activity can be a lab exercise or a crime depending on authorisation. Capability ≠ permission.
> 4. The "hidden" content is already in the DOM (delivered to the client) and only obscured visually by CSS (display:none, opacity, overlay div). Elements panel lets the user remove the overlay or unhide the section; the data was always there. Client-side hiding is decoration, not access control.
> 5. Requests sent, headers (both directions), response bodies, cookies, redirects, mixed-content warnings, hidden API endpoints, leaked one-time codes in custom response headers, file downloads, timing. Useful for spotting configuration mistakes and channel leaks.
> 6. The attacker controls the client. Any JS that runs in the browser can be inspected, modified, or skipped (e.g., breakpoint and overwrite a return value, edit a hidden field, bypass form validation by issuing the underlying HTTP request directly). Real enforcement must be server-side.
> 7. **Elements (DOM)**: is the supposed-hidden content already present in the page? **Network**: what requests/headers/bodies are really exchanged — are codes/secrets leaking? **Storage (Application)**: what session cookies, localStorage, IndexedDB state is the client holding? **Console / Sources**: what client-side logic decides access — can it be inspected, breakpointed, or bypassed?
> 8. If `c1 = m1 XOR k` and `c2 = m2 XOR k`, then `c1 XOR c2 = m1 XOR m2` — the pad cancels and a relation between the plaintexts is exposed. With one known plaintext `pad = c1 XOR m1`, then `m2 = c2 XOR pad`. OTP's perfect-secrecy guarantee requires the key be used exactly once.
> 9. See Q6. Lab 2 Challenge 1 hid credentials in client-side JS reachable from DevTools → Sources. Any "validation" or "secret" on the client is visible and modifiable by the user.
> 10. Lab 2 Challenge 3: after entering credentials, the server returned the 2FA / SSO one-time code in a custom HTTP response header (instead of via a side channel like SMS or an authenticator app). Headers are visible to DevTools → Network and to Burp's HTTP history, so the attacker just reads the header value and replays it. Secrets must travel over a separate authenticated channel.
> 11. They collapse the password search space to a small dictionary. If the user combines a pet name, a birthday, and a favourite number — all values often public on social media — the attacker enumerates the small Cartesian product and finds the password fast. Complexity policies are satisfied (numbers + letters + symbols) but the actual entropy is tiny.
> 12. 7 hex chars = 28 bits of entropy → 16^7 ≈ 268 million possibilities. A laptop computes hundreds of millions of MD5s per second; the entire space falls in seconds. Truncating any cryptographic primitive destroys its security margin — SHA-256 truncated to 28 bits would be equally weak. Hash output length must be preserved.
> 13. Rootkits hook, overwrite, or substitute the system calls and data structures user-space tools rely on. `ls`, `ps`, `cat` may all return filtered results. The kernel-backed `/proc` view often shows what the user-space view hides. Analysts cross-check independent views — never trust one output from a possibly compromised system.
> 14. Server-side access control was never enforced — the article body was delivered to the browser and the paywall is just an overlay/CSS rule. If the data reaches the client, it is the client's to inspect. DevTools → Elements removes the overlay; the content is already in the DOM.
> 15. A served `.git/` directory exposes full repository history: commits "removed" from working files still exist in earlier commits, including accidentally-committed credentials, config, deployment secrets, internal URLs. **git-dumper** reconstructs the repo from an exposed `.git/` URL; `git log --all` and `git grep` then mine the history.
> 16. CSRF tokens defend against **cross-origin** forgery — they prevent an attacker.com page from forging an authenticated request to victim.com because attacker.com cannot read the token. **XSS** runs in victim.com's origin (same-origin as the page), so the injected script can read the CSRF token directly from the DOM (e.g., `document.querySelector('meta[name=csrf]').content`) and include it in the forged request. XSS therefore subsumes CSRF — once you have XSS, CSRF tokens cannot stop you.
