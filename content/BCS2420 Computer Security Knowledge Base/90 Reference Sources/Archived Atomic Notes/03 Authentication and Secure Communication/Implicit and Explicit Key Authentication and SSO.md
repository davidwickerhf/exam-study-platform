---
tags:
  - university
  - bcs2420
  - computer-security
---

# Implicit and Explicit Key Authentication and SSO

> [!abstract] Why this note matters
> - Tutorial 4 Part A Q7 directly tests the distinction between implicit and explicit key authentication.
> - SSO threats appear in Tutorial 4 Part B Q7 and are a self-contained exam topic.

## Overview

After a key exchange, a protocol may or may not confirm that both parties actually hold the correct shared key. This confirmation question defines the difference between implicit and explicit key authentication. SSO (Single Sign-On) brings in a separate but related concern: centralising authentication convenience also centralises risk.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **implicit key authentication**: Lecture 4's phrasing: "key access scope is narrowed but not confirmed." After the protocol run, one party is assured that only the intended party could possibly hold the derived key, but neither party has yet confirmed that they actually computed it correctly.
- **explicit key authentication**: A property where one party receives confirmed proof (via a message) that the other party has successfully derived and holds the correct key.
- **key confirmation**: A message or protocol step that proves the other party computed the correct shared key, typically by sending a MAC or hash of the key over the session.
- **SSO (Single Sign-On)**: An authentication scheme where one authentication event at a central provider grants access to multiple services.
- **identity provider (IdP)**: The central authority in an SSO system that authenticates the user and issues tokens to service providers.

## Detailed Explanation

### Implicit vs Explicit Key Authentication

After a Diffie-Hellman exchange, if the protocol is authenticated (e.g., shares are signed), then both parties know the key was computed with the right entity. This is **implicit key authentication** — Lecture 4 puts it precisely: "key access scope is narrowed but not confirmed." Only the intended party *could* have derived the same key, but neither side has yet explicitly verified the other *did*.

**Explicit key authentication** adds a confirmation step: one or both parties sends a message that can only be produced by someone who knows the shared key (e.g., a MAC over a known value keyed with the session key). This proves the key was actually computed correctly, not just potentially computable.

The difference matters in practice:
- With implicit authentication only: if there is a subtle protocol flaw, one party might derive a different key from the other without the flaw being detected.
- With explicit authentication: any key mismatch is immediately visible because the confirmation message will fail to verify.

Many real protocols (e.g., TLS 1.3, station-to-station protocol) include key confirmation steps to achieve explicit authentication.

### Single Sign-On (SSO)

SSO allows a user to authenticate once to a trusted identity provider and then access multiple services without re-authenticating. Lecture 4 names three SSO types:

1. **Credential Manager (CM)**: The user's device stores per-service credentials locally and auto-fills them on demand. The "single sign-on" experience comes from a master password or device unlock that releases the stored credentials. Browser password managers and OS keychains are examples. No central identity provider is involved.

2. **Enterprise SSO**: A central authentication service within one organisation issues tickets or tokens that internal applications accept. Kerberos in a Windows Active Directory domain is the canonical example. All trust is within the organisation.

3. **Federated identity**: Identity is asserted across *organisational* boundaries. A user authenticated by an identity provider in one domain can be granted access by a service provider in another domain on the strength of a signed assertion. Standards in this category include **SAML** (XML-based assertions, common in enterprise federations), **OAuth** (delegation of access, foundational to API authorisation), and **OpenID Connect** (an identity layer built on top of OAuth 2.0).

**Security risks of SSO:**

1. **Provider compromise**: If the IdP is compromised, every connected service is compromised simultaneously. SSO creates a single point of failure for authentication across the entire ecosystem.

2. **Token replay and forgery**: SSO systems issue tokens (e.g., SAML assertions, JWT tokens). If an attacker can steal, replay, or forge a token, they can impersonate a user across all services that trust that token.

3. **Token lifetime abuse**: Tokens with long lifetimes give attackers a large replay window.

**Mitigations:**

- Harden the IdP with MFA, monitoring, and strict access controls — it is the most critical component.
- Sign tokens cryptographically and verify signatures at each service provider.
- Use short token lifetimes with refresh mechanisms.
- Validate the token's `audience` claim at each service to prevent token reuse across services.
- Monitor for anomalous login patterns (simultaneous logins from different geolocations, etc.).

## How It Works

Implicit key auth → only the correct party *could* compute the key → no confirmation message sent.

Explicit key auth → a confirmation message proves the correct party *did* compute the key → detected immediately if wrong.

SSO → one IdP authentication → token issued → each service validates token against IdP public key or shared secret.

SSO token replay → steal/intercept token → present to service → accepted if not expired or bound to context.

## What You Must Know

- Precise distinction: implicit = assurance of *possible* key sharing ("key access scope is narrowed but not confirmed"); explicit = confirmation of *actual* key holding via a key-use confirmation message.
- Why explicit key authentication is stronger and what the confirmation step looks like.
- The three SSO types from Lecture 4: **Credential Manager**, **Enterprise SSO**, **Federated identity** (with SAML, OAuth, OpenID Connect as the named federated standards).
- Two main SSO threats: IdP compromise and token replay/forgery.
- Two mitigations for each SSO risk.

## 30-Second Oral Answer

- Implicit key authentication assures only the correct party *could* hold the key; explicit authentication additionally confirms they *do*, via a confirmation message.
- SSO is convenient but concentrates risk: compromise of the IdP or token forgery affects all services simultaneously.
- Mitigations: harden the IdP, sign tokens, keep lifetimes short, validate audience claims.

## Typical Exam Questions

- What is the difference between implicit and explicit key authentication?
- Why is explicit key confirmation stronger than implicit authentication alone?
- Name two significant security risks of SSO and explain a mitigation for each.

## Common Pitfalls

- Confusing implicit/explicit key authentication with key transport vs key agreement — they are orthogonal properties.
- Thinking implicit authentication is "no authentication" — it still ensures the correct party is the only one that could have the key.
- Treating SSO as purely a usability feature without appreciating the concentrated risk.

## Concrete Examples and Commands

### Key confirmation in practice

```text
After DH key exchange and mutual authentication:

Alice → Bob: MAC_K(label || nonce_A || nonce_B)
Bob  → Alice: MAC_K(label || nonce_B || nonce_A)

If Bob receives the correct MAC, he confirms Alice computed K correctly.
If there was any protocol manipulation, the MAC fails → explicit auth detected the problem.
```

### SSO token flow

```text
1. User authenticates to IdP (username + MFA).
2. IdP issues signed token: {user: alice, audience: serviceA, exp: +1h, sig: IdP_private_key}
3. User presents token to Service A.
4. Service A verifies signature with IdP public key, checks audience = "serviceA", checks exp.
5. If attacker intercepts token and presents to Service B:
   → audience claim fails ("serviceA" ≠ "serviceB") → rejected.
```

## Related Concepts

- [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]]
- [[Protocols for Secure Communication Nonces, Replay, Reflection, and Relay|Protocols for Secure Communication: Nonces, Replay, Reflection, and Relay]]
- [[Authentication, Identification, and Authorization|Authentication, Identification, and Authorization]]

## Sources

- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial 4.pdf](../Materials/02 Tutorials/Tutorial 4.pdf)
- [Tutorial 4 Solution.pdf](../Materials/02 Tutorials/Tutorial 4 Solution.pdf)
- [Lecture 04 — Authentication and Key Establishment.pdf](../Materials/01 Lectures/Lecture 04 — Authentication and Key Establishment.pdf)
