# Mock Exam — Full Walkthrough (BCS1520, 2024-2025)

**Source:** `Materials/00 Exam Critical/Mock Exam.pdf` + `Materials/00 Exam Critical/Grading Scheme Mock Exam.pdf`
**Format:** 10 graded questions plus Q11 extra space, 110 points, 120 minutes, closed book, formula sheet provided
**Examiners:** Anirudh Wodeyar, Tim Dick, Niloufar Yousefimanesh, Luuk Verkleij

Time per point ≈ 65 sec. Manage by question total (e.g., 9-pt Bayes question should take ≤ 10 min).

---

## Q1 — Multiple Choice (30 points)

### Q1a (2 pts) — Double-blind study
"When you perform a double-blind experiment, who knows the assignment?"

**Answer: a) Neither the subjects, nor the doctors know but the statisticians do.**

> Why: double-blind = both participants and researchers/clinicians are blinded. Only the statisticians (or a third party) keep the assignment key.

### Q1b (3 pts) — Simpson's Paradox
Table:
| Dept | Women | Men |
|---|---|---|
| A | 5/5 (100%) | 45/50 (90%) |
| B | 35/95 (37%) | 3/15 (20%) |
| Total | 40/100 (40%) | 48/65 (74%) |

**Answer: a) Women have the higher admission rate in each department, yet men have the higher rate overall.**

> Why: Women win A (100% vs 90%) and B (37% vs 20%) but lose overall (40% vs 74%) because most women applied to the hard department (B), while most men applied to the easy one (A). Classic Simpson's paradox.

### Q1c (3 pts) — Bell curve, ±1.25 SDs
Mean = 50, SD = 10, 26 observations, bell curve. How many are 1.25 SDs or more away from the mean?

$P(|Z| > 1.25) ≈ 0.212$. Expected count ≈ $26 × 0.212 ≈ 5.5 \to 6$.

**Answer: b) 6 observations.**

> See [[06 Distributions CLT and Sampling]] for the z-table values you should know beyond the formula-sheet defaults.

### Q1d (3 pts) — Scatter plot shaded region
Three shaded panels on a husband-vs-wife education scatter. Which description is **NOT** indicated?

**Answer: d) Wife completed more years of schooling than husband.**

> Why: "more years than husband" requires the region above the diagonal y > x. None of the three panels shade that region — they're all vertical/horizontal bands.

### Q1e (2 pts) — Which is NOT a real way to collect data?
**Answer: b) Lurking Factor Experiment.**

> "Lurking variable" = confounder. There's no such thing as a "lurking factor experiment". The other three (Cohort, RCT, Observational) are real.

### Q1f (4 pts) — Marbles, confidence limits
5 more reds than blues, drawn with replacement. Win if more reds than blues. Better chance: 100 draws or 200?

**Answer: a) Choice 2 (200 draws).**

> Why: with replacement, each draw is Bernoulli(p) with p > 0.5. SE of the proportion = √(p(1−p)/n) shrinks with n. More draws → tighter distribution around the true p > 0.5 → more reliably observe p̂ > 0.5.

### Q1g (2 pts) — CLT applies to distribution of...
**Answer: c) Sample means.**

> Per the formula sheet: "Sampling Distribution of Mean under CLT". CLT is about means of samples, not raw data, not parameters, not RMSE.

### Q1h (2 pts) — ROC AUC = 0.5 means
**Answer: b) Chance level of classifiability.**

> AUC of 0.5 means the model is no better than random guessing. AUC of 1 = perfect, 0 = perfectly wrong (can flip labels).

### Q1i (2 pts) — Hypothesis formulation
"Article says μ = 7.5 hrs/week. Administrator suspects it's lower; her sample mean = 6.6 with n = 100."

**Answer: c) H₀: 7.5 hrs AND Hₐ: less than 7.5 hrs.**

> Why: H₀ contains the claim being tested (the 7.5 from the article, with equality). Hₐ is the directional alternative ("less than", because the administrator suspects it's lower). Never use the sample mean (6.6) as H₀.

### Q1j (2 pts) — Visualization for millions of birth weights
**Answer: c) Strip chart.**

> Why: strip charts plot each individual point. Millions of points = unreadable smear. Histograms, box plots, line plots are all fine for large continuous data.

### Q1k (2 pts) — Variable types (gender, age, doctor visits)
**Answer: c) (Categorical, Continuous, Discrete).**

> Gender = categorical. Age = continuous (on a continuous scale, even if reported in whole years). Doctor visits = discrete (counts).

### Q1l (3 pts) — Mean of f(x) = (7-2x)/2 on [2, 3]
$$E[X] = \int_2^3 x \cdot \frac{7-2x}{2} dx = \frac{29}{12} \approx 2.417$$

