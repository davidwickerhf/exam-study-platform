# Topic 03 — Authentication and Secure Communication

**Primary source coverage:** Lecture 03; Lecture 04 + Legend; Tutorials 3–4; Sample Paper authentication/protocol questions.

This chapter covers how systems prove identity, protect credentials, and establish secure communication channels. The exam emphasis is on precise distinctions and on explaining how protocol attacks arise when freshness, key confirmation, or authentication is missing.

> [!important] How to study this chapter
> Read the chapter once for the map, then drill the definitions, contrasts, and worked examples. Most exam answers should follow: define the concept, state the mechanism, name the relevant attack or failure mode, and give the defense or trade-off.

## What the Exam Asks

- Authentication vs identification vs authorization; claimant/verifier model.
- Password storage: hashing, salt, pepper, stretching, online/offline guessing.
- OTP/tokens/biometrics and their failure modes.
- Replay/reflection/relay attacks, nonces, Diffie-Hellman, EKE, signed DH, SSO.

---

## Authentication, Identification, and Authorization

> [!abstract] Why this note matters
> - Lecture 4 opens with the entity-authentication framing (Lecture 3 covers *user* authentication methods like passwords and biometrics; Lecture 4 introduces the formal entity-authentication setting and the claimant/verifier roles).
> - The distinction between authentication, identification, and authorization is fundamental and easy to confuse in exam answers.

### Overview

Authentication answers 'are you who you claim to be?'. Identification answers 'who are you?'. Authorization answers 'what are you allowed to do?'. The course expects these terms to be used precisely.

This matters because many systems confuse them. Verifying that someone knows a password authenticates knowledge of the password, but it does not itself prove broader legitimacy or define permissions.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **authentication**: A one-to-one test that verifies a claimed identity.
- **identification**: A one-to-many process that establishes identity from available evidence without a prior claimed identity.
- **authorization**: The decision about what an authenticated entity is allowed to do.

### Detailed Explanation

Lecture 4 frames entity authentication as a claimant-verifier exchange: the claimant asserts an identity and presents evidence (typically knowledge of a shared secret), and the verifier decides whether to accept. A correct password does not prove the typist is the intended human, only that the presented secret matched what the system expected. That is enough for authentication in many systems, but it is important to state the limitation clearly.

Identification is different because the system is matching an unknown person or signal against many possibilities. Biometric systems often perform identification when searching a population, but perform authentication when verifying one claimed identity.

Authorization always comes after or alongside identity establishment. A user might authenticate successfully and still not be authorized to install software, access admin pages, or read particular data.

This distinction becomes especially important when systems mix multiple steps together. A login form usually authenticates a claimed identity and then triggers authorization checks on resources. A biometric search across many candidates is doing identification first, not authorization. Separating these stages makes later security reasoning much clearer.

The course also implicitly teaches that strong authentication is not the same as strong authorization. A user may be correctly authenticated and still receive too many privileges because the authorization model is weak. That is why exam answers should treat these as related but separate questions.

This distinction also helps with attack analysis. Credential theft primarily targets authentication. Privilege escalation targets authorization. Population-wide biometric search is an identification problem. Using the right label makes later explanations of attacks and defenses much more precise.

### How It Works

Use authentication when the user claims an identity, such as with a username.

Use identification when the system must decide which identity matches observed data.

Use authorization to reason about privileges and access after identity handling is complete.

Think of the workflow as: establish or verify identity first, then decide what that identity may do.

### What You Must Know

- The precise difference between authentication, identification, and authorization.
- That knowing a password proves knowledge of the password, not necessarily legitimate personhood.

### 30-Second Oral Answer

- Authentication verifies a claimed identity, identification discovers identity, and authorization assigns permissions.
- Systems often combine them, but they are not the same operation.

### Typical Exam Questions

- What is the difference between authentication and identification?
- What role does authorization play after authentication?

### Common Pitfalls

- Using authentication and authorization interchangeably.
- Saying a correct password proves the human user is definitely the legitimate owner.
### Related Concepts

- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[OTPs, Tokens, Biometrics, and Derived Passwords|OTPs, Tokens, Biometrics, and Derived Passwords]]

## Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks

> [!abstract] Why this note matters
> - Lecture 3 and Tutorial 3 are heavily centered on password security.
> - This topic directly supports labs and likely exam problem types.

### Overview

Password systems are central because they show the difference between storing secrets, storing evidence of secrets, and resisting attacks after a breach. The course expects you to understand both the storage side and the attack side.

A secure password system does not merely hash passwords. It uses salts to stop precomputed reuse, stretching to slow offline attacks, and operational controls like rate limiting to resist online guessing.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **salt**: A non-secret random value combined with a password before hashing to make identical passwords hash differently. Prevents reuse of precomputed tables (e.g. rainbow tables) across users.
- **pepper**: A secret extra value used with password hashing and not stored openly in the password database.
- **password stretching (key stretching)**: Making password verification intentionally expensive by iterating the hash or using a slow password-hashing scheme. Named algorithms in this category: **PBKDF2**, **bcrypt**, **scrypt**, **Argon2**.
- **rainbow table**: A precomputed table mapping common password guesses to their hash outputs, used to invert unsalted hashes in O(1) lookup after the precomputation cost.
- **offline attack**: An attack where the adversary tests password guesses locally without querying the legitimate server.
- **online attack**: An attack where guesses are submitted to the real authentication service.

### Detailed Explanation

Cleartext storage is catastrophic because stealing the file reveals every password immediately. Hash storage is better because the attacker must guess passwords and compare digests rather than reading secrets directly.

But unsalted hashes remain weak against precomputed dictionary attacks and **rainbow tables**. A rainbow table is built once (large up-front cost) and then used to invert any unsalted hash by lookup. Salts defeat this by making the same password hash differently for each user: with per-user salts, an attacker would need a separate rainbow table per salt value, which makes precomputation across users useless. Salts are stored in cleartext alongside the hash — their value comes from uniqueness, not secrecy.

