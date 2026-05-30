# Topic 10 — Pseudo-Code and Data Workflows

**Source lectures:** Lectures 1, 2 (data + visualization); tutorials in Python
**Tested by:** Mock Q10 (3 parts, 10 pts: 3 + 4 + 3) — data preprocessing, hypothesis-test pseudocode, classification pseudocode
**Approximate mock points:** 10

The exam doesn't check syntax. Bullet points + clear logical structure score full marks. **Don't write Python — write English steps that look like code.**

---

## What the Exam Asks

Three typical sub-questions:
1. **Data preprocessing** — cleaning, merging, handling missing values
2. **Hypothesis test pseudo-code** — comparing groups
3. **Classification pseudo-code** — train/test workflow

The skeleton is the same: **describe the steps a reader could implement, with the right concepts and choices motivated**.

---

## Universal Pseudo-Code Skeleton

```
1. Load data
2. Preprocess  → handle missing values, encode categoricals, normalise if needed
3. Analyse / model
4. Evaluate    → metrics, train/test split, statistical test
5. Interpret   → translate into a conclusion for the research question
```

For every Q10-style problem, write these 5 steps and fill in the details specific to the question.

---

## Mock Q10a — Preprocessing & Merging (3 pts)

> "50 CSVs (one per state), each labels missing values differently with a string. Write pseudo-code to clean and merge into a single DataFrame."

### Sample answer

```
# 1. Load all state files
dfs = []
for each csv_file in directory:
    df = read_csv(csv_file)
    df['state'] = extract_state_from_filename(csv_file)
    dfs.append(df)

# 2. Identify all missing-value labels across files
candidate_missing_strings = {"NA", "N/A", "-", "?", "", "missing", "999", ...}
# (in practice: print unique values per column from each df to discover them)

# 3. Replace each candidate string with a standard NaN
for df in dfs:
    df.replace(candidate_missing_strings, NaN)

# 4. Handle missing values
#    - drop rows where critical fields (income) are NaN
#    - or impute with column median for numeric / mode for categorical
for df in dfs:
    df.drop(rows where income is NaN)

# 5. Merge into one DataFrame
combined = concatenate(dfs, axis=0)

# 6. Verify
#    - check row counts match sum of inputs
#    - confirm no remaining string-encoded missing values
```

### What graders look for
- **Identification of the missing-value problem** (50 different encodings)
- **A strategy for discovery** (inspect unique values) and **for replacement**
- **A decision about what to do with missing** (drop vs impute, with reasoning)
- **A merge step** with awareness that state must be preserved as a column

---

## Mock Q10b — Hypothesis Test Pseudo-Code (4 pts)

> "Pre-processed DataFrame of incomes by state and gender. Write pseudo-code to assess whether incomes differ between men and women across the USA, and within each state."

### Sample answer

```
# 1. Country-wide comparison
male_incomes = df[df.gender == "M"]["income"]
female_incomes = df[df.gender == "F"]["income"]

mean_male = mean(male_incomes)
mean_female = mean(female_incomes)
n_male, n_female = count of each group

# 2. Choose test
#    - 2 independent groups, comparing means → two-sample t-test
#    - n is large (population of USA) → Z-approximation is fine
test_stat, p_value = two_sample_test(male_incomes, female_incomes)

# 3. Decision rule
if p_value < 0.05:
    conclude "significant difference between mean male and female incomes"
else:
    conclude "no significant difference"

report effect size (Cohen's d) and 95% CI for the difference

# 4. Per-state breakdown
for state in unique(df.state):
    state_df = df[df.state == state]
    repeat steps 1-3 on state_df
    store p_value and effect size per state

# 5. Multiple testing correction
#    50 separate state-level tests at α = 0.05 inflate the family-wise error
#    apply Bonferroni: only call a state "significant" if p < 0.05 / 50 = 0.001
```

### What graders look for
- **Choice of test motivated** (two-sample t-test or Z, with reasoning)
- **Both levels of analysis** (country + per-state) addressed
- **Statistical interpretation** (significance threshold + effect size)
- **Multiple testing awareness** — bonus if mentioned, often expected

---

