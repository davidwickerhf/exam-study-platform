---
tags:
  - university
  - bcs2420
  - computer-security
---

# Web Architecture, HTTP, Cookies, and the Browser Security Model

> [!abstract] Why this note matters
> - Lecture 06, Tutorial L6, and Lab 4 all depend on basic browser and web architecture knowledge.
> - Many web vulnerabilities in the course only make sense if you understand what the browser is doing.

## Overview

Web security starts with understanding what a browser actually receives and executes. The server sends HTML, scripts, cookies, and other resources. The browser parses them, builds the DOM, runs scripts, and automatically attaches certain state like cookies to later requests.

Lecture 06 frames this clearly: the browser is not just displaying content. It is an execution environment. That is why the DOM, script loading order, cookie scope, and origin rules are all security-relevant.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **origin**: The triple of scheme, host, and port used by the browser security model.
- **DOM**: The Document Object Model; the browser's object representation of the page and its structure.
- **cookie**: A value stored by the browser and sent with requests under defined scope rules.
- **Same-Origin Policy**: A browser rule that restricts how scripts from one origin interact with data from another origin.

## Detailed Explanation

A URL identifies location and can include scheme, host, port, path, and query. That matters because the Same-Origin Policy compares scheme, host, and port. Two pages that share a top-level domain but differ in host or port are not automatically same-origin.

Cookies are central because HTTP is stateless, yet authenticated sessions need continuity. The browser therefore stores and reattaches cookies under specific rules. This convenience is what enables session management and also what makes CSRF possible.

The DOM matters because scripts can inspect or modify the current page dynamically. Lab 4 leans on this: if the content is in the client-side page structure, DevTools can often reveal or manipulate it because the browser already has it.

The lecture's script-loading discussion is security-relevant too. Inline scripts, external scripts, event handlers, and `javascript:` URLs are all execution paths. Any place untrusted data reaches these execution contexts can become an attack surface.

The deeper lesson is that browser security is a boundary system. Origin, cookies, transport, and document execution each draw part of the boundary. Later web attacks work by exploiting a mismatch between where developers think the boundary is and where the browser actually enforces it.

## How It Works

Browser loads document -> parses HTML -> builds DOM -> executes scripts as encountered or when events fire.

Cookies are attached automatically to matching requests according to domain/path/scheme rules.

SOP checks scheme + host + port, not merely top-level domain similarity.

## What You Must Know

- Basic URL structure and browser-loading model.
- What the DOM is and why DevTools can inspect it.
- How cookies relate to sessions and later attacks such as CSRF or cookie theft.
- How SOP defines origin.

## 30-Second Oral Answer

- Web security starts with understanding that the browser receives the page, builds the DOM, runs scripts, and automatically manages cookies.
- SOP compares scheme, host, and port, and cookies create state on top of stateless HTTP.

## Typical Exam Questions

- What is the Same-Origin Policy?
- Why are cookies critical to web authentication?
- Why can DevTools reveal hidden or client-side paywalled content?

## Common Pitfalls

- Thinking sharing `.com` makes two pages same-origin.
- Forgetting that if the browser can render it, the client already received it.

## Concrete Examples and Commands

### URL structure reminder

```text
scheme://host[:port]/path?query
https://bank.example.com:8443/account?view=summary
```

### Cookie flags in HTTP

```http
Set-Cookie: sessionid=abc123; HttpOnly; Secure; SameSite=Lax
```

These flags influence theft risk, transport requirements, and some cross-site request behavior.

## Related Concepts

- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]
- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 06.pdf](/Users/davidwickerhf/Downloads/Computer Security/Lecture 06.pdf)
- [Tutorial L6.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L6.pdf)
- [Tutorial L6 Solution..pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L6 Solution..pdf)
- [lab4.pdf](/Users/davidwickerhf/Downloads/Computer Security/lab4.pdf)