**Key stretching** slows offline attacks by making each guess computationally expensive. Named stretching algorithms include **PBKDF2** (NIST-standardised, iterates a base hash), **bcrypt** (based on the Blowfish key schedule, configurable cost), **scrypt** (memory-hard, designed to resist GPU/ASIC parallelism), and **Argon2** (winner of the Password Hashing Competition, configurable for memory, time, and parallelism). Each guess might take 100 ms instead of 1 microsecond, cutting an attacker's guess rate by a factor of 100 000 or more.

Crucially, key stretching defends **only against offline guessing**. Online guessing is already rate-limited by the server (a few attempts per minute before lockout); per-guess slowness on the server side becomes a *self-DoS* — it slows legitimate logins as much as attacker requests, and the server bears the CPU cost. The threat model that justifies expensive password hashing is the post-breach scenario where the attacker has stolen the hash database and is running guesses locally.

Peppering adds another hurdle: even if the attacker gets the hash database, they may still lack the secret pepper value needed to reproduce the verification function.

Online attacks are different. The attacker must interact with the live server, so rate limiting, delays, and lockouts become useful. Those do not help much against offline attacks after a database leak, which is why both storage design and service-side controls matter.

### How It Works

Online attack -> defend with rate limits, lockouts, MFA, and monitoring.

Offline attack -> defend with salts, slow password hashing, strong passwords, and protecting the hash store.

Salt is stored and non-secret; pepper is secret and not left openly in the database.

### What You Must Know

- Why storing cleartext passwords is unacceptable.
- What salts, peppers, and stretching do, and why salts prevent reuse of precomputed rainbow tables across users.
- The named key-stretching algorithms: **PBKDF2**, **bcrypt**, **scrypt**, **Argon2**.
- That **key stretching defends only against offline guessing** — online guessing is rate-limited by the server, so per-guess slowness on the server is a self-DoS.
- The difference between online and offline guessing attacks.
- Why rate limiting mainly helps against online guessing, not offline database cracking.

### 30-Second Oral Answer

- Hashing alone is not enough; you need salts and slow verification to resist offline attacks well.
- Online and offline guessing are different threat models and need different defenses.
- A salt is public uniqueness; a pepper is hidden extra secrecy.

### Typical Exam Questions

- Why do salts prevent precomputed dictionary attacks?
- Why does password stretching help?
- What is the difference between online and offline password guessing?
- What side effect can rate limiting have on legitimate users?

### Common Pitfalls

- Saying salts are secret by definition.
- Claiming rate limiting prevents offline cracking after a database leak.
- Treating peppers as replacements for salts rather than as different tools.
### Worked Examples

#### Offline vs online contrast

If an attacker steals the password hash file, they can test guesses locally without server interaction. That is offline guessing.

If the attacker must submit guesses to the real login page and wait for success/failure responses, that is online guessing.

### Related Concepts

- [[Hash Functions, Collision Resistance, and Digital Signatures|Hash Functions, Collision Resistance, and Digital Signatures]]
- [[OTPs, Tokens, Biometrics, and Derived Passwords|OTPs, Tokens, Biometrics, and Derived Passwords]]
- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]

## OTPs, Tokens, Biometrics, and Derived Passwords

> [!abstract] Why this note matters
> - Tutorial 3 includes Lamport chains, hardware-token ideas, biometrics, peppers, and derived passwords.
> - These are classic compare-and-contrast topics for short-answer exam questions.

### Overview

Not every authentication system is a reusable password checked against a stored hash. The course also covers one-time passwords, hardware tokens, biometrics, and systems that derive site-specific credentials from a master secret.

These mechanisms solve different problems. One-time methods resist replay. Derived passwords reduce password reuse across sites. Biometrics trade usability against error rates and enrollment limits.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **Lamport hash chain**: A one-time password scheme based on repeatedly hashing a secret and verifying values in reverse order.
- **FAR**: False Accept Rate; how often an unauthorized biometric user is incorrectly accepted.
- **FTE**: Failure to Enroll; the rate at which legitimate users cannot be registered successfully.
- **derived password**: A site-specific password generated from a master password plus context such as a domain name.

### Detailed Explanation

Lamport hash chains show a core security idea: you can authenticate by revealing a value that is valid only once, while the server verifies it against a stored anchor or expected next value. That reduces replay risk compared with static secrets.

Hardware tokens that refresh codes over time are similar in spirit: the code is not a permanent password, but a value bound to time or a challenge. Tutorial 3 describes time-based code generators as implicit time-based challenge systems.

Derived-password systems try to stop password reuse without requiring the user to memorize and store a large number of unrelated passwords. They combine a master secret with site context to generate distinct passwords per domain.

Biometric systems introduce a different problem: matching is probabilistic. Tight thresholds reduce false accepts but increase false rejects. Failure to enroll shows that a system can be unusable for some legitimate users even before run-time matching begins.

### How It Works

Lamport chain verification works because hashing is one-way but easy in the forward direction.

A time-based token works because both sides know the time step and secret, so they can derive the same short-lived code.

Biometric systems must choose thresholds that balance FAR and FRR, and they can fail at the enrollment stage entirely.

### What You Must Know

- What Lamport chains, time-based tokens, and derived passwords are for.
- What FAR and FTE mean in biometric systems.
- Why threshold choice changes security/usability tradeoffs in biometrics.

### 30-Second Oral Answer

- OTPs reduce replay risk by making each accepted proof short-lived or one-time.
- Derived passwords reduce reuse by generating different passwords per site from one master secret.
- Biometrics are probabilistic systems with usability and error-rate tradeoffs.

### Typical Exam Questions

