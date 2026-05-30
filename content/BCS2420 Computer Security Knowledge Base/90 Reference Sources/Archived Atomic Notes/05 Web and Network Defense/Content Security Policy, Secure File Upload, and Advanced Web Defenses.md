---
tags:
  - university
  - bcs2420
  - computer-security
---

# Content Security Policy, Secure File Upload, and Advanced Web Defenses

> [!abstract] Why this note matters
> - Tutorial L6 Part B Q7 asks about CSP directives and how they mitigate XSS.
> - Tutorial L6 Part B Q10 asks for a secure file-upload checklist — three or more distinct measures.
> - These are short-answer questions that require precise, enumerable answers.

## Overview

CSP and file-upload security are server-side controls that complement the client-side browser security model. CSP restricts which resources a page may load and execute, dramatically reducing the attack surface for XSS. Secure file upload design prevents attackers from using upload functionality as a code execution vector.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **Content Security Policy (CSP)**: An HTTP response header that instructs the browser to restrict which sources of scripts, styles, images, and other content are considered trusted for that page.
- **default-src**: A CSP directive that serves as a fallback for all content types not explicitly specified.
- **script-src**: A CSP directive that specifies trusted sources of JavaScript.
- **nonce**: A random per-request value included in a CSP header and in inline `<script>` tags; the browser only executes scripts whose nonce matches.
- **MIME type**: A label (e.g., `image/jpeg`, `text/html`) that describes a file's content type, used by browsers to decide how to render it.
- **webroot**: The directory on the server from which files are directly served by the web server; files stored here are accessible via HTTP URLs.

## Detailed Explanation

### Content Security Policy (CSP)

CSP is delivered as an HTTP header:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123'
```

The browser reads this and enforces the rules on the page. Any resource or script that violates the policy is blocked.

**Key directives:**

| Directive | Controls |
|-----------|----------|
| `default-src` | Fallback for all content types not listed separately |
| `script-src` | JavaScript sources; can require `'self'`, specific URLs, or nonces |
| `style-src` | CSS sources |
| `img-src` | Image sources |
| `connect-src` | AJAX/fetch/WebSocket targets |
| `frame-src` | Allowed iframe sources |
| `report-uri` | URL to send CSP violation reports to |

**How CSP mitigates XSS:**

- `script-src 'self'` blocks inline scripts and external scripts from unauthorized origins. Even if an attacker injects `<script>alert(1)</script>`, the browser refuses to run it.
- `script-src 'nonce-xyz'` means only `<script nonce="xyz">` tags execute. Since the attacker cannot know the nonce (it changes per request), their injected scripts are blocked even if the HTML is injected.
- `default-src 'none'` followed by explicit allowlists creates a tight, minimal attack surface.

**Limitations:**
- CSP does not prevent XSS injection into the HTML — it prevents execution of the injected script.
- Overly permissive policies (e.g., `unsafe-inline`, wildcards) negate the benefits.
- CSP errors can break legitimate functionality if not tested carefully.

### Secure File Upload Design

File upload functionality is a common attack vector. Attackers may upload PHP, HTML, or other executable files and then trigger their execution via a URL.

**Minimum checklist of defenses (the exam expects at least three):**

1. **Validate file type using MIME type and extension**: Accept only known-safe types (e.g., `image/jpeg`, `image/png`). Do not trust the Content-Type the browser sends — verify server-side using file-type detection libraries.

2. **Rename the uploaded file on the server**: Replace the user-supplied filename with a randomly generated server-side name. This prevents attackers from predicting the URL of their uploaded file and prevents path traversal via specially crafted names (`../../etc/passwd`).

3. **Store files outside the webroot**: Files stored in a directory not directly served by the web server cannot be executed via HTTP URL. Serve files through a controlled download handler that reads from the private storage location.

4. **Serve files with correct Content-Type headers**: When serving files, set `Content-Type: image/jpeg` explicitly rather than letting the browser sniff the type. This prevents the browser from treating an HTML file disguised as a JPEG as executable HTML.

5. **Scan for malicious content**: Run uploaded files through antivirus or image-sanitization libraries. For images, strip EXIF metadata and re-encode the image to remove embedded payloads.

6. **Enforce size limits**: Large uploads can cause DoS. Set maximum file size constraints.

## How It Works

CSP → HTTP header → browser enforces resource restrictions → blocked scripts do not execute even if injected.

Secure upload → validate type → rename → store outside webroot → serve through handler → correct headers → scan.

## What You Must Know

- What `default-src`, `script-src`, and nonces do in CSP.
- How CSP reduces XSS attack surface (blocks execution, not just injection).
- At least three distinct secure file-upload measures and why each matters.
- Why storing files in the webroot is dangerous.

## 30-Second Oral Answer

- CSP tells the browser which script sources are trusted; `script-src 'self'` blocks third-party scripts; nonces block inline injections even when HTML is compromised.
- Secure file upload requires validating MIME type, renaming the file server-side, storing outside the webroot, and controlling Content-Type on download.
- CSP mitigates but does not eliminate XSS — it prevents the injected script from executing, not the injection itself.

## Typical Exam Questions

- Outline how a CSP can mitigate XSS attacks. Name two specific directives and explain their effect.
- What steps should a server take to ensure uploaded files cannot be executed as scripts?
- How does a CSP nonce work and why is it effective against inline script injection?

## Common Pitfalls

- **CSP does not prevent injection.** It prevents the browser from EXECUTING injected scripts. Injection itself is still possible — an attacker can still insert `<script>...</script>` into the HTML. CSP just makes the injected script harmless if it violates the policy (no matching nonce, disallowed origin, etc.). The HTML may still contain attacker-controlled content; what changes is that the browser refuses to run it.
- Forgetting that trusting the browser-supplied MIME type is insecure — always validate server-side.
- Saying "only allow images" without specifying how that validation is performed (extension is not enough; MIME sniffing and content inspection are needed).

## Concrete Examples and Commands

### CSP header examples

```http
# Allow scripts only from same origin
Content-Security-Policy: script-src 'self'

