---
tags:
  - university
  - bcs2420
  - computer-security
---

# Mixed Content, document.domain, and Cookie Scope Across Subdomains

> [!abstract] Why this note matters
> - Tutorial L6 and its solution material include mixed content, SOP relaxation via `document.domain`, and cookie subdomain scoping.
> - These browser-scope details were present in the source archive but missing as first-class notes.

## Overview

Some web failures happen because a site weakens its own browser-side trust boundaries. Mixed content, broad cookie scoping, and SOP relaxation are all examples where a secure-looking page can become less secure because a lower-level rule is widened.

The exam relevance is that these are precise browser-behavior questions. They reward exact reasoning about what the browser considers same-origin, what HTTPS really protects, and which hosts get access to the same session state.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **mixed content**: An HTTPS page that loads some dependent resource over insecure HTTP.
- **document.domain**: A browser mechanism that can relax SOP between related subdomains by aligning them to a shared parent domain.
- **cookie domain scope**: The set of hosts or subdomains to which a cookie is sent or exposed based on its `Domain` attribute.
- **subdomain trust boundary**: The security boundary created by deciding whether multiple subdomains should share browser trust or cookie scope.

## Detailed Explanation

Mixed content is dangerous because HTTPS only protects the page as long as its dependent resources are also protected. If a script or other active resource loads over HTTP, an attacker who can tamper with that insecure path can undermine the secure page's integrity.

The `document.domain` property exists to let related subdomains opt into a shared parent-domain view. That can solve some legacy coordination problems, but it widens the trust boundary. If one participating subdomain is weaker, the relaxation can create a security path between pages that would otherwise remain isolated by SOP.

Cookie domain scope creates a similar tradeoff. A cookie scoped to `.example.com` can reach multiple subdomains. That may be convenient operationally, but it also means a weak or compromised subdomain can become a stepping stone into the same session space.

## How It Works

HTTPS page + HTTP subresource -> attacker can tamper with the insecure dependency and undermine the secure page.

SOP normally checks scheme, host, and port; `document.domain` can intentionally relax the host part between related subdomains.

A broad cookie domain expands the set of hosts that receive or can potentially misuse the cookie.

## What You Must Know

- Why mixed content is dangerous.
- What `document.domain` does at a high level.
- Why broad cookie scope across subdomains can be risky.

## 30-Second Oral Answer

- A page is only as trustworthy as the weakest resource it loads, so mixed content can break HTTPS integrity.
- Relaxing origin or cookie scope broadens the trust boundary and increases the impact of one weak subdomain.

## Typical Exam Questions

- Why is mixed content dangerous on an HTTPS page?
- What does `document.domain` do?
- What are the risks of setting a cookie for `.example.com`?

## Common Pitfalls

- Assuming the main page being HTTPS protects insecure subresources automatically.
- Assuming all subdomains are equally trustworthy just because they share a parent domain.

## Concrete Examples and Commands

### Cookie scoping example

```http
Set-Cookie: sid=abc123; Domain=.example.com; Path=/; Secure; HttpOnly
```

This makes the cookie available more broadly than an exact-host cookie. That may be intentional, but it also widens the consequences of one weak subdomain.

## Related Concepts

- [[Web Architecture, HTTP, Cookies, and the Browser Security Model|Web Architecture, HTTP, Cookies, and the Browser Security Model]]
- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial L6.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L6.pdf)
- [Tutorial L6 Solution..pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L6 Solution..pdf)
