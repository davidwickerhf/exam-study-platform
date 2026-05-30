---
tags:
  - university
  - bcs2410
  - embedded-programming
  - cram-sheet
---

# 01 Foundations and Course Cram Sheet

Course structure, embedded-system motivation, board context, and the core ideas that frame the rest of the course.

## Quick Links

- [[Course Structure, Assessment, and Resources|Course Structure, Assessment, and Resources]]
- [[Discovery Board, Peripherals, and Memory Types|Discovery Board, Peripherals, and Memory Types]]
- [[Embedded Systems and Microcontrollers|Embedded Systems and Microcontrollers]]
- [[Languages, Abstraction, and Why Computers Speak Binary|Languages, Abstraction, and Why Computers Speak Binary]]
- [[Power Management and Resource Constraints|Power Management and Resource Constraints]]

## Core Distinctions

| Concept | Remember |
| --- | --- |
| Embedded system | A specialized computer for a specific task inside a larger product or environment. |
| ROM/Flash vs RAM | Flash stores program code persistently; RAM stores working state during execution. |
| Peripheral | A hardware block outside the CPU core used for input, output, sensing, timing, or communication. |
| Binary vs C/Assembly | Hardware ultimately represents information in binary; higher-level languages are abstractions above it. |

## Fast Recall

- Know that quizzes and homework support learning but do not count toward the final grade in the syllabus you provided.
- Know that the final exam is graded out of 10 and the resit has the same basic role.
- Know how embedded systems differ from standalone general-purpose computers: specialization, hardware coupling, and resource constraints.
- Know common embedded constraints: power, memory, compute, timing, and interface limitations.
- Know that program storage in embedded systems is typically Flash or ROM-like non-volatile memory, not RAM.
- Know that the Discovery board exposes multiple peripheral examples such as LEDs, GPIO, and sensors.
- Know that computers fundamentally operate on binary encodings, not English or source-level C syntax.
- Know that assembly is closer to machine code than C, but is still not the raw electrical form itself.
- Know that embedded programming is shaped by resource constraints, not only by functional correctness.
- Know that power is a first-class embedded design concern in the syllabus and in edge-device discussions.

## Oral Answer Drills

### Embedded Systems and Microcontrollers

- An embedded system is a specialized computer built to perform a specific task under resource constraints such as power, memory, timing, or hardware integration.
- A microcontroller combines CPU, memory, and peripherals on one chip, which is why it is a common platform for embedded programming.
- For the exam, distinguish embedded systems from general-purpose computers by specialization, integration, and tight hardware-software interaction.
