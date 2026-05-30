# Topic 2 — Cryptography

**Lecture slides:** `Materials/01 Lectures/Lecture 02 — Cryptography Basics.pdf` (56 slides)
**Tutorial coverage:** Tutorial 2 — Parts A (10 MCQs), B (10 short answer), C (6 numerical)
**Lab coverage:** Lab 1 (Caesar/OTP misuse/ECB penguin), Lab 2 (MD5 truncation, salted hashes)
**Past exam coverage:** Sample 2025-03-21 Part A Q4 (sym vs asym), Q5 (stream ciphers), Q6 (hash before sign), Q9 (passive vs active); Part B Q3 (X.509 binding + issuer signature)

Cryptography is the foundational toolkit for confidentiality, integrity, and authentication. The lecture treats it as the wiring under the floorboards of every other security mechanism in the course. Pin three blocks first: the encryption model with key space, the symmetric/asymmetric/hybrid split, and the X.509 essay structure — those cover the bulk of expected exam exposure.

## What the Exam Asks

- Exact crypto vocabulary: plaintext, ciphertext, key space, encryption/decryption.
- Attack models: ciphertext-only, known-plaintext, chosen-plaintext, chosen-ciphertext.
- Hash/MAC/signature distinctions and what each property guarantees.
- Symmetric/asymmetric/hybrid encryption, RSA, X.509 certificates, OTP and block/stream modes.

---

## Encryption Model and Notation

> [!info] The basic model
> **Encryption** transforms plaintext $m$ into ciphertext $c$ to provide confidentiality. **Decryption** reverses the process using a key to recover $m$.

The generic notation, used throughout the course:

