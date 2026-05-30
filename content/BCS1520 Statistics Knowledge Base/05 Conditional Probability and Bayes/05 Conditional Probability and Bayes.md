# Topic 5 — Conditional Probability and Bayes

**Source lectures:** Lecture 4 and 5 (Probability Theory I and II); Lecture 6 (Probability and Statistics part 1)
**Tested by:** Mock Q3 (Bayes / expected frequency tree, 9 pts)
**Approximate mock points:** 9

**This is the biggest single-question chunk after the multi-choice.** Master the tree method and Bayes' rule and you bank 9 points cleanly.

---

## What the Exam Asks

A multi-part conditional probability problem. Usually structured as:
- (a) Compute $P(some event)$ using the **Law of Total Probability** — the unconditional probability
- (b) Reverse the conditional: given the observed outcome, compute $P(cause | outcome)$ using **Bayes' rule**
- (c) Another reversed conditional or a chain

**You can solve all three with either:**
1. **Expected frequency tree** (easier, less error-prone)
2. **Algebraic Bayes' formula** (faster once you're fluent)

The question explicitly says "either create the expected frequency tree or use Bayes' theorem alongside the appropriate probability rules". Use whichever you're more confident in.

---

## Formulas from the Sheet

### Conditional probability
$$P(A \mid B) = \frac{P(A \cap B)}{P(B)}$$

### Multiplication rule (rearranging the above)
$$P(A \cap B) = P(A \mid B) \cdot P(B) = P(B \mid A) \cdot P(A)$$

### Bayes' Rule
$$P(H \mid E) = \frac{P(H) \cdot P(E \mid H)}{P(E)}$$

### Law of Total Probability (LoTP)
For a partition `B₁, B₂, ..., Bₙ` of the sample space:
$$P(A) = \sum_{j=1}^n P(B_j) \cdot P(A \mid B_j)$$

The most common case is `n = 2`:
$$P(A) = P(A \mid B) P(B) + P(A \mid B^c) P(B^c)$$

This denominator is exactly what shows up in Bayes' rule.

---

## Mock Q3 — The Plant Problem

> "Before going on vacation for a week, you ask your spacey friend to water your ailing plant. Without water, the plant has a 70% chance of dying. Even with proper watering, it has a 10% chance of dying. And the probability that your friend will forget to water it is 25%."

Let's define events:
- `F` = friend forgets to water, $P(F) = 0.25$. So $P(F^c) = 0.75$
- `D` = plant dies
- $P(D | F) = 0.70$ (forgot → 70% death). So $P(alive | F) = 0.30$
- $P(D | F^c) = 0.10$ (watered → 10% death). So $P(alive | F^c) = 0.90$

### Method 1 — Expected frequency tree

Imagine **1000 vacations**.