**Answer: b) 2.417.**

> See [[04 Probability Theory]] for the full integration walkthrough.

---

## Q2 — Judging Statistical Claims: Cat Parasite (6 points)

> Headline: "Cat parasite linked to brain cancer", citing a 1.6-fold increase. Real follow-up data:
> |                  | Own Cat | Don't Own Cat |
> |------------------|--------:|---------------:|
> | Brain cancer     | 171     | 645           |
> | No brain cancer  | 114,614 | 378,066       |

### Q2a (4 pts) — Expected frequency given OR = 1.6 and baseline 2/100
Baseline = 2% = 2/100. Apply 1.6× → 3.2/100.

**Answer: e) 3.2/100.**

> Since baseline is rare (2%), OR ≈ RR ≈ 1.6. Both interpretations give ~3.2/100.

### Q2b (2 pts) — Relative risk from real data
- $p_cat = 171 / (171 + 114614) = 171 / 114785 ≈ 0.00149$
- `p_no_cat = 645 / (645 + 378066) = 645 / 378711 ≈ 0.00170`
- `RR = 0.00149 / 0.00170 ≈ 0.876 ≈ 0.9`

**Answer: b) 0.9.**

> Cat owners have ~12% LOWER risk — the original headline was wrong (probably driven by confounding).

---

## Q3 — Conditional Probability: Plant Survives Week (9 points)

Given:
- $P(F) = 0.25$ (friend forgets)
- $P(dies | F) = 0.70$; $P(alive | F) = 0.30$
- $P(dies | watered) = 0.10$; $P(alive | watered) = 0.90$

**Expected frequency tree (1000 vacations):**

```
                            1000
                          /      \
                  forgets         waters
                   250             750
                  /    \          /    \
            dies   alive    dies   alive
            175     75       75     675
```

### Q3a (3 pts) — P(alive)
$(75 + 675) / 1000 = 750/1000 = 0.75 \to 75%$

LoTP check: $P(alive) = 0.30 × 0.25 + 0.90 × 0.75 = 0.075 + 0.675 = 0.75 ✓$

### Q3b (3 pts) — P(friend forgot | plant dead)
Total dead = 175 + 75 = 250. Forgot dead = 175. **$175/250 = 0.70 \to 70%$.**

Bayes check: $P(F|D) = P(D|F)P(F)/P(D) = (0.70 × 0.25)/0.25 = 0.175/0.25 = 0.70 ✓$

> Where P(D) = 1 − P(alive) = 1 − 0.75 = 0.25.

### Q3c (3 pts) — P(alive | friend forgot)
Directly given: $P(alive | F) = 0.30 \to 30%$.

From tree: `75 / 250 = 0.30 ✓`

> See [[05 Conditional Probability and Bayes]].

---

## Q4 — Design a Research Study (8 points)

> Regional government has data on student grades, teachers, schools. Top school wants:
> 1. Are there courses where students underperform vs the region?
> 2. Are findings consistent across teachers?

### Model answer skeleton

1. **Per-course comparison vs region**
   - For each subject, compute the mean exam score at THIS school and at all other schools in the region
   - Compute a per-course **difference** (or standardised effect: z-score relative to the regional distribution)
   - Use a one-sample test for each course: H₀: school mean = regional mean. Two-sided, α = 0.05
   - **Bonferroni correct** for the number of courses tested

2. **Per-teacher consistency check**
   - For each teacher at the school, compute their students' average grade per course
   - Compare across teachers (ANOVA, or pairwise t-tests with correction) within each course
   - If teachers vary widely on the same course → teacher-level variation may be confounding the school-level signal

3. **Caveats / threats to interpretation**
   - **Selection bias:** which students chose which courses? Maybe the underperforming course attracts weaker students.
   - **Sample size per teacher:** small classes have wide CIs — individual teachers may look "different" by chance
   - **Multiple comparisons:** with many courses × teachers, false positives are guaranteed without correction
   - **Simpson's paradox warning:** aggregating across teachers may hide a true effect

4. **Reporting**
   - Effect sizes (mean differences) + 95% CIs, not just p-values
   - Flag courses where school mean is more than 1 SD below regional mean for actionable investigation

### What graders look for (8 pts)
- Clear analysis plan with steps (~3 pts)
- Choice of statistical test with justification (~2 pts)
- Multiple testing acknowledgement (~1 pt)
- Discussion of bias / confounding / interpretation caveats (~2 pts)

---

## Q5 — Confidence Intervals: Video Game Genres (12 points)

> Survey: n = 1200 teens. 70% play racing, 65% sports, 61% rhythm.

### Q5a (8 pts) — Three 95% CIs