$$c = E_k(m) \qquad m = D_{k'}(c)$$

where $E_k$ and $D_{k'}$ are encryption and decryption algorithms parameterised by keys $k$ and $k'$. In symmetric schemes $k = k'$. In asymmetric schemes the two keys form a public/private pair and play different roles.

| Term | Meaning |
| --- | --- |
| **Plaintext** $m$ | The original message |
| **Ciphertext** $c$ | The transformed, unintelligible output |
| **Encryption key** $k$ | The parameter used to encrypt |
| **Decryption key** $k'$ | The parameter used to decrypt |
| **Key space** | The set of all possible keys; size determines brute-force cost |

<figure class="diag-figure">
  <figcaption>Encryption / decryption pipeline — Alice encrypts under $k$, Bob decrypts under $k'$</figcaption>
  <svg viewBox="0 0 760 200" class="diag-svg" role="img" aria-label="Encryption pipeline">
    <defs>
      <marker id="arr-enc" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <text x="80" y="40" text-anchor="middle" class="d-h-sm">Alice</text>
    <text x="680" y="40" text-anchor="middle" class="d-h-sm">Bob</text>
    <line x1="380" y1="20" x2="380" y2="180" class="d-edge dashed"/>

    <text x="80" y="80" text-anchor="middle" class="d-sub">plaintext $m$</text>
    <line x1="80" y1="90" x2="80" y2="108" class="d-edge" marker-end="url(#arr-enc)"/>
    <rect x="40" y="110" width="80" height="50" class="d-node-acc"/>
    <text x="80" y="140" text-anchor="middle" class="d-h-sm">E</text>
    <text x="20" y="138" text-anchor="end" class="d-sub">key $k$ -></text>

    <line x1="120" y1="135" x2="638" y2="135" class="d-edge" marker-end="url(#arr-enc)"/>
    <text x="380" y="125" text-anchor="middle" class="d-sub">$c = E_k(m)$</text>

    <rect x="640" y="110" width="80" height="50" class="d-node-acc"/>
    <text x="680" y="140" text-anchor="middle" class="d-h-sm">D</text>
    <text x="740" y="138" text-anchor="start" class="d-sub">&lt;- key $k'$</text>
    <line x1="680" y1="108" x2="680" y2="90" class="d-edge" marker-end="url(#arr-enc)"/>
    <text x="680" y="80" text-anchor="middle" class="d-sub">$m = D_{k'}(c)$</text>
  </svg>
</figure>

A cryptosystem is judged by one property above all: it must be **computationally infeasible to recover plaintext from ciphertext without the decryption key**. Pretty output is not security. Real security comes from a key space large enough that brute force is hopeless, plus an algorithm with no shortcuts that beat brute force.

### Caesar cipher — a worked example of a broken scheme

The Caesar cipher substitutes each letter by the one three positions later in the alphabet. With $A=0, B=1, \dots, Z=25$:

$$c_i = (m_i + 3) \bmod 26 \qquad m_i = (c_i - 3) \bmod 26$$

Decrypting `FODCGR` from Tutorial 2 Part C Q3:

| $c_i$ | pos | $-3$ | $m_i$ |
| --- | --- | --- | --- |
| F | 5 | 2 | C |
| O | 14 | 11 | L |
| D | 3 | 0 | A |
| C | 2 | $-1 \to 25$ | Z |
| G | 6 | 3 | D |
| R | 17 | 14 | O |

Plaintext: `CLAZDO`. The cipher fails not because the algorithm is buggy — it fails because the key space is only 26. An attacker tries every shift in milliseconds. **Small key space = no security.**

---

## Key Space and Exhaustive Search

> [!info] Key space and brute-force cost
> A cipher with an $n$-bit key has key space $2^n$. On average, exhaustive search finds the right key after trying half the space, $2^{n-1}$ attempts.

For a 128-bit key the average attacker tries about $2^{127} \approx 1.7 \times 10^{38}$ keys. For a 56-bit DES key the figure is $2^{56} \approx 7.2 \times 10^{16}$, brute-forceable on modern hardware in well under a day.

The lecture visualises DES's 56-bit key space as a 3,900 km super-highway from Lisbon to Istanbul, 316 lanes wide and tall, filled with golf balls except for one black ball. Finding that black ball is brute force.

### Tutorial worked examples

**Part C Q1 — 40-bit key, $10^9$ keys/sec:**

$$\frac{2^{40}}{10^9} \approx \frac{1.1 \times 10^{12}}{10^9} = 1100 \text{ s} \approx 0.3 \text{ hours}$$

A 40-bit cipher falls in under an hour. This is why 40-bit keys are obsolete.

**Part C Q2 — 128-bit vs 256-bit:**

$$\frac{2^{256}}{2^{128}} = 2^{128}$$

Doubling the key length does not double the security — it **squares the size of the key space**. Each extra bit doubles cost; 128 extra bits multiply cost by $2^{128}$.

> [!warning] Key length is not the whole story
> Tutorial 2 Part B Q3 expects you to also mention: (1) **implementation robustness** — side-channel leaks and weak RNGs cut effective key length; (2) **encryption speed** — slower legitimate ops can deter brute force but hurt usability; (3) **cryptanalytic breakthroughs** — a structural break may cut effective security far below the nominal key length.

---

## Attack Models and Adversary Capabilities

A cryptosystem is never judged against a generic attacker. It is judged against a specific model.

| Model | Attacker has | Strength |
| --- | --- | --- |
| **Ciphertext-only (COA)** | Ciphertexts only | Weakest |
| **Known-plaintext (KPA)** | Some plaintext-ciphertext pairs | Stronger |
| **Chosen-plaintext (CPA)** | Encryption oracle: picks $m$, sees $c$ | Stronger again |
| **Chosen-ciphertext (CCA)** | Decryption oracle: picks $c$, sees $m$ | **Strongest** of the four |

CCA is strongest because the attacker actively queries the decryption function — the deepest level of interaction with the cipher.

### Passive vs active adversaries (Sample Q9, Tutorial 2 Part B Q1)

| Adversary | Action | Examples |
| --- | --- | --- |
| **Passive** | Observes and records; does not alter | Wi-Fi packet sniffing, recording ciphertext for offline analysis |
| **Active** | Injects, modifies, blocks, replays | Man-in-the-middle, forged commands, packet injection |

Active adversaries are harder to defend against because manipulation of data flow needs more than just confidentiality. It needs integrity checks, authentication, freshness, and handshake protocols. Encryption alone stops eavesdropping; it does not stop tampering or replay.

> [!tip] Exam phrasing
> "Secure against which adversary, with what powers?" — every security claim needs that qualifier. Stating the model is part of the answer.

---

## Symmetric-Key Encryption

> [!info] Symmetric definition (Lecture 2 slide 12, tested verbatim)
> In symmetric-key encryption, **the encryption and decryption keys are the same**. The same shared secret $k$ performs both operations.

Both parties must obtain $k$ over a secure channel before any encrypted communication. That key-distribution problem is the central weakness of pure symmetric schemes — and the motivation for asymmetric crypto.

Symmetric ciphers split into two structural families: stream and block.

### Stream ciphers

> [!info] Stream cipher definition (Lecture 2 slide 15, tested verbatim)
> A stream cipher encrypts plaintext **one bit or one character at a time**, combining each unit with a corresponding keystream unit.

The Vernam cipher is the canonical example. Each plaintext bit is XORed with a keystream bit:

$$c_i = m_i \oplus k_i \qquad m_i = c_i \oplus k_i$$

<figure class="diag-figure">
  <figcaption>Vernam stream cipher — XOR plaintext bits with keystream bits, bit by bit</figcaption>
  <svg viewBox="0 0 760 220" class="diag-svg" role="img" aria-label="Vernam cipher flow">
    <defs>
      <marker id="arr-v" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <text x="80" y="30" text-anchor="middle" class="d-h-sm">Alice (encrypt)</text>
    <text x="680" y="30" text-anchor="middle" class="d-h-sm">Bob (decrypt)</text>
    <line x1="380" y1="20" x2="380" y2="200" class="d-edge dashed"/>

    <text x="80" y="70" text-anchor="middle" class="d-sub">message bits $m_i$</text>
    <line x1="80" y1="80" x2="80" y2="118" class="d-edge" marker-end="url(#arr-v)"/>

    <text x="200" y="70" text-anchor="middle" class="d-sub">keystream $k_i$</text>
    <line x1="200" y1="80" x2="100" y2="118" class="d-edge" marker-end="url(#arr-v)"/>

    <circle cx="90" cy="130" r="14" class="d-node-acc"/>
    <text x="90" y="135" text-anchor="middle" class="d-h-sm">⊕</text>

    <line x1="104" y1="130" x2="658" y2="130" class="d-edge" marker-end="url(#arr-v)"/>
    <text x="380" y="120" text-anchor="middle" class="d-sub">$c_i = m_i \oplus k_i$</text>

    <text x="580" y="70" text-anchor="middle" class="d-sub">keystream $k_i$</text>
    <line x1="580" y1="80" x2="660" y2="118" class="d-edge" marker-end="url(#arr-v)"/>

    <circle cx="670" cy="130" r="14" class="d-node-acc"/>
    <text x="670" y="135" text-anchor="middle" class="d-h-sm">⊕</text>

    <line x1="684" y1="130" x2="720" y2="130" class="d-edge" marker-end="url(#arr-v)"/>
    <text x="730" y="135" text-anchor="start" class="d-sub">$m_i$</text>
  </svg>
</figure>

### The one-time pad and its strict conditions

> [!info] OTP conditions for perfect secrecy
> The Vernam cipher becomes a **one-time pad** with perfect secrecy if and only if the keystream is:
> 1. **truly random**,
> 2. **at least as long as the message**, and
> 3. **never reused**.

Drop any one condition and the guarantee collapses.

> [!warning] OTP reuse breaks confidentiality (Lab 1 Challenge 2)
> Reusing a pad across two messages leaks the XOR of the plaintexts:
>
> $$c_1 \oplus c_2 = (m_1 \oplus k) \oplus (m_2 \oplus k) = m_1 \oplus m_2$$
>
> The key cancels. A known-plaintext attack on $m_1$ then recovers $k$ on that segment, and the second message falls. This is why Lab 1 Challenge 2 succeeds against an OTP-reused ciphertext using only a single known plaintext.

### Block ciphers

> [!info] Block cipher definition (Lecture 2 slide 17)
> A block cipher processes plaintext in **fixed-length blocks** of $n$ bits. Two parameters define it:
> - **Blocklength** $n$: block size in bits
> - **Keylength**: key size in bits

Each block is transformed as $c_i = E_k(m_i)$. If the final plaintext block is shorter than $n$ bits, it is padded with filler characters so the cipher can operate.

| Cipher | Family | Blocklength | Keylength | Status |
| --- | --- | --- | --- | --- |
| Vernam (OTP) | Stream | 1 bit | length of message | Perfectly secret if conditions hold; impractical at scale |
| **DES** | Block | 64 bits | **56 bits** | Deprecated — $2^{56}$ brute-forceable |
| **AES** (Rijndael) | Block | **128 bits** | 128, 192, or 256 bits | Current standard; designed at KU Leuven |

Tutorial 2 Part A Q10 tests this directly: a 56-bit DES key implies $2^{56}$ possible keys.

---

## Block Cipher Modes

A block cipher's primitive transforms one block. **Modes** define how multiple blocks chain together. Mode choice changes leakage and parallelism properties even with the same underlying cipher.

| Mode | Per-block operation | Parallelism | Pattern leakage | Padding needed |
| --- | --- | --- | --- | --- |
| **ECB** Electronic Codebook | $c_i = E_k(m_i)$ | Encrypt + decrypt | **Yes — identical blocks leak** | Yes |
| **CBC** Cipher Block Chaining | $c_i = E_k(m_i \oplus c_{i-1})$, $c_0 = IV$ | Decrypt only | No | Yes |
| **CTR** Counter | $c_i = m_i \oplus E_k(N_i)$, $N_{i+1} = N_i + 1$ | Encrypt + decrypt | No | **No** (keystream) |
| **OFB** Output Feedback | Keystream from repeated encryption of state | Sequential | No | No |

<figure class="diag-figure">
  <figcaption>ECB vs CBC — ECB encrypts each block independently; CBC XORs each block with the previous ciphertext before encryption</figcaption>
  <svg viewBox="0 0 760 320" class="diag-svg" role="img" aria-label="ECB and CBC modes">
    <defs>
      <marker id="arr-m" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <text x="190" y="30" text-anchor="middle" class="d-h">ECB mode</text>
    <text x="570" y="30" text-anchor="middle" class="d-h">CBC mode</text>
    <line x1="380" y1="20" x2="380" y2="300" class="d-edge dashed"/>

    <!-- ECB column -->
    <text x="190" y="70" text-anchor="middle" class="d-sub">$m_i$</text>
    <line x1="190" y1="80" x2="190" y2="108" class="d-edge" marker-end="url(#arr-m)"/>
    <rect x="150" y="110" width="80" height="40" class="d-node-acc"/>
    <text x="190" y="135" text-anchor="middle" class="d-h-sm">$E_k$</text>
    <line x1="190" y1="150" x2="190" y2="178" class="d-edge" marker-end="url(#arr-m)"/>
    <text x="190" y="195" text-anchor="middle" class="d-sub">$c_i = E_k(m_i)$</text>

    <text x="190" y="245" text-anchor="middle" class="d-label-danger">identical blocks -> identical ciphertext</text>

    <!-- CBC column -->
    <text x="500" y="70" text-anchor="middle" class="d-sub">$c_{i-1}$</text>
    <line x1="500" y1="80" x2="560" y2="115" class="d-edge" marker-end="url(#arr-m)"/>
    <text x="640" y="70" text-anchor="middle" class="d-sub">$m_i$</text>
    <line x1="640" y1="80" x2="580" y2="115" class="d-edge" marker-end="url(#arr-m)"/>

    <circle cx="570" cy="125" r="14" class="d-node-acc"/>
    <text x="570" y="130" text-anchor="middle" class="d-h-sm">⊕</text>

    <line x1="570" y1="139" x2="570" y2="158" class="d-edge" marker-end="url(#arr-m)"/>
    <rect x="530" y="160" width="80" height="40" class="d-node-acc"/>
    <text x="570" y="185" text-anchor="middle" class="d-h-sm">$E_k$</text>

    <line x1="570" y1="200" x2="570" y2="228" class="d-edge" marker-end="url(#arr-m)"/>
    <text x="570" y="245" text-anchor="middle" class="d-sub">$c_i = E_k(m_i \oplus c_{i-1})$</text>
    <text x="570" y="275" text-anchor="middle" class="d-label-accent">chaining hides repeats</text>
  </svg>
</figure>

### Why ECB leaks structure (Lab 1 Challenge 3 — the penguin)

> [!warning] ECB and the penguin
> Because ECB encrypts each block independently, identical plaintext blocks always produce identical ciphertext blocks. Structured plaintext (bitmap images, fixed-format records) keeps its repetition pattern in the ciphertext. The "penguin" image classic shows that you can still see the outline of a penguin after ECB encryption — the underlying block primitive is not broken; the mode is leaking structure.

Lab 1 Challenge 3 (`flag.dat`) exploits exactly this: encryption preserves enough structure that the original file format is recoverable without decrypting.

### CTR mode as a stream cipher built from a block cipher

CTR mode encrypts an incrementing counter $N_i$ and XORs the result with the plaintext:

$$c_i = m_i \oplus E_k(N_i)$$

The block cipher generates a keystream block-by-block; the plaintext never enters $E_k$. This means:

- **CTR behaves like a stream cipher.** Decryption uses the same operation as encryption — XOR with $E_k(N_i)$.
- **No padding is needed.** Truncate the keystream to the message length.
- **Parallelism is full** — counters are independent.
- **Random access** — to decrypt block $i$ alone, regenerate $E_k(N_i)$ and XOR.

Tutorial 2 Part B Q8 asks for a CTR use case: high-speed streaming, parallel encryption, random-access encrypted storage.

---

## Differential and Linear Cryptanalysis

Modern block ciphers face attacks subtler than brute force. Tutorial 2 Part B Q4 names the two most important.

| Attack | Exploits | Defence in cipher design |
| --- | --- | --- |
| **Differential cryptanalysis** (Biham-Shamir, 1990s) | Predictable propagation of XOR differences $\Delta P \to \Delta C$ through rounds | Low differential uniformity in S-boxes; enough rounds |
| **Linear cryptanalysis** (Matsui, 1993) | Statistical bias in linear equations over plaintext, key, ciphertext bits | High S-box non-linearity; diffusion layers cancel biases |

### Shannon's confusion and diffusion

> [!info] Confusion vs diffusion
> - **Confusion** makes the relationship between key and ciphertext bits as complex (non-linear) as possible. Achieved by **substitution** — S-boxes. Counters linear cryptanalysis.
> - **Diffusion** ensures each plaintext bit influences many ciphertext bits, spreading structure across the state. Achieved by **permutation/mixing** layers. Counters differential cryptanalysis.

Modern designs (AES, 3DES) combine both in a substitution-permutation network. AES's provable security margin against differential and linear attacks comes from S-boxes with low differential uniformity, high non-linearity, and the MixColumns diffusion step over enough rounds.

> [!tip] Designing a secure symmetric cipher (Tutorial 2 Part B Q4)
> Core properties: confusion + diffusion + large key space + no structural weaknesses. Cite differential and linear cryptanalysis as the two named cryptanalytic methods to mitigate.

---

## Public-Key (Asymmetric) Encryption

> [!info] Public-key definition
> Each party holds a **key pair**: a public encryption key $e_B$ and a private decryption key $d_B$. The public key can be published; the private key is never shared.
>
> $$c = E_{e_B}(m) \qquad m = D_{d_B}(c)$$

Anyone can encrypt to Bob using $e_B$. Only Bob can decrypt with $d_B$.

| Property | Symmetric | Public-key |
| --- | --- | --- |
| Keys | Shared secret $k$ | Public $e_B$ + private $d_B$ |
| Key distribution | Hard — needs prior secure channel | Easy — publish public keys |
| Speed | Fast (hardware-friendly bit ops) | Slow (modular exponentiation on huge ints) |
| Best use | Bulk data encryption | Key transport, signatures, identity binding |

The main advantage of public-key crypto (Sample Q4, Tutorial 2 Part A Q1) is **simplified key distribution**: no pre-shared secret needed.

### RSA — the canonical public-key scheme

RSA is built from two large secret primes $p$ and $q$.

1. Compute the modulus $n = pq$.
2. Choose a public exponent $e$.
3. Derive the private exponent $d$ so that exponentiation by $d$ inverts exponentiation by $e$ modulo $n$.
4. Publish $(n, e)$; keep $d, p, q$ secret.

Encryption and decryption are both modular exponentiations:

$$c = m^e \bmod n \qquad m = c^d \bmod n$$

Security rests on the **integer factorisation problem**: recovering $p, q$ from $n$ is believed to be computationally infeasible for large primes. If an attacker can factor $n$, they recompute $d$ and decrypt everything.

> [!warning] Recognition cue (Tutorial 2 Part A Q4 distractor)
> "Modular exponentiation with prime numbers" describes **RSA, not Vernam**. The exam uses this phrase to test whether you can tell the two apart. Vernam = bit XOR with keystream; RSA = $m^e \bmod n$.

### Why asymmetric is slow

Modular exponentiation on numbers thousands of bits wide costs orders of magnitude more than AES's bit-level ops on 128-bit blocks. AES finishes a block in nanoseconds; RSA can take milliseconds per operation. Tutorial 2 Part C Q6 makes this concrete:

$$10{,}000 \text{ messages} \times 5 \text{ ms} = 50{,}000 \text{ ms} = 50 \text{ s}$$

The same volume under AES would complete in well under a second. The cost gap is the entire motivation for hybrid encryption.

---

## Hybrid Encryption

> [!info] Hybrid encryption (Lecture 2 slide 23 — tested process)
> Combines symmetric efficiency for bulk data with public-key convenience for key distribution. Process:
> 1. **Generate a fresh random symmetric key** $k$.
> 2. **Encrypt the message** $m$ with $k$ using a fast symmetric cipher (e.g. AES): $c = E_k(m)$.
> 3. **Encrypt the symmetric key** $k$ with the recipient's public key $e_B$: $E_{e_B}(k)$.
>
> The sender transmits both pieces. The recipient decrypts $k$ with $d_B$, then decrypts $c$ with $k$.

<figure class="diag-figure">
  <figcaption>Hybrid encryption — symmetric cipher handles the payload, asymmetric step protects the symmetric key</figcaption>
  <svg viewBox="0 0 760 240" class="diag-svg" role="img" aria-label="Hybrid encryption flow">
    <defs>
      <marker id="arr-h" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="20" y="20" width="120" height="40" class="d-node"/>
    <text x="80" y="45" text-anchor="middle" class="d-h-sm">message $m$</text>

    <rect x="20" y="100" width="120" height="40" class="d-node-acc"/>
    <text x="80" y="125" text-anchor="middle" class="d-h-sm">fresh key $k$</text>

    <line x1="140" y1="40" x2="218" y2="80" class="d-edge" marker-end="url(#arr-h)"/>
    <line x1="140" y1="120" x2="218" y2="85" class="d-edge" marker-end="url(#arr-h)"/>

    <rect x="220" y="65" width="120" height="50" class="d-node-acc"/>
    <text x="280" y="85" text-anchor="middle" class="d-h-sm">AES encrypt</text>
    <text x="280" y="105" text-anchor="middle" class="d-sub">$c = E_k(m)$</text>

    <line x1="140" y1="120" x2="218" y2="175" class="d-edge" marker-end="url(#arr-h)"/>
    <rect x="220" y="160" width="120" height="50" class="d-node-acc"/>
    <text x="280" y="180" text-anchor="middle" class="d-h-sm">RSA encrypt</text>
    <text x="280" y="200" text-anchor="middle" class="d-sub">$E_{e_B}(k)$</text>

    <text x="160" y="200" text-anchor="end" class="d-sub">pub key $e_B$ -></text>

    <line x1="340" y1="90" x2="438" y2="100" class="d-edge" marker-end="url(#arr-h)"/>
    <line x1="340" y1="185" x2="438" y2="140" class="d-edge" marker-end="url(#arr-h)"/>

    <rect x="440" y="80" width="200" height="80" class="d-node"/>
    <text x="540" y="105" text-anchor="middle" class="d-h-sm">transmitted bundle</text>
    <text x="540" y="125" text-anchor="middle" class="d-sub">$E_k(m)$ (payload)</text>
    <text x="540" y="145" text-anchor="middle" class="d-sub">$E_{e_B}(k)$ (wrapped key)</text>
  </svg>
</figure>

Tutorial 2 Part C Q6 and Part B Q9 both test this. The Q9 scenario — encrypt a 1 GB file — exposes the cost asymmetry: RSA on 1 GB is infeasibly slow and would balloon the ciphertext to multiples of the modulus size. Generate a random AES key, encrypt the file with AES, encrypt only the AES key with RSA. TLS handshakes use this exact pattern.

> [!warning] Common confusion
> Hybrid encryption is **not weaker** than pure asymmetric encryption. It is the standard form. Encrypting bulk data directly with RSA is the unusual case, not the default.

### Integrity of public keys (motivates PKI)

> [!info] Public keys must be authenticated
> A public key can be published, but its **integrity** and **authenticity** are critical. Substituting an opponent's key for the legitimate one breaks the entire scheme — the encryptor unknowingly encrypts to the attacker.

This is exactly what the XKCD comic in the lecture skewers: texting your public key is convenient but lets the eavesdropper substitute their own. The fix is **certificates**, which bind keys to identities — see PKI section below.

---

## Cryptographic Hash Functions

> [!info] Hash function
> A cryptographic hash $H$ maps an **arbitrary-length input** $m$ to a **fixed-length output** $h = H(m)$ (the "digest" or "hash value"). Easy to compute, hard to invert.

Hashes are not encryption. There is no key, no decryption, and no secrecy in the same sense. The security questions are different.

<figure class="diag-figure">
  <figcaption>Cryptographic hash function — arbitrary-length input compressed to fixed-length digest; one-way</figcaption>
  <svg viewBox="0 0 760 220" class="diag-svg" role="img" aria-label="Hash function">
    <defs>
      <marker id="arr-hf" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <text x="380" y="30" text-anchor="middle" class="d-sub">input $m$ (arbitrary length)</text>
    <line x1="380" y1="40" x2="380" y2="68" class="d-edge" marker-end="url(#arr-hf)"/>

    <polygon points="240,70 520,70 460,170 300,170" class="d-node-acc"/>
    <text x="380" y="115" text-anchor="middle" class="d-h">$H$</text>
    <text x="380" y="140" text-anchor="middle" class="d-sub">cryptographic hash</text>

    <line x1="380" y1="170" x2="380" y2="198" class="d-edge" marker-end="url(#arr-hf)"/>
    <text x="380" y="215" text-anchor="middle" class="d-sub">output $h = H(m)$ (fixed length)</text>

    <text x="200" y="120" text-anchor="end" class="d-label-accent">easy to compute -></text>
    <text x="560" y="120" text-anchor="start" class="d-label-danger">&lt;- hard to invert</text>
  </svg>
</figure>

### The three security properties

> [!info] Three hash properties — keep them separate
> 1. **One-way (preimage resistance):** Given $h$, finding any $m$ with $H(m) = h$ is infeasible.
> 2. **Second-preimage resistance:** Given $m_1$, finding $m_2 \neq m_1$ with $H(m_2) = H(m_1)$ is infeasible.
> 3. **Collision resistance:** Finding any two distinct $m_1 \neq m_2$ with $H(m_1) = H(m_2)$ is infeasible.

Mapping exam phrasing to property (Tutorial 2 Part A Q2, Q7):

| Question phrasing | Property |
| --- | --- |
| "Does not reveal information about the input" | **One-way** |
| "Find two distinct inputs with the same hash" | **Collision resistance** |
| "Forge a different message matching this hash" | **Second-preimage resistance** |

### Birthday paradox and collision cost

For an $n$-bit hash, the birthday paradox says collisions appear after about $\sqrt{2^n} = 2^{n/2}$ random trials. For a 128-bit hash (Tutorial 2 Part C Q5):

$$\sqrt{2^{128}} = 2^{64} \approx 1.84 \times 10^{19}$$

Collisions in a 128-bit hash are found at around $2^{64}$ work — already weak by modern standards. SHA-256 outputs 256 bits precisely so collision search costs $2^{128}$.

> [!warning] Lab 2 Challenge 4 — truncated MD5
> Truncating an MD5 hash to its first 7 hex characters (28 bits) reduces collision search to about $2^{14} \approx 16{,}000$ trials. Custom hash validation that throws away bits is catastrophic — Lab 2 brute-forces a collision in seconds.

### Why a block cipher cannot replace a hash (Tutorial 2 Part B Q6)

Block ciphers are **two-way** by design (decryption exists). Hashes require **one-way** behaviour. Encrypting with a block cipher under some fixed key does not give collision resistance or preimage resistance at scale — different design goals, different primitives.

---

## Digital Signatures

> [!info] Digital signatures (Lecture 2 properties slide)
> A digital signature provides three guarantees:
> 1. **Data origin authentication** — assurance of who sent it.
> 2. **Data integrity** — assurance the message is unaltered.
> 3. **Non-repudiation** — the signer cannot later deny having signed.

The scheme uses an asymmetric key pair, **reversed in role** compared to encryption:

- **Signing key** $s_A$ — Alice's **private** key, used to sign.
- **Verification key** $v_A$ — Alice's **public** key, used by anyone to verify.

$$t = S_{s_A}(m) \qquad V_{v_A}(m, t) \to \texttt{VALID} \text{ or } \texttt{INVALID}$$

### Signing the hash (standard practice)

In practice, the signing primitive is applied to a hash of the message, not the message itself:

$$h = H(m) \qquad t = S_{s_A}(h)$$

Sample Q6 tests **why**:

> [!tip] Sample Q6 — why hash before signing
> 1. **Speed**: signing a short digest is much faster than signing a large message via slow asymmetric ops.
> 2. **Tamper detection**: any change to $m$ changes $H(m)$, invalidating the signature.

Collision resistance of $H$ is essential — if an attacker can find $m' \neq m$ with $H(m') = H(m)$, the signature on $m$ also verifies on $m'$, defeating integrity and non-repudiation.

<figure class="diag-figure">
  <figcaption>Signature creation and verification — sign the digest, verify by recomputing and comparing</figcaption>
  <svg viewBox="0 0 760 280" class="diag-svg" role="img" aria-label="Digital signature with hashing">
    <defs>
      <marker id="arr-s" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <text x="190" y="30" text-anchor="middle" class="d-h">Sign (Alice)</text>
    <text x="570" y="30" text-anchor="middle" class="d-h">Verify (Bob)</text>
    <line x1="380" y1="20" x2="380" y2="260" class="d-edge dashed"/>

    <!-- sign side -->
    <rect x="130" y="60" width="120" height="40" class="d-node"/>
    <text x="190" y="85" text-anchor="middle" class="d-h-sm">message $m$</text>
    <line x1="190" y1="100" x2="190" y2="128" class="d-edge" marker-end="url(#arr-s)"/>
    <rect x="130" y="130" width="120" height="40" class="d-node-acc"/>
    <text x="190" y="155" text-anchor="middle" class="d-h-sm">hash $H$</text>
    <line x1="190" y1="170" x2="190" y2="198" class="d-edge" marker-end="url(#arr-s)"/>
    <rect x="130" y="200" width="120" height="40" class="d-node-acc"/>
    <text x="190" y="220" text-anchor="middle" class="d-h-sm">sign $S_{s_A}$</text>
    <text x="190" y="235" text-anchor="middle" class="d-sub">$t = S_{s_A}(H(m))$</text>

    <!-- transmit -->
    <line x1="250" y1="220" x2="498" y2="150" class="d-edge" marker-end="url(#arr-s)"/>
    <text x="380" y="180" text-anchor="middle" class="d-sub">$(m, t)$</text>

    <!-- verify side -->
    <rect x="500" y="60" width="120" height="40" class="d-node"/>
    <text x="560" y="85" text-anchor="middle" class="d-h-sm">recv $(m, t)$</text>
    <line x1="560" y1="100" x2="560" y2="128" class="d-edge" marker-end="url(#arr-s)"/>
    <rect x="500" y="130" width="120" height="40" class="d-node-acc"/>
    <text x="560" y="155" text-anchor="middle" class="d-h-sm">verify $V_{v_A}$</text>
    <line x1="560" y1="170" x2="560" y2="198" class="d-edge" marker-end="url(#arr-s)"/>
    <rect x="500" y="200" width="120" height="40" class="d-node"/>
    <text x="560" y="225" text-anchor="middle" class="d-h-sm">VALID / INVALID</text>
  </svg>
</figure>

---

## Message Authentication Codes (MACs)

> [!info] MAC definition (Lecture 2 slides 41-43)
> A Message Authentication Code is a tag $t = M_k(m)$ computed over message $m$ using a **shared secret key** $k$. The receiver recomputes $M_k(m')$ on the received $m'$ and accepts if and only if the tags match.

MAC verification gives integrity and origin authentication between key-holders. It does **not** give non-repudiation, because both parties hold $k$ — either could have produced the tag, and a third party cannot tell which one.

### MAC vs digital signature (Tutorial 2 Part B Q10)

| Property | MAC | Digital signature |
| --- | --- | --- |
| Key type | Symmetric (shared $k$) | Asymmetric (private signing, public verification) |
| Who can tag | Any holder of $k$ | Only the private-key holder |
| Who can verify | Any holder of $k$ | Anyone with the public verification key |
| Integrity | Yes | Yes |
| Origin authentication | Yes (to key-holders) | Yes (publicly) |
| **Non-repudiation** | **No** | **Yes** |
| Speed | Fast (hash-like cost) | Slow (asymmetric crypto) |
| Best use | High-volume integrity between two parties already sharing a key | Public attestation, contracts, third-party-verifiable proof |

> [!tip] Choosing between them
> - **Closed system, shared key already, high throughput → MAC.** E.g. HMAC-SHA-256 on storage blocks within an organisation, frames inside a TLS session.
> - **Open system, third-party verification, legal context → signature.** E.g. signed software releases, e-commerce contracts (Tutorial 2 Part B Q7: signed purchase agreements provide non-repudiation).

---

## X.509 Certificates and PKI

This section maps directly to Sample 2025-03-21 Part B Q3 — the X.509 essay question.

### Why certificates exist

> [!info] The binding problem
> Public keys must be authenticated to ensure they belong to the claimed entity. Substituting an attacker's public key for a legitimate one compromises the entire scheme. An X.509 **certificate** binds a public key to an identity using a digital signature from a trusted **Certification Authority (CA)**.

A certificate is not a key. It is a wrapper around a key that records who the key belongs to, who vouches for that, how long the binding is valid, and what algorithm the vouching uses.

### The nine X.509 fields (Lecture 2 slide 50)

| # | Field | Contents |
| --- | --- | --- |
| 1 | **Version** | Format version, e.g. X.509v3 |
| 2 | **Serial-Number** | Uniquely identifies this certificate (used for revocation) |
| 3 | **Issuer** | Issuing CA's name |
| 4 | **Validity-Period** | Not-Before and Not-After dates |
| 5 | **Subject** | Owner's name |
| 6 | **Public-Key info** | (Public-Key-Algorithm, Key-Value) |
| 7 | **Extension fields** (optional) | Subject-Alternate-Name (SAN list), Basic-Constraints, Key-Usage, CRL-Distribution-Points, others |
| 8 | **Signature-Algorithm** | (algorithmID, parameters) |
| 9 | **Digital-Signature** | Issuer's signature over fields 1-8 |

Fields 1-8 are the data being attested; field 9 is the CA's attestation over that data.

<figure class="diag-figure">
  <figcaption>Certificate creation — CA hashes the data fields and signs the hash with its private key; verifier recomputes hash and checks with CA public key</figcaption>
  <svg viewBox="0 0 760 280" class="diag-svg" role="img" aria-label="Certificate creation and verification">
    <defs>
      <marker id="arr-c" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <text x="190" y="30" text-anchor="middle" class="d-h">CA signs</text>
    <text x="570" y="30" text-anchor="middle" class="d-h">Relying party verifies</text>
    <line x1="380" y1="20" x2="380" y2="260" class="d-edge dashed"/>

    <rect x="80" y="60" width="220" height="60" class="d-node"/>
    <text x="190" y="82" text-anchor="middle" class="d-h-sm">Subject ID + Public Key</text>
    <text x="190" y="102" text-anchor="middle" class="d-sub">+ Issuer, Validity, Serial-Number</text>

    <line x1="190" y1="120" x2="190" y2="148" class="d-edge" marker-end="url(#arr-c)"/>
    <rect x="130" y="150" width="120" height="40" class="d-node-acc"/>
    <text x="190" y="175" text-anchor="middle" class="d-h-sm">hash $H$</text>

    <line x1="190" y1="190" x2="190" y2="218" class="d-edge" marker-end="url(#arr-c)"/>
    <rect x="100" y="220" width="180" height="40" class="d-node-acc"/>
    <text x="190" y="240" text-anchor="middle" class="d-h-sm">sign with CA private key</text>
    <text x="190" y="255" text-anchor="middle" class="d-sub">-> Digital-Signature field</text>

    <!-- verify side -->
    <rect x="460" y="60" width="220" height="60" class="d-node"/>
    <text x="570" y="82" text-anchor="middle" class="d-h-sm">Received certificate</text>
    <text x="570" y="102" text-anchor="middle" class="d-sub">all 9 fields</text>

    <line x1="570" y1="120" x2="570" y2="148" class="d-edge" marker-end="url(#arr-c)"/>
    <rect x="510" y="150" width="120" height="40" class="d-node-acc"/>
    <text x="570" y="175" text-anchor="middle" class="d-h-sm">hash $H$ + check</text>

    <line x1="570" y1="190" x2="570" y2="218" class="d-edge" marker-end="url(#arr-c)"/>
    <rect x="480" y="220" width="180" height="40" class="d-node"/>
    <text x="570" y="240" text-anchor="middle" class="d-h-sm">verify with CA public key</text>
    <text x="570" y="255" text-anchor="middle" class="d-sub">VALID -> trust the binding</text>
  </svg>
</figure>

### CA pre-issuance responsibilities (Lecture 2)

Before producing the signature, a CA must:

1. **Verify knowledge of the private key** — the requester proves possession of the private key matching the public key in the request.
2. **Verify control of computer-addressable identities** — e.g. domain names, email addresses asserted in the certificate.
3. **Confirm asserted natural-world names** for high-quality certificates — additional vetting for corporate identity or extended-validation certificates.

### Certificate acquisition

End-entities request a certificate from a CA by submitting a **Distinguished Name (DN)**, public key, and other attributes. The CA performs the three checks. If they pass, the CA fills in fields 1-8 and signs them as field 9. The signed certificate is returned and can be published.

### Why the issuer signature prevents impersonation (Sample Part B Q3)

The CA's signature covers all data fields. A verifier hashes those fields and checks the hash against the signature using the CA's public key. Three attack paths fail:

| Attack | Why it fails |
| --- | --- |
| **Tamper with a field** (e.g. swap the Public-Key info) | Recomputed hash no longer matches the signature; verification fails |
| **Forge a fresh signed certificate** with a fake binding | Requires the CA's private key; signature-scheme hardness assumption |
| **Convince the CA to issue a real certificate for someone else's identity** | Blocked by the three pre-issuance checks |

> [!tip] Sample Part B Q3 — full-marks answer
> 1. List the key fields that bind subject to key: **Subject**, **Subject's Public Key (Public-Key info)**, **Issuer**, **Validity-Period**, **Digital-Signature**.
> 2. Explain the signature prevents impersonation because (a) any tamper invalidates the signature, and (b) producing a fresh fake binding requires the CA's private key. Neither path is available to an attacker who has not compromised the CA itself.

### PKI as the surrounding framework

PKI is the operational framework for managing key pairs and their use by applications. It includes data structures (certificates, revocation lists), cryptographic toolkits, architectural components (CAs, registration authorities), and protocols for key lifecycle: generation, installation, normal use, revocation, recovery, and update.

Tutorial 2 Part B Q5: an organisation can use PKI to secure internal email — each employee gets a certificate; senders fetch recipients' certificates to encrypt to them or verify their signatures, trusting the CA to have vouched correctly for the binding.

---

## Practical Considerations

> [!warning] Don't roll your own crypto
> Two lecture guidelines:
> 1. **Use well-tested, widely accepted cryptographic algorithms and protocols.** AES, SHA-256, RSA-OAEP, established TLS versions.
> 2. **Avoid designing your own.** Custom validation logic, truncated hashes, and ad-hoc protocols are how breaches happen.

Lab 1 Challenge 5 and Lab 2 Challenge 4 hammer this in: custom key validation in a compiled binary is reverse-engineerable; truncating MD5 to 7 hex chars cuts collision search to brute-forceable cost. Real cryptography depends on well-analysed primitives.

---

## Past Exam Coverage

The 2025-03-21 sample paper has clear crypto questions in Part A and one essay in Part B. Map your answers tightly to the lecture.

- **Part A Q4 — symmetric vs public-key.** Answer: symmetric uses a pre-shared secret for both operations; public-key uses a public-private pair. Distractors invert the speed or claim PK is only for content encryption.
- **Part A Q5 — stream ciphers.** Answer: encrypt data one bit or character at a time, often via a keystream generator. Verbatim from slide 15.
- **Part A Q6 — why hash before signing.** Answer: (1) signing a short digest is faster than signing a long message via slow asymmetric ops, and (2) any change to the message changes the hash, so signatures detect tampering.
- **Part A Q9 — passive vs active attackers.** Answer: passive observes traffic, active injects or modifies data.
- **Part B Q3 — X.509 certificate binding and issuer signature.**
  - Name the fields that bind subject to public key: **Subject**, **Public-Key info**, **Issuer**, **Validity-Period**, **Digital-Signature**.
  - Explain the signature ensures authenticity: it covers all data fields, so tampering invalidates it and forging requires the CA's private key.
  - Without a trusted CA signature, anyone could create a fake certificate binding any public key to a legitimate name — the entire trust model rests on that signature.

A full-marks Q3 answer enumerates fields, explains the signature's role concretely (recompute hash, verify with CA public key), and names the two attack paths the signature blocks: field tampering (signature breaks) and fresh forgery (needs CA private key).

---

## Encryption, Decryption, Key Space, and Exhaustive Search

> [!abstract] Why this note matters
> - Lecture 2 and Tutorial 2 make this the base model for the rest of the cryptography material.
> - Lab 1 is built around weak transformations, readable ciphertext reasoning, and brute-force feasibility.

### Overview

Lecture 2 treats cryptography as foundational infrastructure for security. The basic model is simple: encryption converts plaintext to ciphertext, and decryption recovers plaintext using the appropriate key.

What makes that model useful or useless is not the existence of a transformation but the size and structure of the key space and the difficulty of reversing the transformation without the key.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **plaintext**: The original message before encryption.
- **ciphertext**: The transformed, unintelligible output produced by encryption.
- **encryption key**: The secret or public parameter used to convert plaintext into ciphertext.
- **decryption key**: The parameter used to recover plaintext from ciphertext.
- **key space**: The total set of possible keys for a cryptographic system.
- **exhaustive key search**: Trying every key until the correct one is found.

### Detailed Explanation

A cipher does not become secure merely because it changes the appearance of the text. Encodings and simple transformations may be reversible without any real secrecy. Lab 1 is designed to force that distinction: some outputs look transformed, but only some actually behave like cryptography.

Key space matters because brute force is always the fallback attack. If the set of possible keys is tiny, then trying all keys is feasible. If it is enormous, brute force becomes impractical. This is why lecture material contrasts Caesar-style substitution with modern key sizes.

But key length is not the entire story. The algorithm must also resist smarter attacks than brute force. Still, the first sanity check is always: if I had to try all keys, is the search space obviously too small?

### How It Works

Encryption is a function from plaintext and key to ciphertext; decryption reverses it with the matching key or matching key pair.

A good cryptosystem should make plaintext recovery infeasible without the correct key.

Exhaustive key search typically succeeds after about half the key space on average, because the right key is equally likely to be anywhere in the set.

### What You Must Know

- Plaintext, ciphertext, encryption key, and decryption key.
- What key space means and why larger key spaces resist brute-force attacks.
- Why not every transformation counts as real cryptography.

### 30-Second Oral Answer

- Encryption aims to protect confidentiality by turning plaintext into ciphertext under a key.
- The first security sanity check is whether brute-force search over the key space is feasible.
- A transformation is not secure just because it looks scrambled; it must resist recovery without the key.

### Typical Exam Questions

- What is key space?
- Why does key length matter for brute-force resistance?
- Why are simple encodings or weak substitutions not enough for confidentiality?

### Common Pitfalls

- Confusing encoding with encryption.
- Talking about key length without linking it to search feasibility.

### Concrete Examples and Commands

#### Lecture-level notation

```text
c = E_k(m)
m = D_k'(c)
```

The exact notation depends on whether the scheme is symmetric or asymmetric, but the course uses this form to separate message, ciphertext, and key roles.

#### Lab 1 attacker viewpoint

```text
Question: is this line encrypted, or only encoded/transformed?
Check:
1. Is there any real secret key involved?
2. Is the key space tiny enough to brute-force?
3. Is the transformation obviously reversible without cryptanalysis?
```

### Worked Examples

#### Why a small key space fails

If a cipher has only 26 keys, as in a Caesar-style alphabetic shift, an attacker can simply try every shift and inspect the outputs.

That is not because the algorithm is badly implemented. It is because the key space is so small that exhaustive search is trivial.

### Related Concepts

- [[Attack Models and Adversary Capabilities|Attack Models and Adversary Capabilities]]
- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]

## Attack Models and Adversary Capabilities

> [!abstract] Why this note matters
> - Tutorial 2 directly asks you to summarize the attack models and compare their strength.
> - The distinction between passive and active adversaries also reappears in later protocol notes.

### Overview

A cryptosystem is not judged against one generic attacker. It is judged against attacker models. The stronger the attacker model, the stronger the security claim has to be.

The course uses four classical attack models and the passive-vs-active distinction to reason about what a scheme must resist and what kinds of protocol defenses are necessary.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **ciphertext-only attack**: The attacker only sees ciphertexts.
- **known-plaintext attack**: The attacker knows some plaintext-ciphertext pairs.
- **chosen-plaintext attack**: The attacker can choose plaintexts and obtain their encryptions.
- **chosen-ciphertext attack**: The attacker can choose ciphertexts and obtain corresponding decryptions or oracle outputs.
- **passive adversary**: An attacker who observes but does not modify communication.
- **active adversary**: An attacker who injects, changes, blocks, or replays messages.

### Detailed Explanation

Ciphertext-only is the weakest attacker model because the adversary only sees encrypted outputs. Known-plaintext is stronger because it reveals how some messages map to ciphertext. Chosen-plaintext is stronger again because the attacker can deliberately probe the encryption function. Chosen-ciphertext is typically the strongest of these four because the attacker can actively query decryption behavior.

These are not just taxonomy items. They tell you how aggressively the scheme is being tested. A system secure only against passive observation may still fail badly once the attacker can manipulate or query it.

The passive-vs-active distinction becomes especially important for protocols. Encryption alone may block passive eavesdropping, but active attacks like replay, message injection, or man-in-the-middle require freshness checks, authentication, and sometimes explicit key confirmation.

In other words, attacker models are a way of stating assumptions. If you claim a design is secure, the next question is always 'secure against which adversary and with what powers?'. The course expects you to make those assumptions explicit rather than leaving them implicit.

### How It Works

When comparing models, think of each later model as giving the attacker more leverage or more oracle access than the previous one.

An active adversary is harder to defend against because the attacker can influence system state or communication flow, not merely observe it.

Protocol design must assume active attackers unless there is a very strong reason not to.

### What You Must Know

- Definitions of the four attack models.
- Why chosen-ciphertext is the strongest of the four classical models listed in the course.
- The difference between passive and active adversaries.

### 30-Second Oral Answer

- The attack model defines what power the attacker has.
- Chosen-ciphertext is strongest because the attacker can probe decryption behavior directly.
- Protocols must usually defend against active attackers, not just passive listeners.

### Typical Exam Questions

- Which attack model imposes the strongest requirement on a cryptosystem?
- Why are active adversaries harder to defend against than passive ones?
- How do the four attack models differ?

### Common Pitfalls

- Listing models without explaining the extra power each one adds.
- Assuming encryption solves active-manipulation attacks automatically.
### Related Concepts

- [[Protocols for Secure Communication Nonces, Replay, Reflection, and Relay|Protocols for Secure Communication: Nonces, Replay, Reflection, and Relay]]
- [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]]

## Stream Ciphers vs Block Ciphers — Formal Definitions

> [!abstract] Why this note matters
> - Lecture 2 slide 15's stream cipher definition has been tested verbatim on past exams — 'one bit or one character at a time'.
> - The block cipher slide pairs blocklength `n` and keylength terminology that the exam expects you to use correctly (for AES: blocklength = 128, keylength = 128/192/256).
> - DES (56-bit, deprecated) and AES (Rijndael, KU Leuven) are the two canonical examples; both appear in Tutorial 2 Part A questions about key spaces and modern symmetric design.

### Overview

Symmetric encryption splits into two structural families: stream ciphers, which process the plaintext one bit or one character at a time, and block ciphers, which process the plaintext in fixed-length chunks. The course wants you to be able to state the formal definitions verbatim, recognise the canonical examples (Vernam for stream, DES and AES for block), and explain why block ciphers need padding for short final blocks.

### Exam Focus

- Tier 1 priority.
- Written to align with Lecture 2 (slides 15-18) and Tutorial 2 Q4, Q8, Q10.

### Core Definitions

- **Stream cipher**: An encryption scheme that processes plaintext one bit or one character at a time, combining each unit with a corresponding unit from a keystream.
- **Block cipher**: An encryption scheme that processes plaintext in fixed-length blocks.
- **Blocklength `n`**: The block size in bits (e.g. 128 for AES).
- **Keylength**: The key size in bits (e.g. 128, 192, or 256 for AES).
- **Padding**: Extra 'filler' characters appended to a short final plaintext block so it matches the cipher's blocklength.
- **Keystream**: For stream ciphers, the sequence of key units `k_1 k_2 k_3 ...` combined with the plaintext units.

### Detailed Explanation

The stream-versus-block distinction is structural and decides how the cipher consumes its input. A stream cipher pretends the plaintext is an indefinitely long sequence of small units (typically bits) and processes each one as it arrives. The encryption operation is usually some form of bit-level combination — for the Vernam cipher, XOR with a key bit of equal weight, `c_i = m_i XOR k_i`. A block cipher refuses to process anything smaller than its blocklength. It treats the plaintext as a sequence of `n`-bit blocks and applies a single keyed transformation to each block.

Two consequences follow immediately. First, block ciphers always need a story for what to do when the plaintext does not divide evenly into `n`-bit blocks — the lecture explicitly mentions appending 'filler' characters until the last block is full. Second, block ciphers always need a story for what to do across multiple blocks, which is the role of block-cipher modes (ECB, CBC, CTR), covered in the [[Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes|modes note]].

The two canonical block ciphers the course names are DES and AES. DES is the historical 56-bit standard and is treated as deprecated because its key space (`2^56`) is brute-forceable today — Tutorial 2 Q10 uses this exact figure. AES (Advanced Encryption Standard) is the current standard, built from the Rijndael design by researchers at KU Leuven. AES fixes the blocklength at 128 bits and supports key lengths of 128, 192, or 256 bits.

The Vernam cipher is the canonical stream-cipher example. It encrypts bit by bit and shares a keystream of equal length to the message. Used correctly (key truly random, exactly the message length, never reused) it gives perfect secrecy — the one-time pad. Any reuse or shortcut breaks the guarantee.

### How It Works

#### Stream cipher (Lecture 2 slide 15)

- Plaintext `m = m_1 m_2 m_3 ...` is consumed one bit (or one character) at a time.
- Each unit is combined with the corresponding unit of a keystream `k = k_1 k_2 k_3 ...`.
- For Vernam: `c_i = m_i XOR k_i`, decryption `m_i = c_i XOR k_i`.
- Vernam is the explicit example named in the slides.

#### Block cipher (Lecture 2 slide 17)

- Plaintext is split into fixed-length blocks of `n` bits.
- Each block is transformed under the key: `c_i = E_k(m_i)`.
- Two parameters define a block cipher: blocklength `n` (block size in bits) and keylength (key size in bits).
- If the last plaintext block has fewer than `n` bits, it is padded with 'filler' characters until it matches the blocklength.

#### The canonical examples

| Cipher | Family | Blocklength | Keylength | Status |
|---|---|---|---|---|
| Vernam (OTP) | Stream | 1 bit | length of message | Perfectly secret if used correctly; impractical key management |
| DES | Block | 64 bits | 56 bits | Deprecated — `2^56` is brute-forceable |
| AES (Rijndael) | Block | 128 bits | 128, 192, or 256 bits | Current standard; designed at KU Leuven |

#### Why blocks need padding

A block cipher's transformation is defined only for inputs of exactly `n` bits. If the final plaintext block is shorter, the cipher has nothing to operate on for the missing bits. Padding fills the gap with filler characters so the cipher can be applied; the padding scheme has to be unambiguous so the receiver can strip it after decryption.

#### Relation to stream ciphers via CTR mode

A block cipher run in CTR mode behaves like a stream cipher: the block cipher transforms a counter into a keystream block, and the keystream is XORed with the plaintext, exactly the Vernam pattern. This is the standard way to turn a block cipher into a stream cipher and is also why CTR mode does not need padding — see the [[Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes|modes note]].

### What You Must Know

- The verbatim stream cipher definition: 'encrypts plaintext one bit or one character at a time'.
- The block cipher definition: 'fixed-length blocks', parameters blocklength and keylength.
- AES: Rijndael design, KU Leuven origin, blocklength 128, keylength 128/192/256.
- DES: 56-bit key, deprecated because brute-forceable.
- Vernam is the named stream cipher example; perfect secrecy requires the strict OTP conditions.
- Block ciphers need padding for short final blocks; stream-style modes (CTR) avoid this by acting bit-wise.

### 30-Second Oral Answer

- A stream cipher encrypts the plaintext one bit or one character at a time using a keystream — the Vernam cipher is the canonical example.
- A block cipher encrypts fixed-length blocks of `n` bits under a key; AES uses blocklength 128 and keylength 128/192/256, DES used a 56-bit key and is now deprecated.
- Because block ciphers operate on whole blocks, a short final block must be padded with filler characters to match the blocklength.

### Typical Exam Questions

- Which statement correctly describes a stream cipher? *(Tested verbatim from slide 15.)*
- What is the difference between a stream cipher and a block cipher?
- What is the blocklength and keylength of AES?
- How many possible keys does DES have? *(Tutorial 2 Q10: `2^56`.)*
- Why does a block cipher require padding for the last block?

### Common Pitfalls

- Saying Vernam encrypts in 64-bit blocks — it does not, it is bit-wise.
- Saying AES is a stream cipher — it is a block cipher; CTR mode is what makes a block cipher behave like a stream cipher.
- Confusing blocklength with keylength. For AES the blocklength is fixed at 128 bits, while the keylength varies (128/192/256).
- Treating DES as 'modern symmetric encryption'. DES is the historical example; AES is the current standard.

### Concrete Examples

A protocol header says `AES-256-CBC`. That tells you: AES (blocklength 128 bits), 256-bit key, CBC mode. Plaintext gets chunked into 128-bit blocks; the last short block is padded; each block is XORed with the previous ciphertext before encryption.

A stream-cipher example: a Vernam pad of 1 million random bits is loaded onto two devices. Each device encrypts outgoing traffic by XORing it bit by bit with the pad and discards the pad bits after use. As long as no bit is reused and the pad is truly random, the scheme is perfectly secret. Reuse of any pad bit immediately leaks information about both messages that touched it.

### Worked Examples

**Q.** Tutorial 2 Q4: which statement about the Vernam cipher is correct?

**A.** 'It can provide perfect secrecy only if the key is truly random and used exactly once.' This restates the OTP conditions. The distractor 'It encrypts data in 64-bit blocks' is wrong because Vernam is a stream cipher operating one bit at a time. The distractor 'It uses modular exponentiation with prime numbers' describes RSA — see [[RSA, Modular Exponentiation, and Why Asymmetric is Slow|the RSA note]].

**Q.** Tutorial 2 Part C Q10 (paraphrased): a 56-bit DES key implies how many possible keys?

**A.** `2^56`. The key length in bits is the exponent on the key space; this is why DES is brute-forceable on modern hardware and why AES uses 128 bits or more.

### Related Concepts

- [[Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes|Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes]]
- [[Encryption, Decryption, Key Space, and Exhaustive Search|Encryption, Decryption, Key Space, and Exhaustive Search]]
- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
- [[RSA, Modular Exponentiation, and Why Asymmetric is Slow|RSA, Modular Exponentiation, and Why Asymmetric is Slow]]

## Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes

> [!abstract] Why this note matters
> - Tutorial 2 and the retained course corpus explicitly cover the Vernam cipher, one-time pad conditions, and ECB/CBC/CTR/OFB.
> - Lab 1 already uses OTP misuse as a practical attack pattern, so these ideas need to exist as first-class notes.

### Overview

This topic is where the course stops talking about encryption only in generic terms. The same cipher can behave very differently depending on how it is composed or reused.

The Vernam / OTP material shows the strongest possible secrecy claim and the cleanest failure mode when the usage rules are broken. The mode-of-operation material shows that even with the same underlying block cipher, pattern leakage and engineering tradeoffs can differ sharply.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **Vernam cipher**: A XOR-based stream-cipher construction that becomes a one-time pad only when the key conditions are ideal.
- **one-time pad**: A perfectly secret scheme only if the key is truly random, at least as long as the message, and never reused.
- **ECB**: Electronic Codebook mode; encrypts each plaintext block independently.
- **CBC**: Cipher Block Chaining mode; XORs each plaintext block with the previous ciphertext block before encryption.
- **CTR**: Counter mode; generates keystream blocks by encrypting counter values.
- **OFB**: Output Feedback mode; generates keystream from repeated encryption of evolving state.

### Detailed Explanation

The Vernam cipher encrypts by XORing plaintext with a keystream. It becomes a one-time pad only if the keystream is truly random, long enough, and never reused. The course is careful about this because students often remember 'OTP is perfectly secret' and forget the very strict conditions that make that statement true.

Lab 1 demonstrates the consequence of violating those conditions. If the same pad is reused, then the relationship between ciphertexts leaks structure, and a known-plaintext attack can recover pad information and expose another message. That is why OTP misuse is not a small bug; it destroys the central security guarantee.

Block-cipher modes make the same broader point. ECB encrypts blocks independently, so repeated plaintext blocks remain repeated ciphertext blocks. CBC reduces that leakage by chaining blocks. CTR and OFB instead generate keystream-like values, which changes both the leakage properties and the implementation behavior.

The course does not require deep formal proofs of these modes. What it does require is high-level reasoning: what repeats, what chains, what behaves like a keystream, and what the practical implications are for confidentiality and implementation.

### How It Works

OTP/Vernam encryption is based on XOR between message data and a keystream or pad.

Reusing the same OTP pad across messages leaks relations between plaintexts.

ECB treats blocks independently, so repeated structure leaks.

CBC adds dependency by combining each block with previous ciphertext.

CTR and OFB turn the block cipher into a keystream-producing mechanism in different ways.

### What You Must Know

- Conditions required for OTP to be perfectly secure.
- Why OTP reuse breaks confidentiality.
- The main weakness of ECB.
- The high-level differences among CBC, CTR, and OFB.

### 30-Second Oral Answer

- OTP is perfectly secure only under strict one-time random-key conditions.
- ECB leaks repeated-block structure, while CBC, CTR, and OFB change how blocks or keystreams are combined.

### Typical Exam Questions

- What conditions are required for a one-time pad to be perfectly secure?
- Why does OTP reuse fail?
- Why is ECB weaker than CBC for structured data?
- Why is CTR often described as suitable for high-speed or parallel-friendly use?

### Common Pitfalls

- Calling any XOR-based scheme a one-time pad.
- Thinking ECB is safe for patterned data because the underlying block cipher is strong.
- Confusing CBC chaining with CTR counter generation.

### Concrete Examples and Commands

#### OTP reuse relation

```text
c1 = m1 XOR k
c2 = m2 XOR k
c1 XOR c2 = m1 XOR m2
```

The key cancels when reused across two ciphertexts, exposing a relation between the plaintexts and enabling known-plaintext recovery.

#### Mode comparison shorthand

```text
ECB: same plaintext block -> same ciphertext block
CBC: block mixed with previous ciphertext before encryption
CTR: encrypt counters to make a keystream
OFB: repeatedly encrypt evolving state to make a keystream
```

### Worked Examples

#### Why the ECB image-pattern problem exists

If structured plaintext contains many repeated blocks, ECB can preserve visible repetition patterns because each block is encrypted in isolation.

That is why ECB's weakness is a structural leakage issue rather than a claim that the underlying block primitive is broken.

### Related Concepts

- [[Encryption, Decryption, Key Space, and Exhaustive Search|Encryption, Decryption, Key Space, and Exhaustive Search]]
- [[Attack Models and Adversary Capabilities|Attack Models and Adversary Capabilities]]
- [[Lab 1 and Lab 2 Cryptography, Authentication, and Web Weaknesses|Lab 1 and Lab 2: Cryptography, Authentication, and Web Weaknesses]]

## Hash Functions, Collision Resistance, and Digital Signatures

> [!abstract] Why this note matters
> - Tutorial 2 asks directly about one-wayness, collision resistance, and digital signatures.
> - Passwords, integrity, and signature reasoning all depend on distinguishing the hash properties correctly.

### Overview

Hash functions are not encryption. They are fixed transformations used for integrity, indexing, password verification, and signature construction. That means the security questions are different from secrecy questions.

The tutorial material highlights three properties that students often mix up: one-wayness, collision resistance, and second-preimage resistance. The course expects you to keep them separate.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **one-way property**: It should be computationally infeasible to recover the original input from the hash output.
- **collision resistance**: It should be computationally infeasible to find two distinct inputs with the same hash.
- **second-preimage resistance**: Given one input, it should be hard to find a different input with the same hash.
- **digital signature**: A cryptographic mechanism that provides integrity, origin authentication, and usually non-repudiation.

### Detailed Explanation

One-wayness is about inversion: given the digest, can you recover the input? Collision resistance is about finding any two different inputs with the same digest. Second-preimage resistance is narrower: given one specific input, can you find another that collides with it?

Digital signatures rely on hash functions because it is usually more efficient to sign a digest of the message than the full message, and because a secure digest binds the signature to message integrity. The signature then provides proof of origin and protection against tampering.

This distinction also matters for later authentication notes. Password hashes are not encrypted passwords waiting to be decrypted. They are digests that must be recomputed and compared, which is why salts, stretching, and secret peppers matter.

The exam value of this topic is precision. Students often say 'hashing proves integrity' without explaining why. A stronger answer says integrity checking works because any meaningful change to the message should change the digest, and a signature over that digest lets the verifier detect tampering and confirm who signed it.

### How It Works

If the question is 'can you recover the input from the hash?', think one-wayness.

If the question is 'can you find any two messages with the same digest?', think collision resistance.

If the question is 'can you forge a different message that matches this message's digest?', think second-preimage resistance.

If the question is about signatures, separate the hash role from the signing-key role: the hash compresses and binds the message, while the signing operation authenticates the digest.

### What You Must Know

- The difference between one-wayness, collision resistance, and second-preimage resistance.
- What digital signatures are intended to provide: integrity, origin authentication, and non-repudiation.
- That hash functions are not secrecy tools in the same sense as encryption.

### 30-Second Oral Answer

- Hash properties answer different questions: inversion, any collision, or targeted collision.
- Digital signatures use these properties to bind identity and integrity to a message.

### Typical Exam Questions

- What is collision resistance?
- What is the difference between one-wayness and second-preimage resistance?
- What do digital signatures provide?

### Common Pitfalls

- Using 'collision resistance' for every hash-security property.
- Calling signatures an encryption mechanism for confidentiality.
### Related Concepts

- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]