<figure class="diag-figure">
  <figcaption>Expected frequency tree for the plant problem</figcaption>
  <svg viewBox="0 0 760 310" class="diag-svg" role="img" aria-label="Expected frequency tree for conditional probability">
    <defs>
      <marker id="arr-g-bayes-plant" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
      <marker id="arr-a-bayes-plant" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-acc"/>
      </marker>
      <marker id="arr-d-bayes-plant" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr-dan"/>
      </marker>
    </defs>
    <rect x="300" y="18" width="160" height="44" class="d-node-ink"/>
    <text x="380" y="45" text-anchor="middle" class="d-h-inv">1000 vacations</text>

    <rect x="130" y="116" width="170" height="48" class="d-node"/>
    <text x="215" y="137" text-anchor="middle" class="d-h-sm">Friend forgets</text>
    <text x="215" y="154" text-anchor="middle" class="d-sub">25% → 250</text>
    <rect x="460" y="116" width="170" height="48" class="d-node"/>
    <text x="545" y="137" text-anchor="middle" class="d-h-sm">Friend waters</text>
    <text x="545" y="154" text-anchor="middle" class="d-sub">75% → 750</text>

    <path d="M 330 62 L 226 114" class="d-edge" marker-end="url(#arr-g-bayes-plant)"/>
    <text x="244" y="91" text-anchor="middle" class="d-label">P(F)=0.25</text>
    <path d="M 430 62 L 534 114" class="d-edge" marker-end="url(#arr-g-bayes-plant)"/>
    <text x="516" y="91" text-anchor="middle" class="d-label">P(Fc)=0.75</text>

    <rect x="35" y="230" width="145" height="48" class="d-node-dan"/>
    <text x="108" y="251" text-anchor="middle" class="d-h-sm">dies</text>
    <text x="108" y="268" text-anchor="middle" class="d-sub">70% of 250 = 175</text>
    <rect x="220" y="230" width="145" height="48" class="d-node-acc"/>
    <text x="293" y="251" text-anchor="middle" class="d-h-sm">alive</text>
    <text x="293" y="268" text-anchor="middle" class="d-sub">30% of 250 = 75</text>
    <rect x="405" y="230" width="145" height="48" class="d-node-dan"/>
    <text x="478" y="251" text-anchor="middle" class="d-h-sm">dies</text>
    <text x="478" y="268" text-anchor="middle" class="d-sub">10% of 750 = 75</text>
    <rect x="590" y="230" width="145" height="48" class="d-node-acc"/>
    <text x="663" y="251" text-anchor="middle" class="d-h-sm">alive</text>
    <text x="663" y="268" text-anchor="middle" class="d-sub">90% of 750 = 675</text>

    <path d="M 180 164 L 116 228" class="d-edge-dan" marker-end="url(#arr-d-bayes-plant)"/>
    <path d="M 250 164 L 286 228" class="d-edge-acc" marker-end="url(#arr-a-bayes-plant)"/>
    <path d="M 512 164 L 484 228" class="d-edge-dan" marker-end="url(#arr-d-bayes-plant)"/>
    <path d="M 580 164 L 656 228" class="d-edge-acc" marker-end="url(#arr-a-bayes-plant)"/>
  </svg>
</figure>

**(a) P(alive) = ?**
Alive total = 75 (forgot but lived) + 675 (watered, lived) = **750/1000 = 0.75 → 75%**

Algebraic check via LoTP:
$P(alive) = P(alive|F)P(F) + P(alive|F^c)P(F^c) = 0.30 × 0.25 + 0.90 × 0.75 = 0.075 + 0.675 = 0.75 ✓$

**(b) P(friend forgot | plant dead) = ?**
Dead total = 175 + 75 = 250.
Of those, 175 came from the "forgot" branch.
$P(forgot | dead) = 175 / 250 = 0.70 \to 70%$

Algebraic check via Bayes:
$P(F | D) = P(D|F)P(F) / P(D) = (0.70 × 0.25) / 0.25 = 0.175 / 0.25 = 0.70 ✓$

**(c) P(alive | friend forgot) = ?**
This is given directly: $P(alive | F) = 0.30 = 30%$.

Algebraic: of 250 forgot-branch vacations, 75 are alive. `75/250 = 0.30 ✓`

---

## When to Use the Tree (Highly Recommended for the Exam)

The tree method is **more reliable under time pressure** because:
- It makes the partition explicit (each branch is a $B_j$)
- The denominator of Bayes is automatic (you just count the relevant column)
- Easy to sanity-check (rows sum to total)
- You can solve all three sub-parts from the same tree

### Tree recipe
1. **Start with a round population number** (1000, 10,000 — whatever makes the percentages give whole numbers)
2. **Branch on the first event** (the prior): multiply by P(event) and P(not event)
3. **Branch each leaf again on the conditional event**: multiply by P(outcome|branch) and P(not outcome|branch)
4. **Sum across rows to verify** they equal the parent
5. **Answer each question** by counting from the leaves:
   - $P(A) = sum of leaves where A occurs / total$
   - $P(B | A) = leaves where B\cap A occurs / leaves where A occurs$

---

## When to Use Bayes' Formula

Best when:
- The problem is already in `P(E|H), P(H), P(H^c)` form
- You can multiply mentally
- You want to be slick

