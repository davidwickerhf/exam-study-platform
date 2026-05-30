---
tags:
  - university
  - bcs2420
  - computer-security
---

# Stream Ciphers vs Block Ciphers — Formal Definitions

> [!abstract] Why this note matters
> - Lecture 2 slide 15's stream cipher definition has been tested verbatim on past exams — 'one bit or one character at a time'.
> - The block cipher slide pairs blocklength `n` and keylength terminology that the exam expects you to use correctly (for AES: blocklength = 128, keylength = 128/192/256).
> - DES (56-bit, deprecated) and AES (Rijndael, KU Leuven) are the two canonical examples; both appear in Tutorial 2 Part A questions about key spaces and modern symmetric design.

## Overview

Symmetric encryption splits into two structural families: stream ciphers, which process the plaintext one bit or one character at a time, and block ciphers, which process the plaintext in fixed-length chunks. The course wants you to be able to state the formal definitions verbatim, recognise the canonical examples (Vernam for stream, DES and AES for block), and explain why block ciphers need padding for short final blocks.

## Exam Focus

- Tier 1 priority.
- Written to align with Lecture 2 (slides 15-18) and Tutorial 2 Q4, Q8, Q10.

## Core Definitions

- **Stream cipher**: An encryption scheme that processes plaintext one bit or one character at a time, combining each unit with a corresponding unit from a keystream.
- **Block cipher**: An encryption scheme that processes plaintext in fixed-length blocks.
- **Blocklength `n`**: The block size in bits (e.g. 128 for AES).
- **Keylength**: The key size in bits (e.g. 128, 192, or 256 for AES).
- **Padding**: Extra 'filler' characters appended to a short final plaintext block so it matches the cipher's blocklength.
- **Keystream**: For stream ciphers, the sequence of key units `k_1 k_2 k_3 ...` combined with the plaintext units.

## Detailed Explanation

The stream-versus-block distinction is structural and decides how the cipher consumes its input. A stream cipher pretends the plaintext is an indefinitely long sequence of small units (typically bits) and processes each one as it arrives. The encryption operation is usually some form of bit-level combination — for the Vernam cipher, XOR with a key bit of equal weight, `c_i = m_i XOR k_i`. A block cipher refuses to process anything smaller than its blocklength. It treats the plaintext as a sequence of `n`-bit blocks and applies a single keyed transformation to each block.

Two consequences follow immediately. First, block ciphers always need a story for what to do when the plaintext does not divide evenly into `n`-bit blocks — the lecture explicitly mentions appending 'filler' characters until the last block is full. Second, block ciphers always need a story for what to do across multiple blocks, which is the role of block-cipher modes (ECB, CBC, CTR), covered in the [[Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes|modes note]].

The two canonical block ciphers the course names are DES and AES. DES is the historical 56-bit standard and is treated as deprecated because its key space (`2^56`) is brute-forceable today — Tutorial 2 Q10 uses this exact figure. AES (Advanced Encryption Standard) is the current standard, built from the Rijndael design by researchers at KU Leuven. AES fixes the blocklength at 128 bits and supports key lengths of 128, 192, or 256 bits.

The Vernam cipher is the canonical stream-cipher example. It encrypts bit by bit and shares a keystream of equal length to the message. Used correctly (key truly random, exactly the message length, never reused) it gives perfect secrecy — the one-time pad. Any reuse or shortcut breaks the guarantee.

## How It Works

### Stream cipher (Lecture 2 slide 15)

- Plaintext `m = m_1 m_2 m_3 ...` is consumed one bit (or one character) at a time.
- Each unit is combined with the corresponding unit of a keystream `k = k_1 k_2 k_3 ...`.
- For Vernam: `c_i = m_i XOR k_i`, decryption `m_i = c_i XOR k_i`.
- Vernam is the explicit example named in the slides.

### Block cipher (Lecture 2 slide 17)

- Plaintext is split into fixed-length blocks of `n` bits.
- Each block is transformed under the key: `c_i = E_k(m_i)`.
- Two parameters define a block cipher: blocklength `n` (block size in bits) and keylength (key size in bits).
- If the last plaintext block has fewer than `n` bits, it is padded with 'filler' characters until it matches the blocklength.

### The canonical examples

| Cipher | Family | Blocklength | Keylength | Status |
|---|---|---|---|---|
| Vernam (OTP) | Stream | 1 bit | length of message | Perfectly secret if used correctly; impractical key management |
| DES | Block | 64 bits | 56 bits | Deprecated — `2^56` is brute-forceable |
| AES (Rijndael) | Block | 128 bits | 128, 192, or 256 bits | Current standard; designed at KU Leuven |

### Why blocks need padding