## Message Authentication Codes (MACs)

> [!abstract] Why this note matters
> - Tutorial 2 Q10 directly asks when a MAC is preferable to a digital signature and vice versa.
> - Lecture 2 introduces MACs as the symmetric counterpart to digital signatures: same integrity and origin guarantees, no non-repudiation.
> - Confusing MAC and signature is one of the easiest ways to lose marks on the integrity questions.

### Overview

A Message Authentication Code (MAC) is a tag computed over a message using a shared secret key. It tells the receiver two things: the message was not altered in transit (integrity), and it came from someone who holds the same key (origin). It does not tell the receiver which of the key-holders sent it — that is the property MACs deliberately do not have.

The course presents MACs alongside digital signatures because they answer almost the same question but with very different trust assumptions. A signature uses asymmetric keys and gives non-repudiation. A MAC uses one shared symmetric key and gives no non-repudiation, but is much faster.

### Exam Focus

- Tier 1 priority.
- Written to align with Lecture 2 (slides 41-43) and Tutorial 2 Q10.

### Core Definitions

- **MAC (Message Authentication Code)**: A short tag `t = M_k(m)` computed over a message `m` using a secret key `k` shared between sender and receiver.
- **Tag**: The output of the MAC algorithm; appended to the message and sent alongside it.
- **Verification**: The receiver recomputes the tag with the same key and accepts the message if and only if the recomputed tag matches the received tag.
- **Origin authentication**: Assurance that the message came from one of the key-holders.
- **Integrity**: Assurance that the message has not been altered.