- What is the purpose of a Lamport hash chain?
- How does a time-based token work at a high level?
- How do threshold choices affect FAR and FRR?
- What problem do derived passwords try to solve?

### Common Pitfalls

- Treating biometrics as exact matching rather than threshold-based matching.
- Confusing FTE with FAR or FRR.
### Related Concepts

- [[Authentication, Identification, and Authorization|Authentication, Identification, and Authorization]]
- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]

## Graphical Passwords and Alternative Authentication Schemes

> [!abstract] Why this note matters
> - Tutorial 3 Part B Q8 asks to outline two types of graphical password schemes, their security advantages, and a drawback of each.
> - This is an extension of the authentication topic and may appear in short-answer form.

### Overview

Text passwords have well-known usability and security weaknesses. Graphical password schemes attempt to leverage visual and spatial memory, which humans typically handle better than arbitrary character strings. The course treats two main types and their respective attack surfaces.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **graphical password**: An authentication method where the user's credential is defined by interaction with visual material (clicking, drawing, selecting) rather than typing a text string.
- **cued recall**: A graphical password scheme where the user clicks on pre-selected points in an image in a correct sequence.
- **pure recall (pattern lock)**: A graphical password scheme where the user traces a path or pattern on a grid without any image cue.
- **shoulder surfing**: An attack where someone observes the user's input physically or via camera.
- **smudge attack**: An attack on touchscreen devices where the residue of finger swipes reveals the pattern drawn.

### Detailed Explanation

#### Type 1 — Cued Recall (Click-Based)

The user selects a set of click points on one or more images during registration. At login, the same image is presented and the user must click the correct points in sequence.

Example: PassPoints, Cued Click Points.

**Security advantage:**
- Images provide rich spatial cues, making it easier to remember complex or unique click sequences.
- The secret is tied to a spatial location, which is harder to dictionary-attack than a word-based password.
- Large theoretical password space if the image is high-resolution and click tolerance is tight.

**Drawback:**
- Shoulder surfing: an observer watching the screen or a camera recording the session can capture click positions.
- Click hotspots: users tend to click on salient features (faces, corners) of images, which reduces the effective password space and enables predictive attacks.

#### Type 2 — Pure Recall / Pattern Lock (Android-style)

The user traces a connected path through a grid of dots (e.g., 3×3 = 9 dots on Android) during registration. At login, the same path must be reproduced.

**Security advantage:**
- Fast to enter; users can reproduce complex paths quickly with practice.
- No text involved; harder to key-log in the traditional sense.

**Drawback:**
- **Smudge attacks**: the finger leaves grease traces on the touchscreen that can reveal the pattern even when the screen is off.
- **Predictable patterns**: studies show users overwhelmingly choose simple patterns (L-shapes, Z-shapes, short paths starting from corners), drastically reducing effective security despite a theoretically large space.

#### Comparison with Text Passwords

| Property | Text password | Graphical cued-recall | Pattern lock |
|----------|--------------|----------------------|--------------|
| Memory | Difficult for complex passwords | Easier (spatial cues) | Easier (motor memory) |
| Shoulder surfing | Low risk (keys not visible) | High risk | High risk (visible swipe) |
| Smudge attack | N/A | N/A | High risk |
| Dictionary attack | Yes | Hotspot attacks | Pattern prediction |
| Key logging | Yes | No | No |

### How It Works

Cued recall → image presented → user clicks correct sequence of pre-registered points → tolerance zone checked for each click.

Pattern lock → grid presented → user traces path → system checks correct nodes in correct order.

Both replace memorisation of arbitrary symbols with spatial or motor memory.

### What You Must Know

- Two distinct types: cued recall (click-based) and pure recall (pattern lock).
- One security advantage and one drawback for each.
- Why graphical passwords do not automatically solve the predictability problem.

### 30-Second Oral Answer

- Cued-recall graphical passwords use spatial image cues, reducing memorisation burden but creating shoulder-surfing risk and click-hotspot predictability.
- Pattern locks leverage motor memory but are vulnerable to smudge attacks and highly predictable because users choose simple patterns.
- Both types represent usability improvements over text passwords but introduce different attack surfaces that text passwords do not have.

### Typical Exam Questions

- Outline two types of graphical password schemes and their security advantages.
- What is a smudge attack and which authentication scheme does it target?
- Why do graphical passwords not solve the predictability problem despite offering a large theoretical space?

### Common Pitfalls

- Confusing cued recall (image-based click) with pure recall (pattern grid) — they are distinct schemes.
- Assuming graphical passwords are harder to crack — predictable usage patterns often reduce the effective password space significantly.
- Forgetting that shoulder-surfing is a higher risk for graphical schemes than for text entry because movements are visible.

### Related Concepts

- [[OTPs, Tokens, Biometrics, and Derived Passwords|OTPs, Tokens, Biometrics, and Derived Passwords]]
- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[Authentication, Identification, and Authorization|Authentication, Identification, and Authorization]]

## Protocols for Secure Communication: Nonces, Replay, Reflection, and Relay

> [!abstract] Why this note matters
> - Lecture 4 and Tutorial 4 center on these protocol attacks and defenses.
> - This is one of the most exam-likely reasoning areas because it mixes definitions with attack logic.

### Overview

Secure communication protocols are not only about confidentiality. They must also show freshness, resist message reuse, and often bind identity to session establishment.