## Mock Q10c — Classification Pseudo-Code (3 pts)

> "Same DataFrame. Write pseudo-code to classify which state any individual is from."

### Sample answer

```
# 1. Define features and target
X = df[demographic_columns]   # family size, race, house ownership, etc.
y = df["state"]               # target — 50 classes

# 2. Encode categorical features
X = one_hot_encode(X)         # or label encoding for ordered cats

# 3. Train / test split
X_train, X_test, y_train, y_test = split(X, y, test_size=0.2, stratify=y)

# 4. Train a classifier
#    options: logistic regression (multinomial), random forest, gradient boosting
model = RandomForestClassifier()
model.fit(X_train, y_train)

# 5. Evaluate on held-out test set
y_pred = model.predict(X_test)
accuracy = mean(y_pred == y_test)
confusion = confusion_matrix(y_test, y_pred)

# 6. Sanity check vs baseline
baseline_accuracy = 1/50   # random guess for 50 states
if accuracy >> baseline_accuracy:
    conclude "features have signal for state membership"

# 7. (Optional) cross-validation for a more stable estimate
cv_scores = k_fold_cross_validate(model, X, y, k=5)
report mean ± std
```

### What graders look for
- **Train/test split** (or cross-validation)
- **Reasonable model choice** (any sensible algorithm)
- **Evaluation metric** appropriate for multi-class (accuracy, confusion matrix, possibly F1)
- **Baseline comparison** (random guess = 1/50)
- **Note about training the model only on training data** (no leakage)

---

## Universal Vocabulary for Pseudo-Code

The exam doesn't care which library you implicitly invoke. Use these neutral terms:

| Concept | Neutral pseudo-code term |
|---|---|
| Load file | `read_csv(file)`, `load(file)` |
| Filter rows | `df[df.col == value]` or `select where col == value` |
| Group by | `groupby(col)` or `partition by col` |
| Aggregate | `mean(col)`, `count()`, `sum(col)` |
| Two-sample test | `two_sample_test(a, b)` |
| Train/test split | `split(X, y, test_size=0.2)` |
| Fit model | `model.fit(X_train, y_train)` |
| Predict | `model.predict(X_test)` |
| Evaluate | `accuracy = mean(y_pred == y_test)` |

---

## Marking Heuristic

You usually get points for:
1. **Mentioning preprocessing explicitly** (1 pt)
2. **Choosing an appropriate analytical method with justification** (1–2 pts)
3. **Splitting train/test or using cross-validation when modelling** (1 pt)
4. **Reporting a sensible metric or significance threshold** (1 pt)
5. **Sanity-checking against a baseline** or **noting limitations** (1 pt)

You lose points (or fail to earn) for:
- Jumping straight to a model without mentioning preprocessing
- Writing syntactically correct Python without **logical structure**
- Forgetting train/test separation (data leakage)
- Forgetting multiple-testing when you do many tests
- Confusing classification and regression metrics (accuracy for regression, MSE for classification, etc.)

---

## Conceptual Gotchas

- **Pseudo-code is judged for logic, not syntax.** A clear English-bulleted list scores as well as code-like blocks.
- **Always preprocess before training.** Handle missing values, scale numeric features, encode categoricals.
- **Train/test split prevents leakage.** Never evaluate on data you trained on.
- **Stratify on class** when there's class imbalance (otherwise some classes may be missing from train or test).
- **Baseline comparison matters.** "95% accuracy" sounds great until you realise the majority class is 95%.
- **Choose the right metric for the task:** accuracy / F1 / AUC for classification; MSE / MAE / R² for regression.
- **Multiple comparisons inflate Type I rate** — same warning as for CI ([[07 Confidence Intervals]]).

---

## Quick Reference

| Step | Always include |
|---|---|
| Load | `read_csv` or equivalent |
| Preprocess | Missing values, encoding, optional scaling |
| Split | train/test or CV — **always** for any modelling |
| Analyse | Pick test/model based on question (means → t-test; counts → χ²; predict → classifier/regressor) |
| Evaluate | One sensible metric + baseline + (optionally) CI |
| Interpret | Translate stat answer back to the research question |