### Detailed Explanation

The MAC algorithm `M` takes a key `k` and a message `m` and produces a tag `t = M_k(m)`. The sender transmits the pair `(m, t)`. The receiver, who also holds `k`, recomputes `M_k(m')` on whatever message `m'` they received and compares it against the transmitted `t`. Equal tags mean the message is valid; unequal tags mean it has been tampered with or did not come from the key-holder.

The security argument is symmetric. Because only key-holders can compute valid tags, an outsider who does not know `k` cannot produce a tag that will verify, so they cannot inject a forged message under the legitimate sender's identity. They also cannot meaningfully alter a real message in transit, because changing `m` would require recomputing `t`, which they cannot do without `k`.

This is exactly the integrity-plus-origin story digital signatures tell, with one important loss. Because both parties hold the same key, neither party can prove to a third party which of them produced a tag. Either of them could have. That is why MACs do not provide non-repudiation, and it is the single point that decides whether the exam answer should be 'MAC' or 'signature'.

The same reason MACs lack non-repudiation is also the reason they are practical for high-volume integrity work: there is no asymmetric operation on the critical path, so the cost is comparable to a hash, not to a public-key signature.

### How It Works

#### Tag generation and verification (Lecture 2 slides 41-43)

1. **Compute the tag**: sender runs `t = M_k(m)` and sends `(m, t)` to the receiver.
2. **Verify the tag**: receiver, given `(m', t')`, computes `M_k(m')` and accepts if and only if it equals `t'`.