The course repeatedly emphasizes that old valid messages may still be dangerous if the protocol cannot distinguish fresh runs from stale ones.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **nonce**: A random value used once to guarantee freshness.
- **timestamp**: A time value used to show that a message is recent.
- **sequence number**: An ordered counter used to detect duplicates or reordering.
- **Time-Variant Parameters (TVPs)**: Lecture 4's umbrella term for the family of freshness defenses (nonces + timestamps + sequence numbers). Any value that changes from run to run and can be bound into a protected message qualifies.
- **replay attack**: Reusing a previously captured message in a later protocol run.
- **reflection attack**: Replaying a captured message back to the originating party, exploiting symmetric mutual-authentication structures.
- **relay attack**: Forwarding messages in real time between distinct protocol runs, impersonating proximity or identity.
- **interleaving attack**: Weaving together messages from distinct *concurrent* protocol runs so that responses from one run satisfy challenges in another.
- **forward search attack**: Pre-computing candidate responses by feeding guesses into the protocol's one-way function and seeking output matches against captured traffic.
- **pre-capture attack**: Extracting one-time passwords (OTPs) or other one-shot credentials from a client by social engineering, before the legitimate use, then replaying them later.

### Detailed Explanation

Replay attacks work because many protocols would accept a valid-looking message again if they have no freshness check. If an attacker records one successful login response or challenge response and sends it later, the system may accept it unless it checks that the message belongs to the current session.

**Time-Variant Parameters (TVPs)** — the lecture's umbrella term covering nonces, timestamps, and sequence numbers — solve this by binding a response to the present run. A challenge-response message that includes the server's nonce proves not only knowledge of a secret but also that the response was constructed for this challenge. Each TVP defends against a slightly different threat model: nonces give random freshness, timestamps give absolute freshness (at the cost of clock synchronisation), sequence numbers give ordered freshness (cheap but stateful). Tutorial 4 Part A Q2 tests the ability to map these defenses against each attack type.

Reflection attacks occur when the adversary exploits symmetric protocol structure, sending a challenge or response back toward the originator to obtain a useful answer. Relay attacks are different: the attacker is a live messenger in the middle, passing protocol messages between genuine endpoints while impersonating one side.

#### Three further attack types from Lecture 4

Beyond the classic replay/reflection/relay trio, Lecture 4 explicitly names three more attack patterns:

- **Interleaving**: The attacker runs two (or more) protocol instances *in parallel* against the same victim, using the responses obtained in one run as inputs to challenges in the other. Where reflection bounces messages within a single run, interleaving weaves together messages from distinct concurrent runs. Defenses include binding session identifiers or role tags into every protected message so that a response built for run X cannot satisfy a challenge in run Y.

- **Forward search**: Conceptually similar to a dictionary attack, but framed as a *precomputation* attack against a known one-way function. The attacker enumerates plausible inputs (passwords, OTP seeds), feeds them through the hash or KDF, and stores the outputs. When real traffic is later captured, it is matched against the precomputed table. Defenses are exactly the standard offline-attack defenses: salts, slow hashes, large input spaces.

- **Pre-capture**: A social-engineering attack specifically against one-time-password systems. The attacker tricks the user into reading or typing an OTP *before* the user actually needs it (for example, by impersonating support staff and asking the user to "test" their authenticator). The captured OTP is then replayed by the attacker into the real authentication flow within the OTP's validity window. Because OTPs are valid exactly once and only briefly, the defense is operational rather than cryptographic: train users not to disclose OTPs, never use them outside the legitimate login flow, and shorten validity windows.

These distinctions matter because the defenses differ. Freshness checks (TVPs) stop replay and basic interleaving. Asymmetric protocol structure or explicit role binding helps with reflection and richer interleaving. Proximity and man-in-the-middle-resistant designs help with relay. Salts and slow hashing help with forward search. User training and short validity windows help with pre-capture.

### How It Works

No freshness mechanism -> old valid message may still be accepted.

Nonce-based design -> response must include the fresh challenge in a protected way.

Reflection -> attacker reuses a party's own behavior against it.

Relay -> attacker forwards messages in real time without necessarily understanding them.

### What You Must Know

- The roles of nonces, timestamps, and sequence numbers, all subsumed under the term **Time-Variant Parameters (TVPs)**.
- The difference between replay, reflection, relay, interleaving, forward search, and pre-capture attacks.
- Why sending a simple hash of a secret can still be replayed.
- That TVPs are the lecture's umbrella defense term against freshness-related attacks (tested in Tutorial 4 Part A Q2).

### 30-Second Oral Answer

- Freshness is essential in authentication protocols because a valid old message may still authenticate if the protocol cannot tell it is stale.
- Replay reuses old traffic, reflection abuses symmetric challenge structure, and relay forwards live traffic between legitimate endpoints.

### Typical Exam Questions

- How does a nonce help prevent replay?
- What is the difference between a reflection attack and a relay attack?
- Why is a simple `H(K)` proof insecure if reused across sessions?

### Common Pitfalls

- Using 'replay' for every protocol attack involving repeated messages.
- Forgetting that timestamps require reasonably synchronized clocks and freshness checking logic.
### Related Concepts

- [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]]
- [[Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs|Firewalls, DMZs, Proxy Firewalls, SSH Tunnels, and VPNs]]

## Protocol Notation and the EKE Message Flow

> [!abstract] Why this note matters
> - Lecture 4's protocol diagrams (EKE, DH-EKE, challenge-response, KDC) all use the same compact notation.
> - Tutorial 3 and Tutorial 4 solutions assume fluency with this notation. Without it, the symbolic message lines are unreadable.
> - The Lecture 4 Legend (4-page handout) explicitly defines every symbol used in EKE and DH-EKE.

### Overview

Cryptographic protocols are written as a sequence of message lines of the form `Sender -> Receiver : message`. The message itself uses a small fixed vocabulary of symbols for parties, keys, public values, and encryption operations. The Lecture 4 Legend collects this vocabulary in one place so EKE, DH-EKE, and related diagrams can be parsed unambiguously.

This note is a reference for that vocabulary and shows the two EKE flows in full.

### Exam Focus