### Bayes recipe
1. **Identify**: what is the prior $P(H)$? what is the evidence `E`?
2. **Write out**: $P(H | E) = P(E | H) \cdot P(H) / P(E)$
3. **Expand the denominator using LoTP**: $P(E) = P(E|H)P(H) + P(E|H^c)P(H^c)$
4. **Substitute and compute**

---

## Common Bayes Patterns (from Conditional Probability Tutorial)

### Pattern: Disease testing
> "Cancer prevalence 6%, test gives false negative 10%, false positive 5%. Given negative result, what's the chance she has cancer?"

- `H = has cancer`, $P(H) = 0.06$
- `E = negative test`
- $P(E | H) = 0.10$ (false negative)
- $P(E | H^c) = 1 − 0.05 = 0.95$ (true negative)
- $P(H | E) = (0.10 × 0.06) / (0.10 × 0.06 + 0.95 × 0.94) = 0.006 / 0.899 = 0.0067 ≈ 0.7%$

### Pattern: Manufacturing defects
> "Three motels (20%, 50%, 30%), each with different probability of faulty plumbing (5%, 4%, 8%). Given a faulty room, probability it's at motel L?"

$P(L | F) = P(F|L)P(L) / P(F) = (0.08 × 0.3) / (0.05\cdot 0.2 + 0.04\cdot 0.5 + 0.08\cdot 0.3) = 0.024 / 0.054 = 4/9$

### Pattern: Diagnostic + multiple causes
> "Truth serum: 90% correct on guilty, 1% false positive on innocent. Population 5% guilty. Test says guilty — prob actually innocent?"

$P(innocent | flagged) = P(flagged|innocent)P(innocent) / P(flagged) = (0.01 × 0.95) / (0.90 × 0.05 + 0.01 × 0.95) = 0.0095 / 0.0545 ≈ 0.174 (17.4%)$

**Insight:** Even with a seemingly accurate test (90% true positive, 1% false positive), if the base rate is low, most positives are false. This is the **base rate fallacy.**

### Pattern: Monty Hall
- 3 doors, prize behind one (uniform 1/3 each)
- You pick A; host opens B showing no prize
- Should you switch?

$P(prize at A | host opened B) = P(host opens B | prize at A) \cdot 1/3 / P(host opens B)$

$P(host opens B | prize at A) = 1/2$ (he's free to open either of B or C)
$P(host opens B | prize at B) = 0$ (he won't reveal the prize)
$P(host opens B | prize at C) = 1$ (forced — can't open A which you picked, can't open C with prize)

$P(host opens B) = (1/2)(1/3) + 0(1/3) + 1(1/3) = 1/6 + 1/3 = 1/2$
$P(prize at A | B opened) = (1/2 × 1/3) / (1/2) = 1/3$
$P(prize at C | B opened) = (1 × 1/3) / (1/2) = 2/3$

**Switch — doubles your chance.**

---

## Conceptual Gotchas

- **$P(A|B) \neq P(B|A)$** in general. The exam loves to reverse these. Read carefully.
- **Conditional probability requires $P(B) > 0$** (you can't condition on impossibility).
- **Two events being independent means $P(A|B) = P(A)$** — knowledge of B tells you nothing about A.
- **Conditional probability of "test positive given disease" (sensitivity) is NOT the same as "disease given test positive"** (positive predictive value). Confusing these is the most common medical-statistics error.
- **The tree method's row sums should equal the parent** — always check.
- **The denominator in Bayes is just LoTP** — you're partitioning over all possible causes.
- **A small base rate inflates false-positive rates** — even highly accurate tests look bad for rare conditions.

---

## Quick Reference

| Quantity | Formula |
|---|---|
| Conditional probability | $P(A\|B) = P(A\cap B) / P(B)$ |
| Multiplication rule | $P(A\cap B) = P(A\|B)P(B)$ |
| Bayes' rule | $P(H\|E) = P(E\|H)P(H) / P(E)$ |
| Law of Total Probability | $P(E) = Σ P(E\|Hᵢ)P(Hᵢ)$ |
| Independence | $P(A\cap B) = P(A)P(B)$ ⇔ $P(A\|B) = P(A)$ |

**Exam approach for Q3:** Always build the tree first. It takes 30 seconds and prevents algebra errors under stress.