Both sides must share `k` ahead of time over a secure channel.

#### MAC vs digital signature

| Property | MAC | Digital signature |
|---|---|---|
| Key type | Symmetric (shared key `k`) | Asymmetric (signing private key, verification public key) |
| Who can produce a valid tag | Any holder of `k` | Only the holder of the signing private key |
| Who can verify | Any holder of `k` | Anyone with the verification public key |
| Integrity | Yes | Yes |
| Origin authentication | Yes, to key-holders | Yes, publicly |
| Non-repudiation | No (either party could have made it) | Yes (only the private-key holder could have) |
| Speed | Fast (hash-like cost) | Slow (asymmetric crypto) |
| Best use case | High-volume integrity between two parties who already share a key | Public attestation, legal contexts, anything needing third-party proof |

### What You Must Know

- The MAC formula `t = M_k(m)` and the verify-by-recompute pattern.
- That MAC gives integrity and origin but **not** non-repudiation.
- The reason non-repudiation is missing: both parties hold the same key, so neither can prove to a third party who produced the tag.
- That MAC is much faster than a signature because there is no public-key operation.

### 30-Second Oral Answer

- A MAC is a tag `t = M_k(m)` computed with a shared secret key; the receiver recomputes the same tag with the same key to verify.
- It ensures integrity and origin authentication between the two key-holders.
- It does not give non-repudiation, because either key-holder could have produced the tag — for non-repudiation you need a digital signature with an asymmetric signing key.