- Tier 1 priority (prerequisite for any protocol-flow question).
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **A, B**: The communicating parties (Alice and Bob).
- **W**: The password-derived encryption key shared between A and B. Derived from the user password, used as a symmetric encryption key in EKE.
- **e_A**: A temporary public key generated by A for a single protocol run.
- **E_{e_A}(K)**: The session key K encrypted under the temporary public key e_A.
- **g^a, g^b**: Diffie-Hellman public values. `a` is A's secret exponent, `b` is B's secret exponent, `g` is the agreed generator.
- **K**: The shared session key derived from the protocol run (in DH-EKE, `K = g^(ab) mod p`).
- **T**: A test value used by A to demonstrate possession of K in the third EKE message.
- **`{X}_K`**: The message X encrypted under key K. Equivalent shorthand: `{X}K`.
- **`Sender -> Receiver : message`**: A single protocol message from Sender to Receiver carrying `message`.
- **`Sender <- Receiver : message`**: Same as above but reversed direction (the lecture sometimes writes the arrow this way to show that the next message comes back from B to A).

### Detailed Explanation

#### Reading a protocol line

`A -> B : A, {e_A}_W` means: Alice sends Bob two things, concatenated. First, her identity `A` in cleartext. Second, her temporary public key `e_A`, encrypted under the password-derived key `W`. The curly-brace notation `{X}_K` always means "X encrypted under K".

Encryption can nest. `{E_{e_A}(K)}_W` is the session key K, first encrypted under the temporary public key e_A, then the result encrypted again under W. To recover K, the recipient must decrypt the outer layer with W and then decrypt the inner layer with the private key matching e_A.

#### Why W (the password-derived key) matters

W is not the password itself. It is a symmetric key derived deterministically from the password — typically by a hash or key-derivation function. Both parties can recompute W from the shared password without transmitting it. EKE then uses W only to encrypt structures that contain no verifiable plaintext, which is why an offline dictionary attack on W cannot easily succeed.

#### Basic EKE — three messages

```text
1.  A -> B : A, {e_A}_W
2.  A <- B : {E_{e_A}(K)}_W
3.  A -> B : {T}_K
```

- Message 1: Alice sends her identity and her freshly generated temporary public key e_A, encrypted under W.
- Message 2: Bob picks the session key K, encrypts it under Alice's public key e_A (so only Alice can recover K), then encrypts the whole thing under W (so an attacker without the password sees only ciphertext).
- Message 3: Alice proves she successfully recovered K by encrypting a test value T under K and sending it back.

The security property the legend emphasises: an attacker who guesses a candidate W' cannot tell whether the guess is correct, because decrypting either message with W' just yields more pseudo-random ciphertext (e_A and {E_{e_A}(K)} both look random). Without K, there is no verifiable plaintext to test guesses against.

#### DH-EKE — three messages with forward secrecy

```text
1.  A -> B : A, {g^a}_W
2.  A <- B : {g^b}_W
3.  A and B compute K = g^(ab) mod p from the DH agreement
```

- Message 1: Alice sends her DH public value g^a, encrypted under W.
- Message 2: Bob sends his DH public value g^b, encrypted under W.
- Step 3: Both sides decrypt with W, then perform the standard Diffie-Hellman key derivation: Alice computes `(g^b)^a`, Bob computes `(g^a)^b`, both arrive at `K = g^(ab) mod p`.

Forward secrecy follows: the secret exponents `a` and `b` are ephemeral and discarded after the session. Even if W (or any long-term key) leaks later, the attacker still faces the Discrete Logarithm Problem to recover a or b from the recorded g^a and g^b.

### How It Works

`A -> B : A, {e_A}_W` -> Alice sends identity plus temporary public key encrypted under password-derived key.

`{E_{e_A}(K)}_W` -> nested encryption: first under e_A, then under W. Recipient peels W off first.

`{T}_K` -> Alice's confirmation that she successfully decrypted K.

`g^a`, `g^b` -> Diffie-Hellman public values; secret exponents `a`, `b` never leave the parties.

### What You Must Know

- The meaning of A, B, W, e_A, K, T, g^a, g^b.
- The three message lines of basic EKE and of DH-EKE.
- That `{X}_K` denotes encryption of X under key K, and that encryption can nest.
- Why DH-EKE provides forward secrecy and basic EKE does not.

### 30-Second Oral Answer

- The notation is a compact way to write "who sends what to whom, encrypted under which key".
- W is the password-derived symmetric key; e_A is a one-shot public key Alice generates; K is the session key; T is a test value proving Alice computed K correctly.
- Basic EKE is three messages: send {e_A}_W, receive {E_{e_A}(K)}_W, reply {T}_K.
- DH-EKE swaps the public-key part for Diffie-Hellman exponents g^a and g^b, giving forward secrecy.

### Typical Exam Questions

- Parse the line `A -> B : A, {e_A}_W`. What is sent and how is it protected?
- Why does the curly-brace nesting in `{E_{e_A}(K)}_W` matter?
- Write out the three messages of EKE and DH-EKE.
- Which symbol in DH-EKE makes forward secrecy possible, and why?

### Common Pitfalls

- Confusing W (the password-derived symmetric key) with the password itself, or with the session key K.
- Treating e_A as a session key rather than a temporary public key whose only purpose is wrapping K in message 2.
- Forgetting that T in message 3 of EKE is encrypted under K (not under W) — that is precisely how A proves she recovered K.
- Mixing the EKE arrows: message 2 comes back from B to A, even when written `A <- B`.

### Worked Examples

#### Decrypting message 2 of EKE step by step

Message 2 of basic EKE is `{E_{e_A}(K)}_W`. As the recipient, Alice does the following:

1. She knows W (derived from the password). She decrypts the outer layer with W. The result is `E_{e_A}(K)` — the session key K encrypted under her temporary public key e_A.
2. She knows the private key matching e_A (she generated e_A herself in message 1). She decrypts again to obtain K.