A block cipher's transformation is defined only for inputs of exactly `n` bits. If the final plaintext block is shorter, the cipher has nothing to operate on for the missing bits. Padding fills the gap with filler characters so the cipher can be applied; the padding scheme has to be unambiguous so the receiver can strip it after decryption.

### Relation to stream ciphers via CTR mode

A block cipher run in CTR mode behaves like a stream cipher: the block cipher transforms a counter into a keystream block, and the keystream is XORed with the plaintext, exactly the Vernam pattern. This is the standard way to turn a block cipher into a stream cipher and is also why CTR mode does not need padding — see the [[Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes|modes note]].

## What You Must Know

- The verbatim stream cipher definition: 'encrypts plaintext one bit or one character at a time'.
- The block cipher definition: 'fixed-length blocks', parameters blocklength and keylength.
- AES: Rijndael design, KU Leuven origin, blocklength 128, keylength 128/192/256.
- DES: 56-bit key, deprecated because brute-forceable.
- Vernam is the named stream cipher example; perfect secrecy requires the strict OTP conditions.
- Block ciphers need padding for short final blocks; stream-style modes (CTR) avoid this by acting bit-wise.

## 30-Second Oral Answer

- A stream cipher encrypts the plaintext one bit or one character at a time using a keystream — the Vernam cipher is the canonical example.
- A block cipher encrypts fixed-length blocks of `n` bits under a key; AES uses blocklength 128 and keylength 128/192/256, DES used a 56-bit key and is now deprecated.
- Because block ciphers operate on whole blocks, a short final block must be padded with filler characters to match the blocklength.

## Typical Exam Questions

- Which statement correctly describes a stream cipher? *(Tested verbatim from slide 15.)*
- What is the difference between a stream cipher and a block cipher?
- What is the blocklength and keylength of AES?
- How many possible keys does DES have? *(Tutorial 2 Q10: `2^56`.)*
- Why does a block cipher require padding for the last block?

## Common Pitfalls

- Saying Vernam encrypts in 64-bit blocks — it does not, it is bit-wise.
- Saying AES is a stream cipher — it is a block cipher; CTR mode is what makes a block cipher behave like a stream cipher.
- Confusing blocklength with keylength. For AES the blocklength is fixed at 128 bits, while the keylength varies (128/192/256).
- Treating DES as 'modern symmetric encryption'. DES is the historical example; AES is the current standard.

## Concrete Examples

A protocol header says `AES-256-CBC`. That tells you: AES (blocklength 128 bits), 256-bit key, CBC mode. Plaintext gets chunked into 128-bit blocks; the last short block is padded; each block is XORed with the previous ciphertext before encryption.

A stream-cipher example: a Vernam pad of 1 million random bits is loaded onto two devices. Each device encrypts outgoing traffic by XORing it bit by bit with the pad and discards the pad bits after use. As long as no bit is reused and the pad is truly random, the scheme is perfectly secret. Reuse of any pad bit immediately leaks information about both messages that touched it.

## Worked Examples

**Q.** Tutorial 2 Q4: which statement about the Vernam cipher is correct?

**A.** 'It can provide perfect secrecy only if the key is truly random and used exactly once.' This restates the OTP conditions. The distractor 'It encrypts data in 64-bit blocks' is wrong because Vernam is a stream cipher operating one bit at a time. The distractor 'It uses modular exponentiation with prime numbers' describes RSA — see [[RSA, Modular Exponentiation, and Why Asymmetric is Slow|the RSA note]].

**Q.** Tutorial 2 Part C Q10 (paraphrased): a 56-bit DES key implies how many possible keys?

**A.** `2^56`. The key length in bits is the exponent on the key space; this is why DES is brute-forceable on modern hardware and why AES uses 128 bits or more.

## Related Concepts

- [[Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes|Vernam Cipher, One-Time Pad Misuse, and Block Cipher Modes]]
- [[Encryption, Decryption, Key Space, and Exhaustive Search|Encryption, Decryption, Key Space, and Exhaustive Search]]
- [[Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI|Symmetric vs Asymmetric Encryption, Hybrid Encryption, and PKI]]
- [[RSA, Modular Exponentiation, and Why Asymmetric is Slow|RSA, Modular Exponentiation, and Why Asymmetric is Slow]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- Lecture 2 — Cryptography Basics, slides 14-18: [Lecture 02 — Cryptography Basics.pdf](../Materials/01%20Lectures/Lecture%2002%20%E2%80%94%20Cryptography%20Basics.pdf)
- [Tutorial 2.pdf](../Materials/02%20Tutorials/Tutorial%202.pdf)
- [Tutorial 2 Solution.pdf](../Materials/02%20Tutorials/Tutorial%202%20Solution.pdf)