### Typical Exam Questions

- What does a MAC guarantee, and what does it not guarantee?
- Explain how a MAC is generated and verified.
- When would you choose a MAC over a digital signature, and vice versa? *(Tutorial 2 Q10.)*
- Why does a MAC fail to provide non-repudiation?

### Common Pitfalls

- Claiming MACs provide non-repudiation. They do not, by construction.
- Confusing MAC with a hash. A bare hash has no key and gives no origin authentication — anyone can recompute it.
- Confusing MAC with a digital signature. The asymmetry of keys is what gives signatures their extra property; MACs are intentionally symmetric.
- Forgetting that key distribution is still a problem — MAC verification assumes both sides already share `k`.

### Concrete Examples

A storage system uses HMAC-SHA-256 to protect file integrity. The server and the client share a secret key. Every time the client uploads a file, it sends the file plus an HMAC tag. The server recomputes the HMAC with the same key and refuses the upload if the tags do not match. This catches transmission errors and any attacker who tampered with the file in flight, since they do not know the key.

The same architecture would be a bad fit for, say, signed software updates that a vendor distributes to thousands of customers. Each customer would need the same key as the vendor, which both leaks the ability to forge updates and prevents the vendor from later proving that a particular customer received a specific update. That is a signature problem, not a MAC problem.

### Worked Examples

**Q.** Alice and Bob share a MAC key `k`. Alice sends Bob `(m, t)` where `t = M_k(m)`. Bob receives `(m', t)` and the tag verifies. Bob then claims Alice sent `m'`. Can Alice deny it credibly to a judge?

**A.** Yes — credibly. Because Bob also holds `k`, Bob could equally have produced `(m', t)` himself. The judge has no way to distinguish a tag Alice made from a tag Bob made. This is exactly the missing non-repudiation property. If non-repudiation were required, Alice would need to have signed `m` with her own signing private key instead.

**Q.** When is a MAC the right choice?

**A.** When both parties trust each other, share a key already, and need fast integrity-and-origin checks at high throughput — for example, protecting message frames inside a single TLS session, or authenticating storage blocks within an organization. The asymmetric guarantees of a signature would be wasted work in that setting.

### Related Concepts

- [[Hash Functions, Collision Resistance, and Digital Signatures|Hash Functions, Collision Resistance, and Digital Signatures]]
- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
- [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]]

## Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI

> [!abstract] Why this note matters
> - The syllabus explicitly requires symmetric and asymmetric cryptography and PKI.
> - Tutorial 2 asks about the comparative advantage of public-key encryption and hybrid encryption.

### Overview

Symmetric encryption is usually efficient for bulk data, but key distribution is difficult because both parties need the shared secret securely in advance. Asymmetric encryption makes key distribution easier, but it is usually more computationally expensive for large data.

Hybrid encryption combines the strengths of both. This is the practical pattern the course wants you to understand: use public-key techniques to protect a fresh symmetric session key, then use the symmetric key for the actual data.

### Exam Focus

- Tier 1 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **symmetric encryption**: A setting where the **same shared secret key is used for both encryption AND decryption** (Lecture 2 slide 12 — the exact framing the past exam tested).
- **asymmetric encryption**: A setting using a public key and a private key with different roles — the public encryption key `e_B` encrypts, the private decryption key `d_B` decrypts.
- **hybrid encryption**: A system where a random symmetric key `k` encrypts the data and that symmetric key is then protected with the recipient's asymmetric public key `e_B`.
- **PKI**: Public Key Infrastructure; the collection of certificates, trust relationships, policies, and procedures used to bind public keys to identities.

### Detailed Explanation

Public-key cryptography solves a key-distribution problem, not every problem. It allows a sender to use a recipient's public key without already sharing a secret. That convenience is why tutorial questions identify secure key distribution as the major advantage of asymmetric schemes.

Hybrid encryption exists because asymmetric encryption is not usually the right tool for encrypting large volumes of application data directly. Instead, the sender generates a random symmetric key, encrypts the message with that key, and then protects the symmetric key with the recipient's public key.

PKI provides the trust layer that makes public keys meaningful in real systems. A public key is useful only if you can trust whose key it is. Certificates, issuers, validation, and trust anchors provide that binding.