# Allow scripts with a specific nonce only
Content-Security-Policy: script-src 'nonce-rAnd0mV4lu3'

# Maximum restriction starting point
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'
```

### Script blocked by CSP nonce

```html
<!-- Legitimate script (nonce matches) -->
<script nonce="rAnd0mV4lu3">doLegitimateWork();</script>

<!-- Attacker-injected script (no nonce) — browser blocks it -->
<script>stealCookies();</script>
```

### Secure file upload flow

```text
1. User uploads "profile.php" pretending to be an image.
2. Server validates: Content-Type = image/jpeg? → read file magic bytes → not a JPEG → reject.
3. If valid image: rename to "a3f8c2b1.jpg", store at /var/app/uploads/ (outside webroot).
4. When user requests the file: handler reads /var/app/uploads/a3f8c2b1.jpg,
   sends response with Content-Type: image/jpeg header.
5. Browser treats file as image, not HTML. Embedded PHP is never executed.
```

## Related Concepts

- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]
- [[Web Architecture, HTTP, Cookies, and the Browser Security Model|Web Architecture, HTTP, Cookies, and the Browser Security Model]]
- [[University/BCS2420 Computer Security Knowledge Base/05 Web and Network Defense/Mixed Content, document.domain, and Cookie Scope Across Subdomains|Mixed Content, document.domain, and Cookie Scope Across Subdomains]]

## Sources

- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial L6.pdf](100 Extra Materials/Tutorial L6.pdf)
- [Tutorial L6 Solution..pdf](100 Extra Materials/Tutorial L6 Solution..pdf)
- [Lecture 6.pdf](100 Extra Materials/Lecture 6.pdf)
