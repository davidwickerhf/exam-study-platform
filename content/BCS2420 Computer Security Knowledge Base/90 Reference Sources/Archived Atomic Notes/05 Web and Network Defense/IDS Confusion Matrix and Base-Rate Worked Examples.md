---
tags:
  - university
  - bcs2420
  - computer-security
---

# IDS Confusion Matrix and Base-Rate Worked Examples

> [!abstract] Why this note matters
> - Lecture 8 and Tutorial L8 Part C both pose calculation-style questions that depend on the IDS confusion matrix.
> - The base-rate problem produces some of the most counter-intuitive results in the course; without practising the arithmetic, the conclusion ("most alarms are false even with a 95% detector") feels wrong.
> - Worked examples here mirror the exact tutorial drills so the same template can be applied in the exam.

## Overview

Intrusion detection is binary classification: each event is either an intrusion or not, and the IDS either alarms or does not. Four outcomes are possible — true positive, false positive, false negative, true negative — and they form the confusion matrix.

From this matrix the course derives five metrics: FPR, TPR (detection rate), FNR, TNR, and AP (alarm precision). The base-rate problem then shows why these metrics can mislead: when actual intrusions are rare, even a low false-positive rate produces overwhelmingly many false alarms.

This note compiles the formulas, the confusion matrix, and the two worked drills from Tutorial L8 Part C so the same arithmetic can be reused in the exam.

## Exam Focus

- Tier 1 priority — Tutorial L8 Part C contains calculation drills that match likely exam questions exactly.
- Written to align with the provided lectures, tutorials, solutions, labs, and syllabus.

## Core Definitions

- **True Positive (TP)**: An intrusion occurred and the IDS raised an alarm.
- **False Positive (FP)**: No intrusion occurred but the IDS raised an alarm.
- **False Negative (FN)**: An intrusion occurred but the IDS did not raise an alarm.
- **True Negative (TN)**: No intrusion occurred and the IDS did not raise an alarm.
- **base rate**: The prior probability that an arbitrary event is an actual intrusion.
- **alarm fatigue**: The operational degradation when a security team learns to ignore alarms because most of them are false.

## The Confusion Matrix

|                       | intrusion (positive)    | no intrusion (negative) |
|-----------------------|-------------------------|-------------------------|
| **alarm raised**      | TP — intrusion detected | FP — false alarm        |
| **no alarm raised**   | FN — intrusion missed   | TN — normal operation   |

## Detailed Explanation

### The Five Formulas

| Metric | Formula | Meaning |
|--------|---------|---------|
| **True Positive Rate (TPR)** | `TPR = TP / (TP + FN)` | Fraction of real intrusions that are detected. Also called the detection rate or recall. |
| **False Positive Rate (FPR)** | `FPR = FP / (FP + TN)` | Fraction of benign events incorrectly alarmed on. |
| **Alarm Precision (AP)** | `AP = TP / (TP + FP)` | Fraction of alarms that are correct. The metric an operator actually feels. |
| **True Negative Rate (TNR)** | `TNR = 1 - FPR` | Fraction of benign events correctly left alone. |
| **False Negative Rate (FNR)** | `FNR = 1 - TPR` | Fraction of real intrusions missed. |

The two useful identities — TNR = 1 - FPR and FNR = 1 - TPR — are time-savers in the exam.

### The Base-Rate Problem in One Sentence

If intrusions are rare, **alarm precision (AP) collapses even when TPR and FPR look good**, because the denominator of AP is dominated by false positives generated from the huge number of benign events.

### Why Two Errors, Not One

The course insists that both FPR and FNR matter:

- High FPR -> alarm fatigue -> real alarms get ignored.
- High FNR -> missed intrusions -> silent compromise.

A single number (e.g., "accuracy") hides this trade-off, which is why the exam emphasises both metrics separately.

## Worked Examples

### Worked Example 1 — Tutorial L8 Part C, Q1: False Positives and Negatives

**Setup.** IDS has FPR = 2%, TPR = 90%. Daily events: 200 real intrusions, 10,000 non-intrusive events.

**False negatives.** FNR = 1 - TPR = 10%. FN = 0.10 × 200 = **20 missed intrusions**.

**False positives.** FP = FPR × benign events = 0.02 × 10,000 = **200 false alarms**.

**Insight.** The IDS produces 200 false alarms per day and misses 20 real intrusions. Even with a 2% FPR, the absolute number of false alarms equals the count of real intrusions in this scenario.

### Worked Example 2 — Tutorial L8 Part C, Q2: Anomaly Alert Volume

**Setup.** 1,000,000 events/day; 200 are real attacks; TPR = 90%; FPR = 2%.

**Real detections.** TP = 0.90 × 200 = **180 true positives**.

**False alarms.** FP = 0.02 × (1,000,000 - 200) = 0.02 × 999,800 = **19,996 false positives**.

**Total alarms.** Total = 180 + 19,996 ≈ **20,176 alarms**, of which only **180 are real** — roughly 0.9% alarm precision.

**Insight.** This is the operational version of the base-rate problem. A 90% detection rate sounds excellent, but the analyst sees twenty thousand alarms a day and 99% of them are spurious.

### Worked Example 3 — Tutorial L8 Part B, Q2: Base-Rate Drill

**Setup.** TPR = 95%, FPR = 1%, attack rate 1 per 10,000 events, total 100,000 events.

**Attacks.** 100,000 × (1/10,000) = **10 attacks**.

**Detected attacks.** TP = 0.95 × 10 ≈ **9 (specifically 9.5)**.

