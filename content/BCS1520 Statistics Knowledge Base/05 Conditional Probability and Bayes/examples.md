# Worked Examples — Bayes Trees

When a question gives you "P(evidence | disease)" and asks "P(disease | evidence)" you reach for a **tree**: branches for the hypothesis, then branches for the evidence given each hypothesis. Multiply along a path for a joint, sum joints for the marginal, divide for the posterior.

---

## 1. Medical-test Classic

**Setup.** Disease prevalence 1% ($P(D) = 0.01$). Test sensitivity 95% ($P(+|D) = 0.95$). False positive rate 5% ($P(+|¬D) = 0.05$).

**Question.** Given a positive test, what is $P(D|+)$?

**Tree.**

<figure class="diag-figure">
  <figcaption>Medical-test Bayes tree: positive results come from true positives and false positives</figcaption>
  <svg viewBox="0 0 760 290" class="diag-svg" role="img" aria-label="Medical test Bayes tree">
    <defs>
      <marker id="arr-g-med" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="306" y="18" width="148" height="42" class="d-node-ink"/>
    <text x="380" y="44" text-anchor="middle" class="d-h-inv">Patient</text>
    <rect x="118" y="100" width="160" height="46" class="d-node"/>
    <text x="198" y="121" text-anchor="middle" class="d-h-sm">Disease</text>
    <text x="198" y="138" text-anchor="middle" class="d-sub">P(D)=0.01</text>
    <rect x="482" y="100" width="160" height="46" class="d-node"/>
    <text x="562" y="121" text-anchor="middle" class="d-h-sm">No disease</text>
    <text x="562" y="138" text-anchor="middle" class="d-sub">P(not D)=0.99</text>
    <path d="M 330 60 L 210 98" class="d-edge" marker-end="url(#arr-g-med)"/>
    <path d="M 430 60 L 550 98" class="d-edge" marker-end="url(#arr-g-med)"/>
    <rect x="44" y="214" width="140" height="44" class="d-node-acc"/>
    <text x="114" y="234" text-anchor="middle" class="d-h-sm">positive</text>
    <text x="114" y="251" text-anchor="middle" class="d-sub">joint 0.0095</text>
    <rect x="212" y="214" width="140" height="44" class="d-node"/>
    <text x="282" y="234" text-anchor="middle" class="d-h-sm">negative</text>
    <text x="282" y="251" text-anchor="middle" class="d-sub">joint 0.0005</text>
    <rect x="408" y="214" width="140" height="44" class="d-node-acc"/>
    <text x="478" y="234" text-anchor="middle" class="d-h-sm">positive</text>
    <text x="478" y="251" text-anchor="middle" class="d-sub">joint 0.0495</text>
    <rect x="576" y="214" width="140" height="44" class="d-node"/>
    <text x="646" y="234" text-anchor="middle" class="d-h-sm">negative</text>
    <text x="646" y="251" text-anchor="middle" class="d-sub">joint 0.9405</text>
    <path d="M 162 146 L 116 212" class="d-edge" marker-end="url(#arr-g-med)"/>
    <path d="M 234 146 L 280 212" class="d-edge" marker-end="url(#arr-g-med)"/>
    <path d="M 526 146 L 480 212" class="d-edge" marker-end="url(#arr-g-med)"/>
    <path d="M 598 146 L 644 212" class="d-edge" marker-end="url(#arr-g-med)"/>
  </svg>
</figure>

**Compute.**

$$P(+) = P(+ \cap D) + P(+ \cap \lnot D) = 0.0095 + 0.0495 = 0.059$$

$$P(D \mid +) = \frac{P(+ \cap D)}{P(+)} = \frac{0.0095}{0.059} \approx 0.161$$

**Read.** Even with a 95% sensitive test, a positive result only yields a 16% chance of having the disease — because the disease is rare. This is the **base-rate fallacy**.

---

## 2. Two-Stage Sampling

**Setup.** Two urns. Urn A has 70% red, 30% blue. Urn B has 40% red, 60% blue. You pick an urn at random (50/50), then a ball at random.

**Question.** Given you drew red, what is $P(A | red)$?

