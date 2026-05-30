---
tags:
  - university
  - bcs2420
  - computer-security
---

# Human Factors, Insider Threats, and Ethical Security Practice

> [!abstract] Why this note matters
> - The syllabus explicitly names human factors as a learning objective.
> - Tutorial prompts compare insiders and outsiders, and the labs repeatedly show how developer mistakes create exploitable conditions.

## Overview

Many security failures begin with people: weak password choices, oversharing on social media, developer secrets left in web files, administrators trusting compromised output, or users running suspicious attachments. The course does not treat these as side issues. They are core causes of compromise.

Human factors matter in both attack and defense. Attackers exploit trust, habits, and convenience. Defenders must design systems that are usable enough to be followed and strict enough to resist abuse.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **human factors**: The ways human behavior, mistakes, incentives, habits, and usability constraints affect security.
- **insider threat**: Risk originating from someone with legitimate access or trusted position inside the organization.
- **malicious insider**: An insider acting with intent to harm — for example, a disgruntled employee abusing credentials or exfiltrating data.
- **non-malicious employee**: An insider who causes harm *without intent* — typically security-unaware staff who fall for phishing, mis-share data, or skip secure procedures because the secure path is awkward.
- **outsider threat**: Risk from a person or system without legitimate internal access.
- **ethical use**: Using security tools and techniques only with authorization and for legitimate learning, defense, or testing.

## Detailed Explanation

Tutorial 1 asks you to compare insiders and outsiders. Outsiders may lack direct access, but insiders may already possess trust, credentials, or contextual knowledge. That can make insider threats especially dangerous, not because they are always more skilled, but because they start closer to valuable assets.

### Malicious insiders vs non-malicious employees

Lecture 1's named-adversary list distinguishes **malicious insiders** (including disgruntled employees) from **non-malicious employees** (often security-unaware) as *two separate categories*. The distinction matters for both reasoning and defense:

- A **malicious insider** has intent. The defense is detection-oriented: least privilege, separation of duties, monitoring, auditing, and quick revocation when behavior changes.
- A **non-malicious employee** has no intent to harm but causes harm through error — clicking a phishing link, mis-sharing a document, plugging in a USB. The defense is *design-oriented*: safer defaults, simpler secure workflows, mandatory training, phishing-resistant authentication, removing rights that they do not need so that mistakes cannot escalate.

Both are insiders, but a single control set rarely covers both. A monitoring rule that flags suspicious data movement will catch a malicious insider's exfiltration; it will not stop a security-unaware employee from emailing a sensitive spreadsheet to the wrong address in the first place.

Tutorial 3 and Lab 2 show the same theme from another angle. A user may reveal personal details that make their password predictable. A developer may leave hidden data or a secret header in a client-visible place. These are human failures that become technical vulnerabilities — most often the *non-malicious* variety.

Ethics matters because the course uses real security tools and attacker-style reasoning. The syllabus is explicit: only test systems you own or have explicit permission to test. In security, being technically capable and being authorized are different questions.

Usability is part of the same story. If a system makes the secure path confusing, expensive, or irritating, users and administrators often route around it. That is why human factors are not only about careless users; they are also about how system design encourages or discourages secure behavior.

## How It Works

Insider risk is often addressed through least privilege, auditing, separation of duties, and monitoring rather than by assuming trust forever.

Human-factor risk is reduced by better defaults, simpler secure workflows, clearer training, and minimizing the amount of sensitive information exposed to users or developers unnecessarily.

Ethical use means following scope boundaries in labs and professional work. The same techniques can be legal or illegal depending on authorization.

## What You Must Know

- Why human behavior can create or amplify technical vulnerabilities.
- The difference between insider and outsider threats.
- The distinction between **malicious insiders** and **non-malicious employees** — Lecture 1 lists them as separate adversary groups, and each calls for a different defensive style (detection vs design).
- Why ethical and legal scope matters when using security tools.

## 30-Second Oral Answer

- Security fails when people, processes, and technical controls do not support each other.
- Insiders can be especially risky because they begin with trust or access.
- Security tools must be used within explicit authorization boundaries.

## Typical Exam Questions

- Why are human factors important in security?
- Why might insider threats be more dangerous than outsider threats?
- What does ethical use of security tools mean in this course?

## Common Pitfalls

- Treating human issues as separate from technical security.
- Assuming insider threats are only malicious rather than also accidental — Lecture 1's list explicitly separates malicious insiders from non-malicious employees.
- Picking a single defensive strategy (monitoring *or* training) and expecting it to cover both categories.
## Related Concepts

- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 01 — Introduction and Security Fundamentals.pdf](../Materials/01 Lectures/Lecture 01 — Introduction and Security Fundamentals.pdf)
- [Tutorial 1.pdf](../Materials/02 Tutorials/Tutorial 1.pdf)
- [Tutorial 1 Solution.pdf](../Materials/02 Tutorials/Tutorial 1 Solution.pdf)