**Non-attacks.** 100,000 - 10 = 99,990.

**False alarms.** FP = 0.01 × 99,990 ≈ **1,000 (specifically 999.9)**.

**Result.** Roughly **9 true positives vs ~1,000 false positives**. Alarm precision ≈ 9 / 1,009 ≈ 0.9%.

**Insight.** This is the canonical base-rate fallacy result. A 95% detector with a 1% FPR generates a hundred times more false alarms than real ones when attacks are rare. The lecture term for the operational consequence is **alarm fatigue**.

### Worked Example 4 — Tutorial L8 Part C, Q4: DoS Bandwidth

**Setup.** Attacker floods at 100,000 pps (packets per second), each packet 512 bytes.

**Bytes per second.** 100,000 × 512 = 51,200,000 bytes/s = **51.2 MB/s**.

**Bits per second.** 51,200,000 × 8 = 409,600,000 bits/s = **~410 Mbps**.

**Saturation check.** Target uplink = 100 Mbps. Attack is ~410 Mbps. **Yes, this saturates the link** (about 4× over capacity, ignoring overhead).

**Insight.** A modest packet-per-second rate at moderate packet size easily saturates a 100 Mbps link. The arithmetic is mechanical but the exam expects bits-versus-bytes care.

## How It Works

Build the 2×2 confusion matrix -> compute TP, FP, FN, TN from rates and event counts -> derive TPR, FPR, AP, TNR, FNR.

Base-rate problem: rare attacks + many benign events -> FP dominates the numerator of total alarms -> AP collapses even when TPR is high.

DoS bandwidth: pps × bytes per packet × 8 -> bits per second -> compare to link capacity.

## What You Must Know

- The confusion matrix layout (alarm raised × intrusion present).
- The five formulas: TPR, FPR, AP, TNR = 1 - FPR, FNR = 1 - TPR.
- The base-rate problem: rare events make alarm precision collapse.
- The Tutorial L8 Part C arithmetic templates.
- DoS bandwidth conversion: pps × bytes × 8 = bits per second.

## 30-Second Oral Answer

- The IDS confusion matrix has four cells (TP, FP, FN, TN); the five metrics derive from it.
- TPR = TP/(TP+FN), FPR = FP/(FP+TN), AP = TP/(TP+FP), with TNR = 1-FPR and FNR = 1-TPR as shortcuts.
- When the base rate of attacks is low, a small FPR still produces many more false alarms than real ones — that is the base-rate problem and it causes alarm fatigue.

## Typical Exam Questions

- Given TPR = 90% and FPR = 2%, with 200 intrusions and 10,000 benign events, compute false negatives and false positives. *(Answer: 20 FN, 200 FP.)*
- An IDS with TPR = 95% and FPR = 1% sees 100,000 events with attacks at 1 in 10,000. How many true vs false alarms? *(Answer: ~9 TP vs ~1,000 FP.)*
- An attacker sends 100,000 pps at 512 bytes per packet. What bandwidth is this in Mbps, and can it saturate a 100 Mbps link? *(Answer: ~410 Mbps; yes.)*
- Why does an anomaly-based IDS with low FPR still produce mostly false alarms when intrusions are rare?

## Common Pitfalls

- Mixing up TPR's denominator (real intrusions, TP+FN) with FPR's denominator (benign events, FP+TN). They are different totals.
- Reporting AP as the "false positive rate". AP is alarm precision; FPR is fraction of benigns alarmed on. They are very different.
- Forgetting the bits-versus-bytes factor of 8 in DoS bandwidth calculations.
- Stating "the IDS is 95% accurate, so 95% of alarms are correct". The relationship between TPR and AP depends on the base rate.

## Concrete Examples and Commands

### Confusion-matrix template

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

### Tutorial L8 Part C drill template

```text
Given: TPR, FPR, base rate, total events N
Step 1: Real intrusions = base rate × N
Step 2: Benign events   = N - real intrusions
Step 3: TP = TPR × real intrusions
Step 4: FP = FPR × benign events
Step 5: AP = TP / (TP + FP)   <-- the operational truth
```

### DoS bandwidth template

```text
Given: pps (packets/s), bytes per packet
bytes/s = pps × bytes
bits/s  = bytes/s × 8
Mbps    = bits/s / 1,000,000
Compare to link capacity; saturates if Mbps > link capacity.
```

## Related Concepts

- [[IDS, IPS, HIDS, NIDS, and Detection Models|IDS, IPS, HIDS, NIDS, and Detection Models]]
- [[DDoS, Alarm Quality, and Detection Interpretation|DDoS, Alarm Quality, and Detection Interpretation]]
- [[IDS Evasion, Vulnerability Scanners, and Advanced Detection|IDS Evasion, Vulnerability Scanners, and Advanced Detection]]
- [[SYN Flooding, Smurf, Amplification, and DoS Techniques|SYN Flooding, Smurf, Amplification, and DoS Techniques]]

## Sources

- [[01 Syllabus and Course Policies|Syllabus and Course Policies]]
- [[02 Source Inventory|Source Inventory]]
- [[03 Security Course Corpus|Security Course Corpus]]
- [Lecture 08 — Intrusion Detection and WLAN Security.pdf](Materials/01 Lectures/Lecture 08 — Intrusion Detection and WLAN Security.pdf)
- [Tutorial L8.pdf](Materials/02 Tutorials/Tutorial L8.pdf)
- [Tutorial L8 Solution.pdf](Materials/02 Tutorials/Tutorial L8 Solution.pdf)