Formula: $p̂ \pm 1.96 \cdot \sqrt (p̂(1−p̂)/n)$

| Genre | p̂ | SE | Margin | 95% CI |
|---|---|---|---|---|
| Racing | 0.70 | √(0.21/1200) = 0.0132 | 0.0259 | **[0.674, 0.726]** |
| Sports | 0.65 | √(0.2275/1200) = 0.0138 | 0.0270 | **[0.623, 0.677]** |
| Rhythm | 0.61 | √(0.2379/1200) = 0.0141 | 0.0276 | **[0.582, 0.638]** |

> State the formula and why it applies (large n, proportion → use z normal approximation) for full marks.

### Q5b (4 pts) — Why family-wise error > 5%

Each CI individually misses the true value 5% of the time. For 3 independent CIs:
- P(all contain truth) = `0.95³ ≈ 0.857`
- P(at least one misses) = `1 − 0.857 ≈ 14.3%`

So the family-wise error is **~14%**, much greater than the per-test α = 5%. This is the **multiple-testing problem**. A correction like **Bonferroni** (use α/3 per CI) keeps the family-wise rate at 5%.

> See [[07 Confidence Intervals]] for full treatment.

---

## Q6 — Normal Distribution: Cereal Box (12 points)

> Filling machine, X ~ N(μ, σ²) with σ = 4 g (known). Inspect 16 boxes, x̄ = 211 g. Spec: at most 5/1000 boxes filled with less than 200 g.

### Q6a (4 pts) — 95% CI for the mean

$x̄ \pm 1.96 \cdot σ/\sqrt n = 211 \pm 1.96 \cdot 4/\sqrt 16 = 211 \pm 1.96 \cdot 1 = 211 \pm 1.96$

**CI = [209.04, 212.96] grams.**

### Q6b (8 pts) — Does the machine meet the spec?

Spec: $P(X < 200) \leq 0.005$.

With `X ~ N(211, 16)`:
$$Z = \frac{200 - 211}{4} = -2.75$$

$P(Z < −2.75) < P(Z < −2.576) = 0.005$. So **yes, the machine meets the spec** (with margin to spare).

**Note:** The mock question contains a typo ("most five out of a thousand boxes are filled with less than **400** grams"). The intended value is 200 grams (matching the original setup); the answer above assumes that.

> See [[06 Distributions CLT and Sampling]] for the full Z-score calculation.

---

## Q7 — Measurement Caveats (9 points)

**Multi-select with negative scoring — be conservative.**