The retained course corpus goes one step further and discusses certificates explicitly. That means PKI should be understood as an operational trust framework, not just as a vague idea that 'public keys have certificates attached'. The important point is that a relying party accepts a public key because it accepts the binding and the issuer chain behind that binding.

A certificate therefore packages identity information, a public key, and issuer-backed metadata such as serial number and validity period. In a real deployment, the public key becomes usable only after the relying party validates that certificate information against a trust base.

### How It Works

Symmetric: both sides need the **same shared secret key**; the same `k` performs encryption and decryption.

Asymmetric: the public key `e_B` can be shared openly while the private key `d_B` remains secret. Encryption is `c = E_{e_B}(m)`; decryption is `m = D_{d_B}(c)`.

#### Hybrid encryption (Lecture 2 slide 23)

The hybrid encryption process is the enumerated three-step pattern the slide tests:

1. **Generate a fresh random symmetric key `k`.**
2. **Encrypt the message `m` with `k`** using a symmetric cipher (e.g. AES): `c = E_k(m)`.
3. **Encrypt the symmetric key `k` with the recipient's public key `e_B`**: `E_{e_B}(k)`.

The sender transmits both pieces: the symmetric-encrypted payload `E_k(m)` and the asymmetric-encrypted key `E_{e_B}(k)`. The recipient decrypts `k` with their private key `d_B`, then uses `k` to decrypt the payload. This combines the efficiency of symmetric encryption for bulk data with the convenience of public-key encryption for key distribution. See [[RSA, Modular Exponentiation, and Why Asymmetric is Slow|the RSA note]] for why the asymmetric step has to be reserved for the key, not the payload.

#### PKI

PKI uses certificates and trust chains to decide whether a public key belongs to the claimed entity. Certificate-based trust means the verifier must validate not only the key itself, but also the certificate chain and whether the binding is still trustworthy in context. The structural detail — the nine X.509 fields, the CA's pre-issuance checks, and the impersonation-resistance argument — is in the dedicated note: [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]].

### What You Must Know

- Why asymmetric encryption simplifies key distribution.
- Why hybrid encryption is a practical real-world design.
- What PKI is for at a high level.

### 30-Second Oral Answer

- Symmetric encryption is fast but hard to distribute securely; asymmetric encryption improves key distribution but is expensive for bulk data.
- Hybrid encryption uses both: public-key protection for a fresh symmetric session key, then symmetric encryption for the message.
- PKI makes public keys trustworthy by binding them to identities through certificates and trust structure.

### Typical Exam Questions

- What is the main advantage of public-key cryptography over symmetric cryptography?
- How does hybrid encryption work?
- What role does PKI play in secure systems?

### Common Pitfalls

- Claiming asymmetric cryptography removes the need for private keys.
- Forgetting that PKI is about trust and identity binding, not only about key generation.
### Related Concepts

- [[Hash Functions, Collision Resistance, and Digital Signatures|Hash Functions, Collision Resistance, and Digital Signatures]]
- [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]]
- [[RSA, Modular Exponentiation, and Why Asymmetric is Slow|RSA, Modular Exponentiation, and Why Asymmetric is Slow]]
- [[Message Authentication Codes (MACs)|Message Authentication Codes (MACs)]]
- [[Stream Ciphers vs Block Ciphers — Formal Definitions|Stream Ciphers vs Block Ciphers — Formal Definitions]]
- [[Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy|Key Transport, Key Agreement, Diffie-Hellman, EKE, and Forward Secrecy]]

## RSA, Modular Exponentiation, and Why Asymmetric is Slow

> [!abstract] Why this note matters
> - Tutorial 2 Q4 uses 'modular exponentiation with prime numbers' as a distinguishing distractor for the Vernam cipher — you need to recognise this phrase as describing RSA, not stream ciphers.
> - The exam tests *why* asymmetric encryption is slow, which is the motivation for hybrid encryption in the first place.
> - You will not be asked to derive RSA. You will be asked to recognise it and to explain its cost.

### Overview

RSA is the canonical public-key (asymmetric) encryption scheme. The course does not test the full derivation; it tests recognition. You should be able to look at a description and say 'that is RSA' when it mentions a key pair generated from two large primes, encryption as `c = m^e mod n`, and decryption as `m = c^d mod n`. You should also be able to explain why operations of that shape are slow compared to symmetric ciphers like AES, which is what motivates hybrid encryption.

### Exam Focus

- Tier 1 priority for conceptual recognition; the exam does not ask for the mathematical proof.
- Written to align with Lecture 2 (public-key encryption slides 26-28, hybrid encryption slide 23) and Tutorial 2 Q4 and Part C Q6.

### Core Definitions

- **RSA**: A public-key encryption scheme whose security rests on the difficulty of factoring large integers.
- **Modulus `n`**: Product of two large secret primes, `n = pq`.
- **Public exponent `e`**: Public key value used for encryption.
- **Private exponent `d`**: Private key value used for decryption; chosen so that exponentiating by `d` undoes exponentiating by `e` modulo `n`.
- **Modular exponentiation**: The operation `a^b mod n` — the core RSA primitive.
- **Integer factorization problem**: Given `n = pq`, recover `p` and `q`. Believed to be hard for large `n`, which is the security assumption RSA depends on.

### Detailed Explanation

RSA's key pair is built from two large secret primes `p` and `q`. The public modulus is `n = pq`. The public encryption key is the pair `(n, e)`; the private decryption key is `(n, d)`. Encryption is `c = m^e mod n` and decryption is `m = c^d mod n`. The two exponents are mathematically linked so that they cancel out modulo `n`.

Security depends on the fact that recovering `d` from the public information requires factoring `n`, which is believed to be computationally infeasible for large primes. If an attacker could factor `n`, they could recompute `d` and decrypt anything.

The cost story is what the exam actually leans on. Modular exponentiation on numbers thousands of bits wide is enormously more expensive than the bit-level operations a block cipher like AES performs on 128-bit blocks. AES finishes a block in nanoseconds; an RSA operation can take milliseconds — a gap of several orders of magnitude. Tutorial 2 Part C Q6 makes this concrete: 10,000 messages at 5ms per RSA operation is 50 seconds of pure crypto, while AES would dispatch the same volume in a small fraction of a second.

This cost gap is exactly the reason the course teaches hybrid encryption. You do not use RSA to encrypt the payload. You use RSA once to protect a fresh symmetric key, and then you use the symmetric cipher for everything else. The asymmetric primitive solves the key-distribution problem; the symmetric primitive does the bulk work.

### How It Works

#### Key generation (high level)

1. Pick two large secret primes `p` and `q`.
2. Compute the modulus `n = pq`.
3. Choose a public exponent `e`.
4. Derive the private exponent `d` such that exponentiation by `d` inverts exponentiation by `e` modulo `n`.
5. Publish `(n, e)`; keep `d` (and `p`, `q`) secret.

#### Encryption and decryption

- Encrypt: `c = m^e mod n` using the recipient's public key `(n, e)`.
- Decrypt: `m = c^d mod n` using the private key `(n, d)`.

#### Why it is slow

- Each operation is a modular exponentiation on numbers as wide as the modulus (typically 2048 or 4096 bits today).
- Even with efficient algorithms (square-and-multiply, CRT), the per-operation cost is orders of magnitude greater than a symmetric block cipher operation.
- Symmetric ciphers like AES operate on small blocks (128 bits for AES) using bit-level primitives that hardware accelerates very well, while RSA's arithmetic is inherently big-integer.

#### Why this motivates hybrid encryption

- Public-key crypto is convenient for key distribution: you can use the recipient's published key without prior contact.
- Public-key crypto is impractical for bulk data because of the per-operation cost.
- Hybrid encryption keeps the convenience and discards the cost: generate a fresh symmetric key `k`, encrypt the message `m` with `k`, and encrypt only `k` with the recipient's public key. See [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|the hybrid encryption note]] for the full enumeration.

### What You Must Know

- RSA is recognised by the phrases 'key pair', 'two large primes', and 'modular exponentiation' with `c = m^e mod n` / `m = c^d mod n`.
- Security comes from the hardness of factoring `n = pq`.
- RSA is much slower than symmetric ciphers, which is why hybrid encryption exists.
- The course will not ask you to compute RSA by hand; it will ask you to recognise it and explain its role.

### 30-Second Oral Answer

- RSA is a public-key scheme: the key pair is built from two large secret primes whose product `n` is published as part of the public key.
- Encryption and decryption are modular exponentiations, `c = m^e mod n` and `m = c^d mod n`; security rests on the difficulty of factoring `n`.
- These operations are expensive on large integers, so in practice RSA is used to encapsulate a fresh symmetric key in a hybrid scheme, not to encrypt bulk data directly.

### Typical Exam Questions

- Which of the following describes RSA? *(Distractor: 'modular exponentiation with prime numbers'.)*
- Why is public-key encryption typically slower than symmetric encryption?
- Why is hybrid encryption preferred over using RSA directly on large messages? *(Tutorial 2 Part C Q6.)*
- What problem must remain hard for RSA to remain secure?

### Common Pitfalls

- Mixing RSA up with the Vernam cipher because both involve 'keys' — Vernam is symmetric bit-XOR with a keystream; RSA is asymmetric modular exponentiation.
- Saying RSA is 'broken if you know `n`'. The modulus `n` is public; the secret is the factorisation of `n`.
- Claiming RSA is faster than AES. It is several orders of magnitude slower per operation.
- Calling hybrid encryption a 'weaker' form of encryption. It is the standard form; pure RSA encryption of large payloads is what is unusual.

### Concrete Examples

A TLS handshake is the canonical hybrid pattern. The client and server agree on a fresh symmetric session key using a public-key operation (RSA-style key transport, or Diffie-Hellman), then every byte of the actual HTTPS traffic is encrypted with a symmetric cipher like AES-GCM. The expensive asymmetric step happens once per session; the cheap symmetric step happens for every packet.

A counter-example: encrypting a 1 GB backup directly with RSA. At thousands of RSA blocks per second, this is impractically slow, and the ciphertext would be inflated to multiples of the modulus size. The right pattern is to generate a random AES key, encrypt the backup with AES, and encrypt only the AES key with RSA.

### Worked Examples

**Q.** Tutorial 2 Part C Q6: 10,000 messages, each encrypted with RSA at 5 ms per operation. How long does that take, and why does that motivate hybrid encryption?

**A.** `10,000 * 5 ms = 50,000 ms = 50 seconds` of pure crypto time. The same volume under AES would complete in well under a second. The cost ratio is exactly why hybrid encryption uses RSA only once (to protect the symmetric key) and then runs the bulk encryption with the symmetric cipher.

**Q.** Tutorial 2 Q4 lists 'It uses modular exponentiation with prime numbers' as one of the options about the Vernam cipher. Why is that option wrong, and what does it actually describe?

**A.** Vernam is a stream cipher: it XORs message bits with a keystream of equal length. Modular exponentiation with prime numbers is the operational signature of RSA, not Vernam. The exam uses the phrase deliberately to test whether you can tell the two apart.

### Related Concepts

- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
- [[Stream Ciphers vs Block Ciphers — Formal Definitions|Stream Ciphers vs Block Ciphers — Formal Definitions]]
- [[X.509 Certificates and Certification Authorities|X.509 Certificates and Certification Authorities]]
- [[Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes|Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes]]

## X.509 Certificates and Certification Authorities

> [!abstract] Why this note matters
> - Part B Q3 of the 2025 sample exam was the essay question on certificates, the CA's role, and why the CA's signature prevents impersonation.
> - Lecture 2 builds the PKI layer from this exact slide group: the nine X.509 fields, the CA's pre-issuance duties, and the certificate acquisition workflow with a Distinguished Name (DN).
> - You will not be asked a vague PKI question on the exam. You will be asked to enumerate the fields, name the CA's checks, and explain why a relying party trusts the result.

### Overview

A public-key certificate is the data structure that turns a raw public key into something a relying party can act on. It does that by binding the key to an identity and having that binding signed by a trusted Certification Authority (CA). Without the binding, a published key is just bytes; with the binding and a verified signature, it is a usable trust anchor.

X.509 is the certificate format the course teaches. Lecture 2 gives a single slide listing the nine fields and another two slides on CA responsibilities and how an end-entity acquires a certificate. The exam essay question maps almost one-to-one onto those slides.