An eavesdropper who guesses a wrong password computes a wrong W'. Decrypting the outer layer with W' yields random-looking bytes that are not distinguishable from a valid `E_{e_A}(K)` — there is no verifiable plaintext to confirm or reject the guess.

#### DH-EKE concrete derivation

After messages 1 and 2 of DH-EKE, Alice has `g^b` (after decrypting with W) and her own secret `a`. She computes:

```text
K = (g^b)^a mod p = g^(ab) mod p
```

Bob, symmetrically, computes `(g^a)^b mod p = g^(ab) mod p`. Both arrive at the same K without ever transmitting K or a or b.

### Related Concepts

- [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]]
- [[Implicit and Explicit Key Authentication and SSO|Implicit and Explicit Key Authentication and SSO]]
- [[Protocols for Secure Communication Nonces, Replay, Reflection, and Relay|Protocols for Secure Communication: Nonces, Replay, Reflection, and Relay]]

## Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy

> [!abstract] Why this note matters
> - Lecture 4 and the lecture legend cover key establishment, EKE, DH-EKE, and forward secrecy directly.
> - Tutorial 4 asks about key transport vs key agreement, MITM on DH, and forward secrecy.

### Overview

Key establishment answers a practical question: if two parties want secure communication, how do they get a shared session key at all? Lecture 4 distinguishes two answers: one side can choose and send the key, or both sides can contribute to it.

The course then pushes the question further: what stops an attacker from sitting in the middle, and what happens if a long-term secret is compromised later?

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **key transport**: A protocol where one party chooses the session key and securely sends it to the other.
- **key agreement**: A protocol where the shared key is derived from contributions made by both parties.
- **session key**: A short-term key used for one communication session or limited context.
- **forward secrecy**: The property that compromise of long-term keys does not reveal past session keys.
- **EKE**: Encrypted Key Exchange; a password-based protocol that hides key-establishment messages under a password-derived secret.

### Detailed Explanation

Key transport means one side creates the session key and transmits it securely. Key agreement means neither side alone fully determines the shared key; instead, both contribute values from which the final key is derived. Diffie-Hellman is the course's main example of key agreement.

Plain unauthenticated Diffie-Hellman is vulnerable to man-in-the-middle attack because the parties do not know whose public values they received. An active attacker can establish one key with Alice and a different key with Bob and forward traffic between them.

That is why authenticated key establishment matters. Password-based approaches like EKE or DH-EKE attempt to combine password authentication with secure key establishment without revealing enough information to make brute-force attacks easy.

Forward secrecy is desirable because it limits retrospective damage. If long-term credentials leak in the future, recorded past sessions should still remain confidential. DH-EKE supports this better than designs that directly wrap a session key under a long-term secret without fresh independent key agreement.

<figure class="diag-figure">
  <figcaption>Unauthenticated DH vs signed ephemeral DH — the math gives secrecy from eavesdroppers, but signatures are what bind the public shares to identities</figcaption>
  <svg viewBox="0 0 860 350" class="diag-svg" role="img" aria-label="Diffie-Hellman man in the middle and signed Diffie-Hellman defense">
    <defs>
      <marker id="arr-dh-a" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-dh-d" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-dan"/>
      </marker>
      <marker id="arr-dh-g" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-acc"/>
      </marker>
    </defs>

    <rect x="30" y="62" width="120" height="54" class="d-node"/>
    <text x="90" y="84" text-anchor="middle" class="d-h-sm">Alice</text>
    <text x="90" y="104" text-anchor="middle" class="d-sub">sends g^a</text>

    <rect x="370" y="62" width="120" height="54" class="d-node-dan"/>
    <text x="430" y="84" text-anchor="middle" class="d-h-sm">MITM</text>
    <text x="430" y="104" text-anchor="middle" class="d-sub">substitutes shares</text>

    <rect x="710" y="62" width="120" height="54" class="d-node"/>
    <text x="770" y="84" text-anchor="middle" class="d-h-sm">Bob</text>
    <text x="770" y="104" text-anchor="middle" class="d-sub">sends g^b</text>

    <line x1="150" y1="89" x2="368" y2="89" class="d-edge-dan" marker-end="url(#arr-dh-d)"/>
    <line x1="490" y1="89" x2="708" y2="89" class="d-edge-dan" marker-end="url(#arr-dh-d)"/>
    <text x="260" y="74" text-anchor="middle" class="d-label-danger">g^a replaced by g^m</text>
    <text x="600" y="74" text-anchor="middle" class="d-label-danger">g^b replaced by g^n</text>
    <text x="430" y="145" text-anchor="middle" class="d-label-danger">two separate secrets: Alice-MITM and MITM-Bob</text>

    <rect x="30" y="224" width="170" height="62" class="d-node-acc"/>
    <text x="115" y="248" text-anchor="middle" class="d-h-sm">Alice</text>
    <text x="115" y="268" text-anchor="middle" class="d-sub">g^a, Sig_A(g^a)</text>

    <rect x="345" y="224" width="170" height="62" class="d-node"/>
    <text x="430" y="248" text-anchor="middle" class="d-h-sm">Network</text>
    <text x="430" y="268" text-anchor="middle" class="d-sub">shares may be observed</text>

    <rect x="660" y="224" width="170" height="62" class="d-node-acc"/>
    <text x="745" y="248" text-anchor="middle" class="d-h-sm">Bob</text>
    <text x="745" y="268" text-anchor="middle" class="d-sub">g^b, Sig_B(g^b)</text>

    <line x1="200" y1="255" x2="343" y2="255" class="d-edge-acc" marker-end="url(#arr-dh-g)"/>
    <line x1="515" y1="255" x2="658" y2="255" class="d-edge-acc" marker-end="url(#arr-dh-g)"/>
    <text x="430" y="318" text-anchor="middle" class="d-label-accent">substitution fails because the attacker cannot forge signatures over new DH shares</text>
  </svg>
</figure>

### How It Works

