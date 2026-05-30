---
tags:
  - university
  - bcs2420
  - computer-security
  - self-test
---

# 01 Foundations and Security Principles Self Test

Answer these without checking the notes. Then expand the Answer Key callout at the bottom to grade yourself.

## Course Structure, Assessment, and Exam Rules

1. How is the course graded?
2. What happens if the final exam is failed?
3. Why does the course emphasize both theory and labs?

## Security Goals, Policy, Adversaries, and Risk

4. What is the relationship between a security policy and an attack?
5. How would you explain the CIA triad using a real system?
6. What does each variable in `R = T * V * C` represent? (State explicitly what `V` is.)
7. Why can cyber incidents have operational and reputational impacts beyond pure technical damage?
8. Name the four standard adversary attributes used to characterise an attacker, including the one called "Capabilities". Explain what "Capabilities" covers.

## Threat Modeling and STRIDE

9. Write out the STRIDE mnemonic and the security property each letter targets.
10. Compare STRIDE with attack trees: how does each identify threats and what are the trade-offs?
11. What is a model-reality gap? Give one cloud-context example and one mitigation.

## Defense in Depth, Security Strategy, and Security Posture

12. What is defense in depth?
13. How would you evaluate the security posture of a system?
14. Why are physical and organizational controls part of computer security?

## Human Factors, Insider Threats, and Ethical Security Practice

15. Why are human factors important in security?
16. Why might insider threats be more dangerous than outsider threats?
17. What does ethical use of security tools mean in this course?

## Essay-style (past exam pattern)

18. A small organisation defines a policy: "Only enrolled students may access exam solutions before the review session." A misconfigured directory makes the solutions reachable to the public web. Using **policy → threat modeling → non-secure state**, explain why this constitutes an attack success and propose two threat-model entries (using STRIDE or an attack tree) that would have surfaced the risk before deployment.

> [!info]- Answer Key
> 1. Final exam 75%, project 25%. The project grade only counts if the final exam is passed (>55%). Grade scale 6=55-64% up to 10=95-100%.
> 2. You fail the course regardless of project grade. Resit formula: `max( (resit_exam/7.5) + (project/2.5), (resit_exam/10) )` — the project grade from the normal period still counts.
> 3. Lectures build the conceptual framework; labs are where you test, question, and apply the ideas. The exam tests both explanation (theory) and lab-style reasoning. Theory alone leaves you unable to recognise real vulnerability conditions.
> 4. A policy defines the secure state — what is allowed and disallowed. An attack is an intentional action aimed at violating that policy and driving the system into a non-secure state. So an attack is not just "something bad"; it is always defined relative to a stated policy.
> 5. CIA = Confidentiality (keep data accessible only to authorised parties), Integrity (no unauthorised modification), Availability (usable when needed). Example: a hospital records system — C protects patient privacy, I protects correctness of dosage records, A keeps the system reachable during an emergency. Real incidents (ransomware) often violate all three at once.
> 6. `R = T * V * C`. **T** = threat probability (likelihood an adversary attempts the attack). **V** = vulnerability (likelihood that, given the attempt, the attack succeeds — the system weakness). **C** = cost / impact if the attack succeeds. Controls reduce one or more factors.
> 7. Compromises propagate beyond IT: NotPetya stopped shipping operations; WannaCry disrupted hospitals; reputational loss reduces customer trust and stock value. Cost C in the risk equation must include these indirect effects, not only the technical clean-up.
> 8. Adversary attributes: **Objectives**, **Methods**, **Capabilities**, **Funding level**. "Capabilities" = the technical skills, tooling, time, and access an attacker can bring to bear (e.g., a script-kiddie has low capabilities, a nation-state actor has very high capabilities including 0-days, custom implants, supply-chain reach).
> 9. **S**poofing → Authentication. **T**ampering → Integrity. **R**epudiation → Non-repudiation. **I**nformation Disclosure → Confidentiality. **D**enial of Service → Availability. **E**scalation of Privilege → Authorisation.
> 10. STRIDE is checklist-based: walk each component/data-flow against six fixed categories — systematic and easy to remember, but may miss novel threats. Attack trees are goal-decomposition: root = attacker goal, branches = sub-goals, leaves = concrete steps, AND/OR nodes — gives attack-path visualisation and lets you compare costs/likelihoods, but is time-intensive and depends on analyst completeness. Best practice: use both (STRIDE for coverage, attack trees for path analysis).
> 11. A model-reality gap is a mismatch between assumptions in the security model and properties of the real system. Cloud example: the model assumes the provider enforces strict tenant isolation, but the hypervisor has a known VM-escape bug — cross-tenant attacks possible despite "isolated" model. Mitigation: third-party audits, request the provider's pen-test results, run independent tests, assume adversarial conditions for critical components.
> 12. Multiple overlapping controls so no single failure causes total compromise. Each layer should address a different attack step or the same step in a different way (e.g., mail filter → browser protection → least privilege → segmentation → monitoring).
> 13. Look at the *whole picture*: what is exposed, what controls exist, what assumptions might be wrong, what happens when one layer fails, and how quickly the system detects and recovers. Posture is not just "list of controls" — it includes exposure, weakness, response capability.
> 14. Many failures originate in weak processes, weak defaults, or insider mistakes rather than broken algorithms. Strong crypto can be bypassed by tailgating into the server room or by an admin who skips a procedure. Posture is only as strong as the weakest layer including people.
> 15. Users and developers create exploitable conditions: weak passwords, oversharing on social media, secrets left in client-side code, admins who trust compromised output. Attackers exploit trust and habits; defenders must design systems usable enough to be followed and strict enough to resist abuse.
> 16. Insiders already have trust, credentials, and contextual knowledge — they start closer to the assets. An outsider must first defeat perimeter controls; an insider may not need to. Insiders can also be accidental (not just malicious), so least privilege, auditing, and separation of duties matter even for "trusted" staff.
> 17. Only test systems you own or have explicit written authorisation to test. The course's tools (Kali, nmap, Wireshark) are powerful and the same technique can be legal in a lab and a crime outside it. Capability does not imply authorisation.
> 18. Policy → the secure state is "only enrolled students access solutions before review". Threat modeling step → STRIDE on the web server flow flags **I**nformation Disclosure (anyone can reach the path) and possibly **E**scalation (unauthenticated user gains access reserved for enrolled students). An attack-tree leaf would name "guess or scrape directory listing" under the root goal "obtain pre-release solutions". Non-secure state → at the moment the file is reachable to a non-enrolled user, the policy is violated; the *attack success* is the existence of the unauthorised access path, not only its observed exploitation. Two threat-model entries that would have caught it: (a) STRIDE-I row "Can directory listing be enumerated? → Force directory listing off, default-deny on web root"; (b) attack-tree leaf "scrape exam-solutions URL → mitigate with authentication gate and indexing disabled".
