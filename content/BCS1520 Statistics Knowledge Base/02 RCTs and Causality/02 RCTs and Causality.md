# Topic 2 — RCTs and Causality

**Source lectures:** Lecture 3 (RCTs and Causality)
**Tested by:** Mock Q1a (double-blind), Q9a (correlation ≠ causation), Q9b (design an RCT)
**Approximate mock points:** ~10

---

## What the Exam Asks

1. **Define an RCT** and the role of randomisation, control, blinding.
2. **Identify what a correlation of 0 means** for causality (Q9a).
3. **Design an RCT** for a stated claim, end-to-end (Q9b, 6 pts).

---

## Why RCTs Are the Gold Standard

Causality (X causes Y) requires more than association (X correlates with Y). Observational studies face three threats:

1. **Confounders** — a third variable Z drives both X and Y (smoking and yellow fingers — fingers don't cause smoking)
2. **Reverse causation** — Y causes X, not the other way around (does stress cause illness, or illness cause stress?)
3. **Selection bias** — the sample wasn't representative

**An RCT addresses all three by:**
- **Random assignment** to treatment vs control → balances all confounders, observed AND unobserved, on average
- **Manipulation** of the treatment → fixes the direction of causation (treatment came first, by design)
- **Defined population sampling** → controls selection bias

---

## The Four Essential Ingredients of an RCT

When asked to "design an RCT", **always cover these in order:**

1. **Population and sampling**
   - Who is being studied? (e.g., "Maastricht University CS undergraduates")
   - How are they recruited? (volunteer? all of class? random sample?)

2. **Random assignment to treatment / control**
   - Use a real randomisation mechanism (coin flip, RNG)
   - Often `1:1`, but can be `2:1` if treatment is cheap and you want power for the treatment group
   - **Stratified randomisation** if there's a known important confounder (e.g., balance males/females in each group)

3. **The intervention and the control**
   - What does the treatment group get?
   - What does the control group get? **Active control (placebo) or no-treatment control?**
   - **Blinding:**
     - **Single-blind:** subjects don't know which group they're in
     - **Double-blind:** subjects AND researchers/doctors don't know (only statisticians do — mock Q1a)
     - Why? Removes placebo + observer bias
   - **Duration:** how long does the intervention last?

4. **Outcome measurement and analysis**
   - Define the **primary outcome** before starting (e.g., "score on critical thinking test")
   - Decide the statistical test in advance (e.g., "t-test comparing means at significance α = 0.05")
   - **Pre-registration** is best practice (prevents p-hacking)
   - Report **effect size** AND p-value, not just one

---

## Mock Q9b Recipe — "Design an RCT for LLM impact on critical thinking"

A model answer needs all four ingredients. Skeleton:

> **Population:** First-year students at our university taking a critical-thinking module.
>
> **Randomisation:** At enrolment, each student is randomly assigned (1:1, coin flip) to:
> - **Treatment group:** has unrestricted access to a large language model (LLM) for all coursework
> - **Control group:** is required to complete coursework without any LLM assistance (enforced via lab proctoring + browser monitoring)
>
> **Blinding:** Single-blind is impossible (students know if they have LLM access). Markers of the outcome test must be **blinded** to group assignment to prevent grading bias.
>
> **Outcome:** A pre-registered critical-thinking test (e.g., the Watson-Glaser Critical Thinking Appraisal) administered at the **end of the semester**, with a baseline measurement at the start so we can also analyse change.
>
> **Statistical analysis:** Compare mean test scores between groups using a **two-sample t-test** (or non-parametric Mann-Whitney if normality is violated), report effect size (Cohen's d) and 95% CI.
>
> **Causal claim:** Because assignment was randomised, the difference in mean scores can be attributed to LLM access (no confounder, no reverse causation). External validity (does it generalise beyond our university?) is a separate limitation worth mentioning.

---

## Correlation vs Causation

> Mock Q9a: "Correlation between two fish populations is ~0. We can interpret this to mean: ..."

The trap answer is **"there is no causal relationship between the fish populations."** Wrong. A correlation of 0 only rules out **linear** association. It does **not** rule out:
- Non-linear causal relationships (e.g., one population helps the other up to a threshold, then hurts)
- Causal relationships that average out across the dataset
- Time-lagged effects (X causes Y after a delay)

**Correct answer:** "There may still be a causal relationship between fish populations" — correlation alone never proves or disproves causation.

### Key principle
- **Correlation ≠ causation** (well known)
- **No correlation ≠ no causation** (less well known, also true)
- **Only manipulation establishes causation** — and RCTs are the way to manipulate

---

## Causal Inference in Observational Data

In real life you often can't run an RCT (ethics, cost, time). Alternatives:
- **Natural experiments** — exploit something almost-random in the world (e.g., a policy that changed in one state but not another)
- **Instrumental variables** — find a variable that affects X but not Y directly
- **Difference-in-differences** — compare changes over time between treated and untreated groups
- **Propensity score matching** — match treated units to similar untreated units on observables

These are **not deeply tested** in this course but might appear as a distractor in multi-choice.

---

## Conceptual Gotchas

- **"Random sample" ≠ "random assignment".** A random sample is about *who* is studied; random assignment is about *which group* each studied person ends up in. RCTs need the latter; observational studies often have the former.
- **Placebo effect is real and measurable.** That's why placebo controls exist.
- **Generalisability (external validity)** is a separate question from internal validity. An RCT can give a clean causal estimate for the studied population that doesn't generalise.
- **Pre-registration matters** because of "researcher degrees of freedom" — without it, you can try many analyses and report only the significant one (p-hacking, garden of forking paths).
- **Blinding the data analyst** also matters, not just the participants.

---

## Quick Reference

| Question type | Answer pattern |
|---|---|
| What is RCT? | Random assignment + treatment/control + (ideally) blinding + pre-registered analysis |
| Why randomise? | Balances confounders (observed + unobserved) on average |
| Why blind? | Removes placebo, observer, grading bias |
| Correlation = 0 → causation? | Maybe still causal (non-linear, time-lagged, mixed effects) |
| Design an RCT | Population → randomisation → intervention + control → outcome + analysis (in that order) |
| Double-blind | Neither subjects nor researchers know — only statisticians do |