**Tree.**

<figure class="diag-figure">
  <figcaption>Two-stage sampling tree: posterior is matching red leaf over all red leaves</figcaption>
  <svg viewBox="0 0 760 280" class="diag-svg" role="img" aria-label="Two urn conditional probability tree">
    <defs>
      <marker id="arr-g-urn" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="9" markerHeight="6" orient="auto">
        <path d="M0,0 L0,6 L9,3 Z" class="d-arr"/>
      </marker>
    </defs>
    <rect x="306" y="18" width="148" height="42" class="d-node-ink"/>
    <text x="380" y="44" text-anchor="middle" class="d-h-inv">Pick urn</text>
    <rect x="132" y="94" width="150" height="44" class="d-node"/>
    <text x="207" y="120" text-anchor="middle" class="d-h-sm">Urn A · 0.5</text>
    <rect x="478" y="94" width="150" height="44" class="d-node"/>
    <text x="553" y="120" text-anchor="middle" class="d-h-sm">Urn B · 0.5</text>
    <path d="M 330 60 L 218 92" class="d-edge" marker-end="url(#arr-g-urn)"/>
    <path d="M 430 60 L 542 92" class="d-edge" marker-end="url(#arr-g-urn)"/>
    <rect x="54" y="204" width="132" height="44" class="d-node-acc"/>
    <text x="120" y="224" text-anchor="middle" class="d-h-sm">red</text>
    <text x="120" y="241" text-anchor="middle" class="d-sub">0.5×0.7=0.35</text>
    <rect x="218" y="204" width="132" height="44" class="d-node"/>
    <text x="284" y="224" text-anchor="middle" class="d-h-sm">blue</text>
    <text x="284" y="241" text-anchor="middle" class="d-sub">0.5×0.3=0.15</text>
    <rect x="410" y="204" width="132" height="44" class="d-node-acc"/>
    <text x="476" y="224" text-anchor="middle" class="d-h-sm">red</text>
    <text x="476" y="241" text-anchor="middle" class="d-sub">0.5×0.4=0.20</text>
    <rect x="574" y="204" width="132" height="44" class="d-node"/>
    <text x="640" y="224" text-anchor="middle" class="d-h-sm">blue</text>
    <text x="640" y="241" text-anchor="middle" class="d-sub">0.5×0.6=0.30</text>
    <path d="M 172 138 L 124 202" class="d-edge" marker-end="url(#arr-g-urn)"/>
    <path d="M 242 138 L 282 202" class="d-edge" marker-end="url(#arr-g-urn)"/>
    <path d="M 520 138 L 478 202" class="d-edge" marker-end="url(#arr-g-urn)"/>
    <path d="M 590 138 L 638 202" class="d-edge" marker-end="url(#arr-g-urn)"/>
  </svg>
</figure>

$$P(\text{red}) = 0.35 + 0.20 = 0.55$$

$$P(A \mid \text{red}) = \frac{0.35}{0.55} \approx 0.636$$

---

## 3. Bayes Theorem — Algebraic Form

$$P(H \mid E) = \frac{P(E \mid H) \cdot P(H)}{P(E)} = \frac{P(E \mid H) \cdot P(H)}{P(E \mid H) P(H) + P(E \mid \lnot H) P(\lnot H)}$$

Use this when the question gives you all of: prior $P(H)$, likelihood $P(E|H)$, and the complement likelihood $P(E|¬H)$. The tree form is identical work — pick whichever feels less error-prone.

---

## 4. Exam Trap: "False Positive"

> "If a test has a 1% false positive rate and you tested positive, there's a 99% chance you have the disease" — **wrong**. This conflates $P(+ | ¬D)$ with $P(¬D | +)$. Always go through Bayes / tree.

---

## 5. Cheat Sheet

| Question type                          | What to compute              |
|----------------------------------------|------------------------------|
| Given evidence, prob of hypothesis     | Posterior $P(H|E)$ via Bayes |
| Marginal prob of evidence              | Total prob — sum of joints   |
| Independence check                     | $P(A\cap B) == P(A)P(B)$         |
| "Reverse" a conditional                | Bayes (or tree)              |