Key transport -> one side chooses the key and sends it securely.

Key agreement -> both sides contribute, so the shared key is a function of both contributions.

Unauthenticated DH -> vulnerable to MITM because public values are not authenticated.

Forward secrecy -> old session keys are not recoverable just because a long-term key later leaks.

### Diffie-Hellman: The Math

Diffie-Hellman lets two parties derive a shared secret by exchanging only public values. The construction rests on three public parameters and one hard problem.

#### Public parameters

- **Prime `p`**: A large prime modulus. All arithmetic in the protocol is done modulo `p`. The size of `p` (typically 2048 bits or more in modern use) controls the difficulty of the underlying hard problem.
- **Generator `g`**: A *primitive root modulo p*. This means the powers `g^1, g^2, g^3, ..., g^(p-1)` cycle through every nonzero residue mod p. The generator's job is to ensure that `g^a mod p` covers a large enough space that brute search is infeasible.

Both `p` and `g` are public — they are not secret. Alice and Bob agree on them in advance.

#### Exchange and shared key

Each party picks one private value:

- Alice picks secret `a`, computes and sends `g^a mod p`.
- Bob picks secret `b`, computes and sends `g^b mod p`.

Both then compute the same shared session key:

```text
K = (g^b)^a mod p = (g^a)^b mod p = g^(ab) mod p
```

The reason this works is that exponentiation in the multiplicative group mod p is commutative: `(g^b)^a` and `(g^a)^b` are both `g^(ab)`. So both sides arrive at the same K, without ever transmitting K itself, and without ever transmitting `a` or `b`.

#### Why an eavesdropper cannot recover K — the Discrete Logarithm Problem (DLP)

An eavesdropper Eve sees `g`, `p`, `g^a mod p`, and `g^b mod p`. To recover K = g^(ab) mod p, she would need to learn either `a` or `b`. That requires solving:

> Given `g^x mod p`, find `x`.

This is the **Discrete Logarithm Problem (DLP)**. For a suitably chosen `p` (large, and with no nice factorizations of `p-1`), DLP is believed to be computationally hard — no efficient classical algorithm is known. This is why DH is secure against a passive eavesdropper even though all transmitted values are public.

DLP is what makes the math of DH work: multiplication of exponents is easy in one direction (forward) and hard in the other (backward). Eve can verify `g^a` if you tell her `a`, but cannot find `a` from `g^a` alone in reasonable time.

### Signed Diffie-Hellman: Authenticity + Forward Secrecy

Plain Diffie-Hellman has no concept of *who* sent each public value. A man-in-the-middle attacker can intercept `g^a`, replace it with `g^a'`, and establish one session with Alice and another with Bob — neither party will notice. This is the classic MITM weakness of unauthenticated DH, and it is the scenario the 2025-03-21 exam (Part C, Q3) asks about: a developer implements Diffie-Hellman without authenticating the public shares.

The single countermeasure that preserves *both* forward secrecy and authenticity is to **sign each ephemeral Diffie-Hellman public value with the sender's long-term identity key** (or use certificates binding identity keys to identities). This is the construction underlying the Station-to-Station protocol and signed-DH variants used in modern TLS.

#### Why this defeats MITM (authenticity)

Each party transmits not just `g^a` (or `g^b`) but also a signature over that value, produced with their long-term identity signing key. Verifying the signature with the corresponding public key proves the public DH share originated with the legitimate party. A MITM cannot forge the signature without the long-term private key, so any substituted `g^a'` fails verification and the session is aborted. Authenticity of the exchanged DH shares blocks MITM at the source.

#### Why forward secrecy is preserved

Forward secrecy is the property that a *future* compromise of long-term keys does not let the attacker recover *past* session keys. The construction preserves this property because:

1. The DH exponents `a` and `b` are **ephemeral** — they are generated freshly for this one session and discarded immediately after K is derived.
2. The **long-term identity key** is used *only* to sign the ephemeral public values `g^a` and `g^b`. It is never used to encrypt anything.
3. The session key `K = g^(ab) mod p` is derived purely from the ephemeral DH agreement.

If, at some later date, the attacker compromises the long-term signing key, that key gives them the power to *forge signatures going forward* — they could impersonate the party in *future* sessions. But it gives them no help recovering past session keys K, because past K's were derived from past ephemeral `a` and `b` that no longer exist anywhere. To reconstruct any past K from the recorded `g^a` and `g^b`, the attacker would still need to solve the Discrete Logarithm Problem — which the long-term key compromise does nothing to ease.

That is the essential separation: the long-term key authenticates *who is speaking now*, while the ephemeral DH exchange determines *the secret material protecting this session*. Compromise of the first does not leak the second.

#### Summary of the model answer

- Countermeasure: sign each ephemeral DH public key with the sender's long-term identity key (or use certificates).
- Authenticity: MITM substitution is detected because the signature on the substituted share fails verification.
- Forward secrecy: ephemeral exponents `a`, `b` are discarded post-session; future compromise of the long-term signing key cannot recover past `g^(ab)` because DLP still stands in the way.

### What You Must Know

- Difference between key transport and key agreement.
- Why unauthenticated Diffie-Hellman is vulnerable to MITM.
- What forward secrecy means and why it matters.
- The high-level idea behind EKE and DH-EKE.

### 30-Second Oral Answer

- Key transport sends a chosen session key; key agreement derives one from both parties' inputs.
- Diffie-Hellman alone does not authenticate who supplied the public values, so a MITM can interpose.
- Forward secrecy means future compromise of long-term keys should not reveal past session keys.

### Typical Exam Questions

- What is the difference between key transport and key agreement?
- Why can MITM break unauthenticated Diffie-Hellman?
- What is forward secrecy?
- Why is DH-EKE stronger than a naive password-based key exchange?

### Common Pitfalls