### Exam Focus

- Tier 1 priority — this note covers a known past essay question verbatim.
- Written to align with Lecture 2 (slides 47-52) and the provided syllabus.

### Core Definitions

- **X.509 certificate**: A structured record binding a public key to an identity, signed by a CA.
- **Certification Authority (CA)**: A trusted third party that issues certificates by signing the binding between an identity and a public key.
- **Distinguished Name (DN)**: The structured identity an end-entity submits when requesting a certificate.
- **Issuer**: The CA whose signature appears on the certificate.
- **Subject**: The owner whose public key the certificate binds.
- **Relying party**: The party that consumes the certificate and decides whether to trust the binding.

### Detailed Explanation

A certificate is not a key. It is a wrapper around a key that records who the key belongs to, who vouches for that fact, how long the vouching is valid, and what algorithm the vouching uses. The CA's job is to make that wrapper trustworthy enough that a stranger can rely on it without having ever met the subject.

The course models this with three operational pieces. First, the nine X.509 fields define the unit of trust. Second, the CA's pre-issuance checks define what a CA must do before it produces the signature. Third, the acquisition workflow shows how an end-entity actually obtains a certificate, namely by submitting a Distinguished Name and a public key.

The reason the system works against impersonation comes back to one observation: the entire wrapper is signed by the CA, and that signature can only be produced by a holder of the CA's private key. If anyone alters any field or substitutes a different public key into the binding, the digital signature stops verifying under the CA's public key. So a forger has two options, both impractical. They can try to forge the CA's signature, which requires the CA's private key. Or they can try to convince the CA to issue a fresh certificate for an identity they do not control, which is exactly what the CA's pre-issuance checks are designed to block.

This is what makes the certificate, and not the key, the unit of trust in PKI.

### How It Works

#### X.509 certificate fields (Lecture 2 slide 50)

A certificate contains nine fields:

1. **Version** — certificate format version, e.g. X.509v3.
2. **Serial-Number** — uniquely identifies this certificate, used for revocation lookups.
3. **Issuer** — the issuing CA's name.
4. **Validity-Period** — dates Not-Before and Not-After during which the binding is valid.
5. **Subject** — owner's name.
6. **Public-Key info** — pair (Public-Key-Algorithm, Key-Value).
7. **Extension fields** (optional) — Subject-Alternate-Name (SAN list), Basic-Constraints, Key-Usage, CRL-Distribution-Points, and others.
8. **Signature-Algorithm** — (algorithmID, parameters) identifying the algorithm used to sign the certificate.
9. **Digital-Signature** — the signature of the Issuer over all the preceding fields.

The first eight fields are the data being attested to. The ninth is the CA's attestation over that data.

#### CA responsibilities before issuing

Before producing a signature, a CA must:

1. **Verify knowledge of the private key** — the requester must demonstrate that they actually hold the private key matching the public key in the request.
2. **Verify control of computer-addressable identities** — for example domain names or email addresses asserted in the certificate.
3. **Confirm asserted natural-world names** for high-quality certificates — additional vetting for things like corporate identity or extended-validation certificates.

#### Certificate acquisition workflow

End-entities request a certificate from a CA by submitting a Distinguished Name (DN), the public key, and other attributes. The CA performs the checks above. If they pass, the CA fills in the eight data fields and produces the ninth field as a signature over them. The signed certificate is returned to the end-entity and can be published.

#### Why the issuer signature prevents impersonation

The signature covers all the data fields. A verifier recomputes the hash of those fields and checks it against the signature using the CA's public key. Three attack attempts then fail:

- **Tamper with a field** (for example swap the Subject or replace the Public-Key info): the recomputed hash no longer matches the signature, so verification fails.
- **Forge a fresh signed certificate** with a fake binding: this requires producing a valid signature without holding the CA's private key, which is the hardness assumption of the signature scheme.
- **Convince the CA to issue a real certificate for someone else's identity**: this is what the CA's three pre-issuance checks are designed to stop — proof-of-possession of the private key, control of the addressable identity, and confirmation of the natural-world name.

So the security argument is: the binding cannot be altered without breaking the signature, and the binding cannot be freshly forged without either compromising the CA or defeating its identity checks.

### What You Must Know

- The nine X.509 fields, in order, and what each one stores.
- The three CA pre-issuance checks.
- The acquisition workflow (end-entity submits DN + public key + attributes; CA verifies; CA signs).
- The exact security argument: tampering breaks the signature; forgery requires the CA's private key.
- That the certificate, not the key, is what a relying party trusts.

### 30-Second Oral Answer

- An X.509 certificate binds a public key to a Subject's identity using nine fields, the last of which is the CA's digital signature over the other eight.
- Before signing, the CA verifies that the requester holds the matching private key, controls the asserted computer-addressable identities, and (for high-quality certificates) actually has the asserted natural-world name.
- The signature prevents impersonation because any tamper with a field invalidates the signature, and producing a fresh fake binding requires the CA's private key — neither path is available to an attacker.

### Typical Exam Questions

- List the fields contained in an X.509 certificate.
- What are the responsibilities of a Certification Authority before issuing a certificate?
- Describe how an end-entity acquires a certificate from a CA.
- Explain why the digital signature in a certificate prevents an attacker from impersonating the certificate owner. *(Past Part B Q3.)*
- What is the difference between the Issuer and the Subject fields?

### Common Pitfalls

- Confusing the Issuer (CA) with the Subject (owner). The signature is produced by the Issuer, over a binding that names the Subject.
- Saying 'the certificate encrypts the public key'. It does not encrypt anything. It signs a binding.
- Forgetting that revocation depends on the Serial-Number — that is why uniqueness of serials matters operationally.
- Treating the certificate as the trust anchor. The trust anchor is the CA's public key in the relying party's trust store; the certificate is the artifact that anchor verifies.

### Concrete Examples

A browser visits `https://example.com`. The server presents an X.509 certificate whose Subject (or SAN extension) lists `example.com`, whose Public-Key info contains the server's public key, and whose Issuer is a CA the browser already trusts. The browser hashes the data fields, verifies the Digital-Signature field with the CA's public key, checks the Validity-Period, and if everything passes, treats the public key as belonging to `example.com`. Only then does it use that key in the TLS handshake.

### Worked Examples

**Q.** An attacker intercepts a legitimate `example.com` certificate and rewrites the Public-Key info field to contain their own public key, hoping browsers will then encrypt session keys to them. Why does this not work?

**A.** Modifying the Public-Key info changes the data over which the CA's signature was computed. When the browser recomputes the hash and verifies it against the existing Digital-Signature using the CA's public key, the check fails, so the browser rejects the certificate. The attacker would need the CA's private key to re-sign the modified data, and they do not have it.

**Q.** Why are the three CA checks structured the way they are?

**A.** Each check closes a different forgery path. Proof-of-possession blocks an attacker from claiming a key they do not actually hold. Verifying control of the addressable identity blocks issuance of a certificate for a domain the requester does not run. Confirming the natural-world name blocks identity-level fraud. Together they ensure the binding the CA signs reflects reality.

### Related Concepts

- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
- [[Hash Functions, Collision Resistance, and Digital Signatures|Hash Functions, Collision Resistance, and Digital Signatures]]
- [[Message Authentication Codes (MACs)|Message Authentication Codes (MACs)]]
- [[RSA, Modular Exponentiation, and Why Asymmetric is Slow|RSA, Modular Exponentiation, and Why Asymmetric is Slow]]

## Differential and Linear Cryptanalysis

> [!abstract] Why this note matters
> - Tutorial 2 Part B Q4 asks directly about advanced cryptanalytic methods and how a well-designed cipher resists them.
> - The concepts of confusion and diffusion are the standard answer to why AES-like ciphers survive these attacks.

### Overview

Differential and linear cryptanalysis are the two most important classical attacks on block ciphers. They are not brute-force; they exploit mathematical structure in how the cipher maps inputs to outputs. A well-designed cipher must specifically resist both.

### Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

### Core Definitions

- **differential cryptanalysis**: An attack that analyzes how specific differences in plaintext input lead to differences in ciphertext output, exploiting predictable propagation of XOR differences through rounds.
- **linear cryptanalysis**: An attack that exploits statistical linear approximations between bits of the plaintext, key, and ciphertext.
- **confusion**: The property that the relationship between key bits and ciphertext bits is as complex as possible; achieved via substitution (S-boxes).
- **diffusion**: The property that each plaintext bit influences many ciphertext bits, spreading structure across the output; achieved via permutation layers.
- **S-box**: A substitution component in a block cipher designed to introduce non-linearity, resisting linear approximations.

### Detailed Explanation

#### Differential Cryptanalysis

Introduced by Biham and Shamir in the early 1990s. The idea: instead of attacking the cipher directly, study how a chosen difference ΔP between two plaintexts propagates through the cipher's rounds to produce a ciphertext difference ΔC.

If a cipher's round functions are predictable in how they handle XOR differences, the attacker can:
1. Choose many pairs of plaintexts with the same difference ΔP.
2. Observe the corresponding ciphertext pairs.
3. Statistically recover information about the last round key.

**How a well-designed cipher resists it:**
- Strong non-linear S-boxes with low differential uniformity (the maximum probability that a given input difference leads to a given output difference is minimized).
- Sufficient number of rounds to make differential characteristics exponentially unlikely over the full cipher.

#### Linear Cryptanalysis

Introduced by Matsui in 1993. The idea: find a linear equation over GF(2) (XOR) that approximately holds between some plaintext bits, key bits, and ciphertext bits with a probability significantly different from 0.5.

If such a bias exists, the attacker can:
1. Gather enough plaintext/ciphertext pairs.
2. Use the statistical bias to guess key bits.
3. With enough data, recover portions of the key.

**How a well-designed cipher resists it:**
- S-boxes designed with high non-linearity so no linear approximation has a significant bias.
- Diffusion layers (MixColumns in AES) spread linear biases so they cancel out over multiple rounds.

#### Confusion and Diffusion as Defenses

Shannon's two principles for secure cipher design:

- **Confusion** makes the relationship between the key and ciphertext as complex and non-linear as possible. Without confusion, linear approximations are strong.
- **Diffusion** ensures each bit of the plaintext and key affects many bits of the ciphertext. Without diffusion, differential characteristics affect only small parts of the state and are easier to track.

Modern block ciphers (AES, 3DES) combine substitution-permutation networks (SPNs) to achieve both simultaneously.

### How It Works

Differential → exploit predictable input-difference to output-difference propagation → needs low-differential S-boxes + enough rounds to block.

Linear → exploit statistical bias in linear equations over cipher bits → needs high-nonlinearity S-boxes + diffusion to cancel biases.

Confusion → complex key↔ciphertext relationship via substitution (S-boxes).

Diffusion → each input bit affects many output bits via permutations/mixing layers.

### What You Must Know

- What differential cryptanalysis exploits (difference propagation).
- What linear cryptanalysis exploits (statistical linear biases).
- How confusion counters linear cryptanalysis.
- How diffusion counters differential cryptanalysis.
- That a well-designed cipher (e.g., AES) is resistant to both because its S-boxes have low differential uniformity and high non-linearity.

### 30-Second Oral Answer

- Differential cryptanalysis studies how input differences propagate through the cipher; linear cryptanalysis exploits statistical biases in linear bit relationships.
- Confusion (non-linear S-boxes) counters linear attacks; diffusion (mixing layers) counters differential attacks.
- AES was specifically designed to resist both, with a provable security margin for a sufficient number of rounds.

### Typical Exam Questions

- What does differential cryptanalysis attack and how does a well-designed cipher resist it?
- What is the role of confusion and diffusion in a secure block cipher?
- Why are non-linear S-boxes critical in block cipher design?

### Common Pitfalls

- Confusing differential (difference propagation) with linear (statistical bias) — they are separate techniques.
- Thinking confusion = diffusion — they are complementary and distinct properties.
- Forgetting that these attacks are only practical when the number of rounds is insufficient or S-boxes are poorly designed.

### Related Concepts

- [[Attack Models and Adversary Capabilities|Attack Models and Adversary Capabilities]]
- [[Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes|Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes]]
- [[Encryption, Decryption, Key Space, and Exhaustive Search|Encryption, Decryption, Key Space, and Exhaustive Search]]
