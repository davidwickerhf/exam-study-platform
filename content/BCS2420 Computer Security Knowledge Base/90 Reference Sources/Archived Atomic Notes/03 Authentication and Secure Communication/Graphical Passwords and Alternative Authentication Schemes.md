---
tags:
  - university
  - bcs2420
  - computer-security
---

# Graphical Passwords and Alternative Authentication Schemes

> [!abstract] Why this note matters
> - Tutorial 3 Part B Q8 asks to outline two types of graphical password schemes, their security advantages, and a drawback of each.
> - This is an extension of the authentication topic and may appear in short-answer form.

## Overview

Text passwords have well-known usability and security weaknesses. Graphical password schemes attempt to leverage visual and spatial memory, which humans typically handle better than arbitrary character strings. The course treats two main types and their respective attack surfaces.

## Exam Focus

- Tier 2 priority.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **graphical password**: An authentication method where the user's credential is defined by interaction with visual material (clicking, drawing, selecting) rather than typing a text string.
- **cued recall**: A graphical password scheme where the user clicks on pre-selected points in an image in a correct sequence.
- **pure recall (pattern lock)**: A graphical password scheme where the user traces a path or pattern on a grid without any image cue.
- **shoulder surfing**: An attack where someone observes the user's input physically or via camera.
- **smudge attack**: An attack on touchscreen devices where the residue of finger swipes reveals the pattern drawn.

## Detailed Explanation

### Type 1 — Cued Recall (Click-Based)

The user selects a set of click points on one or more images during registration. At login, the same image is presented and the user must click the correct points in sequence.

Example: PassPoints, Cued Click Points.

**Security advantage:**
- Images provide rich spatial cues, making it easier to remember complex or unique click sequences.
- The secret is tied to a spatial location, which is harder to dictionary-attack than a word-based password.
- Large theoretical password space if the image is high-resolution and click tolerance is tight.

**Drawback:**
- Shoulder surfing: an observer watching the screen or a camera recording the session can capture click positions.
- Click hotspots: users tend to click on salient features (faces, corners) of images, which reduces the effective password space and enables predictive attacks.

### Type 2 — Pure Recall / Pattern Lock (Android-style)

The user traces a connected path through a grid of dots (e.g., 3×3 = 9 dots on Android) during registration. At login, the same path must be reproduced.

**Security advantage:**
- Fast to enter; users can reproduce complex paths quickly with practice.
- No text involved; harder to key-log in the traditional sense.

**Drawback:**
- **Smudge attacks**: the finger leaves grease traces on the touchscreen that can reveal the pattern even when the screen is off.
- **Predictable patterns**: studies show users overwhelmingly choose simple patterns (L-shapes, Z-shapes, short paths starting from corners), drastically reducing effective security despite a theoretically large space.

### Comparison with Text Passwords

| Property | Text password | Graphical cued-recall | Pattern lock |
|----------|--------------|----------------------|--------------|
| Memory | Difficult for complex passwords | Easier (spatial cues) | Easier (motor memory) |
| Shoulder surfing | Low risk (keys not visible) | High risk | High risk (visible swipe) |
| Smudge attack | N/A | N/A | High risk |
| Dictionary attack | Yes | Hotspot attacks | Pattern prediction |
| Key logging | Yes | No | No |

## How It Works

Cued recall → image presented → user clicks correct sequence of pre-registered points → tolerance zone checked for each click.

Pattern lock → grid presented → user traces path → system checks correct nodes in correct order.

Both replace memorisation of arbitrary symbols with spatial or motor memory.

## What You Must Know

- Two distinct types: cued recall (click-based) and pure recall (pattern lock).
- One security advantage and one drawback for each.
- Why graphical passwords do not automatically solve the predictability problem.

## 30-Second Oral Answer

- Cued-recall graphical passwords use spatial image cues, reducing memorisation burden but creating shoulder-surfing risk and click-hotspot predictability.
- Pattern locks leverage motor memory but are vulnerable to smudge attacks and highly predictable because users choose simple patterns.
- Both types represent usability improvements over text passwords but introduce different attack surfaces that text passwords do not have.

## Typical Exam Questions

- Outline two types of graphical password schemes and their security advantages.
- What is a smudge attack and which authentication scheme does it target?
- Why do graphical passwords not solve the predictability problem despite offering a large theoretical space?

## Common Pitfalls

- Confusing cued recall (image-based click) with pure recall (pattern grid) — they are distinct schemes.
- Assuming graphical passwords are harder to crack — predictable usage patterns often reduce the effective password space significantly.
- Forgetting that shoulder-surfing is a higher risk for graphical schemes than for text entry because movements are visible.

## Related Concepts

- [[OTPs, Tokens, Biometrics, and Derived Passwords|OTPs, Tokens, Biometrics, and Derived Passwords]]
- [[Password Security Hashing, Salts, Peppers, Stretching, and Guessing Attacks|Password Security: Hashing, Salts, Peppers, Stretching, and Guessing Attacks]]
- [[Authentication, Identification, and Authorization|Authentication, Identification, and Authorization]]

## Sources

- [[03 Security Course Corpus|Security Course Corpus]]
- [Tutorial 3.pdf](100 Extra Materials/Tutorial 3.pdf)
- [Tutorial 3 Solution.pdf](100 Extra Materials/Tutorial 3 Solution.pdf)