- Claiming key agreement means no party contributes private material.
- Saying all key transport provides forward secrecy by default.
### Worked Examples

#### Reflection vs MITM contrast

A MITM on unauthenticated Diffie-Hellman is not a replay attack. The attacker actively negotiates two different keys by substituting public parameters.

That is why the fix is authentication of the exchange, not merely freshness.

### Related Concepts

- [[Protocol Notation and the EKE Message Flow|Protocol Notation and the EKE Message Flow]]
- [[Protocols for Secure Communication Nonces, Replay, Reflection, and Relay|Protocols for Secure Communication: Nonces, Replay, Reflection, and Relay]]
- [[Implicit and Explicit Key Authentication and SSO|Implicit and Explicit Key Authentication and SSO]]
- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]

## Implicit and Explicit Key Authentication and SSO

> [!abstract] Why this note matters
> - Tutorial 4 Part A Q7 directly tests the distinction between implicit and explicit key authentication.
> - SSO threats appear in Tutorial 4 Part B Q7 and are a self-contained exam topic.

### Overview

After a key exchange, a protocol may or may not confirm that both parties actually hold the correct shared key. This confirmation question defines the difference between implicit and explicit key authentication. SSO (Single Sign-On) brings in a separate but related concern: centralising authentication convenience also centralises risk.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **implicit key authentication**: Lecture 4's phrasing: "key access scope is narrowed but not confirmed." After the protocol run, one party is assured that only the intended party could possibly hold the derived key, but neither party has yet confirmed that they actually computed it correctly.
- **explicit key authentication**: A property where one party receives confirmed proof (via a message) that the other party has successfully derived and holds the correct key.
- **key confirmation**: A message or protocol step that proves the other party computed the correct shared key, typically by sending a MAC or hash of the key over the session.
- **SSO (Single Sign-On)**: An authentication scheme where one authentication event at a central provider grants access to multiple services.
- **identity provider (IdP)**: The central authority in an SSO system that authenticates the user and issues tokens to service providers.

### Detailed Explanation

#### Implicit vs Explicit Key Authentication

After a Diffie-Hellman exchange, if the protocol is authenticated (e.g., shares are signed), then both parties know the key was computed with the right entity. This is **implicit key authentication** — Lecture 4 puts it precisely: "key access scope is narrowed but not confirmed." Only the intended party *could* have derived the same key, but neither side has yet explicitly verified the other *did*.

**Explicit key authentication** adds a confirmation step: one or both parties sends a message that can only be produced by someone who knows the shared key (e.g., a MAC over a known value keyed with the session key). This proves the key was actually computed correctly, not just potentially computable.

The difference matters in practice:
- With implicit authentication only: if there is a subtle protocol flaw, one party might derive a different key from the other without the flaw being detected.
- With explicit authentication: any key mismatch is immediately visible because the confirmation message will fail to verify.

Many real protocols (e.g., TLS 1.3, station-to-station protocol) include key confirmation steps to achieve explicit authentication.

#### Single Sign-On (SSO)

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

### How It Works

Implicit key auth → only the correct party *could* compute the key → no confirmation message sent.

Explicit key auth → a confirmation message proves the correct party *did* compute the key → detected immediately if wrong.

SSO → one IdP authentication → token issued → each service validates token against IdP public key or shared secret.

SSO token replay → steal/intercept token → present to service → accepted if not expired or bound to context.

### What You Must Know

- Precise distinction: implicit = assurance of *possible* key sharing ("key access scope is narrowed but not confirmed"); explicit = confirmation of *actual* key holding via a key-use confirmation message.
- Why explicit key authentication is stronger and what the confirmation step looks like.
- The three SSO types from Lecture 4: **Credential Manager**, **Enterprise SSO**, **Federated identity** (with SAML, OAuth, OpenID Connect as the named federated standards).
- Two main SSO threats: IdP compromise and token replay/forgery.
- Two mitigations for each SSO risk.

### 30-Second Oral Answer

- Implicit key authentication assures only the correct party *could* hold the key; explicit authentication additionally confirms they *do*, via a confirmation message.
- SSO is convenient but concentrates risk: compromise of the IdP or token forgery affects all services simultaneously.
- Mitigations: harden the IdP, sign tokens, keep lifetimes short, validate audience claims.

### Typical Exam Questions

- What is the difference between implicit and explicit key authentication?
- Why is explicit key confirmation stronger than implicit authentication alone?
- Name two significant security risks of SSO and explain a mitigation for each.

### Common Pitfalls

- Confusing implicit/explicit key authentication with key transport vs key agreement — they are orthogonal properties.
- Thinking implicit authentication is "no authentication" — it still ensures the correct party is the only one that could have the key.
- Treating SSO as purely a usability feature without appreciating the concentrated risk.

### Concrete Examples and Commands

#### Key confirmation in practice

```text
After DH key exchange and mutual authentication:

Alice → Bob: MAC_K(label || nonce_A || nonce_B)
Bob  → Alice: MAC_K(label || nonce_B || nonce_A)

If Bob receives the correct MAC, he confirms Alice computed K correctly.
If there was any protocol manipulation, the MAC fails → explicit auth detected the problem.
```

#### SSO token flow

```text
1. User authenticates to IdP (username + MFA).
2. IdP issues signed token: {user: alice, audience: serviceA, exp: +1h, sig: IdP_private_key}
3. User presents token to Service A.
4. Service A verifies signature with IdP public key, checks audience = "serviceA", checks exp.
5. If attacker intercepts token and presents to Service B:
   → audience claim fails ("serviceA" ≠ "serviceB") → rejected.
```

### Related Concepts

- [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]]
- [[Protocols for Secure Communication Nonces, Replay, Reflection, and Relay|Protocols for Secure Communication: Nonces, Replay, Reflection, and Relay]]
- [[Authentication, Identification, and Authorization|Authentication, Identification, and Authorization]]