### Q7a (3 pts) — Napoleon window tax → homes built without windows
- ✓ **A measure becoming the target** (Goodhart's Law)
- ✓ **Measurements can be wrong** (the measure stopped capturing house size)
- ✓ **"Teaching to the test"** (same phenomenon, different domain — both are metric-gaming)
- ✗ "Governments are not very clever" (opinion, not a measurement issue — DON'T pick, negative points)

### Q7b (6 pts) — Variable definition problems
- ✓ **Meaning of measurements may change with when/where measured** (e.g., "obese" varies by country)
- ✓ **Measurements may not represent the real world** (operationalisation gap)
- ✓ **Definitions force us to create thresholds that affect the measurement** (e.g., poverty line)
- ✗ "Don't allow us to abstract the real world into numbers" (philosophically debatable; risky — likely meant to be wrong, skip)
- ✗ "Have too much spread" (this is a property of data, not of definitions — don't pick)

> See [[01 Data Visualization and Measurement]].

---

## Q8 — Correlation / Spearman (6 points)

Pearson r = −0.80, Spearman = −0.75.
Statement: "Below-mean values of dep var are associated with below-mean values of indep var."

### Q8a (2 pts) — True or False?
**Answer: b) False.**

> Negative correlation: below-mean X associates with **above-mean** Y, not below-mean.

### Q8b (4 pts) — Motivation + role of Spearman

> The statement is false because the negative Pearson correlation means as one variable goes up, the other goes down — so below-mean values of one are associated with above-mean values of the other. The Spearman rank correlation (also strongly negative at −0.75) confirms this relationship is **monotonic**, not an artefact of a few outliers or a single non-linear inflection — both rankings move in opposite directions consistently. If Spearman had been near zero, it would suggest the linear correlation was driven by outliers; if Spearman had been much stronger than Pearson, it would suggest a strong monotonic-but-non-linear relationship.

> See [[09 Correlation]].

---

## Q9 — RCTs and Causality (8 points)

### Q9a (2 pts) — Correlation ≈ 0 between fish populations
**Answer: d) There may still be a causal relationship between fish populations.**

> Why: correlation = 0 only rules out **linear** association. Non-linear or time-lagged causal effects can still exist.

### Q9b (6 pts) — Design an RCT for "do LLMs affect critical thinking"

Model answer with all four ingredients:

1. **Population:** First-year university students taking a critical-thinking module
2. **Randomisation:** Random assignment (1:1, RNG) to either:
   - Treatment: unrestricted LLM access for coursework
   - Control: no LLM access (enforced via lab proctoring + browser monitoring)
3. **Blinding:** Single-blind impossible (students know if they have LLM). **Markers blinded** to group assignment when grading the outcome
4. **Outcome:** Pre-registered critical thinking test (e.g., Watson-Glaser) at end-of-semester, baseline at start. Statistical test: two-sample t-test on test scores (or Mann-Whitney if not normal). Report effect size + 95% CI
5. **Causal claim:** Because assignment was randomised, any difference can be attributed to LLM access — confounders are balanced on average. External validity (does it generalise beyond this university?) is a noted limitation

> See [[02 RCTs and Causality]] for the recipe.

---

## Q10 — Pseudo-Coding Statistics (10 points)

### Q10a (3 pts) — Preprocess + merge 50 state CSVs

```
1. For each CSV file:
   - Load into a DataFrame
   - Add a 'state' column extracted from the filename
2. Inspect unique values per column across files to find missing-value strings
   (varies between files — could be "NA", "-", "?", "999", etc.)
3. Replace each candidate string with a standard NaN
4. Decide how to handle missing:
   - Drop rows where critical field (income) is NaN
   - Impute non-critical fields with median (numeric) or mode (categorical)
5. Concatenate all DataFrames into one
6. Verify: total row count == sum of individual file rows; no string-encoded missing remain
```

### Q10b (4 pts) — Test income difference between men and women (overall + per-state)

```
# Overall
male_income = df[df.gender == "M"].income
female_income = df[df.gender == "F"].income
test_stat, p_value = two_sample_test(male_income, female_income)
# CLT applies due to large n; use a Z- or t-test for means
report mean_male, mean_female, 95% CI of difference, effect size (Cohen's d)
conclude based on p < 0.05

# Per state
for state in unique(df.state):
    state_df = df[df.state == state]
    repeat the above on state_df

# Multiple-testing correction
50 separate tests → use Bonferroni: significance threshold = 0.05 / 50 = 0.001
```

### Q10c (3 pts) — Classify state from individual attributes

```
1. X = df[demographic_columns]; y = df.state
2. One-hot encode categorical features
3. Stratified train/test split (80/20)
4. Fit a multi-class classifier (logistic regression, random forest, gradient boosting)
5. Evaluate on test:
   - Accuracy
   - Confusion matrix
   - Compare to baseline = 1/50 ≈ 2% (random guess)
6. (Optional) 5-fold cross-validation for stability
```

> See [[10 Pseudo-Code and Data Workflows]].

---

## Q11 — Extra Space

No content. Use only for overflow. **Always mark "see Q11" on the original question** so the grader knows to look.

---

## Sanity Checks Before Submitting

- [ ] All answers inside the reserved box on each page (anything outside is NOT graded)
- [ ] Multi-select questions: counted gains vs negative-point risks before submitting
- [ ] Q3 tree calculations: rows sum to parent totals
- [ ] Q5 CIs: bounds are between 0 and 1 (these are proportions)
- [ ] Q6 CI: 211 is the centre, margin is small (1.96) — bounds are within 2 g of 211
- [ ] Q9b RCT design covers: population, randomisation, intervention/control, outcome, analysis
- [ ] Q10 pseudo-code: each part includes preprocessing → analysis → evaluation

---

## Topic Cross-Reference

| Q | Topic note | Skills used |
|---|---|---|
| 1a, 1d, 1j, 1k | [[01 Data Visualization and Measurement]] | Variable types, vis choice, study design |
| 1a, 9 | [[02 RCTs and Causality]] | Blinding, correlation/causation, RCT design |
| 2 | [[03 Odds Ratios and Relative Risk]] | RR, OR, headline framing |
| 1f, 1l | [[04 Probability Theory]] | Continuous distributions, integration |
| 3 | [[05 Conditional Probability and Bayes]] | Tree, Bayes, LoTP |
| 1c, 1g, 6 | [[06 Distributions CLT and Sampling]] | CLT, z-score, normal distribution |
| 5 | [[07 Confidence Intervals]] | Proportion CI, multiple testing |
| 1i | [[08 Hypothesis Testing]] | H₀/Hₐ formulation |
| 8 | [[09 Correlation]] | Pearson, Spearman, interpretation |
| 10 | [[10 Pseudo-Code and Data Workflows]] | Preprocessing, hypothesis testing, classification pseudo-code |
