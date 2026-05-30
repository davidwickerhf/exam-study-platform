---
tags:
  - university
  - bcs2410
  - embedded-programming
  - worked-drills
---

# Quiz 1 Worked Answers

## 1. Embedded system definition

**Correct answer:** A specialized computer system designed to perform specific tasks.

**Why:** That is the course definition used in the introduction and syllabus. A general-purpose standalone computer is the wrong model.

## 2. Program storage memory

**Correct answer:** ROM/Flash.

**Why:** Program code must survive power loss, so persistent non-volatile storage is used rather than RAM.

## 3. Peripheral examples on the board

**Correct answer:** All of the above.

**Why:** LEDs, GPIO, and sensors all count as peripherals or peripheral-facing board resources in the course context.

## 4. Primary language computers understand

**Correct answer:** Binary.

**Why:** C and assembly are human-level abstractions over binary encodings that the hardware executes.

## 5. Role of the transistor

**Correct answer:** To switch and amplify electronic signals.

**Why:** That switching role is the hardware basis of logic and digital computation.

## 6. Not a primary computer-organization component

**Correct answer:** Operating System.

**Why:** The OS is software, while the organization question is asking about hardware structure.

## 7. Power wall

**Correct answer:** The inability to improve CPU performance due to heat and energy limitations.

**Why:** The term refers to thermal and power limits that restrict easy clock-speed/performance scaling.

## 8. Von Neumann vs Harvard

**Correct answer:** Von Neumann uses a single memory for data and instructions, while Harvard separates them.

**Why:** That shared-versus-separated memory path is the defining distinction.

## 9. Why cache matters

**Correct answer:** It increases processing speed by storing frequently used data closer to the CPU.

**Why:** Cache reduces average access latency; it is not persistent large-scale storage or a boot-only structure.

## 10. Decode stage

**Correct answer:** Translates the instruction into signals understandable by the CPU.

**Why:** Fetch retrieves the instruction, decode interprets it, and execute performs it.

## 11. Not an ALU function

**Correct answer:** Data storage for future use.

**Why:** The ALU computes; it is not the component for long-term storage.

## 12. Program counter

**Correct answer:** To hold the address of the next instruction to execute.

**Why:** The PC drives sequential instruction flow until a branch, call, or exception changes it.

## Related Concepts

- [[Embedded Systems and Microcontrollers|Embedded Systems and Microcontrollers]]
- [[Discovery Board, Peripherals, and Memory Types|Discovery Board, Peripherals, and Memory Types]]
- [[Computer Organization: CPU, Memory, and I-O|Computer Organization: CPU, Memory, and I/O]]
- [[Von Neumann vs Harvard Architecture|Von Neumann vs Harvard Architecture]]
- [[Program Counter and the Instruction Cycle|Program Counter and the Instruction Cycle]]

## Sources

- [[03 Quiz Scope and Extra Materials|Quiz Scope and Extra Materials]]
- [[02 Embedded Course Corpus|Embedded Course Corpus]]
