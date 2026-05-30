---
tags:
  - university
  - bcs2420
  - computer-security
---

# Authentication, Identification, and Authorization

> [!abstract] Why this note matters
> - Lecture 4 opens with the entity-authentication framing (Lecture 3 covers *user* authentication methods like passwords and biometrics; Lecture 4 introduces the formal entity-authentication setting and the claimant/verifier roles).
> - The distinction between authentication, identification, and authorization is fundamental and easy to confuse in exam answers.

## Overview

Authentication answers 'are you who you claim to be?'. Identification answers 'who are you?'. Authorization answers 'what are you allowed to do?'. The course expects these terms to be used precisely.

This matters because many systems confuse them. Verifying that someone knows a password authenticates knowledge of the password, but it does not itself prove broader legitimacy or define permissions.

## Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **authentication**: A one-to-one test that verifies a claimed identity.
- **identification**: A one-to-many process that establishes identity from available evidence without a prior claimed identity.
- **authorization**: The decision about what an authenticated entity is allowed to do.

## Detailed Explanation

Lecture 4 frames entity authentication as a claimant-verifier exchange: the claimant asserts an identity and presents evidence (typically knowledge of a shared secret), and the verifier decides whether to accept. A correct password does not prove the typist is the intended human, only that the presented secret matched what the system expected. That is enough for authentication in many systems, but it is important to state the limitation clearly.

Identification is different because the system is matching an unknown person or signal against many possibilities. Biometric systems often perform identification when searching a population, but perform authentication when verifying one claimed identity.

Authorization always comes after or alongside identity establishment. A user might authenticate successfully and still not be authorized to install software, access admin pages, or read particular data.

This distinction becomes especially important when systems mix multiple steps together. A login form usually authenticates a claimed identity and then triggers authorization checks on resources. A biometric search across many candidates is doing identification first, not authorization. Separating these stages makes later security reasoning much clearer.

The course also implicitly teaches that strong authentication is not the same as strong authorization. A user may be correctly authenticated and still receive too many privileges because the authorization model is weak. That is why exam answers should treat these as related but separate questions.

This distinction also helps with attack analysis. Credential theft primarily targets authentication. Privilege escalation targets authorization. Population-wide biometric search is an identification problem. Using the right label makes later explanations of attacks and defenses much more precise.

## How It Works

Use authentication when the user claims an identity, such as with a username.

Use identification when the system must decide which identity matches observed data.

Use authorization to reason about privileges and access after identity handling is complete.

Think of the workflow as: establish or verify identity first, then decide what that identity may do.

## What You Must Know

- The precise difference between authentication, identification, and authorization.
- That knowing a password proves knowledge of the password, not necessarily legitimate personhood.

## 30-Second Oral Answer

- Authentication verifies a claimed identity, identification discovers identity, and authorization assigns permissions.
- Systems often combine them, but they are not the same operation.

## Typical Exam Questions

- What is the difference between authentication and identification?
- What role does authorization play after authentication?

## Common Pitfalls

- Using authentication and authorization interchangeably.
- Saying a correct password proves the human user is definitely the legitimate owner.
## Related Concepts

- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[OTPs, Tokens, Biometrics, and Derived Passwords|OTPs, Tokens, Biometrics, and Derived Passwords]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 04 — Authentication and Key Establishment.pdf](../Materials/01 Lectures/Lecture 04 — Authentication and Key Establishment.pdf)
- [Lecture 03 — User Authentication Methods.pdf](../Materials/01 Lectures/Lecture 03 — User Authentication Methods.pdf)
